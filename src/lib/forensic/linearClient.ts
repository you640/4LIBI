import { createHash } from "node:crypto";
import { extractTextFromBytes } from "../extractDocumentText";
import { extractTextFromPdf } from "../pdfParser";
import {
  ALLOWED_LINEAR_PROJECT_ID,
  ALLOWED_LINEAR_PROJECT_NAME,
  isFrameworkDocument,
  isNonAdmissibleDerived,
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

const SLASH_YEAR_RE = /\b(\d{1,2}\.\d{1,2}\.)(\d{4})\s*\/\s*(\d{2,4})\b/;

function expandYear(baseYear: string, fragment: string): string {
  if (fragment.length === 4) return fragment;
  if (fragment.length === 2) return `${baseYear.slice(0, 2)}${fragment}`;
  return fragment;
}

/** 12.01.2026/2025 stays a conflict — never collapsed to a single year. */
export function detectDateConflict(
  text: string,
  pickedDate?: string | null,
  pickedConflict?: string | null
): { documentDate: string | null; dateConflict: string | null } {
  if (pickedConflict && pickedConflict.trim()) {
    const raw = pickedConflict.trim();
    const slash = raw.match(SLASH_YEAR_RE);
    if (slash) {
      const yearA = slash[2];
      const yearB = expandYear(yearA, slash[3]);
      return { documentDate: null, dateConflict: `${slash[1]}${yearA}/${yearB}` };
    }
    return { documentDate: pickedDate ?? null, dateConflict: raw };
  }

  const slash = (pickedDate || "").match(SLASH_YEAR_RE) || text.match(SLASH_YEAR_RE);
  if (slash) {
    const yearA = slash[2];
    const yearB = expandYear(yearA, slash[3]);
    if (yearA !== yearB) {
      return {
        documentDate: null,
        dateConflict: `${slash[1]}${yearA}/${yearB}`,
      };
    }
  }

  const rozporMatch = text.match(/upozornenie\s+na\s+rozpor[^\n.]*[:.]\s*([^\n]+)/i);
  if (rozporMatch?.[1]) {
    return {
      documentDate: pickedDate ?? null,
      dateConflict: rozporMatch[1].trim(),
    };
  }

  const dateMatches = [...text.matchAll(/\b(\d{1,2}\.\d{1,2}\.)(\d{4})\b/g)];
  const uniqueDates = Array.from(new Set(dateMatches.map((m) => `${m[1]}${m[2]}`)));
  const uniqueYears = Array.from(new Set(dateMatches.map((m) => m[2])));
  if (uniqueYears.length > 1 && /rozpor|tituln|hlavičk|hlavick|prevzatie|výsluch|vysluch/i.test(text)) {
    return {
      documentDate: null,
      dateConflict: uniqueDates.slice(0, 2).join(" vs "),
    };
  }

  if (pickedDate && !SLASH_YEAR_RE.test(pickedDate)) {
    return { documentDate: pickedDate, dateConflict: null };
  }
  if (uniqueDates.length === 1) return { documentDate: uniqueDates[0], dateConflict: null };
  return { documentDate: pickedDate ?? null, dateConflict: null };
}

export function isTranscriptAttachment(
  title: string,
  mime?: string | null,
  filename?: string | null
): boolean {
  const blob = `${title} ${filename || ""} ${mime || ""}`.toLowerCase();
  if (/textov[ýy]\s+prepis|\bprepis\b|transcript|pracovn[ýy]\s+prepis|overen[ýy]\s+prepis/i.test(blob)) {
    return true;
  }
  const name = (filename || title || "").toLowerCase();
  const mimeL = (mime || "").toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md") || mimeL.includes("text/plain") || mimeL.includes("text/markdown")) {
    return true;
  }
  return false;
}

