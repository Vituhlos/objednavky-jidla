"use client";

import type { PublicFeedbackReply, VotableFeedback } from "@/lib/feedback-meta";
import { ChangesTimeline } from "./feedback/ChangesTimeline";
import { FeedbackComposer, type FeedbackPrefill } from "./feedback/FeedbackComposer";
import { HowItWorks } from "./feedback/HowItWorks";
import { MyFeedback } from "./feedback/MyFeedback";
import { useMyFeedback } from "./feedback/useMyFeedback";
import { VotingBoard } from "./feedback/VotingBoard";

export default function FeedbackPage({
  replies,
  votable,
  prefill,
}: {
  replies: PublicFeedbackReply[];
  votable: VotableFeedback[];
  prefill: FeedbackPrefill;
}) {
  const own = useMyFeedback();

  return (
    <div className="k-shell">

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-4 topbar shrink-0 min-h-[57px]">
        <span className="font-display font-bold text-[15px] text-stone-900">Připomínky</span>
        <span className="text-[12px] text-stone-500">Nápady, chyby i pochvaly</span>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">Připomínky</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start max-w-[1120px]">
          <FeedbackComposer onSent={own.remember} prefill={prefill} />
          <div className="flex flex-col gap-4">
            <HowItWorks />
            <MyFeedback items={own.items} onForget={own.forget} />
            <VotingBoard items={votable} />
            <ChangesTimeline replies={replies} />
          </div>
        </div>
      </main>
    </div>
  );
}
