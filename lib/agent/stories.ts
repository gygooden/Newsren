import { entityLabel, specificEntities } from "./entities";
import type { SourceRecord } from "./types";

export interface Story {
  id: string;
  title: string;
  entity: string;
  /** Record ids in date order (oldest first). */
  timeline: string[];
}

/** The first specific entity on a record decides which story it belongs to. */
export function primaryEntity(r: SourceRecord): string | undefined {
  return specificEntities(r.entities)[0];
}

/** Group records by shared entity and order each group as a timeline. */
export function buildStories(records: SourceRecord[]): Story[] {
  const groups = new Map<string, SourceRecord[]>();
  for (const r of records) {
    for (const entity of specificEntities(r.entities)) {
      const list = groups.get(entity) ?? [];
      list.push(r);
      groups.set(entity, list);
    }
  }
  const stories: Story[] = [];
  for (const [entity, list] of groups) {
    if (list.length < 2) continue;
    const timeline = [...new Map(list.map((r) => [r.id, r])).values()]
      .sort((a, b) => a.provenance.publishedAt.localeCompare(b.provenance.publishedAt))
      .map((r) => r.id);
    stories.push({ id: entity, title: entityLabel(entity), entity, timeline });
  }
  return stories.sort((a, b) => b.timeline.length - a.timeline.length);
}

export function storiesForRecords(stories: Story[], ids: string[]): string[] {
  const set = new Set(ids);
  return stories.filter((s) => s.timeline.some((id) => set.has(id))).map((s) => s.id);
}
