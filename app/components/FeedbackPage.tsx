"use client";

import { useRouter } from "next/navigation";
import type { PublicFeedbackItem, PublicFeedbackReply, VotableFeedback } from "@/lib/feedback-meta";
import type { PublicReleaseNote } from "@/lib/release-notes";
import { ChangesTimeline } from "./feedback/ChangesTimeline";
import { FeedbackComposer, type FeedbackPrefill } from "./feedback/FeedbackComposer";
import { HowItWorks } from "./feedback/HowItWorks";
import { MyFeedback } from "./feedback/MyFeedback";
import { OthersFeedback } from "./feedback/OthersFeedback";
import { useMyFeedback } from "./feedback/useMyFeedback";
import { VotingBoard } from "./feedback/VotingBoard";
import { WhatsNew } from "./feedback/WhatsNew";

export default function FeedbackPage({
  replies,
  votable,
  others,
  releaseNotes,
  prefill,
}: {
  replies: PublicFeedbackReply[];
  votable: VotableFeedback[];
  others: PublicFeedbackItem[];
  releaseNotes: PublicReleaseNote[];
  prefill: FeedbackPrefill;
}) {
  const own = useMyFeedback();
  const router = useRouter();
  // Po odeslání načíst seznamy znovu, ať se nový nápad hned objeví v „Připomínkách ostatních“
  const onSent = (id: number, token: string) => {
    own.remember(id, token);
    router.refresh();
  };
  // Stažená připomínka zmizí i z nástěnky — ta je ze serveru, proto refresh
  const onWithdraw = async (id: number) => {
    const problem = await own.withdraw(id);
    if (!problem) router.refresh();
    return problem;
  };
  const ownIds = new Set(own.items.map((i) => i.id));

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
          <div className="flex flex-col gap-4 min-w-0">
            <FeedbackComposer onSent={onSent} prefill={prefill} />
            <OthersFeedback items={others} ownIds={ownIds} />
          </div>
          <div className="flex flex-col gap-4">
            <HowItWorks />
            <MyFeedback items={own.items} onForget={own.forget} onWithdraw={onWithdraw} />
            <VotingBoard items={votable} />
            <ChangesTimeline replies={replies} />
            <WhatsNew notes={releaseNotes} />
          </div>
        </div>
      </main>
    </div>
  );
}
