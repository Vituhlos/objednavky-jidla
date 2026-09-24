export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getPublicFeedbackReplies } from "@/lib/feedback";
import FeedbackPage from "@/app/components/FeedbackPage";

export const metadata: Metadata = {
  title: "Připomínky · Kantýna",
};

export default function Page() {
  return <FeedbackPage replies={getPublicFeedbackReplies()} />;
}
