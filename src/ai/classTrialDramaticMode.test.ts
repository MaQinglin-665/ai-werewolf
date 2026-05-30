import { describe, expect, it } from "vitest";
import type { AgentView, AiCharacterRoleCard } from "@/game/types";
import {
  DRAMATIC_CLASS_TRIAL_HARD_BOUNDARIES,
  isDramaticClassTrialRoleCard,
  isDramaticClassTrialView,
  shouldUseClassTrialExpressionLeniency,
} from "./classTrialDramaticMode";

describe("classTrialDramaticMode", () => {
  it("enables dramatic speech mode only for class-trial role cards", () => {
    expect(isDramaticClassTrialRoleCard(roleCard("class-trial"))).toBe(true);
    expect(isDramaticClassTrialRoleCard(roleCard("default"))).toBe(false);
    expect(isDramaticClassTrialRoleCard(undefined)).toBe(false);
  });

  it("exposes a view-level expression leniency switch", () => {
    const classTrialView = { roleCard: roleCard("class-trial") } as Pick<AgentView, "roleCard">;
    const ordinaryView = { roleCard: roleCard("default") } as Pick<AgentView, "roleCard">;

    expect(isDramaticClassTrialView(classTrialView)).toBe(true);
    expect(shouldUseClassTrialExpressionLeniency(classTrialView)).toBe(true);
    expect(isDramaticClassTrialView(ordinaryView)).toBe(false);
    expect(shouldUseClassTrialExpressionLeniency(ordinaryView)).toBe(false);
  });

  it("documents hard boundaries that dramatic mode must still keep", () => {
    expect(DRAMATIC_CLASS_TRIAL_HARD_BOUNDARIES).toEqual(
      expect.arrayContaining(["hidden-role-leak", "future-speech", "private-night-info", "illegal-skill-fact"]),
    );
  });
});

function roleCard(theme: string): AiCharacterRoleCard {
  return {
    id: "naegi",
    displayName: "苗木诚",
    theme,
    styleTags: [],
    speechStyleZh: "真诚但戏剧化。",
    reasoningBias: "把混乱拉回共同验证点。",
    voteBias: "投公开矛盾更明确的位置。",
    nightActionBias: "夜晚行动稳健。",
    asVillager: "作为好人时组织桌面。",
    asWerewolf: "作为狼人时用公开理由伪装。",
    pressureResponse: "被怀疑时先承认可疑点。",
    relationshipHints: [],
    catchphrasePolicy: "允许短句，不复刻原台词。",
    forbidden: [],
  };
}
