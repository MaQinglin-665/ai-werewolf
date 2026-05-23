import { beforeEach, describe, expect, it } from "vitest";
import { clearRoomAnalyticsForTests, getRoomAnalyticsHistorySnapshot } from "@/server/roomAnalytics";
import { POST as recordAnalyticsEvent } from "./route";

describe("analytics events route", () => {
  beforeEach(async () => {
    await clearRoomAnalyticsForTests();
  });

  it("accepts anonymous room page views with slash-prefixed paths", async () => {
    const response = await recordAnalyticsEvent(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventType: "room_page_view", path: "/rooms" }),
      }),
    );

    expect(response.status).toBe(200);
    const history = await getRoomAnalyticsHistorySnapshot();
    expect(history.roomPageViews).toBe(1);
    expect(history.homeViews).toBe(0);
  });

  it("accepts anonymous room recovery restored counts without room identity", async () => {
    const response = await recordAnalyticsEvent(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventType: "room_recovery_restored", path: "/rooms" }),
      }),
    );

    expect(response.status).toBe(200);
    const history = await getRoomAnalyticsHistorySnapshot();
    expect(history.roomRecoveriesRestored).toBe(1);
  });

  it("rejects non-page paths and identity fields", async () => {
    const invalidPathResponse = await recordAnalyticsEvent(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventType: "room_page_view", path: "https://evil.example" }),
      }),
    );
    expect(invalidPathResponse.status).toBe(400);

    const identityResponse = await recordAnalyticsEvent(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventType: "room_page_view", path: "/rooms", roomCode: "ABCD12" }),
      }),
    );
    expect(identityResponse.status).toBe(400);

    const history = await getRoomAnalyticsHistorySnapshot();
    expect(history.roomPageViews).toBe(0);
  });
});