export function classifySourceKind(input: {
  title: string;
  documentType?: string | null;
  url?: string | null;
  isAttachment?: boolean;
  filename?: string | null;
  mime?: string | null;
  body?: string | null;
}): SourceKind {
  const title = input.title || "";
  const filename = input.filename || title;
  const nameBlob = `${title} ${filename} ${input.mime || ""}`;
  if (isNonAdmissibleDerived(title, input.documentType, input.url)) {
    return "derived_index";
  }
  if (input.isAttachment) {
    if (isTranscriptAttachment(title, input.mime, filename)) {
      if (/ocr|pracovn[ýy]\s+ocr/i.test(nameBlob)) return "working_ocr";
      return "verified_transcript";
    }
    if (/ocr|pracovn[ýy]\s+ocr/i.test(nameBlob)) return "working_ocr";
    return "original_attachment";
  }
  const bodyBlob = `${nameBlob} ${input.body || ""}`;
  if (isTranscriptAttachment(title, input.mime, filename) || /textov[ýy]\s+prepis|\bprepis\b/i.test(bodyBlob)) {
    if (/ocr|pracovn[ýy]\s+ocr/i.test(bodyBlob)) return "working_ocr";
    return "verified_transcript";
  }
  if (/ocr|pracovn[ýy]\s+ocr/i.test(bodyBlob)) return "working_ocr";
  if (/overen|verified transcript/i.test(bodyBlob)) return "verified_transcript";
  return "working_ocr";
}

function normalizePersonName(name: string): string {
  const trimmed = name.trim();
  if (/^Mareka Plcha$/i.test(trimmed)) return "Marek Plch";
  if (/^Jána Nováka$/i.test(trimmed)) return "Ján Novák";
  if (/^Michala Šveca$/i.test(trimmed)) return "Michal Švec";
  if (/^Petra Kováča$/i.test(trimmed)) return "Peter Kováč";
  if (/^Tomáša Dvořáka$/i.test(trimmed)) return "Tomáš Dvořák";
  if (/^Pavla Horvátha$/i.test(trimmed)) return "Pavol Horváth";
  if (/^Martina Bednára$/i.test(trimmed)) return "Martin Bednár";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 2) {
    let [first, last] = parts;
    if (first.endsWith("a") && !["Andrea", "Eva", "Anna", "Zuzana", "Mária", "Maria", "Elena", "Lucia", "Jana"].includes(first)) {
      first = first.slice(0, -1);
    }
    if (last.endsWith("a") && !["Veselá", "Nová", "Čierna", "Kováčová", "Horváthová"].includes(last)) {
      last = last.slice(0, -1);
    }
    return `${first} ${last}`;
  }
  return trimmed;
}

