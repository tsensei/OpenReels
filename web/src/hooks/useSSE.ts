import { useCallback, useEffect, useRef } from "react";

interface SSEEvent {
  event: string;
  data: unknown;
}

export function useSSE(jobId: string | undefined, onEvent: (event: SSEEvent) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const doneRef = useRef(false);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!jobId || doneRef.current) return;

    const es = new EventSource(`/api/v1/jobs/${jobId}/events`);
    eventSourceRef.current = es;

    const handleEvent = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        onEventRef.current({ event: e.type, data });

        // Stop reconnecting once the job is terminal
        if (e.type === "job:completed" || e.type === "job:failed") {
          doneRef.current = true;
          es.close();
        }
      } catch {}
    };

    const eventTypes = [
      "stage:research",
      "stage:director",
      "stage:tts",
      "stage:visuals",
      "stage:assembly",
      "stage:critic",
      "job:snapshot",
      "job:completed",
      "job:failed",
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, handleEvent);
    }

    es.onerror = () => {
      es.close();
      if (!doneRef.current) {
        setTimeout(connect, 2000);
      }
    };

    return () => {
      es.close();
    };
  }, [jobId]);

  useEffect(() => {
    doneRef.current = false;
    const cleanup = connect();
    return () => {
      cleanup?.();
      eventSourceRef.current?.close();
    };
  }, [connect]);
}
