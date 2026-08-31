import type { ForensicEvidence, ForensicEvidenceType } from "./types";

export const EVIDENCE_TYPE_LABEL: Record<ForensicEvidenceType, string> = {
  direct_evidence: "Priamy dôkaz",
  testimony: "Výpoveď",
  corroborated: "Potvrdené viacerými zdrojmi",
  inference: "Inferencia",
  hypothesis: "Hypotéza",
};

export const WEAPONS_ROLE_LABEL: Record<string, string> = {
  orderer: "Objednávateľ",
  buyer: "Kupujúci",
  payer: "Platiteľ",
  physical_receiver: "Fyzicky prebral",
  transporter: "Prepravca",
  storage_holder: "Držiteľ skladu",
  seller: "Predávajúci",
  transferor: "Odovzdávajúci",
  final_holder: "Konečný držiteľ",
  unknown: "Neznáma rola",
  designer: "Navrhovateľ",
  director: "Riaditeľ plánu",
  coordinator: "Koordinátor",
  invoice_payer: "Platiteľ faktúry",
  cash_payer: "Platiteľ v hotovosti",
  account_holder: "Držiteľ účtu",
  funding_source: "Zdroj financovania",
  intermediary: "Sprostredkovateľ",
  buyer_entity: "Kupujúca firma",
  alleged_next_recipient: "Tvrdený ďalší príjemca",
};

const CONFIRMED_TYPES: ForensicEvidenceType[] = [
  "direct_evidence",
  "corroborated",
];

export function isPresentedAsFact(type: ForensicEvidenceType | null | undefined): boolean {
  return type === "direct_evidence" || type === "corroborated";
}

export function strongestEvidenceType(
  items: ForensicEvidence[]
): ForensicEvidenceType | null {
  const rank: Record<ForensicEvidenceType, number> = {
    direct_evidence: 5,
    corroborated: 4,
    testimony: 3,
    inference: 2,
    hypothesis: 1,
  };
  let best: ForensicEvidenceType | null = null;
  let bestRank = 0;
  for (const item of items) {
    const r = rank[item.evidence_type] || 0;
    if (r > bestRank) {
      bestRank = r;
      best = item.evidence_type;
    }
  }
  return best;
}

export function answerPresentation(input: {
  answer: string | null;
  evidence: ForensicEvidence[];
  inferred?: boolean;
}): {
  answer: string | null;
  asFact: boolean;
  caveat: string | null;
  evidenceType: ForensicEvidenceType | null;
} {
  const type = strongestEvidenceType(input.evidence);
  if (!input.answer) {
    return {
      answer: null,
      asFact: false,
      caveat: "Odpoveď nie je doložená.",
      evidenceType: type,
    };
  }
  if (input.inferred || type === "inference") {
    return {
      answer: input.answer,
      asFact: false,
      caveat: "Inferencia — nie je potvrdený fakt.",
      evidenceType: type ?? "inference",
    };
  }
  if (type === "hypothesis") {
    return {
      answer: input.answer,
      asFact: false,
      caveat: "Hypotéza — zatiaľ nepreukázané.",
      evidenceType: "hypothesis",
    };
  }
  if (type === "testimony") {
    return {
      answer: input.answer,
      asFact: false,
      caveat: "Len výpoveď — nie automaticky dokázaný fakt.",
      evidenceType: "testimony",
    };
  }
  if (type && CONFIRMED_TYPES.includes(type)) {
    return {
      answer: input.answer,
      asFact: true,
      caveat: null,
      evidenceType: type,
    };
  }
  return {
    answer: input.answer,
    asFact: false,
    caveat: "Tvrdenie nie je podložené priamym dôkazom.",
    evidenceType: type,
  };
}

export function evidenceTypeClass(type: ForensicEvidenceType): string {
  switch (type) {
    case "direct_evidence":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "corroborated":
      return "bg-teal-50 text-teal-800 border-teal-200";
    case "testimony":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "inference":
      return "bg-amber-50 text-amber-900 border-amber-300 border-dashed";
    case "hypothesis":
      return "bg-slate-100 text-slate-600 border-slate-300 border-dotted";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}
