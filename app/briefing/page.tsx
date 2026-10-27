import type { Metadata } from "next";
import { BriefingPage } from "@/components/BriefingPage";

export const metadata: Metadata = { title: "My briefing" };

export default function Page() {
  return <BriefingPage />;
}
