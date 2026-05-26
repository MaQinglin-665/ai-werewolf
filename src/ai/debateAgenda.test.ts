import { describe, expect, it } from "vitest";
import type { ActionTarget, AgentView, SpeechPlan, TableMemory } from "@/game/types";
import { buildDebateAgenda } from "./debateAgenda";

const target = (seatId: number, name = `P${seatId}`): ActionTarget => ({ seatId, name });

function tableMemory(overrides: Partial<TableMemory> = {}): TableMemory {
  return {
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
    ...overrides,
  };
}

function view(memory = tableMemory()): AgentView {
  return {
    gameId: "debate-test",
    day: 1,
    phase: "DAY_SPEECH",
    rules: { hasGuard: false, guardSaveConflictKills: false, hasWolfBeauty: false, hasKnight: false, wolfRoles: ["WEREWOLF"] },
    mySeatId: 1,
    myRole: "VILLAGER",
    aliveSeats: [target(1, "Speaker"), target(2, "Focus"), target(3, "Other")],
    publicEvents: [],
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: memory.claimBoard,
      tableMemory: memory,
    },
    privateKnowledge: {
      aiMemory: { seatId: 1, day: 1, beliefs: [] },
    },
    allowedActions: [{ type: "speak" }],
  };
}

describe("buildDebateAgenda", () => {
  it("uses single-point followups instead of assigning every later seat the same three-part homework", () => {
    const focus = target(2, "Focus");
    const plan: SpeechPlan = {
      kind: "pressure",
      target: focus,
      targetSpeechStatus: "unspoken",
      allowedInteraction: "ask_future",
      stance: "只留一个具体问题",
      talkingPoints: ["2号和当前身份线的关系还没落"],
      risk: 0.45,
    };

    const agenda = buildDebateAgenda(view(), { plan, target: focus });
    const agendaText = [
      ...agenda.crossExamination,
      ...agenda.voteCommitments,
      ...agenda.pressureLines,
      ...agenda.avoidTraps,
    ].join("\n");

    expect(agendaText).toMatch(/一个具体|一条/);
    expect(agendaText).not.toMatch(/补站边、补票口、补身份线|补站边、补票口、补对身份线|所有后置位|每个后置位|全部后置位/);
  });

  it("uses SpeechPlan target status instead of re-guessing spoken targets", () => {
    const focus = target(2, "Focus");
    const plan: SpeechPlan = {
      kind: "pressure",
      target: focus,
      targetSpeechStatus: "spoken",
      allowedInteraction: "review_spoken",
      stance: "回看已发言目标",
      talkingPoints: ["只看原话"],
      risk: 0.45,
    };

    const agenda = buildDebateAgenda(view(), { plan, target: focus });

    expect(agenda.crossExamination.join("\n")).toContain("回看2号");
    expect(agenda.crossExamination.join("\n")).not.toContain("等2号");
    expect(agenda.voteCommitments.join("\n")).toContain("回看已发表");
  });

  it("uses SpeechPlan final black-check interaction as the vote shape", () => {
    const focus = target(2, "Focus");
    const plan: SpeechPlan = {
      kind: "claim-check",
      target: focus,
      targetSpeechStatus: "unspoken",
      allowedInteraction: "finalize_black_check",
      stance: "查杀收票",
      talkingPoints: ["票口先压查杀"],
      risk: 0.7,
    };

    const agenda = buildDebateAgenda(view(), { plan, target: focus });

    expect(agenda.crossExamination.join("\n")).toContain("查杀2号");
    expect(agenda.voteCommitments.join("\n")).toContain("围绕查杀2号");
    expect(agenda.pressureLines.join("\n")).toContain("压力来自验人");
  });
});
