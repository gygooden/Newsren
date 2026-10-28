"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LIMITS } from "@/lib/agent/limits";
import type { Briefing, Watch } from "@/lib/agent/types";
import { TOPIC_LABELS } from "@/lib/agent/types";
import { downloadJson, runLive, type LiveResult } from "@/lib/site/agent";
import { closestSavedBriefing, GENERATED_AT } from "@/lib/site/data";
import { enqueue, KEYS, loadWatch, readJson, writeJson } from "@/lib/site/storage";
import { BriefingView } from "./BriefingView";
import { TraceTable } from "./TraceTable";

export function BriefingPage() {
  const [watch, setWatch] = useState<Watch | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [live, setLive] = useState<LiveResult | null>(null);
  const [fallback, setFallback] = useState<Briefing | null>(null);
  const [queued, setQueued] = useState("");
  const resultHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setWatch(loadWatch());
    const last = readJson<Briefing | null>(KEYS.lastLive, null);
    if (last) setFallback(last);
    setLoaded(true);
  }, []);

  const saved = closestSavedBriefing(watch);

  async function run() {
    if (!watch || running) return;
    setRunning(true);
    setSteps(["Sending your watch to the research service"]);
    setMessage("");
    const outcome = await runLive("/run", { watch }, (label) => setSteps((s) => [...s, label]));
    setRunning(false);
    if (outcome.kind === "ok") {
      setLive(outcome.result);
      writeJson(KEYS.lastLive, outcome.result.briefing);
      setSteps((s) => [...s, "Done"]);
    } else {
      setLive(null);
      setMessage(outcome.message);
      setSteps((s) => [...s, "Stopped"]);
    }
    resultHeading.current?.focus();
  }

  function sendToReview(b: Briefing, result?: LiveResult) {
    const ok = enqueue({ briefing: b, run: result?.run, submittedAt: new Date().toISOString() });
    setQueued(ok ? "Sent to the review queue on this device." : "Could not save to the review queue: local storage is unavailable.");
  }

  const shown: Briefing = live?.briefing ?? (message && fallback ? fallback : saved.briefing);
  const shownStatus = live ? "live" : shown.mode === "live" ? "live" : "saved";

  return (
    <div className="wrap">
      <div className="page-intro">
        <p className="eyebrow">Your receipts</p>
        <h1>My briefing</h1>
      </div>
      {loaded && !watch && (
        <p className="notice">
          You are looking at a sample briefing. <Link href="/watch/">Start a watch</Link> to get one built around your own
          topics and county.
        </p>
      )}
      {watch && (
        <p className="notice small">
          <strong>Your watch:</strong> {watch.topics.map((t) => TOPIC_LABELS[t]).join(", ")} · depth: {watch.depth}
          {watch.county ? ` · county: ${watch.county}` : ""}. <Link href="/watch/">Edit your watch</Link>
        </p>
      )}

      <section aria-labelledby="live-heading" className="panel-card">
        <h2 id="live-heading" style={{ marginTop: 0 }}>
          Get a fresh briefing
        </h2>
        <p>
          The research agent searches federal documents, AI research and local news for your watch, then checks every
          quote against what it found. You get {LIMITS.dailyPerVisitor} live runs a day; each takes under{" "}
          {LIMITS.timeoutMs / 1000} seconds.
        </p>
        <div className="button-row">
          <button type="button" id="run-live" onClick={run} disabled={!watch || running} aria-describedby={!watch ? "need-watch" : undefined}>
            {running ? "Running live research" : "Run live research"}
          </button>
        </div>
        {!watch && loaded && (
          <p id="need-watch" className="hint">
            Set up a watch first.
          </p>
        )}
        <div aria-live="polite" className="ui">
          {steps.length > 0 && (
            <>
              <h3>Research steps</h3>
              <ol>
                {steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </>
          )}
          {message && (
            <p className="notice notice-strong" role="alert">
              {message}
            </p>
          )}
          {live && (
            <p>
              Live runs remaining today: {live.remaining}. This run used {live.usage.steps} steps, {live.usage.toolCalls} tool
              calls and {live.usage.inputTokens + live.usage.outputTokens} tokens ({live.usage.stopReason}).
            </p>
          )}
        </div>
      </section>

      <h2 ref={resultHeading} tabIndex={-1}>
        {live ? "Live briefing" : message && fallback ? "Most recent saved briefing" : `Saved briefing: ${saved.name}`}
      </h2>
      {!live && (
        <p className="ui small muted">
          {shown.mode === "saved"
            ? `Precomputed on ${GENERATED_AT.slice(0, 10)} from the daily snapshot, without a model, for a sample watch close to yours.`
            : `Your last live briefing, from ${shown.createdAt.slice(0, 10)}.`}
        </p>
      )}

      <div className="button-row">
        <button type="button" className="secondary" onClick={() => sendToReview(shown, live ?? undefined)}>
          Send to review queue
        </button>
        {live && (
          <button type="button" className="secondary" onClick={() => downloadJson(`newsren-run-${live.run.id}.json`, live.run)}>
            Download run record
          </button>
        )}
      </div>
      <div aria-live="polite" className="ui small">
        {queued && <p>{queued}</p>}
      </div>

      <BriefingView briefing={shown} status={shownStatus} />

      {live && (
        <section aria-labelledby="trace-heading">
          <h2 id="trace-heading">Agent trace</h2>
          <TraceTable trace={live.trace} />
        </section>
      )}
    </div>
  );
}
