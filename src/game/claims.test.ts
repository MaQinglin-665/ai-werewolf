import { describe, expect, it } from "vitest";
import { extractRoleClaimFromSpeech } from "./claims";

describe("role claim extraction", () => {
  it("parses seer checks when a model display name follows the seat number", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 3,
      message: "3号发言。我跳预言家，2号Claude-DS-reason是我昨晚验的查杀，狼人。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim?.claimedRole).toBe("SEER");
    expect(claim?.checks).toEqual([
      expect.objectContaining({
        claimantSeatId: 3,
        targetSeatId: 2,
        result: "WEREWOLF",
      }),
    ]);
  });

  it("keeps a seer black-check claim hard when the reason quotes another soft identity phrase", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 3,
      message:
        "3号发言。我跳预言家，2号Claude-DS-reason是我的查杀。昨晚验他就是觉得他开场发言虽然点出1号不拍身份的问题，但自己也没给出具体怀疑对象或票向。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim?.claimedRole).toBe("SEER");
    expect(claim?.strength).toBe("hard");
    expect(claim?.checks).toEqual([
      expect.objectContaining({
        claimantSeatId: 3,
        targetSeatId: 2,
        result: "WEREWOLF",
      }),
    ]);
  });

  it("does not treat endorsing another seer as a self seer claim", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 4,
      message: "我认3号预言家这条线，查杀先走。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim).toBeUndefined();
  });

  it("does not treat peaceful-night witch-use reasoning as a witch claim", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 1,
      message: "1号发言。平安夜在我这里是女巫用药的结果，狼队空刀概率太低，我不按空刀来盘。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim).toBeUndefined();
  });
});
