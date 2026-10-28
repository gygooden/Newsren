import type { Metadata } from "next";
import { WatchForm } from "@/components/WatchForm";

export const metadata: Metadata = { title: "Start a watch" };

export default function WatchPage() {
  return (
    <div className="wrap">
      <div className="page-intro">
        <p className="eyebrow">Step 1 of 2</p>
        <h1>Start a watch</h1>
        <p className="lede">
          Tell us what to keep an eye on. Your briefing will quote real sources and flag anything it could not verify. It
          takes about a minute.
        </p>
      </div>
      <WatchForm />
    </div>
  );
}
