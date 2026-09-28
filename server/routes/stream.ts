import { Hono } from "hono";
import { subscribe, type RealtimeEvent } from "@/lib/events";
import { getCurrentUser } from "../auth";

export const streamRoutes = new Hono();

streamRoutes.get("/", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.text("Unauthorized", 401);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* closed */
        }
      };
      send(": connected\n\n");
      unsubscribe = subscribe((event: RealtimeEvent) => send(`data: ${JSON.stringify(event)}\n\n`));
      heartbeat = setInterval(() => send(": hb\n\n"), 25000);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
