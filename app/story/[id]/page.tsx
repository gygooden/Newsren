import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryTools } from "@/components/StoryTools";
import { COUNTIES, type CountyId } from "@/lib/agent/types";
import { STORIES, STORY_SOURCES, storyById } from "@/lib/site/data";

export function generateStaticParams() {
  return STORIES.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: storyById(id)?.title ?? "Story" };
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = storyById(id);
  if (!story) notFound();
  return (
    <div className="wrap">
      <p className="ui small muted">Story</p>
      <h1>{story.title}</h1>
      <p>
        {story.timeline.length} records across{" "}
        {story.counties.length ? story.counties.map((c) => COUNTIES[c as CountyId].name).join(" and ") : "national sources"}.
        Local records are sample data.
      </p>
      <StoryTools story={story} sources={STORY_SOURCES} />
    </div>
  );
}
