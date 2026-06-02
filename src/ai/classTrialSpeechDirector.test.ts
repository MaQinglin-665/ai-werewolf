import { describe, expect, it } from "vitest";
import type { AgentView } from "@/game/types";
import { getClassTrialCharacterLens } from "./classTrialCharacterLens";
import {
  buildClassTrialDayContinuationGuide,
  buildClassTrialDialogueRewriteGuide,
  buildClassTrialFinalSpeakerGuide,
  buildClassTrialOpeningDirectorGuide,
  buildClassTrialRepeatedFocusGuide,
  buildClassTrialSelfIntroductionGuide,
} from "./classTrialSpeechDirector";

function roleCardFixture(id = "kirigiri", displayName = "雾切响子"): NonNullable<AgentView["roleCard"]> {
  return {
    id,
    displayName,
    theme: "class-trial",
    styleTags: ["deductive"],
    speechStyleZh: "冷静、抓证据。",
    reasoningBias: "优先审查证据链。",
    voteBias: "投公开证据闭合的位置。",
    nightActionBias: "谨慎。",
    asVillager: "作为好人时保持事实边界。",
    asWerewolf: "作为狼人时用公开理由伪装。",
    pressureResponse: "被怀疑时要求证据链。",
    relationshipHints: [],
    catchphrasePolicy: "允许极短角色感。",
    forbidden: ["不能泄露隐藏身份。"],
  };
}

function makeView(overrides: Partial<AgentView> = {}): AgentView {
  return {
    day: 1,
    mySeatId: 2,
    myRole: "VILLAGER",
    roleCard: roleCardFixture(),
    publicSummary: { recentSpeeches: [] },
    ...overrides,
  } as AgentView;
}

describe("class-trial speech director", () => {
  it("limits self-introduction to the first morning", () => {
    expect(buildClassTrialSelfIntroductionGuide(makeView({ day: 1 }))).toContain("只有第一天早上可以自然报一次");
    expect(buildClassTrialDayContinuationGuide(makeView({ day: 1 }))).toBeUndefined();

    const dayTwoView = makeView({ day: 2 });
    expect(buildClassTrialSelfIntroductionGuide(dayTwoView)).toContain("不要再自我介绍");
    expect(buildClassTrialDayContinuationGuide(dayTwoView)).toContain("第二天以后是连续审判");
  });

  it("rewrites werewolf terms into role-specific class-trial dialogue", () => {
    const lens = getClassTrialCharacterLens(roleCardFixture("fukawa", "腐川冬子"));
    const guide = buildClassTrialDialogueRewriteGuide(makeView({ roleCard: roleCardFixture("fukawa", "腐川冬子") }), lens);

    expect(guide).toContain("台词化转译");
    expect(guide).toContain("不要说“没给票口/站边”");
    expect(guide).toContain("十神大人");
  });

  it("adds low-info opening direction without turning first seat into a flow template", () => {
    const lens = getClassTrialCharacterLens(roleCardFixture("naegi", "苗木诚"));
    const guide = buildClassTrialOpeningDirectorGuide(makeView({ roleCard: roleCardFixture("naegi", "苗木诚") }), lens, {
      isLowInfoDayOneNoHardInfo: true,
      isFinalSpeakerToday: false,
      isOpeningSpeaker: true,
    });

    expect(guide).toContain("首日低信息开庭导演");
    expect(guide).toContain("你是首置位");
    expect(guide).toContain("不要点名下一位做作业");
    expect(guide).toContain("苗木首置位必须留下共同验证点");
  });

  it("guards the final speaker from waiting for future seats", () => {
    expect(buildClassTrialFinalSpeakerGuide(makeView(), true)).toContain("今天最后一个发言位");
    expect(buildClassTrialFinalSpeakerGuide(makeView(), false)).toBeUndefined();
  });

  it("shifts repeated abstract vote pressure into a concrete role action", () => {
    const guide = buildClassTrialRepeatedFocusGuide(makeView({ roleCard: roleCardFixture("kirigiri", "雾切响子") }), {
      currentDaySpeeches: [
        { seq: 1, day: 1, speaker: { seatId: 1, name: "苗木诚" }, message: "你没给票口，这个观察点太空。" },
        { seq: 2, day: 1, speaker: { seatId: 3, name: "腐川冬子" }, message: "还是没给站边和票口，缺口没解除。" },
      ],
    });

    expect(guide).toContain("动态导演提示");
    expect(guide).toContain("不要继续评价站边或票口空缺本身");
    expect(guide).toContain("雾切响子");
    expect(guide).toContain("施压方式");
  });
});
