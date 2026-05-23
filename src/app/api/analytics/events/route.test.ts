import { beforeEach, describe, expect, it } from "vitest";
import { clearRoomAnalyticsForTests, getRoomAnalyticsHistorySnapshot } from "@/server/roomAnalytics";
import { POST as recordAnalyticsEvent } from "./route";

describe("analytics events route", () => {
  beforeEach(async () => {
    await clearRoomAnalyticsForTests();
  });

  it("accepts anonymous room page views with allowlisted public paths", async () => {
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

  it("accepts anonymous home views with the public home path", async () => {
    const response = await recordAnalyticsEvent(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventType: "home_view", path: "/" }),
      }),
    );

    expect(response.status).toBe(200);
    const history = await getRoomAnalyticsHistorySnapshot();
    expect(history.homeViews).toBe(1);
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

  it("rejects query-shaped path values", async () => {
    const response = await recordAnalyticsEvent(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventType: "room_page_view", path: "/rooms?playerToken=secret" }),
      }),
    );

    expect(response.status).toBe(400);
    const history = await getRoomAnalyticsHistorySnapshot();
    expect(history.roomPageViews).toBe(0);
  });

  it.each(["playerName", "playerId", "playerToken", "inviteToken", "recoveryToken"])(
    "rejects extra sensitive field %s",
    async (fieldName) => {
      const response = await recordAnalyticsEvent(
        new Request("http://localhost/api/analytics/events", {
          method: "POST",
          body: JSON.stringify({ eventType: "room_page_view", path: "/rooms", [fieldName]: "secret" }),
        }),
      );

      expect(response.status).toBe(400);
    },
  );

  it("rejects unknown event types and overlong paths", async () => {
    const unknownEventResponse = await recordAnalyticsEvent(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventType: "room_joined", path: "/rooms" }),
      }),
    );
    expect(unknownEventResponse.status).toBe(400);

    const overlongPathResponse = await recordAnalyticsEvent(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventType: "room_page_view", path: `/${"a".repeat(120)}` }),
      }),
    );
    expect(overlongPathResponse.status).toBe(400);
  });
});
