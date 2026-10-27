"use client";

import { useState } from "react";
import { clearAll } from "@/lib/site/storage";

export function ClearDataButton() {
  const [status, setStatus] = useState("");
  return (
    <>
      <button type="button" onClick={() => setStatus(clearAll() ? "Your watch, review queue, decisions, alerts and last live briefing were removed from this browser." : "This browser blocked access to local storage. Clear site data in your browser settings instead.")}>
        Clear my data
      </button>
      <div aria-live="polite">{status && <p>{status}</p>}</div>
    </>
  );
}
