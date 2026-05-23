"use client";

type RoomFlowAnalyticsEventType = "room_page_view" | "room_recovery_restored";

export type RoomFlowAnalyticsEventBody = {
  eventType: RoomFlowAnalyticsEventType;
  path?: string;
};

const ROOM_FLOW_ANALYTICS_ENDPOINT = "/api/analytics/events";

export function sendRoomFlowAnalytics(event: RoomFlowAnalyticsEventBody): void {
  const body = JSON.stringify({
    eventType: event.eventType,
    ...(event.path ? { path: event.path } : {}),
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(ROOM_FLOW_ANALYTICS_ENDPOINT, body)) return;
    }

    if (typeof fetch === "function") {
      void fetch(ROOM_FLOW_ANALYTICS_ENDPOINT, {
        body,
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        method: "POST",
      }).catch(() => undefined);
    }
  } catch {
    // Analytics must never interrupt room entry or recovery flows.
  }
}
