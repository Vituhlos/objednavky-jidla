import { getStatusMeta, type FeedbackStatus } from "@/lib/feedback-meta";

// Stejná řeč barev jako štítky v historii: tlumené pozadí, sytý text.
const STATUS_STYLES: Record<FeedbackStatus, React.CSSProperties> = {
  new: { background: "rgba(234,88,12,0.12)", color: "#c2410c" },
  read: { background: "rgba(26,18,8,0.07)", color: "#7a6552" },
  planned: { background: "rgba(59,130,246,0.12)", color: "#1d4ed8" },
  done: { background: "rgba(21,128,61,0.12)", color: "#15803d" },
  rejected: { background: "rgba(26,18,8,0.05)", color: "#a8a29e" },
};

export function StatusBadge({ status, label }: { status: FeedbackStatus; label?: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" style={STATUS_STYLES[status]}>
      {label ?? getStatusMeta(status).label}
    </span>
  );
}
