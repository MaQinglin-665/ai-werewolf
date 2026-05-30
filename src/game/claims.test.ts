import { describe, expect, it } from "vitest";
import { extractRoleClaimFromSpeech, isSupportedRoleClaim } from "./claims";

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

  it("treats dramatic class-trial witch reveals as hard witch claims", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 6,
      message: "6号塞蕾丝缇雅。女巫在这里。药还握在我手上，谁要下注请现在开口。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim?.claimedRole).toBe("WITCH");
    expect(claim?.strength).toBe("hard");
  });

  it("does not turn dramatic class-trial witch wording on for ordinary games", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 6,
      message: "女巫在这里这个说法我不认可，我只是按平安夜做死亡形态推理。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "default" },
    });

    expect(claim).toBeUndefined();
  });

  it("keeps peaceful-night public reasoning distinct from a class-trial witch claim", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 1,
      message: "平安夜在我这里更像女巫用药结果，但这不是我明牌女巫。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim).toBeUndefined();
  });

  it("lets hard class-trial witch reveals win over negation-like wording", () => {
    const directReveal = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 6,
      message: "这不是暗示，我明牌女巫。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });
    const revealWithReasoning = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 6,
      message: "女巫在这里，平安夜更像女巫用药结果。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(directReveal?.claimedRole).toBe("WITCH");
    expect(directReveal?.strength).toBe("hard");
    expect(revealWithReasoning?.claimedRole).toBe("WITCH");
    expect(revealWithReasoning?.strength).toBe("hard");
  });

  it("treats dramatic class-trial seer reveals as hard seer claims", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 1,
      message: "我把预言家牌摊开，2号是金水。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim?.claimedRole).toBe("SEER");
    expect(claim?.strength).toBe("hard");
  });

  it("does not let witch reasoning suppress explicit class-trial seer claims", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 1,
      message: "我跳预言家，平安夜更像女巫用药结果。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim?.claimedRole).toBe("SEER");
    expect(claim?.strength).toBe("hard");
  });

  it("supports dramatic class-trial hunter gun claims", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 4,
      message: "枪在这里，别逼我开枪。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim?.claimedRole).toBe("HUNTER");
    expect(claim?.strength).toBe("hard");
    expect(isSupportedRoleClaim({ claimedRole: "HUNTER", message: "枪在这里，别逼我开枪。" })).toBe(true);
  });

  it("does not treat generic class-trial lead-the-vote wording as a hunter claim", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 4,
      message: "今天谁带人冲票都要解释。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim).toBeUndefined();
  });

  it("does not treat generic forced vote-lead wording as a hunter gun claim", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 4,
      message: "别逼我带人冲票。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim).toBeUndefined();
  });
});
