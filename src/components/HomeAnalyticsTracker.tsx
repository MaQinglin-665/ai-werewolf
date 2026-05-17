"use client";

import { useEffect } from "react";

export function HomeAnalyticsTracker() {
  useEffect(() => {
    const payload = JSON.stringify({ eventType: "home_view", path: "/" });
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/events", blob);
      return;
    }

    void fetch("/api/analytics/events", {
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      method: "POST",
    }).catch(() => undefined);
  }, []);

  return null;
}
