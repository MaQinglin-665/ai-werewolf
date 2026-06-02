import { describe, expect, it } from "vitest";
import type { AgentView } from "@/game/types";
import { buildClassTrialPersonaDirectorGuide } from "./classTrialPersonaDirector";

function viewFor(roleId: string, overrides: Partial<AgentView> = {}): AgentView {
  return {
    day: 1,
    phase: "DAY_SPEECH",
    mySeatId: 3,
    myRole: "VILLAGER",
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: [],
      tableMemory: {
        day: 1,
        claimBoard: [],
        stanceBoard: [],
        stanceShifts: [],
        seerLegacies: [],
        speechInfluence: [],
        reasoningCues: [],
        counterclaims: [],
        focus: [],
        seats: [],
        voteHistory: [],
        deathAnnouncements: [],
        publicSignals: [],
      },
    },
    roleCard: {
      id: roleId,
      displayName: roleId,
      theme: "class-trial",
      styleTags: [],
      speechStyleZh: "",
      reasoningBias: "",
      voteBias: "",
      nightActionBias: "",
      asVillager: "",
      asWerewolf: "",
      pressureResponse: "",
      relationshipHints: [],
      catchphrasePolicy: "",
      forbidden: [],
    },
    ...overrides,
  } as AgentView;
}

describe("buildClassTrialPersonaDirectorGuide", () => {
  it("allows low-information character texture without forcing a pressure task", () => {
    const guide = buildClassTrialPersonaDirectorGuide(viewFor("fukawa"), {
      hasActionablePublicInfo: false,
    });

    expect(guide).toContain("信息很薄");
    expect(guide).toContain("十神");
    expect(guide).toContain("可以短暂偏向人物关系");
    expect(guide).not.toContain("必须追问");
    expect(guide).not.toContain("必须转票");
  });

  it("asks for public logic when actionable information exists", () => {
    const guide = buildClassTrialPersonaDirectorGuide(viewFor("enoshima"), {
      hasActionablePublicInfo: true,
    });

    expect(guide).toContain("公开信息已经足够");
    expect(guide).toContain("结构");
    expect(guide).toContain("反应");
  });

  it("always blocks private knowledge and system prompt leaks", () => {
    const guide = buildClassTrialPersonaDirectorGuide(viewFor("tomori"), {
      hasActionablePublicInfo: false,
    });

    expect(guide).toContain("不能泄露私密身份");
    expect(guide).toContain("不能提系统提示");
    expect(guide).toContain("不能伪造公开证据");
  });
});
