import { createHash } from "node:crypto";
import {
  ALLOWED_LINEAR_PROJECT_ID,
  ALLOWED_LINEAR_PROJECT_NAME,
  isFrameworkDocument,
  isDerivedNavigationTitle,
} from "./sourceOfTruth";
import type {
  LinearCatalog,
  LinearEvidenceSource,
  LinearSourceMetadata,
  LinearStatus,
  SourceKind,
} from "./linearTypes";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

export class LinearUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinearUnavailableError";
  }
}

type FetchLike = typeof fetch;

interface GqlPageInfo {
  hasNextPage?: boolean;
  endCursor?: string | null;
}

interface GqlAttachment {
  id: string;
  title?: string | null;
  url?: string | null;
}

interface GqlIssue {
  id: string;
  identifier?: string;
  title: string;
  description?: string | null;
  url?: string | null;
  labels?: { nodes?: { name: string }[] };
  attachments?: { nodes?: GqlAttachment[]; pageInfo?: GqlPageInfo };
}

interface GqlDocument {
  id: string;
  title: string;
  content?: string | null;
  url?: string | null;
  project?: { id?: string | null; name?: string | null } | null;
}

async function linearGraphql<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
  fetchImpl: FetchLike
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    throw new LinearUnavailableError(
      `Linear GraphQL sieťová chyba: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new LinearUnavailableError("Linear GraphQL HTTP 401/403: Neplatný alebo chýbajúci API kľúč.");
    }
    if (response.status === 429) {
      throw new LinearUnavailableError("Linear GraphQL HTTP 429: Prekročený limit požiadaviek (Rate Limit).");
    }
    throw new LinearUnavailableError(
      `Linear GraphQL HTTP ${response.status}`
    );
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: { message?: string }[];
  };
  if (payload.errors?.length) {
    throw new LinearUnavailableError(
      payload.errors.map((e) => e.message || "GraphQL error").join("; ")
    );
  }
  if (!payload.data) {
    throw new LinearUnavailableError("Linear GraphQL vrátil prázdne data.");
  }
  return payload.data;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function pickMeta(text: string, keys: string[]): string | null {
  for (const key of keys) {
    const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const re = new RegExp(
      `(?:^|\\n)\\s*(?:[-*]\\s*)?\\*?\\*?\\s*(?:${escapedKey})\\s*\\*?\\*?\\s*[:|=]\\s*(.+)`,
      "i"
    );
    const match = text.match(re);
    if (match?.[1]) {
      let value = match[1].trim().replace(/\s+$/, "");
      value = value.replace(/^[`'*_]+|[`'*_]+$/g, "").trim();
      if (value && value.toLowerCase() !== "null" && value !== "-") return value;
    }
  }
  return null;
}

