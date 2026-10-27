"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { entityLabel } from "@/lib/agent/entities";
import { ALERT_CRITERIA, type AlertCriterion, type QuizQuestion, type StoryView } from "@/lib/agent/learn";
import { LIMITS } from "@/lib/agent/limits";
import { DEPTHS, type Depth, type SourceRecord, type Watch } from "@/lib/agent/types";
import { sourceLabel } from "@/lib/agent/util";
import { runLive, type LiveResult } from "@/lib/site/agent";
import { GENERATED_AT } from "@/lib/site/data";
import { KEYS, loadWatch, readJson, writeJson } from "@/lib/site/storage";
import { ClaimList } from "./ClaimList";
import { SourceReport, StatusLabel } from "./SourceReport";
import { Tabs } from "./Tabs";

type Sources = Record<string, SourceRecord>;

function Timeline({ story, sources }: { story: StoryView; sources: Sources }) {
  return (
    <>
      <h2>Connected stories</h2>
      <p className="muted">
        Records that share the tag &ldquo;{entityLabel(story.entity)}&rdquo;, oldest first. Real federal and research records
        connect to sample local records only through this shared tag; they do not mention each other.
      </p>
      <ol>
        {story.timeline.map((id) => {
          const r = sources[id];
          if (!r) return null;
          return (
            <li key={id} className="card">
              <SourceReport record={r} heading="h3" />
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Quiz({ question }: { question: QuizQuestion }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const name = useId();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setChecked(true);
      }}
    >
      <fieldset>
        <legend>
          {question.transfer ? "Transfer question: " : ""}
          {question.prompt.replace(/^Transfer: /, "")}
        </legend>
        {question.options.map((o, i) => (
          <div className="choice" key={i}>
            <input type="radio" id={`${name}-${i}`} name={name} checked={choice === i} onChange={() => { setChoice(i); setChecked(false); }} />
            <label htmlFor={`${name}-${i}`}>{o}</label>
          </div>
        ))}
        <button type="submit" className="secondary" disabled={choice === null}>
          Check answer
        </button>
        <div aria-live="polite">
          {checked && choice !== null && (
            <p>
              <strong>{choice === question.answer ? "Correct." : "Not quite."}</strong> {question.explanation}
            </p>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function Learn({ story }: { story: StoryView }) {
  const [depth, setDepth] = useState<Depth>("student");
  useEffect(() => {
    const w = loadWatch();
    if (w) setDepth(w.depth);
  }, []);
  const l = story.learn;
  return (
    <>
      <h2>Learn this topic</h2>
      <div className="field">
        <label htmlFor="explain-for">Explain for</label>
        <select id="explain-for" value={depth} onChange={(e) => setDepth(e.target.value as Depth)}>
          {DEPTHS.map((d) => (
            <option key={d} value={d}>
              {d[0].toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <p aria-live="polite">{l.explanation[depth]}</p>
      <details>
        <summary>What happened?</summary>
        <ul>
          {l.whatHappened.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </details>
      <details>
        <summary>What is new?</summary>
        <p>{l.whatIsNew}</p>
      </details>
      <details>
        <summary>What evidence exists?</summary>
        <ul>
          {l.evidence.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </details>
      <details>
        <summary>What should I watch next?</summary>
        {l.watchNext.length ? (
          <ul>
            {l.watchNext.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          <p>No upcoming dates were found in these records.</p>
        )}
      </details>
      <h3>Glossary</h3>
      <dl className="facts">
        {l.glossary.map((g) => (
          <div key={g.term} style={{ display: "contents" }}>
            <dt>{g.term}</dt>
            <dd>{g.definition}</dd>
          </div>
        ))}
      </dl>
      <h3>Check your understanding</h3>
      {l.quiz.map((q) => (
        <Quiz key={q.id} question={q} />
      ))}
      <h3>Discussion prompts</h3>
      <ul>
        {l.discussion.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </>
  );
}

function AskForm({ story }: { story: StoryView }) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [result, setResult] = useState<LiveResult | null>(null);
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return setError("Enter a question.");
    if (question.length > LIMITS.maxQuestionChars) return setError(`Questions are limited to ${LIMITS.maxQuestionChars} characters. You have ${question.length}.`);
    setError("");
    setRunning(true);
    setResult(null);
    setMessage("");
    setSteps(["Sending your question"]);
    const stored = loadWatch();
    const watch: Watch = stored ?? {
      topics: story.sections.includes("finance") ? ["finance-regulation"] : story.sections.includes("education") ? ["education"] : ["labor"],
      organizations: "",
      questions: "",
      depth: "student",
      county: story.counties[0] as Watch["county"],
    };
    const outcome = await runLive("/ask", { watch, question: question.trim() }, (s) => setSteps((x) => [...x, s]));
    setRunning(false);
    if (outcome.kind === "ok") setResult(outcome.result);
    else setMessage(outcome.message);
  }

  const claims = result?.briefing.items.flatMap((i) => i.claims) ?? [];
  return (
    <form onSubmit={onSubmit} noValidate>
      <h3>Ask one question about this story</h3>
      <p id="ask-hint" className="hint">
        The answer uses only sources retrieved for it, passes quote verification, and counts toward your {LIMITS.dailyPerVisitor} live runs per day.
      </p>
      <label htmlFor="ask-question">Your question</label>
      <textarea
        id="ask-question"
        rows={3}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        aria-describedby={`ask-hint${error ? " ask-error" : ""}`}
        aria-invalid={error ? true : undefined}
      />
      <div aria-live="polite">
        {error && (
          <p id="ask-error" className="error-text">
            {error}
          </p>
        )}
      </div>
      <div className="button-row">
        <button type="submit" disabled={running}>
          {running ? "Searching sources" : "Ask"}
        </button>
      </div>
      <div aria-live="polite" className="ui">
        {steps.length > 0 && (
          <ol>
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
        {message && <p className="notice notice-strong">{message}</p>}
        {result && (
          <div>
            <h4>Answer from retrieved sources</h4>
            {claims.length === 0 ? (
              <p>
                <strong>The agent could not find support for an answer in the sources it retrieved.</strong>
              </p>
            ) : (
              <ClaimList claims={claims} sources={result.briefing.sources} />
            )}
            {result.briefing.unverified.length > 0 && (
              <>
                <h4>Could not verify</h4>
                <ul>
                  {result.briefing.unverified.map((u, i) => (
                    <li key={i}>
                      {u.text} ({u.reason})
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="small">Live runs remaining today: {result.remaining}</p>
          </div>
        )}
      </div>
    </form>
  );
}

function Evidence({ story, sources }: { story: StoryView; sources: Sources }) {
  return (
    <>
      <h2>Inspect evidence</h2>
      <h3>Claims and their quotes</h3>
      <ClaimList claims={story.claims} sources={sources} />
      <h3>Disagreements</h3>
      {story.disagreements.length === 0 ? (
        <p>No disagreements between outlets were found in these records.</p>
      ) : (
        story.disagreements.map((d) => (
          <div key={d.about}>
            <p>
              <strong>{d.about}</strong>
            </p>
            <ul>
              {d.positions.map((p) => (
                <li key={p.sourceId}>
                  {p.outlet}: &ldquo;{p.quote}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <h3>Not yet reported</h3>
      {story.gaps.length === 0 ? (
        <p>Every primary document here has matching coverage.</p>
      ) : (
        <ul>
          {story.gaps.map((g) => (
            <li key={g.sourceId}>
              <StatusLabel text={g.label} /> {sources[g.sourceId]?.title}
            </li>
          ))}
        </ul>
      )}
      <AskForm story={story} />
    </>
  );
}

function Follow({ story }: { story: StoryView }) {
  const [criteria, setCriteria] = useState<AlertCriterion[]>([]);
  const [saved, setSaved] = useState<AlertCriterion[]>([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const all = readJson<Record<string, AlertCriterion[]>>(KEYS.alerts, {});
    setCriteria(all[story.id] ?? []);
    setSaved(all[story.id] ?? []);
  }, [story.id]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const all = readJson<Record<string, AlertCriterion[]>>(KEYS.alerts, {});
    all[story.id] = criteria;
    const ok = writeJson(KEYS.alerts, all);
    setSaved(criteria);
    setStatus(ok ? "Alert criteria saved on this device." : "Local storage is unavailable, so the criteria were not saved.");
  }

  return (
    <>
      <h2>Follow developments</h2>
      <p>
        Choose which kinds of new primary evidence matter to you. Opinion pieces are never alert triggers. Each daily build
        re-checks the snapshot, and matches appear below. Real-time delivery of alerts is future work.
      </p>
      <form onSubmit={onSubmit}>
        <fieldset>
          <legend>Alert me about</legend>
          {(Object.keys(ALERT_CRITERIA) as AlertCriterion[]).map((c) => (
            <div className="choice" key={c}>
              <input
                type="checkbox"
                id={`alert-${c}`}
                checked={criteria.includes(c)}
                onChange={() => setCriteria((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))}
              />
              <label htmlFor={`alert-${c}`}>{ALERT_CRITERIA[c]}</label>
            </div>
          ))}
        </fieldset>
        <button type="submit">Save alert criteria</button>
      </form>
      <div aria-live="polite">{status && <p className="ui">{status}</p>}</div>
      <h3>Matches in the snapshot of {GENERATED_AT.slice(0, 10)}</h3>
      {saved.length === 0 ? (
        <p>No criteria saved yet.</p>
      ) : (
        saved.map((c) => (
          <div key={c}>
            <h4>{ALERT_CRITERIA[c]}</h4>
            {story.alerts[c].length === 0 ? (
              <p>No matches.</p>
            ) : (
              <ul>
                {story.alerts[c].map((m) => (
                  <li key={m.sourceId}>
                    {m.date}: {m.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </>
  );
}

export function StoryTools({ story, sources }: { story: StoryView; sources: Sources }) {
  return (
    <>
      <Tabs
        label="Story tools"
        tabs={[
          { id: "connected", label: "Connected stories", content: <Timeline story={story} sources={sources} /> },
          { id: "learn", label: "Learn this topic", content: <Learn story={story} /> },
          { id: "evidence", label: "Inspect evidence", content: <Evidence story={story} sources={sources} /> },
          { id: "follow", label: "Follow developments", content: <Follow story={story} /> },
        ]}
      />
      <section aria-labelledby="next-q">
        <h2 id="next-q">Next questions to investigate</h2>
        <ul>
          {story.nextQuestions.map((q, i) => (
            <li key={i}>
              {q.question} <a href={`#source-${q.sourceId}`}>Raised by: {sources[q.sourceId]?.title ?? q.sourceId}</a>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="story-sources">
        <h2 id="story-sources">Sources in this story</h2>
        <ul>
          {story.sourceIds.map((id) => {
            const r = sources[id];
            if (!r) return null;
            return (
              <li key={id} id={`source-${id}`}>
                <span className="label label-source">{sourceLabel(r)}</span> {r.provenance.outlet}, &ldquo;{r.title}&rdquo; ({r.provenance.publishedAt}).{" "}
                {r.provenance.sourceUrl ? <a href={r.provenance.sourceUrl}>Original: {r.title}</a> : <span className="muted">Sample record, no original.</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
