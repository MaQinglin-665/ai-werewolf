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

  it("parses characterful seer black checks with a named target and pronoun result", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 1,
      message:
        "好，昨晚平安夜，女巫用药了。我是预言家，苗木诚。我昨晚查了3号腐川冬子——她是狼人。今天票口先压在3号身上。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim?.claimedRole).toBe("SEER");
    expect(claim?.strength).toBe("hard");
    expect(claim?.checks).toEqual([
      expect.objectContaining({
        claimantSeatId: 1,
        targetSeatId: 3,
        result: "WEREWOLF",
      }),
    ]);
  });

  it("parses class-trial seer checks when a dash-separated name is followed by result-is-wolf wording", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 1,
      message:
        "我先说一件事。我是预言家，昨晚查了3号——腐川冬子，结果是狼。今天先别把3号轻轻放过去。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim?.claimedRole).toBe("SEER");
    expect(claim?.strength).toBe("hard");
    expect(claim?.checks).toEqual([
      expect.objectContaining({
        claimantSeatId: 1,
        targetSeatId: 3,
        result: "WEREWOLF",
      }),
    ]);
  });

  it("parses class-trial self-intro seer claims with seat and character name before the role", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 1,
      message:
        "我是1号苗木诚，预言家，昨晚验了6号塞蕾丝缇雅，查杀，她是狼。今天我的票挂在6号。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim?.claimedRole).toBe("SEER");
    expect(claim?.strength).toBe("hard");
    expect(claim?.checks).toEqual([
      expect.objectContaining({
        claimantSeatId: 1,
        targetSeatId: 6,
        result: "WEREWOLF",
      }),
    ]);
  });

  it("treats a self-owned check result and gold water as a hard seer claim", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 1,
      message:
        "大家……早上好。我知道第一天信息很少，平安夜也让我们暂时没有明确的伤亡可以讨论。但这就是我的查验结果，我必须说出来。 我们今天能一起验证的点，就是3号腐川冬子接了这张金水之后的发言。我希望你能先听听3号腐川冬子怎么聊，然后我们看看后面对这个查验结果的反应。我们先确认这一点：3号是好人，那么今天，我们的出人焦点就不应该在她身上。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim?.claimedRole).toBe("SEER");
    expect(claim?.strength).toBe("hard");
    expect(claim?.checks).toEqual([
      expect.objectContaining({
        claimantSeatId: 1,
        targetSeatId: 3,
        result: "GOOD",
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

  it("does not treat recognizing another player's witch claim as a self witch claim", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 3,
      message: "2号Claude的女巫声明目前没人对跳，我先认，但4号银水要发言闭合。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim).toBeUndefined();
  });

  it("does not treat quoted witch-claim wording while recognizing another witch as a self claim", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 3,
      message:
        "2号Claude跳女巫救了4号豆包，这个身份我暂时先认，因为没有对跳，而且他给了具体银水目标，这个比单纯说“我是女巫”要硬一点。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim).toBeUndefined();
  });

  it("does not treat referenced black-check positions as a new self seer check", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 6,
      message:
        "苗木诚这张牌已经拍在桌上了，3号就是查杀位，这个结果我暂时收下。腐川冬子，你准备用哪枚筹码替自己开脱。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
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

  it("parses seat-only comma witch reveals as hard witch claims", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 2,
      message: "我是2号，女巫。昨晚救的是4号豆包，4号是银水。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim?.claimedRole).toBe("WITCH");
    expect(claim?.strength).toBe("hard");
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

  it("treats concise ordinary witch save reports as hard witch claims", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 2,
      message: "我是2号Claude，女巫。平安夜我救了4号豆包，4号是银水。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim?.claimedRole).toBe("WITCH");
    expect(claim?.strength).toBe("hard");
  });

  it("treats colloquial I-witch save reports as hard witch claims", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 2,
      message: "平安夜，我女巫，昨晚救了4号豆包，4号是银水。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim?.claimedRole).toBe("WITCH");
    expect(claim?.strength).toBe("hard");
  });

  it("does not treat a silver-water recipient acknowledgement as a witch claim", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 4,
      message: "我是4号豆包。2号Claude说我是银水，我先接这个信息。但今天先不聊这个，我手里没东西。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim).toBeUndefined();
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

  it("does not treat refusing to confirm public medicine as a witch claim", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 2,
      message: "我不替女巫确认解药，只按平安夜盘。",
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

  it("treats concise ordinary hunter self reports as hard hunter claims", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 1,
      message: "1号DeepSeek，女巫用药了，平安夜。我是猎人，底牌不虚，但今天不急着拍身份打轮次。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim?.claimedRole).toBe("HUNTER");
    expect(claim?.strength).toBe("hard");
  });

  it("treats seat-name seer reports as hard seer claims", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 8,
      message: "8号Kimi，预言家。昨晚验的2号Claude，查杀。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });

    expect(claim?.claimedRole).toBe("SEER");
    expect(claim?.strength).toBe("hard");
    expect(claim?.checks).toEqual([expect.objectContaining({ targetSeatId: 2, result: "WEREWOLF" })]);
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
