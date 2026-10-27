import type { SourceRecord } from "@/lib/agent/types";
import { sourceLabel } from "@/lib/agent/util";
import { DocumentIcon } from "./Icons";

type HeadingTag = "h2" | "h3" | "h4";

export function SourceLabel({ record }: { record: SourceRecord }) {
  return <span className="label label-source">{sourceLabel(record)}</span>;
}

export function StatusLabel({ text }: { text: string }) {
  const cls = text === "Not yet reported by a journalist" ? "label label-unreported" : text === "Reported" ? "label label-reported" : "label";
  return <span className={cls}>{text}</span>;
}

/** The source report leads every item: outlet or agency, author, title, excerpt, link. */
export function SourceReport({ record, heading = "h3" }: { record: SourceRecord; heading?: HeadingTag }) {
  const H = heading;
  const p = record.provenance;
  return (
    <div>
      <p className="ui small" style={{ margin: "0 0 0.25rem" }}>
        <SourceLabel record={record} />
        {record.kind === "arxiv" && <StatusLabel text="Preprint, not peer reviewed" />}
        {record.recordType === "document" && <span className="label">{record.docType}</span>}
        {record.recordType === "opinion" && <span className="label">Opinion</span>}
      </p>
      <H style={{ marginTop: "0.25rem" }}>{record.title}</H>
      <p className="ui small muted" style={{ margin: "0 0 0.5rem" }}>
        {record.recordType === "document" && <DocumentIcon />}
        {p.outlet}
        {p.author && p.author !== p.outlet ? ` · ${p.author}` : ""} · <time dateTime={p.publishedAt}>{p.publishedAt}</time>
      </p>
      <blockquote>{record.excerpt}</blockquote>
      <p className="ui small">
        {p.sourceUrl ? (
          <a href={p.sourceUrl} rel="noopener noreferrer">
            Read the original at {p.outlet}: {record.title}
          </a>
        ) : (
          <span className="muted">Sample record. No original publication exists.</span>
        )}
      </p>
    </div>
  );
}
