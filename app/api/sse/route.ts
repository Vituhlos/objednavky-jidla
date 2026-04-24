import { subscribe } from "@/lib/sse-broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      unsubscribe = subscribe(() => {
        try {
          controller.enqueue(encoder.encode("event: change\ndata: {}\n\n"));
        } catch {
          // client already disconnected
        }
      });

      intervalId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          if (intervalId) clearInterval(intervalId);
        }
      }, 20_000);
    },
    cancel() {
      unsubscribe?.();
      if (intervalId) clearInterval(intervalId);
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
