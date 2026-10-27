// Entity tags connect records. Real documents and sample records are linked
// only through these shared tags, never by claiming one mentions the other.

export interface EntityDef {
  id: string;
  label: string;
  /** Generic tags are too broad to define a story or a coverage match. */
  generic?: boolean;
  keywords: string[];
}

export const ENTITIES: EntityDef[] = [
  { id: "artificial-intelligence", label: "Artificial intelligence", generic: true, keywords: ["artificial intelligence", " ai ", "machine learning", "language model", "generative"] },
  { id: "layoffs", label: "Layoffs and WARN notices", keywords: ["layoff", "warn notice", "worker adjustment", "job cuts", "reduction in force", "displaced worker"] },
  { id: "automated-hiring", label: "Automated hiring tools", keywords: ["automated hiring", "hiring tool", "employment decision", "applicant screening", "resume screening"] },
  { id: "workforce-training", label: "Workforce training", keywords: ["retraining", "workforce development", "apprenticeship", "job training", "reskilling"] },
  { id: "ai-tutoring", label: "AI tutoring in schools", keywords: ["tutor", "tutoring", "intelligent tutoring"] },
  { id: "student-data-privacy", label: "Student data privacy", keywords: ["student data", "ferpa", "student privacy", "education records"] },
  { id: "data-centers", label: "Data centers and power", keywords: ["data center", "power grid", "electricity demand", "substation"] },
  { id: "ai-in-lending", label: "AI in lending and banking", keywords: ["underwriting", "credit model", "fraud screening", "credit risk", "lending decision", "credit decision", "fair lending"] },
  { id: "investment-advisers", label: "Investment advisers and brokers", keywords: ["investment adviser", "broker-dealer", "predictive data analytics", "robo-advis"] },
  { id: "warehouse-automation", label: "Warehouse automation", keywords: ["warehouse", "fulfillment center", "robotic picking"] },
  { id: "consumer-protection", label: "Consumer protection", generic: true, keywords: ["consumer protection", "unfair or deceptive", "deceptive practices"] },
];

export const ENTITY_BY_ID: Record<string, EntityDef> = Object.fromEntries(ENTITIES.map((e) => [e.id, e]));

/** Keywords match at the start of a word, so "tutor" matches "tutoring" but not "statutory". */
export function tagEntities(text: string): string[] {
  const padded = ` ${text.toLowerCase().replace(/[^a-z0-9-]+/g, " ")} `;
  return ENTITIES.filter((e) => e.keywords.some((k) => padded.includes(` ${k.trim().toLowerCase()}`))).map((e) => e.id);
}

export function specificEntities(ids: string[]): string[] {
  return ids.filter((id) => ENTITY_BY_ID[id] && !ENTITY_BY_ID[id].generic);
}

export function entityLabel(id: string): string {
  return ENTITY_BY_ID[id]?.label ?? id;
}
