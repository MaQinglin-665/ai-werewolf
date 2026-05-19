import { describe, expect, it } from "vitest";
import { createMockCommand } from "./mockAgent";
import { createSpeechPlan } from "./tableRead";
import type {
  ActionTarget,
  AgentView,
  AiTableRead,
  ClaimBoardItem,
  Phase,
  PublicReasoningCue,
  Role,
  SeatRead,
  TableMemory,
} from "@/game/types";

describe("mock AI role action diversity", () => {
  it("lets seer checks prioritize a public counterclaimant with table cues", () => {
    const counterSeer = target(2, "Counter Seer");
    const outside = target(3, "Outside");
    const tableMemory = emptyTableMemory({
      counterclaims: [
        {
          claimedRole: "SEER",
          claimedRoleLabel: "预言家",
          claimants: [counterSeer, target(4, "Other Seer")],
        },
      ],
      reasoningCues: [reasoningCue(counterSeer, "counterclaim", "strong")],
    });

    const command = createMockCommand(
      actionView("SEER", "NIGHT_SEER", { type: "seerCheck", targets: [counterSeer, outside] }),
      tableRead("SEER", [
        seatRead(counterSeer, {
          suspicion: 50,
          trust: 30,
          publicClaims: [roleClaim(counterSeer, "SEER")],
        }),
        seatRead(outside, { suspicion: 60, trust: 45 }),
      ], tableMemory),
    );

    expect(command).toMatchObject({
      type: "seerCheck",
      targetSeatId: counterSeer.seatId,
    });
    expect(command.reason).toContain("公开线索");
    expect(command.reason).toContain("可复盘公开线索");
  });

  it("lets guard protection favor a trusted power claim over a generic good seat", () => {
    const witch = target(2, "Witch Claim");
    const civilian = target(3, "Clean Civilian");

    const command = createMockCommand(
      actionView(
        "GUARD",
        "NIGHT_GUARD",
        { type: "guardAction", targets: [witch, civilian], canSkip: true },
        { hasGuard: true, guardSaveConflictKills: true },
      ),
      tableRead("GUARD", [
        seatRead(witch, {
          suspicion: 20,
          trust: 70,
          publicClaims: [roleClaim(witch, "WITCH")],
        }),
        seatRead(civilian, { suspicion: 10, trust: 80 }),
      ]),
    );

    expect(command).toMatchObject({
      type: "guardAction",
      targetSeatId: witch.seatId,
    });
  });

  it("lets wolf beauty charm target high-value power claims", () => {
    const seer = target(2, "Seer Claim");
    const trustedCivilian = target(3, "Trusted Civilian");

    const command = createMockCommand(
      actionView("WOLF_BEAUTY", "NIGHT_WOLF_BEAUTY", {
        type: "wolfBeautyCharm",
        targets: [seer, trustedCivilian],
        canSkip: true,
      }),
      tableRead("WOLF_BEAUTY", [
        seatRead(seer, {
          suspicion: 20,
          trust: 72,
          publicClaims: [roleClaim(seer, "SEER")],
        }),
        seatRead(trustedCivilian, { suspicion: 5, trust: 68 }),
      ]),
    );

    expect(command).toMatchObject({
      type: "wolfBeautyCharm",
      targetSeatId: seer.seatId,
    });
  });

  it("lets wolves night-kill high-value public roles instead of only raw trust", () => {
    const seer = target(2, "Seer Claim");
    const cleanCivilian = target(3, "Clean Civilian");
    const tableMemory = emptyTableMemory({
      reasoningCues: [reasoningCue(seer, "claim", "strong")],
    });

    const command = createMockCommand(
      actionView("WEREWOLF", "NIGHT_WOLVES", { type: "wolfKill", targets: [seer, cleanCivilian] }),
      tableRead("WEREWOLF", [
        seatRead(seer, {
          suspicion: 10,
          trust: 82,
          publicClaims: [roleClaim(seer, "SEER")],
        }),
        seatRead(cleanCivilian, { suspicion: 0, trust: 90 }),
      ], tableMemory),
    );

    expect(command).toMatchObject({
      type: "wolfKill",
      targetSeatId: seer.seatId,
    });
  });

  it("lets wolf fake seer checks avoid black-checking an unchallenged power claim", () => {
    const powerClaim = target(2, "Hunter Claim");
    const openTarget = target(3, "Open Suspicion");
    const oldTarget = target(4, "Old Gold");
    const selfClaim = roleClaim(target(1, "Self"), "SEER");
    selfClaim.lastUpdatedDay = 1;
    selfClaim.checks = [{ day: 1, target: oldTarget, result: "GOOD" }];
    const tableMemory = emptyTableMemory({ claimBoard: [selfClaim] });
    const view = actionView("WEREWOLF", "DAY_SPEECH", { type: "vote", targets: [powerClaim, openTarget], canAbstain: false });
    view.publicSummary.claimBoard = [selfClaim];
    view.publicSummary.tableMemory = tableMemory;

    const plan = createSpeechPlan(
      view,
      tableRead("WEREWOLF", [
        seatRead(powerClaim, {
          suspicion: 92,
          trust: 20,
          publicClaims: [roleClaim(powerClaim, "HUNTER")],
        }),
        seatRead(openTarget, {
          suspicion: 64,
          trust: 42,
        }),
      ], tableMemory),
    );

    expect(plan.claimIntent?.check).toMatchObject({
      targetSeatId: openTarget.seatId,
      result: "WEREWOLF",
    });
  });

  it("lets the true seer reveal a day-one good check when an outside seer has already claimed", () => {
    const checkedSeat = target(2, "Gold");
    const outsideSeer = target(3, "Outside Seer");
    const outsideClaim = roleClaim(outsideSeer, "SEER");
    const tableMemory = emptyTableMemory({
      claimBoard: [outsideClaim],
      counterclaims: [
        {
          claimedRole: "SEER",
          claimedRoleLabel: "预言家",
          claimants: [outsideSeer],
        },
      ],
    });
    const view = actionView("SEER", "DAY_SPEECH", { type: "speak" }, { wolfRoles: ["WEREWOLF"] });
    view.day = 1;
    view.publicSummary.claimBoard = [outsideClaim];
    view.publicSummary.tableMemory = tableMemory;
    view.privateKnowledge.seerChecks = [{ day: 1, seerSeatId: 1, targetSeatId: checkedSeat.seatId, result: "GOOD" }];
    view.aliveSeats = [target(1, "Self"), checkedSeat, outsideSeer];

    const plan = createSpeechPlan(view, tableRead("SEER", [seatRead(checkedSeat), seatRead(outsideSeer)], tableMemory));

    expect(plan.kind).toBe("claim-check");
    expect(plan.claimIntent).toMatchObject({
      claimedRole: "SEER",
      strength: "hard",
      check: {
        targetSeatId: checkedSeat.seatId,
        result: "GOOD",
      },
    });
    expect(plan.stance).toContain("金水");
  });

  it("keeps an unpressured day-one good check hidden when no outside seer has claimed", () => {
    const checkedSeat = target(2, "Gold");
    const tableMemory = emptyTableMemory();
    const view = actionView("SEER", "DAY_SPEECH", { type: "speak" }, { wolfRoles: ["WEREWOLF"] });
    view.day = 1;
    view.publicSummary.tableMemory = tableMemory;
    view.privateKnowledge.seerChecks = [{ day: 1, seerSeatId: 1, targetSeatId: checkedSeat.seatId, result: "GOOD" }];
    view.aliveSeats = [target(1, "Self"), checkedSeat];

    const plan = createSpeechPlan(view, tableRead("SEER", [seatRead(checkedSeat)], tableMemory));

    expect(plan.kind).toBe("defend");
    expect(plan.claimIntent).toBeUndefined();
    expect(plan.stance).toContain("首日金水先藏验人");
  });
});

