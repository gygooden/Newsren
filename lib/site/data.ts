import approved from "../../config/approved.json";
import sampleWatches from "../../config/sample-watches.json";
import briefingsFile from "../../data/generated/briefings.json";
import productsFile from "../../data/generated/products.json";
import storiesFile from "../../data/generated/stories.json";
import type { StoryView } from "../agent/learn";
import type { SectionProducts } from "../agent/products";
import type { Briefing, SourceRecord, Watch } from "../agent/types";

export interface SavedBriefing {
  sampleWatchId: string;
  name: string;
  briefing: Briefing;
}

export const SAVED_BRIEFINGS = (briefingsFile as unknown as { generatedAt: string; briefings: SavedBriefing[] }).briefings;
export const GENERATED_AT = (briefingsFile as unknown as { generatedAt: string }).generatedAt;
export const SAMPLE_WATCHES = sampleWatches as { id: string; name: string; watch: Watch }[];

const stories = storiesFile as unknown as { stories: StoryView[]; sources: Record<string, SourceRecord> };
export const STORIES = stories.stories;
export const STORY_SOURCES = stories.sources;

const products = productsFile as unknown as { products: SectionProducts; sources: Record<string, SourceRecord> };
export const PRODUCTS = products.products;
export const PRODUCT_SOURCES = products.sources;

export const APPROVED_STORY_IDS = (approved as { stories: { id: string; approvedAt: string }[] }).stories;

export function storyById(id: string): StoryView | undefined {
  return STORIES.find((s) => s.id === id);
}

/** The saved briefing whose sample watch is closest to the reader's watch. */
export function closestSavedBriefing(watch: Watch | null): SavedBriefing {
  if (!watch) return SAVED_BRIEFINGS[0];
  const score = (w: Watch) =>
    (w.county === watch.county ? 3 : 0) + w.topics.filter((t) => watch.topics.includes(t)).length + (w.depth === watch.depth ? 0.5 : 0);
  return [...SAVED_BRIEFINGS].sort((a, b) => score(b.briefing.watch) - score(a.briefing.watch))[0];
}
