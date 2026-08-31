import { useMemo, useState, type ReactNode } from "react";
import { useCaseContext } from "../../lib/caseContext";
import { BottomSheet } from "../m3/BottomSheet";
import {
  answerPresentation,
  evidenceTypeClass,
  EVIDENCE_TYPE_LABEL,
  WEAPONS_ROLE_LABEL,
} from "../../lib/forensic/presentation";
import type {
  ForensicDocumentAnalysis,
  ForensicEvidence,
  ForensicEvidenceType,
} from "../../lib/forensic/types";

type Citation = ForensicEvidence & { actorName?: string };

export function OtazkyTab() {
  const { analysis } = useCaseContext();
  const forensic = analysis.forensic;
  const [citation, setCitation] = useState<Citation | null>(null);

  if (!forensic) {
    return (
      <div className="m3-card-outlined text-center py-10" data-testid="otazky-empty">
        <p className="text-sm font-medium text-surface-on mb-1">
          Forenzná analýza troch otázok chýba
        </p>
        <p className="text-xs text-outline">
          Tento spis vznikol pred forenzným režimom alebo analýza ešte neprebehla.
        </p>
      </div>
    );
  }

  if (forensic.status === "linear_unavailable") {
    return (
      <div className="m3-card-outlined border-error py-6" data-testid="otazky-linear-unavailable">
        <p className="text-sm font-semibold text-error mb-2">
          Analýza zastavená — Linear nie je dostupný
        </p>
        <p className="text-xs text-outline mb-3">
          Jediný povolený dôkazný repozitár sa nepodarilo načítať. Odpovede na tri
          otázky sa nedoplňajú z modelu ani z nahratých súborov mimo Linear projektu.
        </p>
        <ul className="text-xs text-error space-y-1">
          {(forensic.diagnostics?.validation_errors || []).map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (forensic.status === "failed" || !forensic.case_level) {
    return (
      <div className="m3-card-outlined border-error py-6" data-testid="otazky-failed">
        <p className="text-sm font-semibold text-error mb-2">
          Forenzná analýza zlyhala
        </p>
        <p className="text-xs text-outline mb-3">
          Model nevrátil validný JSON podľa schémy. Diagnostika je uložená, tvrdenia sa
          neprezentujú ako fakty.
        </p>
        {forensic.diagnostics?.validation_errors?.length ? (
          <ul className="text-xs text-error space-y-1">
            {forensic.diagnostics.validation_errors.slice(0, 6).map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const result = forensic.case_level;

  return (
    <div className="space-y-4 pb-8" data-testid="otazky-tab">
      {forensic.status === "partial" && (
        <div className="m3-card-outlined border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Časť dokumentov sa nepodarilo analyzovať. Agregácia je len z úspešných
          dokumentov.
        </div>
      )}

      <p className="text-[11px] text-outline">
        Prompt {forensic.prompt_version} · {forensic.model} ·{" "}
        {new Date(forensic.analyzed_at).toLocaleString("sk-SK")}
      </p>

      <QuestionCard
        testId="question-weapons"
        title="1. Tok zbraní"
        question="Kto zbrane objednával, nakupoval, platil, fyzicky preberal a následne predával alebo odovzdával?"
        answer={
          result.questions.weapons_flow.confirmed_answer ??
          result.questions.weapons_flow.answer
        }
        evidence={result.questions.weapons_flow.actors.flatMap((a) => a.evidence)}
        missing={[
          ...(result.questions.weapons_flow.missing_confirmation || []),
          ...result.questions.weapons_flow.missing_evidence,
        ]}
        candidates={result.questions.weapons_flow.best_supported_candidates}
        onCite={setCitation}
      >
        {result.questions.weapons_flow.actors.map((actor) => (
          <ActorRow
            key={`${actor.entity_id || actor.name}-${actor.role}`}
            name={actor.name}
            entity={actor.entity}
            entityId={actor.entity_id}
            role={actor.role}
            confidence={actor.confidence}
            inferred={actor.inferred}
            evidence={actor.evidence}
            onCite={setCitation}
          />
        ))}
      </QuestionCard>

      <QuestionCard
        testId="question-plan"
        title="2. Autor a riadenie plánu"
        question="Kto celý plán navrhol, riadil alebo koordinoval?"
        answer={
          result.questions.plan_author.confirmed_answer ??
          result.questions.plan_author.answer
        }
        evidence={[
          ...result.questions.plan_author.evidence,
          ...result.questions.plan_author.candidates.flatMap((c) => c.evidence),
        ]}
        missing={[
          ...(result.questions.plan_author.missing_confirmation || []),
          ...result.questions.plan_author.missing_evidence,
        ]}
        alternatives={result.questions.plan_author.alternative_explanations}
        candidates={result.questions.plan_author.best_supported_candidates}
        onCite={setCitation}
      >
        {result.questions.plan_author.candidates.map((c) => (
          <ActorRow
            key={`${c.entity_id || c.name}-${c.role}`}
            name={c.name}
            entity={c.entity}
            entityId={c.entity_id}
            role={c.role}
            confidence={c.confidence}
            inferred={c.inferred}
            evidence={c.evidence}
            onCite={setCitation}
          />
        ))}
      </QuestionCard>

      <QuestionCard
        testId="question-financing"
        title="3. Financovanie"
        question="Kto poskytoval finančné prostriedky a celý plán financoval?"
        answer={
          result.questions.financing.confirmed_answer ??
          result.questions.financing.answer
        }
        evidence={[
          ...result.questions.financing.evidence,
          ...result.questions.financing.payers.flatMap((p) => p.evidence),
          ...result.questions.financing.funding_sources.flatMap((s) => s.evidence),
        ]}
        missing={[
          ...(result.questions.financing.missing_confirmation || []),
          ...result.questions.financing.missing_evidence,
        ]}
        candidates={result.questions.financing.best_supported_candidates}
        onCite={setCitation}
      >
        {result.questions.financing.payers.map((p) => (
          <ActorRow
            key={`payer-${p.entity_id || p.name}-${p.role}`}
            name={p.name}
            entity={p.entity}
            entityId={p.entity_id}
            role={p.role}
            confidence={p.confidence}
            inferred={p.inferred}
            evidence={p.evidence}
            onCite={setCitation}
          />
        ))}
        {result.questions.financing.funding_sources.map((s) => (
          <ActorRow
            key={`fund-${s.name}`}
            name={s.name}
            entity={s.entity}
            role="funding_source"
            confidence={s.confidence}
            inferred={false}
            evidence={s.evidence}
            note={
              s.distinct_from_invoice_payer
                ? "Odlišné od platiteľa faktúry"
                : undefined
            }
            onCite={setCitation}
          />
        ))}
      </QuestionCard>

      {(result.transaction_edges?.length ?? 0) > 0 && (
        <section className="m3-card-outlined" data-testid="transaction-edges">
          <h3 className="text-sm font-semibold text-surface-on mb-2">
            Transakčné hrany
          </h3>
          <ul className="space-y-1">
            {result.transaction_edges!.map((edge) => (
              <li
                key={edge.edge_id}
                className="text-xs text-surface-on"
                data-testid="transaction-edge"
                data-role={edge.role}
              >
                {edge.from_entity_id} → {edge.to_entity_id} · {edge.role}
                {edge.instrument ? ` · ${edge.instrument}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.contradictions.length > 0 && (
        <section className="m3-card-outlined border-error" data-testid="otazky-contradictions">
          <h3 className="text-sm font-semibold text-error mb-2">Rozpory</h3>
          <ul className="space-y-2">
            {result.contradictions.map((c, i) => (
              <li key={`${c.field}-${i}`} className="text-xs text-surface-on">
                <span className="font-medium">{c.field}:</span> {c.value_a} vs{" "}
                {c.value_b}
                <span className="block text-outline mt-0.5">{c.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <MetaStrip result={result} documents={forensic.documents.length} />

      <BottomSheet
        open={Boolean(citation)}
        onClose={() => setCitation(null)}
        title="Citácia dôkazu"
      >
        {citation && (
          <div className="space-y-2 text-sm" data-testid="citation-sheet">
            <p className="text-xs text-outline">
              {citation.document_id}
              {citation.page != null ? ` · strana ${citation.page}` : ""}
            </p>
            <p className="text-[11px] text-outline break-all">
              project {citation.linear_project_id || "—"}
              {citation.linear_issue_id ? ` · issue ${citation.linear_issue_id}` : ""}
              {citation.linear_document_id ? ` · document ${citation.linear_document_id}` : ""}
              {citation.attachment_id ? ` · attachment ${citation.attachment_id}` : ""}
            </p>
            <EvidenceBadge type={citation.evidence_type} />
            <blockquote className="text-sm italic text-surface-on border-l-2 border-outline-variant pl-3">
              {citation.quote}
            </blockquote>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function QuestionCard({
  testId,
  title,
  question,
  answer,
  evidence,
  missing,
  alternatives,
  candidates,
  children,
  onCite,
}: {
  testId: string;
  title: string;
  question: string;
  answer: string | null;
  evidence: ForensicEvidence[];
  missing: string[];
  alternatives?: string[];
  candidates?: Array<{
    name: string;
    role?: string;
    entity_id?: string;
    entity_kind?: string;
    confidence?: number;
    evidence?: ForensicEvidence[];
  }>;
  children: ReactNode;
  onCite: (c: Citation) => void;
}) {
  const presentation = useMemo(
    () => answerPresentation({ answer, evidence }),
    [answer, evidence]
  );

  return (
    <section className="m3-card-outlined space-y-3" data-testid={testId}>
      <div>
        <h2 className="text-sm font-semibold text-surface-on">{title}</h2>
        <p className="text-xs text-outline mt-1">{question}</p>
      </div>

      {presentation.answer ? (
        <p
          className={`text-sm ${
            presentation.asFact
              ? "font-semibold text-surface-on"
              : "italic text-outline"
          }`}
          data-testid={`${testId}-answer`}
          data-as-fact={presentation.asFact ? "true" : "false"}
        >
          {presentation.answer}
        </p>
      ) : (
        <p
          className="text-sm text-outline"
          data-testid={`${testId}-answer`}
          data-as-fact="false"
        >
          Odpoveď nie je doložená.
        </p>
      )}

      {presentation.caveat && (
        <p
          className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1"
          data-testid={`${testId}-caveat`}
        >
          {presentation.caveat}
        </p>
      )}

      <div className="space-y-2">{children}</div>

      {candidates && candidates.length > 0 && (
        <div data-testid={`${testId}-candidates`} className="space-y-2 mt-2">
          <h3 className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold mb-1">
            Najlepšie podložení kandidáti (nepotvrdené)
          </h3>
          <div className="space-y-2">
            {candidates.map((c) => {
              const mainEv = c.evidence?.[0];
              const evType = mainEv?.evidence_type;
              return (
                <div
                  key={`${c.entity_id || c.name}-${c.role || "cand"}`}
                  className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-2.5 space-y-1.5"
                  data-testid="candidate-card"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-surface-on">
                      {c.name}
                      {c.role ? <span className="text-outline font-normal"> · {c.role}</span> : null}
                    </span>
                    <span className="text-[11px] font-mono text-outline">
                      {Math.round((c.confidence ?? 0) * 100)} %
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {c.entity_id && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-variant text-surface-on">
                        {c.entity_id}
                      </span>
                    )}
                    {evType && <EvidenceBadge type={evType} />}
                  </div>
                  {c.evidence && c.evidence.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {c.evidence.slice(0, 2).map((ev, idx) => (
                        <div
                          key={idx}
                          className="text-[11px] text-surface-on/80 border-l-2 border-amber-400 pl-2 cursor-pointer hover:bg-amber-100/50"
                          onClick={() => onCite({ ...ev, actorName: c.name })}
                        >
                          <p className="italic">„{ev.quote}“</p>
                          <p className="text-[10px] text-outline mt-0.5">
                            {ev.linear_issue_id ? `Linear: ${ev.linear_issue_id}` : ev.document_id}
                            {ev.page != null ? ` · s. ${ev.page}` : ""}
                            {ev.source_group_id ? ` · group: ${ev.source_group_id}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div data-testid={`${testId}-missing`}>
          <h3 className="text-[11px] uppercase tracking-wide text-outline mb-1">
            Chýbajúce dôkazy / missing_confirmation
          </h3>
          <ul className="text-xs text-outline list-disc pl-4 space-y-0.5">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {alternatives && alternatives.length > 0 && (
        <div>
          <h3 className="text-[11px] uppercase tracking-wide text-outline mb-1">
            Alternatívne vysvetlenia
          </h3>
          <ul className="text-xs text-outline list-disc pl-4">
            {alternatives.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {evidence.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {evidence.slice(0, 6).map((ev, i) => (
            <CitationChip key={`${ev.document_id}-${i}`} evidence={ev} onCite={onCite} />
          ))}
        </div>
      )}
    </section>
  );
}

function ActorRow({
  name,
  entity,
  entityId,
  role,
  confidence,
  inferred,
  evidence,
  note,
  onCite,
}: {
  name: string;
  entity: string | null;
  entityId?: string;
  role: string;
  confidence: number;
  inferred: boolean;
  evidence: ForensicEvidence[];
  note?: string;
  onCite: (c: Citation) => void;
}) {
  const type = evidence[0]?.evidence_type;
  const asFact = !inferred && type !== "inference" && type !== "hypothesis" && type !== "testimony";

  return (
    <div
      className="rounded-xl border border-outline-variant bg-surface-low p-3 space-y-2"
      data-testid="forensic-actor"
      data-role={role}
      data-entity-id={entityId || ""}
      data-as-fact={asFact ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-sm ${asFact ? "font-semibold" : "italic font-medium"} text-surface-on`}>
            {name}
          </p>
          {entity && <p className="text-[11px] text-outline">{entity}</p>}
          {entityId && (
            <p className="text-[10px] text-outline font-mono" data-testid="entity-id">
              {entityId}
            </p>
          )}
        </div>
        <span className="text-[11px] font-medium text-outline whitespace-nowrap">
          {Math.round(confidence * 100)} %
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-outline-variant">
          {WEAPONS_ROLE_LABEL[role] || role}
        </span>
        {type && <EvidenceBadge type={type} />}
        {inferred && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-amber-300 text-amber-800">
            Odvodené
          </span>
        )}
      </div>
      {note && <p className="text-[11px] text-outline">{note}</p>}
      <div className="flex flex-wrap gap-1">
        {evidence.map((ev, i) => (
          <CitationChip
            key={`${ev.document_id}-${i}`}
            evidence={{ ...ev, actorName: name }}
            onCite={onCite}
          />
        ))}
      </div>
    </div>
  );
}

function CitationChip({
  evidence,
  onCite,
}: {
  evidence: Citation;
  onCite: (c: Citation) => void;
}) {
  const label =
    evidence.page != null
      ? `${evidence.document_id} · s. ${evidence.page}`
      : evidence.document_id;
  return (
    <button
      type="button"
      className="text-[10px] px-2 py-1 rounded-lg border border-primary/30 text-primary bg-primary-container"
      data-testid="forensic-citation"
      onClick={() => onCite(evidence)}
    >
      {label}
    </button>
  );
}

function EvidenceBadge({ type }: { type: ForensicEvidenceType }) {
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full border ${evidenceTypeClass(type)}`}
      data-testid={`evidence-type-${type}`}
    >
      {EVIDENCE_TYPE_LABEL[type]}
    </span>
  );
}

function MetaStrip({
  result,
  documents,
}: {
  result: ForensicDocumentAnalysis;
  documents: number;
}) {
  return (
    <p className="text-[10px] text-outline">
      {documents} dokumentov · hash {result.document_hash?.slice(0, 12) || "—"} ·{" "}
      {result.entities.length} entít · {result.transactions.length} transakcií
    </p>
  );
}