function actionView(
  role: Role,
  phase: Phase,
  action: AgentView["allowedActions"][number],
  rules: Partial<AgentView["rules"]> = {},
): AgentView {
  const targets =
    "targets" in action
      ? action.targets
      : [];

  return {
    gameId: "test-role-actions",
    mySeatId: 1,
    myRole: role,
    phase,
    day: 2,
    rules: {
      hasGuard: false,
      guardSaveConflictKills: false,
      hasWolfBeauty: role === "WOLF_BEAUTY",
      hasKnight: false,
      wolfRoles: ["WEREWOLF", "WOLF_KING", "WHITE_WOLF_KING", "WOLF_BEAUTY"],
      ...rules,
    },
    aliveSeats: [target(1, "Self"), ...targets],
    publicEvents: [],
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: [],
      tableMemory: emptyTableMemory(),
    },
    privateKnowledge: {
      wolfTeammates: role === "WEREWOLF" || role === "WOLF_BEAUTY" ? [target(1, "Self")] : undefined,
    },
    allowedActions: [action],
  } as AgentView;
}

function tableRead(role: Role, seats: SeatRead[], tableMemory = emptyTableMemory()): AiTableRead {
  const self = seatRead(target(1, "Self"), {
    suspicion: 0,
    trust: 100,
    isSelf: true,
  });

  return {
    mySeatId: 1,
    myRole: role,
    day: 2,
    seats: [self, ...seats],
    knownWolfSeatIds: [],
    knownGoodSeatIds: [],
    wolfTeammateSeatIds: role === "WEREWOLF" || role === "WOLF_BEAUTY" ? [1] : [],
    focus: seats[0],
    backupFocus: seats[1],
    voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
    recentSpeeches: [],
    recentDeaths: [],
    tableMemory,
    tableMood: "test",
  };
}

