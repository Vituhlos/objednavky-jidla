"use client";

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="v2-shell">
      <div className="v2-content" style={{ padding: "2rem" }}>
        <div className="v2-alert v2-alert--warn">
          <p>Nastala chyba: {error.message}</p>
        </div>
        <button onClick={reset} className="v2-btn v2-btn--secondary" style={{ marginTop: "1rem" }}>
          Zkusit znovu
        </button>
      </div>
    </div>
  );
}