export function parseSourceMetadata(
  text: string,
  labels: string[] = []
): LinearSourceMetadata {
  let personOrEntity =
    pickMeta(text, ["osoba", "subjekt", "person", "entity", "osoba alebo subjekt", "súvisiaci subjekt", "suvisiaci subjekt"]) ||
    labels.find((l) => /^osoba[:/]/i.test(l))?.split(/[:/]/)[1]?.trim() ||
    null;

  if (!personOrEntity) {
    const nameMatch = text.match(/(?:výsluch|výpoveď|vypoved|vysluch)\s+(?:svedka|zadržaného|obvineného|podozrivého|zadrzaneho|obvineneho|podozriveho)?\s*([A-ZÁÉÍÓÚÝŽŠČŤŇ][a-záéíóúýžščťň]+\s+[A-ZÁÉÍÓÚÝŽŠČŤŇ][a-záéíóúýžščťň]+)/i);
    if (nameMatch?.[1]) {
      personOrEntity = nameMatch[1].trim();
    }
  }

  let documentType =
    pickMeta(text, ["typ dokumentu", "typ", "document type", "druh", "druh dokumentu"]) ||
    labels.find((l) =>
      /výpove[dď]|fakt[uú]r|zmluva|licen|protokol|uznesen|obžalob|spis|email|mail/i.test(l)
    ) ||
    null;

  if (!documentType) {
    if (/zápisnica o výsluchu|vysluchu/i.test(text)) documentType = "zápisnica o výsluchu";
    else if (/prepis/i.test(text)) documentType = "prepis";
    else if (/faktúr|faktur/i.test(text)) documentType = "faktúra";
    else if (/zmluv/i.test(text)) documentType = "zmluva";
    else if (/licen/i.test(text)) documentType = "licencia";
    else if (/index/i.test(text)) documentType = "index";
    else if (/časová os|casova os/i.test(text)) documentType = "časová os";
  }

  let documentDate = pickMeta(text, [
    "dátum", "datum", "date", "document date",
    "titulná strana", "titulna strana",
    "prevzatie", "prevzatie osoby",
    "zadržanie", "zadrzanie",
    "výsluch", "vysluch",
    "dátum a čas", "datum a cas"
  ]);

  if (!documentDate) {
    const dateMatch = text.match(/\b(\d{1,2}\.\d{1,2}\.\d{4})\b/);
    if (dateMatch?.[1]) {
      documentDate = dateMatch[1];
    }
  }

  const dateConflict = pickMeta(text, [
    "dátumový rozpor",
    "datumovy rozpor",
    "date conflict",
    "rozpor dátumu",
    "upozornenie na rozpor",
    "upozornenie na rozpor v dátume",
    "upozornenie na rozpor v datume"
  ]);

  const completeness = pickMeta(text, [
    "úplnosť", "uplnost", "completeness", "kompletnosť",
    "rozsah", "rozsah zdroja", "rozsah dodaného materiálu", "rozsah dodaneho materialu",
    "zdrojový pdf", "zdrojove pdf", "zdrojový súbor", "zdrojovy subor"
  ]);

  const hash = pickMeta(text, ["hash", "sha256", "sha-256", "sha-256 pdf", "sha256 pdf"]);

  return {
    personOrEntity,
    documentType,
    documentDate,
    dateConflict,
    completeness,
    hash,
  };
}

export function admissibilityGaps(source: {
  title: string;
  text: string;
  metadata: LinearSourceMetadata;
  hasAttachment: boolean;
}): string[] {
  const missing: string[] = [];
  if (!source.title.trim()) missing.push("názov dôkazu");
  if (!source.metadata.personOrEntity) missing.push("osoba alebo subjekt");
  if (!source.metadata.documentType) missing.push("typ dokumentu");
  if (!source.metadata.documentDate && !source.metadata.dateConflict) {
    missing.push("dátum alebo zaznamenaný dátumový rozpor");
  }
  if (!source.metadata.completeness) missing.push("informácia o úplnosti dokumentu");
  if (!source.hasAttachment && source.text.trim().length < 20) {
    missing.push("príloha alebo čitateľný prepis");
  }
  return missing;
}

function sourceKindFor(title: string, hasAttachment: boolean, isVerified: boolean): SourceKind {
  if (isDerivedNavigationTitle(title)) return "derived_index";
  if (hasAttachment) return "original_attachment";
  if (isVerified) return "verified_transcript";
  return "working_ocr";
}

async function paginateIssues(
  apiKey: string,
  projectId: string,
  fetchImpl: FetchLike
): Promise<{ projectName: string; issues: GqlIssue[] }> {
  const issues: GqlIssue[] = [];
  let cursor: string | null = null;
  let projectName = ALLOWED_LINEAR_PROJECT_NAME;
  let guard = 0;

  const query = `
    query ProjectIssues($id: String!, $after: String) {
      project(id: $id) {
        id
        name
        issues(first: 50, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            identifier
            title
            description
            url
            labels { nodes { name } }
            attachments(first: 50) {
              nodes { id title url }
            }
          }
        }
      }
    }
  `;

  type ProjectPage = {
    project: {
      id: string;
      name: string;
      issues: { pageInfo: GqlPageInfo; nodes: GqlIssue[] };
    } | null;
  };

  while (guard < 40) {
    guard += 1;
    const page: ProjectPage = await linearGraphql<ProjectPage>(
      apiKey,
      query,
      { id: projectId, after: cursor },
      fetchImpl
    );

    if (!page.project) {
      throw new LinearUnavailableError(
        `Linear projekt ${projectId} sa nenašiel alebo nie je prístupný.`
      );
    }
    projectName = page.project.name;
    issues.push(...(page.project.issues.nodes || []));
    if (!page.project.issues.pageInfo?.hasNextPage) break;
    cursor = page.project.issues.pageInfo.endCursor ?? null;
    if (!cursor) break;
  }

  return { projectName, issues };
}

