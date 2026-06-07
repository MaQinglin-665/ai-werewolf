import { describe, expect, it } from "vitest";
import { analyzeClassTrialSpeechQuality } from "./classTrialSpeechQuality";

describe("analyzeClassTrialSpeechQuality", () => {
  it("marks boring but correct speech as viewer-quality failure without hard invalidation", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 2,
      name: "雾切响子",
      roleId: "kirigiri",
      isFallback: false,
      speech: "我认为1号报查杀需要验证，3号先发言，后续看票型。",
      previousSpeeches: [],
      roleOveruseBans: ["不要反复说验证", "不要总是中立审计"],
    });

    expect(result.hardInfoUseful).toBe(true);
    expect(result.viewerQuality).toBe("fail");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "boring_but_correct")).toBe(true);
  });

  it("returns evidence and revision direction for repeated role-label wording", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 5,
      name: "江之岛盾子",
      roleId: "enoshima",
      isFallback: false,
      speech: "这个结构的收益太清楚了，谁从混乱里获利就看谁。",
      previousSpeeches: [{ seatId: 2, name: "雾切响子", speech: "这条结构的收益太顺了。" }],
      roleOveruseBans: ["不要反复说结构", "不要反复说收益"],
    });

    expect(result.viewerQuality).toBe("fail");
    expect(result.repeatedAxes).toEqual(expect.arrayContaining(["structure", "benefit"]));
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "role_label_repeat" && finding.revisionDirection.length > 0)).toBe(
      true,
    );
  });

  it("keeps fallback rows out of anti-template quality scoring", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 4,
      name: "黑白熊",
      isFallback: true,
      speech: "按现在桌面看，我先把票口放这里。",
      previousSpeeches: [{ seatId: 1, name: "苗木诚", speech: "按现在桌面看，后续看票型。" }],
    });

    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings).toEqual([]);
  });

  it("does not flag a direct live move just because it mentions public facts", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 4,
      name: "腐川冬子",
      roleId: "fukawa",
      speech: "别把票塞给我。1号报查杀太干净了，我先压3号一句：你为什么第一反应不是反咬他？",
      isFallback: false,
      previousSpeeches: [{ seatId: 1, name: "雾切响子", speech: "3号是狼，今天先听他怎么解释。" }],
    });

    expect(result.liveIntentPresent).toBe(true);
    expect(result.characterPresence).toBe("strong");
    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings).toEqual([]);
  });

  it("treats Naegi hope-boundary black checks as character presence instead of plain seer reporting", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 1,
      name: "苗木诚",
      roleId: "naegi",
      isFallback: false,
      speech:
        "我是预言家，昨晚查验3号腐川冬子是狼人。我知道这句话很重，但结果必须说出来；我们先共同确认这一点，今天谁要保她，就公开和这个结果对撞。",
      previousSpeeches: [],
    });

    expect(result.characterPresence).not.toBe("weak");
    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "weak_character_presence")).toBe(false);
  });

  it("treats Naegi's result-boundary phrasing as character presence even without saying hope", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 1,
      name: "苗木诚",
      roleId: "naegi",
      isFallback: false,
      speech:
        "我是预言家，昨晚查了3号腐川冬子——结果是狼。我知道这句话很重，但结果必须说出来。请后面的人不要绕开这个结果，我需要看到每个人对这个查杀的态度。我们先确认这一点，然后一步步来。",
      previousSpeeches: [],
    });

    expect(result.characterPresence).not.toBe("weak");
    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "weak_character_presence")).toBe(false);
  });

  it("flags Kirigiri pressuring an unopposed black-check claimant before the checked seat responds", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 2,
      name: "雾切响子",
      roleId: "kirigiri",
      isFallback: false,
      speech:
        "苗木诚，你首置位跳预言家报3号查杀，票压得太死了。你是在预设有人保她，还是提前封住别人缓看的空间？",
      previousSpeeches: [{ seatId: 1, name: "苗木诚", speech: "我跳预言家，昨晚查验3号腐川冬子是狼人，今天票先压这里。" }],
    });

    expect(result.viewerQuality).toBe("fail");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "unearned_claimant_pressure")).toBe(true);
    expect(result.antiTemplateFindings.find((finding) => finding.kind === "unearned_claimant_pressure")?.revisionDirection).toContain(
      "被查杀位",
    );
  });

  it("does not flag Kirigiri when she holds the claimant provisional and forces the checked response", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 2,
      name: "雾切响子",
      roleId: "kirigiri",
      isFallback: false,
      speech:
        "苗木诚的预言家查杀先放桌面。我不急着替他站台，也不替他拆台。现在的问题是腐川冬子还没发言，她怎么接这一刀。",
      previousSpeeches: [{ seatId: 1, name: "苗木诚", speech: "我跳预言家，昨晚查验3号腐川冬子是狼人，今天票先压这里。" }],
    });

    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "unearned_claimant_pressure")).toBe(false);
  });

  it("treats Kirigiri holding a black-check result and cutting to the checked seat as character presence", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 2,
      name: "雾切响子",
      roleId: "kirigiri",
      isFallback: false,
      speech:
        "1号，你的查验结果我听到了。3号腐川冬子，你报得很快，结论也很干脆；这部分我先不接住。3号，正面接这个查杀，你是反跳、认平民，还是指出预言家哪里搞错了？我要的是能让人核对的说法。",
      previousSpeeches: [{ seatId: 1, name: "苗木诚", speech: "我跳预言家，昨晚查验3号腐川冬子是狼人，今天票先压这里。" }],
    });

    expect(result.characterPresence).not.toBe("weak");
    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "weak_character_presence")).toBe(false);
  });

  it("treats Kirigiri naming the checked-seat response order as detective action", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 2,
      name: "雾切响子",
      roleId: "kirigiri",
      isFallback: false,
      speech:
        "苗木诚第一个起跳，查杀落在3号腐川冬子。既然有人报查杀，今天焦点是谁接杀、谁救、谁改目标。3号，轮到你。不要铺垫，一句话说清你是什么身份、对苗木诚这个起跳怎么看。我听完你，再决定这一轮票怎么放。",
      previousSpeeches: [{ seatId: 1, name: "苗木诚", speech: "我跳预言家，昨晚查验3号腐川冬子是狼人，今天票先压这里。" }],
    });

    expect(result.characterPresence).not.toBe("weak");
    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "weak_character_presence")).toBe(false);
  });

  it("flags Kirigiri when checked-response language still centers claimant pressure", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 2,
      name: "雾切响子",
      roleId: "kirigiri",
      isFallback: false,
      speech:
        "苗木诚首置位直接报查杀，三个动作一口气做完，没有留余地。你给后置位留的观察窗口很小。腐川冬子还没发言。",
      previousSpeeches: [{ seatId: 1, name: "苗木诚", speech: "我跳预言家，昨晚查验3号腐川冬子是狼人，今天票先压这里。" }],
    });

    expect(result.viewerQuality).toBe("fail");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "unearned_claimant_pressure")).toBe(true);
  });

  it("flags later speakers reusing the same black-check claimant pressure axis", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 5,
      name: "江之岛盾子",
      roleId: "enoshima",
      isFallback: false,
      speech:
        "苗木诚首置位跳预言家报腐川冬子查杀，票压得这么死，后置位谁站得舒服才有意思。我先看谁顺着这条查杀走。",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "我跳预言家，昨晚查验3号腐川冬子是狼人，今天票先压这里。" },
        { seatId: 2, name: "雾切响子", speech: "这条查杀先放桌面，3号腐川冬子必须正面接。" },
        { seatId: 3, name: "腐川冬子", speech: "我不认这条查杀，他一句话就想把我按死。" },
      ],
    });

    expect(result.viewerQuality).toBe("warn");
    expect(result.repeatedAxes).toContain("black-check");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "black_check_axis_repeat")).toBe(true);
  });

  it("does not flag Monokuma's direct checked-seat poke as abstract axis repeat", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 4,
      name: "黑白熊",
      roleId: "monokuma",
      isFallback: false,
      speech:
        "噗哈哈——平安夜，然后苗木诚第一句话就砸了个查杀在腐川冬子头上。有意思，真有意思。腐川冬子，你说“不认这条查杀”，但你接下去只说了一句“今天我哪里不接”——你倒是接啊。你是什么身份？你要打苗木诚是悍跳，那你至少给个方向。",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "平安夜。我跳预言家，昨晚查验3号腐川冬子是狼人，今天票先压这里。" },
        { seatId: 2, name: "雾切响子", speech: "3号腐川冬子必须正面接这条查杀。" },
        { seatId: 3, name: "腐川冬子", speech: "我不认这条查杀，苗木诚一句话就想把我按死。" },
      ],
    });

    expect(result.characterPresence).not.toBe("weak");
    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "thought_axis_repeat")).toBe(false);
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "black_check_axis_repeat")).toBe(false);
  });

  it("does not flag the first direct checked-seat follow-up after the checked seat answers", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 4,
      name: "黑白熊",
      roleId: "monokuma",
      isFallback: false,
      speech:
        "噗，这局真有意思。苗木诚首置位拍查杀——动作够果断，但腐川冬子你的接法更有趣。你第一反应不是跳身份自证，而是反过来质疑他“准备得太顺”？那我问你一句实话：你是狼，你今天打算怎么活下来？",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "我是预言家，昨晚查验3号腐川冬子查杀，今天票先压这里。" },
        { seatId: 2, name: "雾切响子", speech: "腐川冬子必须正面回答——你查她，她认不认。" },
        { seatId: 3, name: "腐川冬子", speech: "我不认这条查杀，苗木诚一句话就想把我按死。" },
      ],
    });

    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "black_check_axis_repeat")).toBe(false);
  });

  it("does not flag Monokuma's observer-seat poke as abstract axis repeat", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 4,
      name: "黑白熊",
      roleId: "monokuma",
      isFallback: false,
      speech:
        "噗哈哈，有意思有意思！苗木诚首置位跳预言家，一口咬死3号查杀。腐川冬子接杀的反应倒是挺标准。你们两个这一来一回，裁判席上看得清清楚楚。但我更在意的是——2号雾切响子小同学，你说不急着全盘接受也不急着否定，先听3号怎么说……这不就是最安全的观望位吗。",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "苗木诚首置位跳预言家，报3号腐川冬子查杀。" },
        { seatId: 2, name: "雾切响子", speech: "我不急着全盘接受，先听3号怎么接这条查杀。" },
        { seatId: 3, name: "腐川冬子", speech: "我不认这条查杀，苗木诚首置位太急。" },
      ],
    });

    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "thought_axis_repeat")).toBe(false);
  });

  it("does not flag Enoshima when she quotes the black-check axis only to pivot the stage to a new target", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 5,
      name: "江之岛盾子",
      roleId: "enoshima",
      isFallback: false,
      speech:
        "哎呀，这就有趣了。1号报查杀，3号接得不干脆，但你们的注意力是不是跑偏了？从1号开口到现在，谁跟得最舒服？不是3号，是2号雾切。她那句“我先不接住”听起来像在给他留台阶。",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "我跳预言家，昨晚查验3号腐川冬子是狼人，今天票先压这里。" },
        { seatId: 2, name: "雾切响子", speech: "这条查杀先放桌面，3号腐川冬子必须正面接。" },
        { seatId: 3, name: "腐川冬子", speech: "我不认这条查杀，他一句话就想把我按死。" },
      ],
    });

    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "thought_axis_repeat")).toBe(false);
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "black_check_axis_repeat")).toBe(false);
  });

  it("does not flag Enoshima when she says she cares more about a follower than the checked seat", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 5,
      name: "江之岛盾子",
      roleId: "enoshima",
      isFallback: false,
      speech:
        "呀——平安夜，然后苗木诚第一句话就砸了个查杀出来。有意思，真有意思。不过呢，比起腐川冬子那句“我不认”，我更在意的是——黑白熊，你刚才那段话接得也太舒服了吧。你急着帮查杀位定调子？还是说你早就知道腐川冬子接不住这个查杀，所以先替她把场子暖好。",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "平安夜。我跳预言家，昨晚查验3号腐川冬子是狼人，今天票先压这里。" },
        { seatId: 3, name: "腐川冬子", speech: "我不认这条查杀，苗木诚一句话就想把我按死。" },
        { seatId: 4, name: "黑白熊", speech: "腐川冬子你只说不认，你倒是接啊。" },
      ],
    });

    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "black_check_axis_repeat")).toBe(false);
  });

  it("does not flag Enoshima when she directly addresses a follower and continues with pronoun pressure", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 5,
      name: "江之岛盾子",
      roleId: "enoshima",
      isFallback: false,
      speech:
        "哎呀，这就有趣了。苗木诚一张嘴就把票压在了腐川冬子身上，腐川冬子接得倒是快，可最让我想看的，不是他们两个。黑白熊，你刚才那段话挺有意思的。你说苗木诚首置位查杀编的“太有道理”了，替他盘了一整条“为什么挑腐川冬子”的作案动机。可问题是——你为什么要替他盘得这么完整？苗木诚自己都没说几句，你就急着帮他把查杀的合理性补完了。",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "我跳预言家，昨晚查验3号腐川冬子查杀，今天票先压这里。" },
        { seatId: 3, name: "腐川冬子", speech: "哈啊，苗木诚首置位跳预言家查杀我，像是早就准备好这张发言稿。" },
        { seatId: 4, name: "黑白熊", speech: "腐川冬子那套话像是在说苗木诚查杀编得太有道理了。" },
      ],
    });

    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "black_check_axis_repeat")).toBe(false);
  });

  it("still flags Enoshima when a follower pivot ends by replaying checked-seat self-proof", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 5,
      name: "江之岛盾子",
      roleId: "enoshima",
      isFallback: false,
      speech:
        "哎呀，这就有趣了。黑白熊，你刚才追着腐川冬子说“你没报身份”，但你自己的话里藏了什么呢？你替她划了个标准——被查杀就该先说“我不是狼”。腐川冬子，你没接“我不是狼”这个球，我倒是看得很清楚。",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "我是预言家，昨晚查验3号腐川冬子是狼人，今天票先压这里。" },
        { seatId: 3, name: "腐川冬子", speech: "我不认这条查杀，苗木诚一句话就想把我按死。" },
        { seatId: 4, name: "黑白熊", speech: "腐川冬子你只说不认，你倒是接啊。" },
      ],
    });

    expect(result.viewerQuality).toBe("warn");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "black_check_axis_repeat")).toBe(true);
  });

  it("does not flag Celestia when she prices a follower's explanation-cost move", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 6,
      name: "塞蕾丝缇雅",
      roleId: "celestia",
      isFallback: false,
      speech:
        "平安夜是整桌唯一明确的公开筹码。但江之岛，你刚才那段发言，比平安夜本身更值得我押一枚小筹码。你替腐川冬子接了一层“位置打反手”的包装，又替苗木诚补了一个“今天怎么处理查杀”的要求。你是在帮谁降低解释成本？",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "我是预言家，昨晚查验3号腐川冬子是狼人。" },
        { seatId: 3, name: "腐川冬子", speech: "我不认这条查杀，苗木诚首置位太急了。" },
        { seatId: 5, name: "江之岛盾子", speech: "苗木给完查杀之后没有处理动作，腐川的位置反手也太方便。" },
      ],
    });

    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "black_check_axis_repeat")).toBe(false);
  });

  it("treats Celestia wager pressure as character presence and concrete live intent", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 6,
      name: "塞蕾丝缇雅",
      roleId: "celestia",
      isFallback: false,
      speech:
        "啊啦，苗木诚这枚筹码已经押在3号腐川冬子身上了。目前为止，我还没看到哪位愿意真正跟注——要么围观，要么只问验证方式而不说自己怎么下注。5号江之岛盾子，你刚才问我的问题是“黑白熊是正好没兴趣站，还是故意没兴趣站”。那我也把问题还给你：你既然能精准指出黑白熊坐在裁判席中央看戏，那你自己的筹码准备押在哪一侧？我暂时不看查杀位本人。",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "我是预言家，昨晚查验3号腐川冬子查杀，今天票先压这里。" },
        { seatId: 3, name: "腐川冬子", speech: "我不认这条查杀，苗木诚一句话就想把我按死。" },
        { seatId: 4, name: "黑白熊", speech: "腐川冬子把身份话留在裁判席中央，还想装作没人看见吗。" },
        { seatId: 5, name: "江之岛盾子", speech: "黑白熊坐在裁判席中央看戏，不准备自己沾边吗？" },
      ],
    });

    expect(result.characterPresence).toBe("strong");
    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "thought_axis_repeat")).toBe(false);
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "weak_character_presence")).toBe(false);
  });

  it("does not flag late voice or tempo reads that cite the black-check axis before pivoting away", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 8,
      name: "高松灯",
      roleId: "tomori",
      isFallback: false,
      speech:
        "……我这里停了一下。苗木诚首置位跳预言家报查杀，腐川冬子说“我不认”——这句话本身没问题。但江之岛盾子，你接完腐川冬子那句以后，替查杀位铺了一条“真正的好人应该反打”的标准，可你自己的票口在哪儿？",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "我跳预言家，昨晚查验3号腐川冬子是狼人，今天票先压这里。" },
        { seatId: 2, name: "雾切响子", speech: "这条查杀先放桌面，3号腐川冬子必须正面接。" },
        { seatId: 5, name: "江之岛盾子", speech: "1号报查杀，但3号划边界太舒服了，黑白熊像是在替她铺台阶。" },
        { seatId: 7, name: "十神白夜", speech: "查杀位接过话后，江之岛盾子，你今天的票口标准是什么。" },
      ],
    });

    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "black_check_axis_repeat")).toBe(false);
  });

  it("does not flag a speaker who calls out the table repeating the black-check axis", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 8,
      name: "高松灯",
      roleId: "tomori",
      isFallback: false,
      speech:
        "1号报了查杀，3号说不认，然后停在那里了。但6号自己，你问5号是不是在等后置位帮她把结论说圆——那你呢。这个顺序让我觉得不太自然，像大家都拿到了同一个方向。",
      previousSpeeches: [
        { seatId: 5, name: "江之岛盾子", speech: "腐川冬子刚才接查杀还没给验证，黑白熊像是在帮她找台阶。" },
        { seatId: 6, name: "塞蕾丝缇雅", speech: "腐川冬子的查杀接法把底牌交给后置位猜，5号是不是在等别人把结论说圆。" },
        { seatId: 7, name: "十神白夜", speech: "腐川冬子只说不认这条查杀，不算推理。" },
      ],
    });

    expect(result.antiTemplateFindings.some((finding) => finding.kind === "black_check_axis_repeat")).toBe(false);
  });

  it("treats Tomori voice-disconnect pivots as character presence, not weak generic logic", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 8,
      name: "高松灯",
      roleId: "tomori",
      isFallback: false,
      speech:
        "……6号塞蕾丝，你刚才把5号的模糊落脚点轻轻放上桌，但声音没有接到自己这里。你说她在等别人说圆，可你这一句也像在等全场替你点头；这个没接上的地方，我先记住。",
      previousSpeeches: [
        { seatId: 4, name: "黑白熊", speech: "腐川冬子只说不认，没说身份，也没说怎么接这个查杀。" },
        { seatId: 5, name: "江之岛盾子", speech: "黑白熊像是在替腐川争取缓冲时间。" },
        { seatId: 6, name: "塞蕾丝缇雅", speech: "5号是不是在等后置位帮她把结论说圆。" },
      ],
    });

    expect(result.characterPresence).not.toBe("weak");
    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "weak_character_presence")).toBe(false);
  });

  it("treats Anon social-tempo pivots as character presence, not empty roundabout talk", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 9,
      name: "千早爱音",
      roleId: "anon",
      isFallback: false,
      speech:
        "等一下，这里气氛已经被同一条压力带着跑了。我先把关系链接回来：6号接5号接得太顺，像是在帮大家把票往一个方向推，这个接话点我不想轻轻放过。",
      previousSpeeches: [
        { seatId: 4, name: "黑白熊", speech: "腐川冬子只说不认，没说身份，也没说怎么接这个查杀。" },
        { seatId: 5, name: "江之岛盾子", speech: "黑白熊像是在替腐川争取缓冲时间。" },
        { seatId: 6, name: "塞蕾丝缇雅", speech: "5号是不是在等后置位帮她把结论说圆。" },
      ],
    });

    expect(result.characterPresence).not.toBe("weak");
    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "weak_character_presence")).toBe(false);
  });

  it("treats Anon's relationship reset as a live targeted move, not repeated abstract axes", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 9,
      name: "千早爱音",
      roleId: "anon",
      isFallback: false,
      speech:
        "等一下——我先把关系接回来。1号查杀3号已经走了大半圈，然后8号高松灯把我的想法点出来了：5号江之岛盾子，你把1号、2号、4号全评了一遍，你自己落在哪里呢？你这段话顺序太顺了，像在帮大家梳理座位，而不是在找狼。",
      previousSpeeches: [
        { seatId: 5, name: "江之岛盾子", speech: "1号报查杀太干净，3号没给验证缺口，4号也盯住了缺口。" },
        { seatId: 8, name: "高松灯", speech: "5号江之岛盾子，你的声音没有接到自己这里，只是在评别人。" },
      ],
    });

    expect(result.characterPresence).not.toBe("weak");
    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "thought_axis_repeat")).toBe(false);
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "weak_character_presence")).toBe(false);
  });

  it("does not flag direct stance-accountability pressure as repeated abstract axes", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 8,
      name: "高松灯",
      roleId: "tomori",
      isFallback: false,
      speech:
        "……我这里停了一下。2号雾切同学，你说只问这句身份话接下来怎么被验证，但你绕开了苗木同学这个查杀本身。你没说信不信，也没说腐川同学的回应哪里不对。你把判断责任推给后面的人，但你自己先站了一个“不站边”的位置。我想先确认这一点：你现在的立场是什么。",
      previousSpeeches: [
        { seatId: 2, name: "雾切响子", speech: "我只问这句身份话接下来怎么被验证。" },
        { seatId: 5, name: "江之岛盾子", speech: "苗木首置位报查杀，腐川接杀，雾切没有给验证结论。" },
        { seatId: 7, name: "十神白夜", speech: "雾切绕开了查杀和验证责任，这不是客观。" },
      ],
    });

    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "thought_axis_repeat")).toBe(false);
  });

  it("treats Togami qualification review as a concrete role move, not abstract axis repeat", () => {
    const result = analyzeClassTrialSpeechQuality({
      seatId: 7,
      name: "十神白夜",
      roleId: "togami",
      isFallback: false,
      speech:
        "十神白夜。平安夜，女巫用过药了，这个先放一边——真正值得看的是前置位的质量。苗木诚，首置位跳预言家报查杀，动作本身够重。但问题不在于他跳没跳，而在于他这句话之后，你们所有人的反应有没有达标。腐川冬子，你被查杀后第一反应是骂他“话放得够重”，却没有正面说出“我不是狼”这三个字。黑白熊抓住了这一点，江之岛盾子说你没接球，塞蕾丝缇雅押在你“解释成本够高”上。",
      previousSpeeches: [
        { seatId: 1, name: "苗木诚", speech: "我是预言家，昨晚查验3号腐川冬子查杀，今天票先压这里。" },
        { seatId: 3, name: "腐川冬子", speech: "我不认这条查杀，苗木诚一句话就想把我按死。平安夜，女巫用过药了，这个先放一边。" },
        { seatId: 4, name: "黑白熊", speech: "平安夜的事你带一句就过，我也不追问。腐川冬子你只说不认，没说身份，也没说怎么接这个查杀。" },
        { seatId: 5, name: "江之岛盾子", speech: "黑白熊像是在替腐川争取缓冲时间。" },
      ],
    });

    expect(result.characterPresence).not.toBe("weak");
    expect(result.viewerQuality).toBe("pass");
    expect(result.antiTemplateFindings.some((finding) => finding.kind === "thought_axis_repeat")).toBe(false);
  });
});
