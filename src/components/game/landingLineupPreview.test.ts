import { describe, expect, it } from "vitest";
import { copyAiFriend, getDefaultAiFriends } from "@/game/aiFriends";
import { buildLandingLineupPreview } from "./landingLineupPreview";

describe("buildLandingLineupPreview", () => {
  it("keeps the selected human seat and fills the other seats with resolved AI friends", () => {
    const friends = getDefaultAiFriends("test").slice(0, 2);

    const preview = buildLandingLineupPreview({
      seatCount: 4,
      humanSeatMode: "fixed",
      selectedHumanSeatId: 2,
      selectedAiFriends: friends,
    });

    expect(preview.map((item) => ({ seatId: item.seatId, nickname: item.nickname, isHuman: item.isHuman, autoFilled: item.autoFilled }))).toEqual([
      { seatId: 1, nickname: "DeepSeek", isHuman: false, autoFilled: false },
      { seatId: 2, nickname: "你", isHuman: true, autoFilled: false },
      { seatId: 3, nickname: "Claude", isHuman: false, autoFilled: false },
      { seatId: 4, nickname: "DeepSeek2", isHuman: false, autoFilled: true },
    ]);
  });

  it("uses all seats for AI friends in spectator mode", () => {
    const custom = {
      ...copyAiFriend(getDefaultAiFriends("test")[0], { id: "friend-avatar", now: "2026-05-26T00:00:00.000Z" }),
      nickname: "旁观位AI",
      avatarDataUrl: "data:image/webp;base64,AAAA",
      ttsVoice: "voice-a",
    };

    const preview = buildLandingLineupPreview({
      seatCount: 2,
      humanSeatMode: "none",
      selectedHumanSeatId: null,
      selectedAiFriends: [custom],
    });

    expect(preview).toMatchObject([
      {
        seatId: 1,
        nickname: "旁观位AI",
        avatarDataUrl: "data:image/webp;base64,AAAA",
        ttsVoice: "voice-a",
        isHuman: false,
        autoFilled: false,
      },
      {
        seatId: 2,
        nickname: "DeepSeek",
        isHuman: false,
        autoFilled: true,
      },
    ]);
  });

  it("returns an empty preview until the board and selected human seat are ready", () => {
    expect(
      buildLandingLineupPreview({
        seatCount: 0,
        humanSeatMode: "random",
        selectedHumanSeatId: 1,
        selectedAiFriends: [],
      }),
    ).toEqual([]);

    expect(
      buildLandingLineupPreview({
        seatCount: 6,
        humanSeatMode: "fixed",
        selectedHumanSeatId: null,
        selectedAiFriends: [],
      }),
    ).toEqual([]);
  });
});