export function canonicalSourceGroupId(input: {
  title: string;
  issueId?: string | null;
  documentId?: string | null;
  person?: string | null;
}): string {
  const t = input.title.toLowerCase();
  const dokazMatch = t.match(/(?:dôkaz|dokaz|\b)\s*0?([0-9]{1,2})\b/i);
  if (dokazMatch?.[1]) {
    return `evidence-${dokazMatch[1].padStart(2, "0")}`;
  }
  if (input.issueId) return input.issueId;
  if (input.documentId) return input.documentId;
  const person =
    input.person ||
    input.title.match(/[-–—]\s*([A-ZÁÉÍÓÚÝŽŠČŤŇ][a-záéíóúýžščťň]+\s+[A-ZÁÉÍÓÚÝŽŠČŤŇ][a-záéíóúýžščťň]+)/i)?.[1] ||
    null;
  if (person) {
    const normalized = normalizePersonName(person);
    const slug = normalized.toLowerCase().replace(/[^a-záéíóúýžščťň0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (slug.length >= 3) return `person-${slug}`;
  }
  return "unknown";
}

export function sourceGroupId(
  issueId: string | null,
  documentId: string | null,
  title = "",
  person: string | null = null
): string {
  return canonicalSourceGroupId({ title, issueId, documentId, person });
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
      personOrEntity = normalizePersonName(nameMatch[1].trim());
    }
  } else {
    personOrEntity = normalizePersonName(personOrEntity);
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

  const pickedDate = pickMeta(text, [
    "dátum", "datum", "date", "document date",
    "titulná strana", "titulna strana",
    "prevzatie", "prevzatie osoby",
    "zadržanie", "zadrzanie",
    "výsluch", "vysluch",
    "dátum a čas", "datum a cas"
  ]);

  const pickedConflict = pickMeta(text, [
    "dátumový rozpor",
    "datumovy rozpor",
    "date conflict",
    "rozpor dátumu",
    "upozornenie na rozpor",
    "upozornenie na rozpor v dátume",
    "upozornenie na rozpor v datume"
  ]);

  const { documentDate, dateConflict } = detectDateConflict(
    text,
    pickedDate,
    pickedConflict
  );

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

function isAdmissibleSource(source: {
  title: string;
  is_framework: boolean;
  source_kind: SourceKind;
  metadata: LinearSourceMetadata;
  missing_fields: string[];
}): boolean {
  if (source.is_framework) return false;
  if (source.source_kind === "derived_index") return false;
  if (isNonAdmissibleDerived(source.title, source.metadata.documentType)) return false;
  return source.missing_fields.length === 0;
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

function guessMime(title: string, contentType: string): string {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  if (ct && ct !== "application/octet-stream") return ct;
  const name = title.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".txt") || name.endsWith(".md")) return "text/plain";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".tif") || name.endsWith(".tiff")) return "image/tiff";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
  return ct || "application/octet-stream";
}

async function decodeAttachmentBytes(
  bytes: ArrayBuffer,
  mime: string,
  filename: string,
  ocrApiKey: string | null
): Promise<string> {
  const mimeL = mime.toLowerCase();
  if (
    mimeL.includes("text/") ||
    mimeL.includes("json") ||
    mimeL.includes("markdown")
  ) {
    return new TextDecoder("utf-8").decode(bytes).trim().slice(0, 200_000);
  }
  if (mimeL.includes("pdf") || filename.toLowerCase().endsWith(".pdf")) {
    try {
      const text = (await extractTextFromPdf(bytes.slice(0))).trim();
      if (text.length >= 10) return text.slice(0, 200_000);
    } catch {
      /* OCR fallback below */
    }
  }
  if (ocrApiKey) {
    try {
      return (
        await extractTextFromBytes(
          bytes,
          { name: filename, mime },
          ocrApiKey
        )
      ).trim().slice(0, 200_000);
    } catch {
      /* fall through to utf8 heuristic */
    }
  }
  const sample = new Uint8Array(bytes).slice(0, 256);
  if (sample.length > 0) {
    let printable = 0;
    for (const b of sample) {
      if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || (b >= 160 && b <= 255)) printable += 1;
    }
    if (printable / sample.length > 0.8) {
      try {
        return new TextDecoder("utf-8").decode(bytes).trim().slice(0, 200_000);
      } catch {
        /* invalid utf-8 fallback */
      }
    }
  }
  return "";
}

