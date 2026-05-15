import { subscribeTenant } from "@/lib/sse-broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  // params is a Promise but we need the slug synchronously to capture it.
  // Resolve it before building the stream.
  let unsubscribe: (() => void) | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    unsubscribe?.();
    unsubscribe = null;
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const { tenantSlug } = await params;
      controller.enqueue(encoder.encode(": connected\n\n"));

      unsubscribe = subscribeTenant(tenantSlug, () => {
        try {
          controller.enqueue(encoder.encode("event: change\ndata: {}\n\n"));
        } catch {
          cleanup();
        }
      });

      intervalId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 20_000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
