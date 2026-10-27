"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { COUNTIES } from "@/lib/agent/types";
import type { Briefing } from "@/lib/agent/types";
import { STORIES } from "@/lib/site/data";
import { ClaimList } from "./ClaimList";
import { SourceReport, StatusLabel } from "./SourceReport";

export type ContextStatus = "live" | "saved" | "approved";

const CONTEXT_LABEL: Record<ContextStatus, string> = {
  live: "AI-generated, not editor-reviewed",
  saved: "Assembled automatically from quoted source text, not editor-reviewed",
  approved: "Editor-reviewed",
};

type Zoom = "county" | "region" | "nation";

export function BriefingView({ briefing, status }: { briefing: Briefing; status: ContextStatus }) {
  const [zoom, setZoom] = useState<Zoom>(briefing.watch.county ? "county" : "nation");
  const zoomId = useId();
  const src = briefing.sources;
  const countyName = briefing.watch.county ? COUNTIES[briefing.watch.county].name : null;
  const zoomIds = briefing.zoom[zoom];

  return (
    <div>
      {status !== "approved" && (
        <p className="notice ui">
          <strong>Personal briefing, not editor-reviewed.</strong> Only you can see it. Nothing here appears on the front
          page unless an editor approves it.
        </p>
      )}

      <section aria-labelledby="items-heading">
        <h2 id="items-heading">Reports and documents</h2>
        {briefing.items.length === 0 && <p>No items passed verification in this briefing.</p>}
        {briefing.items.map((item) => {
          const record = src[item.sourceId];
          if (!record) return null;
          return (
            <article key={item.sourceId} className="card" aria-labelledby={`t-${item.sourceId}`}>
              <div id={`t-${item.sourceId}`}>
                <SourceReport record={record} heading="h3" />
              </div>
              <h4>Newsren context</h4>
              <p className="ui small">
                <span className="label">{CONTEXT_LABEL[status]}</span>
              </p>
              <ClaimList claims={item.claims} sources={src} />
              {item.whyItMatters && (
                <p>
                  <span className="ui small muted">Why it matters (explanation, not a factual claim): </span>
                  {item.whyItMatters}
                </p>
              )}
              {item.nextQuestions.length > 0 && (
                <>
                  <p className="ui small" style={{ marginBottom: "0.25rem" }}>
                    <strong>Next questions to investigate</strong>
                  </p>
                  <ul>
                    {item.nextQuestions.map((q) => (
                      <li key={q.question}>
                        {q.question} <span className="ui small muted">(raised by {src[q.sourceId]?.title ?? q.sourceId})</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          );
        })}
      </section>

      {briefing.disagreements.length > 0 && (
        <section aria-labelledby="disagree-heading">
          <h2 id="disagree-heading">Where sources disagree</h2>
          <p className="muted">Newsren records disagreements and does not pick a side.</p>
          {briefing.disagreements.map((d) => (
            <div key={d.about} className="card">
              <h3>{d.about}</h3>
              <ul>
                {d.positions.map((p) => (
                  <li key={p.sourceId}>
                    {p.outlet}: &ldquo;{p.quote}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="beyond-heading">
        <h2 id="beyond-heading">Beyond your watch</h2>
        <p className="muted">
          Chosen by a published significance score (local impact, independent sources, document type), never by
          clicks or popularity. <Link href="/about/#significance">How the score works</Link>.
        </p>
        {briefing.beyond.length === 0 && <p>No items outside your topics met the threshold this time.</p>}
        {briefing.beyond.map((b) => {
          const record = src[b.sourceId];
          if (!record) return null;
          return (
            <article key={b.sourceId} className="card">
              <SourceReport record={record} heading="h3" />
              <p>
                <strong className="ui">Why you are seeing this:</strong> {b.reason}{" "}
                <span className="ui small muted">
                  (score {b.score}: local impact {b.components.localImpact}, independent sources{" "}
                  {b.components.independentSources}, document type {b.components.documentType})
                </span>
              </p>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="gaps-heading">
        <h2 id="gaps-heading">Not yet reported</h2>
        <p className="muted">
          Primary documents with no matching news coverage in the sources checked. Newsren does not write stories about
          them; it drafts a tip for a partner newsroom.
        </p>
        {briefing.gaps.length === 0 && <p>Every primary document in this briefing has matching coverage.</p>}
        {briefing.gaps.map((g) => {
          const record = src[g.sourceId];
          if (!record) return null;
          return (
            <article key={g.sourceId} className="card">
              <p className="ui small" style={{ margin: 0 }}>
                <StatusLabel text={g.label} />
              </p>
              <SourceReport record={record} heading="h3" />
              <p className="ui small">{g.tip}</p>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="unverified-heading">
        <h2 id="unverified-heading">What we could not verify</h2>
        {briefing.unverified.length === 0 ? (
          <p>Every claim submitted for this briefing matched a quote in a retrieved source.</p>
        ) : (
          <ul>
            {briefing.unverified.map((u, i) => (
              <li key={i}>
                {u.text} <span className="ui small muted">({u.reason})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="zoom-heading">
        <h2 id="zoom-heading">Zoom out</h2>
        <fieldset>
          <legend>Show items at this level</legend>
          {(["county", "region", "nation"] as Zoom[]).map((z) => (
            <div className="choice" key={z}>
              <input type="radio" id={`${zoomId}-${z}`} name={`${zoomId}-zoom`} value={z} checked={zoom === z} onChange={() => setZoom(z)} />
              <label htmlFor={`${zoomId}-${z}`}>
                {z === "county" ? `County${countyName ? ` (${countyName})` : " (no county chosen)"}` : z === "region" ? "Region (other counties)" : "Nation (federal documents and research)"}
              </label>
            </div>
          ))}
        </fieldset>
        <div aria-live="polite">
          {zoomIds.length === 0 ? (
            <p>No retrieved items at this level.</p>
          ) : (
            <ul>
              {zoomIds.map((id) => (
                <li key={id}>
                  {src[id]?.title ?? id} <span className="ui small muted">({src[id]?.provenance.outlet})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="coverage-heading">
        <h2 id="coverage-heading">Coverage checked</h2>
        <dl className="facts">
          <dt>Sources checked</dt>
          <dd>{briefing.coverage.sourcesChecked.map((s) => `${s.name}: ${s.count}`).join("; ") || "None"}</dd>
          <dt>Independent outlets and agencies</dt>
          <dd>
            {briefing.coverage.independentOutlets.length}: {briefing.coverage.independentOutlets.join(", ")}
          </dd>
          <dt>Thin coverage</dt>
          <dd>{briefing.coverage.thinCoverage.length ? briefing.coverage.thinCoverage.join("; ") : "None found"}</dd>
        </dl>
        {briefing.stories.length > 0 && (
          <>
            <h3>Related stories</h3>
            <ul>
              {briefing.stories
                .map((id) => STORIES.find((s) => s.id === id))
                .filter(Boolean)
                .map((s) => (
                  <li key={s!.id}>
                    <Link href={`/story/${s!.id}/`}>Story: {s!.title}</Link>
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
