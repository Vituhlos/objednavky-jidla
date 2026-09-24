export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/feedback-meta";
import { getPublicFeedbackReplies } from "@/lib/feedback";
import FeedbackPage from "@/app/components/FeedbackPage";

export const metadata: Metadata = {
  title: "Připomínky · Kantýna",
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Parametry z odkazu „Nahlásit problém“ (chybová stránka, nápověda):
 * `?kategorie=chyba&odkud=/historie&chyba=…`. Server je stejně validuje znovu
 * při odeslání — tady jde jen o předvyplnění.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const category = first(params.kategorie);
  const page = first(params.odkud);
  return (
    <FeedbackPage
      prefill={{
        category: FEEDBACK_CATEGORIES.some((c) => c.id === category) ? (category as FeedbackCategory) : null,
        page: /^\/[a-z0-9/_-]{0,99}$/i.test(page) ? page : "",
        context: first(params.chyba).slice(0, 300),
      }}
      replies={getPublicFeedbackReplies()}
    />
  );
}
