import { afterEach, describe, expect, it, vi } from "vitest";
import { sendRoomFlowAnalytics } from "./roomFlowAnalytics";

describe("sendRoomFlowAnalytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends anonymous room flow events with sendBeacon when available", () => {
    const sendBeacon = vi.fn((url: string, data?: BodyInit | null) => {
      void url;
      void data;
      return true;
    });
    vi.stubGlobal("navigator", { sendBeacon });

    sendRoomFlowAnalytics({ eventType: "room_page_view", path: "/rooms" });

    expect(sendBeacon).toHaveBeenCalledOnce();
    const [url, body] = sendBeacon.mock.calls[0];
    expect(url).toBe("/api/analytics/events");
    expect(JSON.parse(String(body))).toEqual({ eventType: "room_page_view", path: "/rooms" });
  });

  it("falls back to keepalive fetch and keeps payload anonymous", () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", fetch);

    sendRoomFlowAnalytics({ eventType: "room_recovery_restored", path: "/rooms" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.objectContaining({
        body: JSON.stringify({ eventType: "room_recovery_restored", path: "/rooms" }),
        keepalive: true,
        method: "POST",
      }),
    );
  });
});
