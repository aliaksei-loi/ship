import { bus, SHIP_EVENT } from "@/lib/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { signal } = request;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* client gone */
        }
      };

      const handler = (event: unknown) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      };
      bus.on(SHIP_EVENT, handler);

      // hello + 30s heartbeat
      send(`event: ready\ndata: {}\n\n`);
      const ping = setInterval(() => send(`: keep-alive\n\n`), 30000);

      const cleanup = () => {
        clearInterval(ping);
        bus.off(SHIP_EVENT, handler);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