export async function readAttachmentContent(
  attachment: GqlAttachment,
  apiKey: string,
  fetchImpl: FetchLike,
  ocrApiKey: string | null = null
): Promise<{ text: string; bytes: ArrayBuffer; mime: string }> {
  const empty = { text: "", bytes: new ArrayBuffer(0), mime: "" };
  if (!attachment.url) return empty;
  try {
    let res = await fetchImpl(attachment.url, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok && res.status >= 400 && res.status < 500) {
      // S3 / presigned GCS URLs might reject Authorization header with 400/403
      res = await fetchImpl(attachment.url);
    }
    if (!res.ok) return empty;
    const mime = guessMime(
      attachment.title || "",
      res.headers.get("content-type") || ""
    );
    const bytes = await res.arrayBuffer();
    const text = await decodeAttachmentBytes(
      bytes,
      mime,
      attachment.title || "attachment",
      ocrApiKey
    );
    return { text, bytes, mime };
  } catch {
    return empty;
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
  const isFramework = isFrameworkDocument(issue.title, issue.url);
  const identifier = issue.identifier || issue.id;
  const groupId = canonicalSourceGroupId({
    title: issue.title,
    issueId: issue.id,
    person: metadata.personOrEntity,
  });

  const sources: LinearEvidenceSource[] = [];

  if (description) {
    const source_kind = classifySourceKind({
      title: issue.title,
      documentType: metadata.documentType,
      url: issue.url,
      isAttachment: false,
      body: description,
    });
    const missing = isFramework
      ? ["Dokument 00A nie je dôkazom o skutkovom priebehu."]
      : source_kind === "derived_index"
        ? ["Odvodený register, časová os alebo AI súhrn nie je skutkový dôkaz."]
        : admissibilityGaps({
            title: issue.title,
            text: description,
            metadata,
            hasAttachment: attachments.length > 0 || description.length >= 20,
          });
    const source: LinearEvidenceSource = {
      linear_project_id: projectId,
      linear_issue_id: issue.id,
      linear_document_id: null,
      attachment_id: null,
      source_group_id: groupId,
      identifier,
      title: issue.title,
      url: issue.url ?? null,
      source_kind,
      is_framework: isFramework,
      admissible: false,
      missing_fields: missing,
      metadata,
      text: description,
      content_hash: sha256(description),
      mime: "text/markdown",
    };
    source.admissible = isAdmissibleSource(source);
    sources.push(source);
  }

  for (const attachment of attachments) {
    const title = attachment.title || `${issue.title} (príloha)`;
    const source_kind = classifySourceKind({
      title,
      documentType: metadata.documentType,
      url: issue.url,
      isAttachment: true,
      filename: attachment.title,
      body: description,
    });
    const missing = isFramework
      ? ["Dokument 00A nie je dôkazom o skutkovom priebehu."]
      : source_kind === "derived_index"
        ? ["Odvodený register, časová os alebo AI súhrn nie je skutkový dôkaz."]
        : admissibilityGaps({
            title,
            text: description,
            metadata,
            hasAttachment: true,
          });
    const source: LinearEvidenceSource = {
      linear_project_id: projectId,
      linear_issue_id: issue.id,
      linear_document_id: null,
      attachment_id: attachment.id,
      source_group_id: groupId,
      identifier: `${identifier}:${attachment.id}`,
      title,
      url: attachment.url ?? null,
      source_kind,
      is_framework: isFramework,
      admissible: false,
      missing_fields: missing,
      metadata,
      text: "",
      content_hash: metadata.hash,
      mime: null,
    };
    source.admissible = isAdmissibleSource(source);
    sources.push(source);
  }

  if (sources.length === 0) {
    const missing = admissibilityGaps({
      title: issue.title,
      text: "",
      metadata,
      hasAttachment: false,
    });
    const source: LinearEvidenceSource = {
      linear_project_id: projectId,
      linear_issue_id: issue.id,
      linear_document_id: null,
      attachment_id: null,
      source_group_id: groupId,
      identifier,
      title: issue.title,
      url: issue.url ?? null,
      source_kind: classifySourceKind({
        title: issue.title,
        documentType: metadata.documentType,
        url: issue.url,
      }),
      is_framework: isFramework,
      admissible: false,
      missing_fields: missing,
      metadata,
      text: "",
      content_hash: null,
      mime: null,
    };
    sources.push(source);
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
  ocrApiKey?: string | null;
}): Promise<LinearCatalog> {
  const projectId = opts.projectId || ALLOWED_LINEAR_PROJECT_ID;
  if (projectId !== ALLOWED_LINEAR_PROJECT_ID) {
    throw new LinearUnavailableError(
      `Povolený je iba Linear project ID ${ALLOWED_LINEAR_PROJECT_ID}.`
    );
  }
  const fetchImpl = opts.fetchImpl || fetch;
  const ocrApiKey =
    opts.ocrApiKey !== undefined
      ? opts.ocrApiKey
      : process.env.MISTRAL_API_KEY || null;
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
      const dedupeKey = `${source.linear_issue_id || ""}:${source.attachment_id || "body"}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      if (source.attachment_id && source.url && !source.text) {
        const att = (issue.attachments?.nodes || []).find(
          (a) => a.id === source.attachment_id
        );
        if (att) {
          const downloaded = await readAttachmentContent(
            att,
            opts.apiKey,
            fetchImpl,
            ocrApiKey
          );
          if (downloaded.bytes.byteLength > 0) {
            source.bytes = downloaded.bytes;
            source.mime = downloaded.mime || source.mime;
          }
          if (downloaded.text) {
            source.text = downloaded.text;
            source.content_hash = sha256(downloaded.text);
            source.source_kind = classifySourceKind({
              title: source.title,
              documentType: source.metadata.documentType,
              url: source.url,
              isAttachment: true,
              filename: att.title,
              mime: downloaded.mime,
              body: downloaded.text,
            });
            const attMeta = parseSourceMetadata(`${source.title}\n${downloaded.text.slice(0, 5000)}`);
            source.metadata = {
              personOrEntity: source.metadata.personOrEntity || attMeta.personOrEntity,
              documentType: source.metadata.documentType || attMeta.documentType,
              documentDate: source.metadata.documentDate || attMeta.documentDate,
              dateConflict: source.metadata.dateConflict || attMeta.dateConflict,
              completeness: source.metadata.completeness || attMeta.completeness,
              hash: source.metadata.hash || attMeta.hash,
            };
            source.missing_fields = isFrameworkDocument(source.title, source.url)
              ? ["Dokument 00A nie je dôkazom o skutkovom priebehu."]
              : source.source_kind === "derived_index"
                ? ["Odvodený register, časová os alebo AI súhrn nie je skutkový dôkaz."]
                : admissibilityGaps({
                    title: source.title,
                    text: source.text,
                    metadata: source.metadata,
                    hasAttachment: true,
                  });
            source.admissible = isAdmissibleSource(source);
          }
        }
      }
      sources.push(source);
    }
  }

  for (const doc of documents) {
    const dedupeKey = `doc:${doc.id}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const isFramework = isFrameworkDocument(doc.title, doc.url);
    const text = doc.content?.trim() || "";
    const metadata = parseSourceMetadata((doc.title || "") + "\n" + text);
    const source_kind = classifySourceKind({
      title: doc.title,
      documentType: metadata.documentType,
      url: doc.url,
      body: text,
    });
    const missing = isFramework
      ? ["Dokument 00A nie je dôkazom o skutkovom priebehu."]
      : source_kind === "derived_index"
        ? ["Odvodený register, časová os alebo AI súhrn nie je skutkový dôkaz."]
        : admissibilityGaps({
            title: doc.title,
            text,
            metadata,
            hasAttachment: text.length > 20,
          });
    const groupId = canonicalSourceGroupId({
      title: doc.title,
      documentId: doc.id,
      person: metadata.personOrEntity,
    });
    const source: LinearEvidenceSource = {
      linear_project_id: projectId,
      linear_issue_id: null,
      linear_document_id: doc.id,
      attachment_id: null,
      source_group_id: groupId,
      identifier: doc.id,
      title: doc.title,
      url: doc.url ?? null,
      source_kind,
      is_framework: isFramework,
      admissible: false,
      missing_fields: missing,
      metadata,
      text,
      content_hash: text ? sha256(text) : metadata.hash,
      mime: "text/markdown",
    };
    source.admissible = isAdmissibleSource(source);
    sources.push(source);
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
      ocrApiKey: null,
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