function seatRead(targetSeat: ActionTarget, overrides: Partial<SeatRead> = {}): SeatRead {
  return {
    ...targetSeat,
    suspicion: 35,
    trust: 45,
    pressure: [],
    isSelf: false,
    isKnownWolf: false,
    isKnownGood: false,
    isWolfTeammate: false,
    speechCount: 1,
    votesReceived: 0,
    publicClaims: [],
    publicChecksAgainst: [],
    publicStancesGiven: [],
    publicStancedBy: [],
    ...overrides,
  };
}

function roleClaim(claimant: ActionTarget, role: Role): ClaimBoardItem {
  return {
    claimId: `${claimant.seatId}:${role}`,
    claimant,
    claimedRole: role,
    claimedRoleLabel: roleLabel(role),
    strength: "hard",
    checks: [],
    summary: `${claimant.seatId}号声称${roleLabel(role)}`,
    lastUpdatedDay: 2,
    sourceSpeechSeq: claimant.seatId,
  };
}

function reasoningCue(targetSeat: ActionTarget, kind: PublicReasoningCue["kind"], weight: PublicReasoningCue["weight"]): PublicReasoningCue {
  return {
    cueId: `${kind}:${targetSeat.seatId}`,
    day: 2,
    kind,
    weight,
    summary: `${targetSeat.seatId}号进入公开推理焦点`,
    target: targetSeat,
    evidence: [`${targetSeat.seatId}号有可复盘公开线索`],
  };
}

function emptyTableMemory(overrides: Partial<TableMemory> = {}): TableMemory {
  return {
    day: 2,
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

function target(seatId: number, name: string): ActionTarget {
  return { seatId, name };
}

function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    VILLAGER: "平民",
    SEER: "预言家",
    WITCH: "女巫",
    HUNTER: "猎人",
    GUARD: "守卫",
    IDIOT: "白痴",
    KNIGHT: "骑士",
    WEREWOLF: "狼人",
    WOLF_KING: "狼王",
    WHITE_WOLF_KING: "白狼王",
    WOLF_BEAUTY: "狼美人",
  };
  return labels[role];
}