async function paginateDocuments(
  apiKey: string,
  projectId: string,
  fetchImpl: FetchLike
): Promise<GqlDocument[]> {
  const documents: GqlDocument[] = [];
  let cursor: string | null = null;
  let guard = 0;

  const query = `
    query ProjectDocuments($after: String) {
      documents(first: 50, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          title
          content
          url
          project { id name }
        }
      }
    }
  `;

  try {
    while (guard < 20) {
      guard += 1;
      type DocumentsPage = {
        documents: { pageInfo: GqlPageInfo; nodes: GqlDocument[] };
      };
      const page: DocumentsPage = await linearGraphql<DocumentsPage>(
        apiKey,
        query,
        { after: cursor },
        fetchImpl
      );
      const nodes = page.documents?.nodes || [];
      for (const doc of nodes) {
        if (doc.project?.id === projectId) documents.push(doc);
      }
      if (!page.documents?.pageInfo?.hasNextPage) break;
      cursor = page.documents.pageInfo.endCursor ?? null;
      if (!cursor) break;
    }
  } catch {
    // Documents query is optional; issues remain the primary catalog.
  }

  return documents;
}

async function readAttachmentText(
  attachment: GqlAttachment,
  apiKey: string,
  fetchImpl: FetchLike
): Promise<string> {
  if (!attachment.url) return "";
  try {
    const res = await fetchImpl(attachment.url, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return "";
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/") || contentType.includes("json") || contentType.includes("markdown")) {
      return (await res.text()).slice(0, 200_000);
    }
    return "";
  } catch {
    return "";
  }
}

function issueToSources(
  issue: GqlIssue,
  projectId: string
): LinearEvidenceSource[] {
  const labels = (issue.labels?.nodes || []).map((n) => n.name);
  const description = issue.description?.trim() || "";
  const metadata = parseSourceMetadata((issue.title || "") + "\n" + description, labels);
  const attachments = issue.attachments?.nodes || [];
  const verified = /overen|manuálne skontrol|verified transcript/i.test(description);
  const isFramework = isFrameworkDocument(issue.title, issue.url);
  const identifier = issue.identifier || issue.id;

  const sources: LinearEvidenceSource[] = [];

  if (description) {
    const missing = isFramework
      ? ["Dokument 00A nie je dôkazom o skutkovom priebehu."]
      : admissibilityGaps({
          title: issue.title,
          text: description,
          metadata,
          hasAttachment: true,
        });
    sources.push({
      linear_project_id: projectId,
      linear_issue_id: issue.id,
      linear_document_id: null,
      attachment_id: null,
      identifier,
      title: issue.title,
      url: issue.url ?? null,
      source_kind: sourceKindFor(issue.title, false, verified),
      is_framework: isFramework,
      admissible: !isFramework && missing.length === 0,
      missing_fields: missing,
      metadata,
      text: description,
      content_hash: sha256(description),
    });
  }

  for (const attachment of attachments) {
    const title = attachment.title || `${issue.title} (príloha)`;
    const missing = isFramework
      ? ["Dokument 00A nie je dôkazom o skutkovom priebehu."]
      : admissibilityGaps({
          title,
          text: description,
          metadata,
          hasAttachment: true,
        });
    sources.push({
      linear_project_id: projectId,
      linear_issue_id: issue.id,
      linear_document_id: null,
      attachment_id: attachment.id,
      identifier: `${identifier}:${attachment.id}`,
      title,
      url: attachment.url ?? null,
      source_kind: sourceKindFor(title, true, verified),
      is_framework: isFramework,
      admissible: !isFramework && missing.length === 0,
      missing_fields: missing,
      metadata,
      text: "",
      content_hash: metadata.hash,
    });
  }

  if (sources.length === 0) {
    const missing = admissibilityGaps({
      title: issue.title,
      text: "",
      metadata,
      hasAttachment: false,
    });
    sources.push({
      linear_project_id: projectId,
      linear_issue_id: issue.id,
      linear_document_id: null,
      attachment_id: null,
      identifier,
      title: issue.title,
      url: issue.url ?? null,
      source_kind: sourceKindFor(issue.title, false, false),
      is_framework: isFramework,
      admissible: false,
      missing_fields: missing,
      metadata,
      text: "",
      content_hash: null,
    });
  }

  return sources;
}

