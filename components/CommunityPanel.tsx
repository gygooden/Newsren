"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { COUNTIES, type CountyId, type Depth } from "@/lib/agent/types";
import {
  describeAuthor,
  NAME_MAX_CHARS,
  NOTE_MAX_CHARS,
  REACTIONS,
  ROLE_IDS,
  ROLES,
  summarizePulse,
  type PublicNote,
  type PulseCounts,
  type Reaction,
  type Role,
} from "@/lib/community";
import { readCommunity, sendNote, sendPulse } from "@/lib/site/community";
import { KEYS, loadWatch, readJson, writeJson } from "@/lib/site/storage";

const ROLE_FROM_DEPTH: Record<Depth, Role> = { student: "student", educator: "educator", professional: "worker" };

function plural(n: number, word: string) {
  return `${n} ${word.toLowerCase()}${n === 1 ? "" : "s"}`;
}

export function CommunityPanel({ story }: { story: string }) {
  const [county, setCounty] = useState<CountyId | undefined>();
  const [role, setRole] = useState<Role>("resident");
  const [pulse, setPulse] = useState<PulseCounts>({});
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [reacted, setReacted] = useState<string[]>([]);
  const [loadError, setLoadError] = useState("");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const watch = loadWatch();
    const c = watch?.county;
    setCounty(c);
    setRole(readJson<Role | null>(KEYS.role, null) ?? (watch ? ROLE_FROM_DEPTH[watch.depth] : "resident"));
    setReacted(readJson<string[]>(KEYS.reacted, []));
    readCommunity(story, c).then((r) => {
      if (r.ok) {
        setPulse(r.data.pulse);
        setNotes(r.data.notes);
      } else setLoadError(r.message);
    });
  }, [story]);

  const countyName = county ? COUNTIES[county].name : null;
  const summary = summarizePulse(pulse, county);
  const voices = summary.reduce((n, s) => n + s.total, 0);
  const localVoices = summary.reduce((n, s) => n + s.inCounty, 0);

  function chooseRole(r: Role) {
    setRole(r);
    writeJson(KEYS.role, r);
  }

  async function react(reaction: Reaction) {
    const key = `${story}:${reaction}`;
    if (reacted.includes(key)) return;
    const r = await sendPulse({ story, reaction, role, county });
    if (!r.ok) {
      setStatus(r.message);
      return;
    }
    if (r.data.pulse) setPulse(r.data.pulse);
    const next = [...reacted, key];
    setReacted(next);
    writeJson(KEYS.reacted, next);
    setStatus(`Added: ${REACTIONS[reaction]}.`);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError("");
    setStatus("");
    if (text.trim().length < 3) {
      setError("Write a note of at least 3 characters.");
      return;
    }
    setSending(true);
    const r = await sendNote({ story, text, role, county, name: county ? name : undefined });
    setSending(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setText("");
    setStatus(r.data.message);
  }

  return (
    <section aria-labelledby="community-heading" className="community">
      <p className="eyebrow">Community</p>
      <h2 id="community-heading" style={{ marginTop: "0.25rem" }}>
        What readers {countyName ? "near you " : ""}are saying
      </h2>
      <p className="muted">
        {voices === 0
          ? "No one has weighed in yet. Be the first."
          : `${plural(voices, "reaction")} so far${countyName ? `, ${localVoices} from ${countyName}` : ""}.`}{" "}
        {!countyName && (
          <>
            <Link href="/watch/">Add your county</Link> to see who near you is weighing in.
          </>
        )}
      </p>
      {loadError && <p className="notice small">{loadError}</p>}

      <div className="field">
        <label htmlFor="community-role">I am a</label>
        <select id="community-role" value={role} onChange={(e) => chooseRole(e.target.value as Role)} style={{ maxWidth: "16rem" }}>
          {ROLE_IDS.map((r) => (
            <option key={r} value={r}>
              {ROLES[r]}
            </option>
          ))}
        </select>
      </div>

      <h3>How does this land for you?</h3>
      <ul className="pulse plain-list">
        {summary.map((s) => {
          const pressed = reacted.includes(`${story}:${s.reaction}`);
          return (
            <li key={s.reaction}>
              <button type="button" className="pulse-button" aria-pressed={pressed} onClick={() => react(s.reaction)}>
                <span>{REACTIONS[s.reaction]}</span>
                <strong>{s.total}</strong>
              </button>
              {s.total > 0 && (
                <p className="small muted pulse-who">
                  {countyName && s.inCounty > 0 && <span className="label label-source">{s.inCounty} near you</span>}
                  {s.byRole.map((b) => plural(b.count, ROLES[b.role])).join(" · ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div role="status" aria-live="polite" className="small">
        {status && <p>{status}</p>}
      </div>

      <h3>Notes from readers</h3>
      {notes.length === 0 ? (
        <p className="muted">No notes yet.</p>
      ) : (
        <ul className="plain-list">
          {notes.map((n) => (
            <li key={n.id} className="card note">
              <p className="note-author small">
                <strong>{n.name ? `${n.name}, ` : ""}{describeAuthor(n)}</strong>
                {county && n.county === county && <span className="label label-reported">Your area</span>}
                <time dateTime={n.createdAt} className="muted">
                  {n.createdAt.slice(0, 10)}
                </time>
              </p>
              <p>{n.text}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} noValidate className="card">
        <h3 style={{ marginTop: 0 }}>Add a note</h3>
        <p className="hint">
          Posting as <strong>{describeAuthor({ role, county })}</strong>. A moderator reviews every note before it appears.
          No links, emails or phone numbers.
        </p>
        <div className="field">
          <label htmlFor="note-text">Your note</label>
          <textarea
            id="note-text"
            rows={3}
            maxLength={NOTE_MAX_CHARS}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-describedby={`note-count${error ? " note-error" : ""}`}
            aria-invalid={error ? true : undefined}
          />
          <p id="note-count" className="hint">
            {text.length} of {NOTE_MAX_CHARS} characters
          </p>
        </div>
        {county ? (
          <div className="field">
            <label htmlFor="note-name">Name to show (optional)</label>
            <p id="note-name-hint" className="hint">
              Leave blank to stay anonymous. Your name is shown only to readers who set {countyName} as their county. Counties
              are self-reported, so anyone who picks {countyName} could see it.
            </p>
            <input type="text" id="note-name" maxLength={NAME_MAX_CHARS} value={name} onChange={(e) => setName(e.target.value)} aria-describedby="note-name-hint" autoComplete="given-name" />
          </div>
        ) : (
          <p className="hint">Your note will be anonymous. Add a county to your watch if you want to show your name to readers in your area.</p>
        )}
        {error && (
          <p id="note-error" className="error-text">
            {error}
          </p>
        )}
        <button type="submit" disabled={sending}>
          {sending ? "Sending" : "Send for review"}
        </button>
      </form>
    </section>
  );
}
