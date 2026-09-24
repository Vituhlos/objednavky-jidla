"use client";

import type { PublicFeedbackReply } from "@/lib/feedback-meta";
import MIcon from "./MIcon";
import { ChangesTimeline } from "./feedback/ChangesTimeline";
import { FeedbackComposer } from "./feedback/FeedbackComposer";
import { HowItWorks } from "./feedback/HowItWorks";

export default function FeedbackPage({ replies }: { replies: PublicFeedbackReply[] }) {
  return (
    <div className="k-shell">

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-4 topbar shrink-0 min-h-[57px]">
        <span className="font-display font-bold text-[15px] text-stone-900">Připomínky</span>
        <span className="text-[12px] text-stone-500">Nápady, chyby i pochvaly</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-stone-500">
          <MIcon name="lock" size={13} style={{ color: "#a8a29e" }} />
          Čte jen správce · jde to i bez jména
        </span>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">Připomínky</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
            <MIcon name="lock" size={12} style={{ color: "#a8a29e" }} />
            Čte jen správce
          </span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start max-w-[1120px]">
          <FeedbackComposer />
          <div className="flex flex-col gap-4">
            <HowItWorks />
            <ChangesTimeline replies={replies} />
          </div>
        </div>
      </main>
    </div>
  );
}