export function resolveLinearApiKey(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const key = env.LINEAR_API_KEY || env.LINEAR_API_TOKEN || "";
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveLinearProjectId(
  env: NodeJS.ProcessEnv = process.env
): string {
  const fromEnv = env.LINEAR_PROJECT_ID?.trim();
  return fromEnv || ALLOWED_LINEAR_PROJECT_ID;
}

export async function loadLinearCatalog(opts: {
  apiKey: string;
  projectId?: string;
  fetchImpl?: FetchLike;
}): Promise<LinearCatalog> {
  const projectId = opts.projectId || ALLOWED_LINEAR_PROJECT_ID;
  if (projectId !== ALLOWED_LINEAR_PROJECT_ID) {
    throw new LinearUnavailableError(
      `Povolený je iba Linear project ID ${ALLOWED_LINEAR_PROJECT_ID}.`
    );
  }
  const fetchImpl = opts.fetchImpl || fetch;
  const { projectName, issues } = await paginateIssues(
    opts.apiKey,
    projectId,
    fetchImpl
  );
  const documents = await paginateDocuments(opts.apiKey, projectId, fetchImpl);

  const sources: LinearEvidenceSource[] = [];
  const seenKeys = new Set<string>();

  for (const issue of issues) {
    const issueSources = issueToSources(issue, projectId);
    for (const source of issueSources) {
      const dedupeKey = source.attachment_id || source.linear_issue_id || source.identifier;
      if (dedupeKey && seenKeys.has(dedupeKey)) continue;
      if (dedupeKey) seenKeys.add(dedupeKey);

      if (source.attachment_id && source.url && !source.text) {
        const att = (issue.attachments?.nodes || []).find(
          (a) => a.id === source.attachment_id
        );
        if (att) {
          const text = await readAttachmentText(att, opts.apiKey, fetchImpl);
          if (text) {
            source.text = text;
            source.content_hash = sha256(text);
          }
        }
      }
      sources.push(source);
    }
  }

  for (const doc of documents) {
    const dedupeKey = doc.id;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const isFramework = isFrameworkDocument(doc.title, doc.url);
    const text = doc.content?.trim() || "";
    const metadata = parseSourceMetadata((doc.title || "") + "\n" + text);
    const missing = isFramework
      ? ["Dokument 00A nie je dôkazom o skutkovom priebehu."]
      : admissibilityGaps({
          title: doc.title,
          text,
          metadata,
          hasAttachment: text.length > 20,
        });
    sources.push({
      linear_project_id: projectId,
      linear_issue_id: null,
      linear_document_id: doc.id,
      attachment_id: null,
      identifier: doc.id,
      title: doc.title,
      url: doc.url ?? null,
      source_kind: sourceKindFor(doc.title, false, /overen/i.test(text)),
      is_framework: isFramework,
      admissible: !isFramework && missing.length === 0,
      missing_fields: missing,
      metadata,
      text,
      content_hash: text ? sha256(text) : metadata.hash,
    });
  }

  return {
    project_id: projectId,
    project_name: projectName,
    loaded_at: new Date().toISOString(),
    sources,
  };
}

export async function getLinearStatus(opts: {
  apiKey: string | null;
  projectId?: string;
  fetchImpl?: FetchLike;
}): Promise<LinearStatus> {
  const projectId = opts.projectId || ALLOWED_LINEAR_PROJECT_ID;
  if (!opts.apiKey) {
    return {
      configured: false,
      reachable: false,
      project_id: projectId,
      project_name: null,
      issue_count: null,
      document_count: null,
      admissible_count: null,
      error: "Chýba LINEAR_API_KEY na serveri.",
    };
  }
  try {
    const catalog = await loadLinearCatalog({
      apiKey: opts.apiKey,
      projectId,
      fetchImpl: opts.fetchImpl,
    });
    return {
      configured: true,
      reachable: true,
      project_id: catalog.project_id,
      project_name: catalog.project_name,
      issue_count: catalog.sources.filter((s) => s.linear_issue_id).length,
      document_count: catalog.sources.filter((s) => s.linear_document_id).length,
      admissible_count: catalog.sources.filter((s) => s.admissible).length,
      error: null,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      project_id: projectId,
      project_name: null,
      issue_count: null,
      document_count: null,
      admissible_count: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
