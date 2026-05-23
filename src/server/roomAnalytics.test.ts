import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearRoomAnalyticsForTests, getRoomAnalyticsHistorySnapshot, recordRoomAnalyticsEvent } from "./roomAnalytics";

describe("room analytics aggregation", () => {
  beforeEach(async () => {
    vi.stubEnv("AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL", "");
    vi.stubEnv("AI_WEREWOLF_ROOM_DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL", "file:./dev.db");
    await clearRoomAnalyticsForTests();
  });

  it("counts anonymous room flow milestones without inflating duplicate room milestones", async () => {
    await recordRoomAnalyticsEvent({ eventType: "room_page_view", subjectId: "view-1" });
    await recordRoomAnalyticsEvent({ eventType: "room_recovery_restored", subjectId: "restore-1" });
    await recordRoomAnalyticsEvent({ eventType: "room_speech_reached", roomId: "room-1", roomCode: "ABC123" });
    await recordRoomAnalyticsEvent({ eventType: "room_speech_reached", roomId: "room-1", roomCode: "ABC123" });
    await recordRoomAnalyticsEvent({ eventType: "room_vote_reached", roomId: "room-1", roomCode: "ABC123" });
    await recordRoomAnalyticsEvent({ eventType: "room_vote_reached", roomId: "room-1", roomCode: "ABC123" });
    await recordRoomAnalyticsEvent({ eventType: "room_vote_resolved", roomId: "room-1", roomCode: "ABC123" });
    await recordRoomAnalyticsEvent({ eventType: "room_vote_resolved", roomId: "room-1", roomCode: "ABC123" });

    const history = await getRoomAnalyticsHistorySnapshot({ days: 7 });

    expect(history.roomPageViews).toBe(1);
    expect(history.roomRecoveriesRestored).toBe(1);
    expect(history.roomsReachedSpeech).toBe(1);
    expect(history.roomsReachedVote).toBe(1);
    expect(history.roomsResolvedVote).toBe(1);
    expect(history.recentDays.at(-1)).toMatchObject({
      roomPageViews: 1,
      roomRecoveriesRestored: 1,
      roomsReachedSpeech: 1,
      roomsReachedVote: 1,
      roomsResolvedVote: 1,
    });
  });
});
