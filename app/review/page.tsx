import type { Metadata } from "next";
import { CommunityModeration } from "@/components/CommunityModeration";
import { ReviewQueue } from "@/components/ReviewQueue";

export const metadata: Metadata = { title: "Review queue" };

export default function ReviewPage() {
  return (
    <div className="wrap">
      <h1>Editor review queue</h1>
      <p>
        Nothing reaches the public front page until an editor approves it here. Live briefings are delivered only to the
        reader who asked for them.
      </p>
      <p className="notice">
        In this proof of concept the queue and the approvals are stored in this browser&apos;s local storage, so only this
        device sees them. A shared review queue for a newsroom is future work. Stories on the public front page are listed
        in <code>config/approved.json</code>.
      </p>
      <ReviewQueue />
      <CommunityModeration />
    </div>
  );
}
