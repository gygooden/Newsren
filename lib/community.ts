import { COUNTIES, COUNTY_IDS, type CountyId } from "./agent/types";

// Community pulse and notes, shared by the site and the Worker.
// Notes are anonymous by default. A reader may add a display name, which is
// shown only to readers who chose the same county in their watch.

export const REACTIONS = {
  "affects-job": "This affects my job",
  "affects-school": "This affects my school",
  "affects-money": "This affects my money",
  "seeing-locally": "I'm seeing this where I live",
  "want-more": "I want more on this",
} as const;
export type Reaction = keyof typeof REACTIONS;
export const REACTION_IDS = Object.keys(REACTIONS) as Reaction[];

export const ROLES = {
  student: "Student",
  educator: "Educator",
  parent: "Parent",
  worker: "Worker",
  resident: "Resident",
} as const;
export type Role = keyof typeof ROLES;
export const ROLE_IDS = Object.keys(ROLES) as Role[];

export const NOTE_MAX_CHARS = 280;
export const NAME_MAX_CHARS = 30;
export const NOTES_PER_VISITOR_PER_DAY = 3;
export const MAX_PENDING = 100;
export const MAX_APPROVED_PER_STORY = 50;

export interface StoredNote {
  id: string;
  story: string;
  text: string;
  role: Role;
  county?: CountyId;
  name?: string;
  createdAt: string;
}

/** A note as a reader sees it: the name is present only for readers in the same county. */
export interface PublicNote {
  id: string;
  text: string;
  role: Role;
  county?: CountyId;
  name?: string;
  createdAt: string;
}

/** Counts keyed by `${reaction}|${role}|${county or "none"}`. */
export type PulseCounts = Record<string, number>;

export interface CommunityView {
  pulse: PulseCounts;
  notes: PublicNote[];
}

export class CommunityInputError extends Error {}

const isRole = (v: unknown): v is Role => typeof v === "string" && v in ROLES;
const isReaction = (v: unknown): v is Reaction => typeof v === "string" && v in REACTIONS;
const isCounty = (v: unknown): v is CountyId => (COUNTY_IDS as readonly unknown[]).includes(v);

export function pulseKey(reaction: Reaction, role: Role, county?: CountyId): string {
  return `${reaction}|${role}|${county ?? "none"}`;
}

export function parseCounty(raw: unknown): CountyId | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (!isCounty(raw)) throw new CommunityInputError("Choose a county from the list.");
  return raw;
}

// Links, email addresses and phone numbers are refused: they invite spam and
// let people share contact details, which this site does not collect.
const BLOCKED = [
  { re: /[^\s@]+@[^\s@]+\.[^\s@]+/, why: "Notes cannot contain email addresses." },
  { re: /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ly|gg|xyz)\b/i, why: "Notes cannot contain links." },
  { re: /(\d[\s().-]*){7,}/, why: "Notes cannot contain phone numbers or long numbers." },
];

export function validatePulse(raw: Record<string, unknown>): { reaction: Reaction; role: Role; county?: CountyId } {
  if (!isReaction(raw.reaction)) throw new CommunityInputError("Choose a reaction from the list.");
  if (!isRole(raw.role)) throw new CommunityInputError("Choose who you are from the list.");
  return { reaction: raw.reaction, role: raw.role, county: parseCounty(raw.county) };
}

export function validateNote(raw: Record<string, unknown>): { text: string; role: Role; county?: CountyId; name?: string } {
  const text = typeof raw.text === "string" ? raw.text.trim().replace(/\s+/g, " ") : "";
  if (text.length < 3) throw new CommunityInputError("Write a note of at least 3 characters.");
  if (text.length > NOTE_MAX_CHARS) throw new CommunityInputError(`Notes are at most ${NOTE_MAX_CHARS} characters.`);
  for (const b of BLOCKED) if (b.re.test(text)) throw new CommunityInputError(b.why);
  if (!isRole(raw.role)) throw new CommunityInputError("Choose who you are from the list.");
  const county = parseCounty(raw.county);
  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ") : "";
  if (name) {
    if (!county) throw new CommunityInputError("Choose your county to show your name. Names are shown only to readers in that county.");
    if (name.length > NAME_MAX_CHARS) throw new CommunityInputError(`Names are at most ${NAME_MAX_CHARS} characters.`);
    if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) throw new CommunityInputError("Names can use letters, spaces, periods, apostrophes and hyphens.");
  }
  return { text, role: raw.role, county, name: name || undefined };
}

/** Strips names from notes outside the viewer's county. */
export function toPublic(notes: StoredNote[], viewerCounty?: CountyId): PublicNote[] {
  return notes.map(({ id, text, role, county, name, createdAt }) => ({
    id,
    text,
    role,
    county,
    createdAt,
    ...(name && county && county === viewerCounty ? { name } : {}),
  }));
}

/** "Educator in Santa Clara County", or "Educator" with no county. */
export function describeAuthor(note: Pick<PublicNote, "role" | "county">): string {
  return `${ROLES[note.role]}${note.county ? ` in ${COUNTIES[note.county].name}` : ""}`;
}

export interface PulseSummary {
  reaction: Reaction;
  total: number;
  inCounty: number;
  byRole: { role: Role; count: number }[];
}

/** Totals per reaction, with the viewer's county and a role breakdown. */
export function summarizePulse(pulse: PulseCounts, viewerCounty?: CountyId): PulseSummary[] {
  return REACTION_IDS.map((reaction) => {
    let total = 0;
    let inCounty = 0;
    const roles = new Map<Role, number>();
    for (const [key, count] of Object.entries(pulse)) {
      const [r, role, county] = key.split("|");
      if (r !== reaction || !isRole(role)) continue;
      total += count;
      if (viewerCounty && county === viewerCounty) inCounty += count;
      roles.set(role, (roles.get(role) ?? 0) + count);
    }
    const byRole = [...roles].map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count);
    return { reaction, total, inCounty, byRole };
  });
}
