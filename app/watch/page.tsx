import type { Metadata } from "next";
import { WatchForm } from "@/components/WatchForm";

export const metadata: Metadata = { title: "Follow a question" };

export default function WatchPage() {
  return (
    <div className="wrap">
      <h1>Follow a question</h1>
      <p>
        Choose what to follow and how deep to go. My Newsren will find reporting and primary documents, quote them, and
        tell you what it could not verify.
      </p>
      <WatchForm />
    </div>
  );
}
