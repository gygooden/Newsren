"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LIMITS } from "@/lib/agent/limits";
import { COUNTIES, COUNTY_IDS, DEPTHS, TOPICS, TOPIC_LABELS, type CountyId, type Depth, type Topic, type Watch } from "@/lib/agent/types";
import { loadWatch, saveWatch } from "@/lib/site/storage";

const DEPTH_HINT: Record<Depth, string> = {
  student: "Plain explanations with definitions.",
  educator: "Explanations that support teaching and discussion.",
  professional: "Scope, dates and who is affected, with minimal background.",
};

export function WatchForm() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [organizations, setOrganizations] = useState("");
  const [questions, setQuestions] = useState("");
  const [depth, setDepth] = useState<Depth>("student");
  const [county, setCounty] = useState<CountyId | "">("");
  const [errors, setErrors] = useState<{ topics?: string; questions?: string; organizations?: string }>({});
  const [status, setStatus] = useState("");
  const topicsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const w = loadWatch();
    if (!w) return;
    setTopics(w.topics);
    setOrganizations(w.organizations);
    setQuestions(w.questions);
    setDepth(w.depth);
    setCounty(w.county ?? "");
  }, []);

  function toggleTopic(t: Topic) {
    setTopics((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!topics.length) next.topics = "Choose at least one topic.";
    if (questions.length > LIMITS.maxQuestionChars) next.questions = `Questions must be ${LIMITS.maxQuestionChars} characters or fewer. You have ${questions.length}.`;
    if (organizations.length > LIMITS.maxOrganizationsChars) next.organizations = `Organizations must be ${LIMITS.maxOrganizationsChars} characters or fewer.`;
    setErrors(next);
    const count = Object.keys(next).length;
    if (count) {
      setStatus(`The form has ${count} error${count === 1 ? "" : "s"}. ${Object.values(next).join(" ")}`);
      if (next.topics) topicsRef.current?.focus();
      return;
    }
    const watch: Watch = { topics, organizations: organizations.trim(), questions: questions.trim(), depth, county: county || undefined };
    const saved = saveWatch(watch);
    setStatus(saved ? "Watch saved on this device. Opening your briefing." : "Your browser blocked local storage, so the watch could not be saved. Opening your briefing.");
    router.push("/briefing/");
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div role="status" aria-live="polite" className="ui">
        {status && <p className={Object.keys(errors).length ? "error-text" : undefined}>{status}</p>}
      </div>

      <fieldset aria-describedby={errors.topics ? "topics-error" : undefined}>
        <legend>What do you want to follow? (required)</legend>
        {errors.topics && (
          <p id="topics-error" className="error-text">
            {errors.topics}
          </p>
        )}
        <div className="chips">
          {TOPICS.map((t, i) => (
            <label className="chip" htmlFor={`topic-${t}`} key={t}>
              <input
                ref={i === 0 ? topicsRef : undefined}
                type="checkbox"
                id={`topic-${t}`}
                name="topics"
                value={t}
                checked={topics.includes(t)}
                onChange={() => toggleTopic(t)}
              />
              {TOPIC_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="organizations">Any organizations to track? (optional)</label>
        <p id="organizations-hint" className="hint">
          Separate names with commas. For example: a school district, a company or an agency.
        </p>
        <input
          type="text"
          id="organizations"
          name="organizations"
          value={organizations}
          onChange={(e) => setOrganizations(e.target.value)}
          aria-describedby={`organizations-hint${errors.organizations ? " organizations-error" : ""}`}
          aria-invalid={errors.organizations ? true : undefined}
        />
        {errors.organizations && (
          <p id="organizations-error" className="error-text">
            {errors.organizations}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="questions">What do you want to know? (optional)</label>
        <p id="questions-hint" className="hint">
          One per line, up to {LIMITS.maxQuestionChars} characters in total. Live research will look for sources that answer them.
        </p>
        <textarea
          id="questions"
          name="questions"
          rows={4}
          value={questions}
          onChange={(e) => setQuestions(e.target.value)}
          aria-describedby={`questions-hint${errors.questions ? " questions-error" : ""}`}
          aria-invalid={errors.questions ? true : undefined}
        />
        {errors.questions && (
          <p id="questions-error" className="error-text">
            {errors.questions}
          </p>
        )}
      </div>

      <fieldset>
        <legend>How should we explain things?</legend>
        <div className="option-cards">
          {DEPTHS.map((d) => (
            <label className="option-card" htmlFor={`depth-${d}`} key={d}>
              <input type="radio" id={`depth-${d}`} name="depth" value={d} checked={depth === d} onChange={() => setDepth(d)} />
              <span>
                {d[0].toUpperCase() + d.slice(1)}
                <span className="muted small">{DEPTH_HINT[d]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="county">Your county (optional)</label>
        <p id="county-hint" className="hint">
          The Ground Level lens traces national stories down to what they mean here. Local items are sample data for now.
        </p>
        <select id="county" name="county" value={county} onChange={(e) => setCounty(e.target.value as CountyId | "")} aria-describedby="county-hint">
          <option value="">No county, keep it national</option>
          {COUNTY_IDS.map((c) => (
            <option key={c} value={c}>
              {COUNTIES[c].name}
            </option>
          ))}
        </select>
      </div>

      <p className="hint">Your watch is saved only in this browser. Nothing is sent anywhere until you choose to run live research.</p>
      <button type="submit">Save and see my briefing</button>
    </form>
  );
}
