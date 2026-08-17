// Klasifikácia vzťahov a sieťová metrika pre kriminálne a vyšetrovacie siete
export const RELATIONSHIP_TYPES = {
  SPOLUPACHATEL: 'spolupachatel',
  NEPRIATELSTVO: 'nepriatelstvo',
  FINANCIE: 'financie',
  RODINA: 'rodina',
  ALIBI: 'alibi',
  KONTAKT: 'kontakt'
};

export function classifyRelationship(edge?: { label?: string; type?: string; description?: string } | null) {
  const label = String(edge?.label || edge?.type || '');
  const desc = String(edge?.description || '');
  const raw = `${label} ${desc}`;
  const full = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (full.includes('spolupach') || full.includes('spolupachatel') || full.includes('dohoda') || full.includes('komplic')) {
    return {
      type: RELATIONSHIP_TYPES.SPOLUPACHATEL,
      color: '#dc2626', // Červená
      strokeWidth: 3,
      importance: 5,
      labelBadge: 'Spolupáchateľ'
    };
  }

  if (full.includes('nepriatel') || full.includes('konflikt') || full.includes('hadka') || full.includes('vyhrazanie') || full.includes('rozpor')) {
    return {
      type: RELATIONSHIP_TYPES.NEPRIATELSTVO,
      color: '#f97316', // Oranžová
      strokeWidth: 2.5,
      importance: 4,
      labelBadge: 'Konflikt'
    };
  }

  if (full.includes('peniaz') || full.includes('platba') || full.includes('ucet') || full.includes('prevod') || full.includes('dlh') || full.includes('pozicka')) {
    return {
      type: RELATIONSHIP_TYPES.FINANCIE,
      color: '#eab308', // Zlatá / Žltá
      strokeWidth: 2.5,
      importance: 4,
      labelBadge: 'Finančný tok'
    };
  }

  if (full.includes('otec') || full.includes('matka') || full.includes('syn') || full.includes('dcera') || full.includes('brat') || full.includes('sestra') || full.includes('manzel') || full.includes('rodin')) {
    return {
      type: RELATIONSHIP_TYPES.RODINA,
      color: '#8b5cf6', // Fialová
      strokeWidth: 2,
      importance: 3,
      labelBadge: 'Rodina'
    };
  }

  if (full.includes('alibi') || full.includes('potvrdil') || full.includes('svedci')) {
    return {
      type: RELATIONSHIP_TYPES.ALIBI,
      color: '#10b981', // Zelená
      strokeWidth: 2,
      importance: 3,
      labelBadge: 'Alibi kontakt'
    };
  }

  return {
    type: RELATIONSHIP_TYPES.KONTAKT,
    color: '#3b82f6', // Modrá
    strokeWidth: 1.5,
    importance: 1,
    labelBadge: 'Kontakt'
  };
}

export interface GraphNodeRecord {
  id: string;
  name?: string;
  label?: string;
  role?: string;
  type?: string;
  degree?: number;
  pageRankScore?: number;
  isKeyHub?: boolean;
  nodeRadius?: number;
  [key: string]: unknown;
}

export interface GraphEdgeRecord {
  person1_id?: string;
  person2_id?: string;
  source?: string | { id?: string };
  target?: string | { id?: string };
  [key: string]: unknown;
}

// Výpočet sieťovej centrality (Degree a zjednodušený PageRank) bez externých závislostí
export function calculateGraphMetrics(
  persons: GraphNodeRecord[] = [],
  edges: GraphEdgeRecord[] = []
) {
  if (!persons.length) return { nodesWithMetrics: [], topSuspects: [] };

  const nodeMap = new Map<string, GraphNodeRecord>();
  const neighbors = new Map<string, Set<string>>();

  for (const p of persons) {
    const id = String(p.id || p.name || p.label);
    nodeMap.set(id, { ...p, id, degree: 0, pageRankScore: 1 / persons.length });
    neighbors.set(id, new Set());
  }

  for (const e of edges) {
    const src = String(e.person1_id || (typeof e.source === 'object' ? e.source?.id : e.source) || '');
    const tgt = String(e.person2_id || (typeof e.target === 'object' ? e.target?.id : e.target) || '');
    if (src && tgt && nodeMap.has(src) && nodeMap.has(tgt) && src !== tgt) {
      neighbors.get(src)!.add(tgt);
      neighbors.get(tgt)!.add(src);
    }
  }

  // Degree
  for (const [id, nbrs] of neighbors.entries()) {
    const node = nodeMap.get(id);
    if (node) node.degree = nbrs.size;
  }

  // Iteratívny PageRank (20 iterácií, damping factor 0.85)
  const d = 0.85;
  const N = persons.length;
  let scores: Record<string, number> = {};
  for (const id of nodeMap.keys()) {
    scores[id] = 1 / N;
  }

  for (let iter = 0; iter < 20; iter++) {
    const nextScores: Record<string, number> = {};
    for (const id of nodeMap.keys()) {
      let sum = 0;
      for (const [nbrId, nbrSet] of neighbors.entries()) {
        if (nbrSet.has(id)) {
          sum += scores[nbrId] / (nbrSet.size || 1);
        }
      }
      nextScores[id] = (1 - d) / N + d * sum;
    }
    scores = nextScores;
  }

  const nodesWithMetrics = Array.from(nodeMap.values()).map((n) => {
    const pr = scores[n.id] || 0;
    const isKeyHub = (n.degree || 0) >= 3 || pr > 1.5 / N;
    return {
      ...n,
      pageRankScore: Number(pr.toFixed(4)),
      isKeyHub,
      nodeRadius: Math.max(12, Math.min(32, 14 + (n.degree || 0) * 3))
    };
  });

  nodesWithMetrics.sort((a, b) => (b.pageRankScore || 0) - (a.pageRankScore || 0));

  const topSuspects = nodesWithMetrics.filter(
    (n) => n.role === 'obvinený' || n.role === 'podozrivý' || n.type === 'podozrivý' || n.isKeyHub
  );

  return {
    nodesWithMetrics,
    topSuspects
  };
}
