import type { TraceStep } from "@/lib/agent/types";

export function TraceTable({ trace }: { trace: TraceStep[] }) {
  if (!trace.length) return <p>No trace recorded. This briefing was built without a model.</p>;
  return (
    <div className="table-scroll" role="region" aria-label="Agent trace" tabIndex={0}>
      <table>
        <caption className="visually-hidden">Each model call and tool call in the run</caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Action</th>
            <th scope="col">Arguments</th>
            <th scope="col">Results</th>
            <th scope="col">Tokens in / out</th>
          </tr>
        </thead>
        <tbody>
          {trace.map((t, i) => (
            <tr key={i}>
              <td>{t.step}</td>
              <td>{t.kind === "model" ? "Model call" : t.tool}</td>
              <td>{t.args ? JSON.stringify(t.args) : ""}</td>
              <td>{t.resultCount ?? (t.note ?? "")}</td>
              <td>{t.kind === "model" ? `${t.inputTokens} / ${t.outputTokens}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
