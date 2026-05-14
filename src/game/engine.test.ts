import { describe, expect, it } from "vitest";
import { advanceOneAiStep, advanceWithMockAi, createMockCommand } from "@/ai/mockAgent";
import { buildConstrainedActionInput, createConstrainedLlmActionProvider } from "@/ai/actionProviders";
import {
  buildConstrainedSpeechInput,
  createConstrainedLlmSpeechProvider,
  mockSpeechProvider,
  validateRenderedSpeech,
} from "@/ai/speechProviders";
import { buildAiTableRead, createSpeechPlan, createVotePlan } from "@/ai/tableRead";
import { getAiRoster } from "./personas";
import { buildAgentView, buildHumanView } from "./projection";
import { buildGameReview } from "./review";
import { stripSpeechStageDirections } from "./speechText";
import { buildTableMemory } from "./tableMemory";
import { applyCommand, applySystemStep, createGame, evaluateWinCondition, getSeat, hydrateGameState } from "./engine";

describe("game engine", () => {
  it("assigns the 9-player preset role counts", () => {
    const state = createGame({ seed: 1 });
    const counts = state.seats.reduce<Record<string, number>>((acc, seat) => {
      acc[seat.role] = (acc[seat.role] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts.WEREWOLF).toBe(3);
    expect(counts.VILLAGER).toBe(3);
    expect(counts.SEER).toBe(1);
    expect(counts.WITCH).toBe(1);
    expect(counts.HUNTER).toBe(1);
  });

  it("assigns the 12-player sheriff guard preset role counts", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 1 });
    const counts = state.seats.reduce<Record<string, number>>((acc, seat) => {
      acc[seat.role] = (acc[seat.role] ?? 0) + 1;
      return acc;
    }, {});

    expect(state.board.seatCount).toBe(12);
    expect(state.rules.hasGuard).toBe(true);
    expect(state.rules.hasSheriff).toBe(true);
    expect(counts.WEREWOLF).toBe(4);
    expect(counts.VILLAGER).toBe(4);
    expect(counts.SEER).toBe(1);
    expect(counts.WITCH).toBe(1);
    expect(counts.HUNTER).toBe(1);
    expect(counts.GUARD).toBe(1);
  });

  it("randomizes the human role across seeded games", () => {
    const roles = new Set(Array.from({ length: 20 }, (_, seed) => getSeat(createGame({ seed }), 1).role));
    expect(roles.size).toBeGreaterThan(1);
  });

  it("hydrates legacy saves with current rule defaults", () => {
    const legacyState = createGame({ seed: 5 }) as Partial<ReturnType<typeof createGame>>;
    delete legacyState.rules;
    delete legacyState.board;
    delete legacyState.witch;
    delete legacyState.votes;
    delete legacyState.aiMemories;

    const hydrated = hydrateGameState(legacyState as ReturnType<typeof createGame>);

    expect(hydrated.board.id).toBe("9p-seer-witch-hunter");
    expect(hydrated.rules.hasGuard).toBe(false);
    expect(hydrated.rules.hasSheriff).toBe(false);
    expect(hydrated.guard).toBeUndefined();
    expect(hydrated.sheriff).toBeUndefined();
    expect(hydrated.witch).toEqual({ antidoteAvailable: true, poisonAvailable: true });
    expect(hydrated.votes).toEqual({});
    expect(hydrated.aiMemories).toEqual({});
  });

  it("assigns eight named AI characters with public personalities", () => {
    const state = createGame({ seed: 3, humanSeatId: 5 });
    const aiSeats = state.seats.filter((seat) => seat.isAi);
    const aiNames = new Set(aiSeats.map((seat) => seat.name));
    const view = buildHumanView(state);
    const publicAiSeats = view.seats.filter((seat) => seat.isAi);

    expect(aiSeats).toHaveLength(8);
    expect(aiNames.size).toBe(8);
    expect([...aiNames]).not.toContain("5号 AI");
    expect(aiSeats.every((seat) => seat.persona && seat.name === seat.persona.name)).toBe(true);
    expect(aiSeats.every((seat) => seat.persona?.preferences)).toBe(true);
    expect(publicAiSeats.every((seat) => seat.personaLabel && seat.personaStyle)).toBe(true);
  });

  it("gives each model a distinct soft decision profile", () => {
    const roster = getAiRoster();
    const profiles = new Set(roster.map((persona) => JSON.stringify(persona.preferences)));

    expect(roster).toHaveLength(8);
    expect(profiles.size).toBe(8);
    expect(roster.find((persona) => persona.name === "DeepSeek")?.preferences?.logic).toBeGreaterThan(0.9);
    expect(roster.find((persona) => persona.name === "豆包")?.preferences?.emotion).toBeGreaterThan(0.85);
    expect(roster.find((persona) => persona.name === "Kimi")?.preferences?.identity).toBeGreaterThan(0.9);
  });

  it("rejects actions in the wrong phase", () => {
    const state = createGame({ seed: 2 });
    expect(() => applyCommand(state, { type: "vote", actorSeatId: 1, targetSeatId: 2 })).toThrow(/当前阶段/);
  });

  it("keeps the table in speech phase after the final speaker until the host advances", () => {
    let state = createGame({ seed: 22, humanSeatId: 1 });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [state.humanSeatId];
    state.speechIndex = 0;

    state = applyCommand(state, {
      type: "speak",
      actorSeatId: state.humanSeatId,
      message: "我先把最后一位发言说完，等语音播完再进投票。",
    });
    const view = buildHumanView(state);

    expect(state.phase).toBe("DAY_SPEECH");
    expect(view.availableActions[0]?.type).toBe("continue");

    state = applySystemStep(state);
    expect(state.phase).toBe("DAY_VOTE");
  });

  it("enforces witch potion use", () => {
    let state = createGame({ seed: 4 });
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const witch = state.seats.find((seat) => seat.role === "WITCH")!;
    const victim = state.seats.find((seat) => seat.role !== "WEREWOLF" && seat.seatId !== witch.seatId)!;

    state = applyCommand(state, {
      type: "wolfKill",
      actorSeatId: wolf.seatId,
      targetSeatId: victim.seatId,
    });
    state.phase = "NIGHT_WITCH";
    state = applyCommand(state, { type: "witchAction", actorSeatId: witch.seatId, mode: "save" });

    expect(state.witch.antidoteAvailable).toBe(false);
    expect(state.phase).toBe("DAY_ANNOUNCEMENT");
  });

  it("enforces guard protection rules and same-target save conflict", () => {
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 4 });
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const guard = state.seats.find((seat) => seat.role === "GUARD")!;
    const witch = state.seats.find((seat) => seat.role === "WITCH")!;
    const victim = state.seats.find((seat) => seat.role === "VILLAGER")!;

    state = applyCommand(state, { type: "wolfKill", actorSeatId: wolf.seatId, targetSeatId: victim.seatId });
    expect(state.phase).toBe("NIGHT_GUARD");

    state = applyCommand(state, { type: "guardAction", actorSeatId: guard.seatId, targetSeatId: victim.seatId });
    expect(state.guard?.lastGuardedSeatId).toBe(victim.seatId);
    expect(state.phase).toBe("NIGHT_SEER");

    const repeated = { ...state, phase: "NIGHT_GUARD" as const, night: { wolfTargetSeatId: wolf.seatId } };
    expect(() =>
      applyCommand(repeated, { type: "guardAction", actorSeatId: guard.seatId, targetSeatId: victim.seatId }),
    ).toThrow(/连续两晚/);

    state.phase = "NIGHT_WITCH";
    state = applyCommand(state, { type: "witchAction", actorSeatId: witch.seatId, mode: "save" });
    expect(getSeat(state, victim.seatId).alive).toBe(false);
    expect(getSeat(state, victim.seatId).deathReason).toBe("WOLF_KILL");
  });

  it("settles a guarded night as peaceful before sheriff nomination", () => {
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 41 });
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const guard = state.seats.find((seat) => seat.role === "GUARD")!;
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const witch = state.seats.find((seat) => seat.role === "WITCH")!;
    const victim = state.seats.find((seat) => seat.role === "VILLAGER")!;
    const checkTarget = state.seats.find((seat) => seat.seatId !== seer.seatId)!;

    state = applyCommand(state, { type: "wolfKill", actorSeatId: wolf.seatId, targetSeatId: victim.seatId });
    state = applyCommand(state, { type: "guardAction", actorSeatId: guard.seatId, targetSeatId: victim.seatId });
    state = applyCommand(state, { type: "seerCheck", actorSeatId: seer.seatId, targetSeatId: checkTarget.seatId });
    state = applyCommand(state, { type: "witchAction", actorSeatId: witch.seatId, mode: "skip" });

    expect(state.phase).toBe("DAY_ANNOUNCEMENT");
    expect(getSeat(state, victim.seatId).alive).toBe(true);
    expect(state.events.at(-1)).toMatchObject({
      type: "DAY_STARTED",
      payload: { deadSeatIds: [] },
    });

    state = applySystemStep(state);
    expect(state.phase).toBe("SHERIFF_NOMINATION");
  });

  it("system-advances dead night roles without creating a hidden actor turn", () => {
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 42 });
    const guard = state.seats.find((seat) => seat.role === "GUARD")!;
    guard.alive = false;
    guard.deathReason = "WOLF_KILL";
    state.phase = "NIGHT_GUARD";

    const viewBeforeSkip = buildHumanView(state);
    expect(viewBeforeSkip.currentActorSeatId).toBeUndefined();
    expect(viewBeforeSkip.availableActions[0]).toMatchObject({ type: "continue", label: "继续流程" });

    state = applySystemStep(state);
    expect(state.phase).toBe("NIGHT_SEER");
    expect(state.events.at(-1)).toMatchObject({ type: "ROLE_PHASE_SKIPPED", payload: { role: "GUARD" } });
  });

  it("resolves sheriff election, pk ties, and sheriff weighted exile votes", () => {
    let electedState = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 12 });
    electedState.phase = "SHERIFF_VOTE";
    electedState.sheriff = {
      candidates: [1, 2],
      nominationDecisions: {},
      withdrawnSeatIds: [],
      withdrawalDecisions: {},
      votes: { "3": 1, "4": 1, "5": 2 },
      speechQueue: [],
      speechIndex: 0,
      resolved: false,
    };
    electedState = applySystemStep(electedState);
    expect(electedState.sheriff?.badgeHolderSeatId).toBe(1);
    expect(electedState.phase).toBe("DAY_SPEECH");

    let tiedState = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 13 });
    tiedState.phase = "SHERIFF_VOTE";
    tiedState.sheriff = {
      candidates: [1, 2],
      nominationDecisions: {},
      withdrawnSeatIds: [],
      withdrawalDecisions: {},
      votes: { "3": 1, "4": 2 },
      speechQueue: [],
      speechIndex: 0,
      resolved: false,
    };
    tiedState = applySystemStep(tiedState);
    expect(tiedState.phase).toBe("SHERIFF_PK_SPEECH");
    expect(tiedState.sheriff?.pkCandidates).toEqual([1, 2]);
    tiedState = applySystemStep(tiedState);
    tiedState.sheriff!.votes = { "3": 1, "4": 2 };
    tiedState = applySystemStep(tiedState);
    expect(tiedState.phase).toBe("DAY_SPEECH");
    expect(tiedState.sheriff?.badgeHolderSeatId).toBeUndefined();

    let voteState = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 14 });
    const target = voteState.seats.find((seat) => seat.seatId !== 1 && seat.role !== "HUNTER")!;
    const fallbackTarget = voteState.seats.find((seat) => seat.seatId !== target.seatId && seat.seatId !== 1)!;
    voteState.sheriff = {
      candidates: [],
      nominationDecisions: {},
      withdrawnSeatIds: [],
      withdrawalDecisions: {},
      votes: {},
      speechQueue: [],
      speechIndex: 0,
      badgeHolderSeatId: 1,
      resolved: true,
    };
    voteState.phase = "EXILE_RESOLUTION";
    voteState.votes = {
      "1": target.seatId,
      "3": fallbackTarget.seatId,
    };
    voteState = applySystemStep(voteState);
    expect(getSeat(voteState, target.seatId).alive).toBe(false);
  });

  it("hands off or tears the badge after an exiled sheriff has last words", () => {
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 43 });
    const sheriff = state.seats.find((seat) => seat.role !== "HUNTER")!;
    state.sheriff = {
      candidates: [],
      nominationDecisions: {},
      withdrawnSeatIds: [],
      withdrawalDecisions: {},
      votes: {},
      speechQueue: [],
      speechIndex: 0,
      badgeHolderSeatId: sheriff.seatId,
      resolved: true,
    };
    state.phase = "EXILE_RESOLUTION";
    state.votes = Object.fromEntries(state.seats.map((seat) => [String(seat.seatId), sheriff.seatId]));

    state = applySystemStep(state);
    expect(state.phase).toBe("LAST_WORDS");
    expect(state.pendingSheriffHandoff).toMatchObject({ fromSeatId: sheriff.seatId, nextStep: "DAY_DEATHS" });

    state = applyCommand(state, {
      type: "lastWords",
      actorSeatId: sheriff.seatId,
      message: "警徽如果没人接，就按票型继续盘。",
    });
    expect(state.phase).toBe("SHERIFF_HANDOFF");

    state = applyCommand(state, { type: "sheriffHandoff", actorSeatId: sheriff.seatId });
    expect(state.sheriff?.badgeHolderSeatId).toBeUndefined();
    expect(state.phase).toBe("NIGHT_WOLVES");
    expect(state.day).toBe(2);
    expect(state.events.some((event) => event.type === "SHERIFF_BADGE_TORN")).toBe(true);
  });

  it("allows wolves to night-kill a wolf target for potion bait", () => {
    let state = createGame({ seed: 4 });
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const teammate = state.seats.find((seat) => seat.role === "WEREWOLF" && seat.seatId !== wolf.seatId)!;
    const witch = state.seats.find((seat) => seat.role === "WITCH")!;

    state = applyCommand(state, {
      type: "wolfKill",
      actorSeatId: wolf.seatId,
      targetSeatId: teammate.seatId,
    });
    expect(state.night.wolfTargetSeatId).toBe(teammate.seatId);

    state.phase = "NIGHT_WITCH";
    state = applyCommand(state, { type: "witchAction", actorSeatId: witch.seatId, mode: "save" });
    state = applySystemStep(state);

    expect(getSeat(state, teammate.seatId).alive).toBe(true);
    expect(state.witch.antidoteAvailable).toBe(false);
    expect(state.phase).toBe("DAY_SPEECH");
  });

  it("settles wolf kill and witch poison in the same dawn report", () => {
    let state = createGame({ seed: 15 });
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const witch = state.seats.find((seat) => seat.role === "WITCH")!;
    const wolfTarget = state.seats.find((seat) => seat.role === "VILLAGER")!;
    const poisonTarget = state.seats.find((seat) => seat.role === "SEER")!;

    state = applyCommand(state, { type: "wolfKill", actorSeatId: wolf.seatId, targetSeatId: wolfTarget.seatId });
    state.phase = "NIGHT_WITCH";
    state = applyCommand(state, {
      type: "witchAction",
      actorSeatId: witch.seatId,
      mode: "poison",
      targetSeatId: poisonTarget.seatId,
    });

    expect(state.phase).toBe("DAY_ANNOUNCEMENT");
    expect(getSeat(state, wolfTarget.seatId).deathReason).toBe("WOLF_KILL");
    expect(getSeat(state, poisonTarget.seatId).deathReason).toBe("WITCH_POISON");
    expect(state.events.find((event) => event.type === "DAY_STARTED")?.payload).toMatchObject({
      deadSeatIds: [wolfTarget.seatId, poisonTarget.seatId],
    });

    state = applySystemStep(state);
    expect(state.phase).toBe("DAY_SPEECH");
  });

  it("only lets hunter shoot after wolf kill or exile", () => {
    let wolfKilledHunter = createGame({ seed: 7 });
    const wolf = wolfKilledHunter.seats.find((seat) => seat.role === "WEREWOLF")!;
    const hunter = wolfKilledHunter.seats.find((seat) => seat.role === "HUNTER")!;
    wolfKilledHunter = applyCommand(wolfKilledHunter, {
      type: "wolfKill",
      actorSeatId: wolf.seatId,
      targetSeatId: hunter.seatId,
    });
    wolfKilledHunter.phase = "DAY_ANNOUNCEMENT";
    wolfKilledHunter = applySystemStep(wolfKilledHunter);
    expect(wolfKilledHunter.phase).toBe("HUNTER_SHOT");

    let poisonedHunter = createGame({ seed: 7 });
    poisonedHunter.phase = "DAY_ANNOUNCEMENT";
    poisonedHunter.night.witchPoisonTargetSeatId = hunter.seatId;
    poisonedHunter = applySystemStep(poisonedHunter);
    expect(poisonedHunter.phase).not.toBe("HUNTER_SHOT");
    expect(getSeat(poisonedHunter, hunter.seatId).deathReason).toBe("WITCH_POISON");
  });

  it("handles tied votes without exile", () => {
    let state = createGame({ seed: 11 });
    state.phase = "DAY_VOTE";
    state.votes = {
      "1": 2,
      "2": 1,
      "3": 4,
      "4": 3,
    };

    state = applySystemStep(state);
    expect(state.phase).toBe("EXILE_RESOLUTION");
    state = applySystemStep(state);

    expect(state.day).toBe(2);
    expect(state.phase).toBe("NIGHT_WOLVES");
    expect(state.seats.every((seat) => seat.alive)).toBe(true);
    expect(state.events.some((event) => event.type === "VOTE_TIED")).toBe(true);
  });

  it("keeps votes private until resolution reveals tally and public vote reasons", () => {
    let state = createGame({ seed: 30 });
    state.phase = "DAY_VOTE";
    state = applyCommand(state, { type: "vote", actorSeatId: 1, targetSeatId: 2, reason: "测试理由" });
    const voteEvent = state.events.find((event) => event.type === "VOTE_CAST")!;

    expect(voteEvent.visibility).toBe("private");
    expect(buildHumanView(state).tableSummary.voteSnapshot.tally).toHaveLength(0);

    state.votes = {
      "1": 2,
      "2": 3,
      "3": 2,
    };
    state.phase = "EXILE_RESOLUTION";
    state = applySystemStep(state);
    const revealEvent = state.events.find((event) => event.type === "VOTE_REVEALED")!;
    const viewAfterReveal = buildHumanView(state);

    expect(revealEvent.visibility).toBe("public");
    expect(JSON.stringify(revealEvent.payload)).not.toContain("测试理由");
    expect(viewAfterReveal.tableSummary.voteSnapshot.votes).toEqual([
      expect.objectContaining({
        voter: expect.objectContaining({ seatId: 1 }),
        target: expect.objectContaining({ seatId: 2 }),
        reason: "测试理由",
      }),
    ]);
  });

  it("allows abstain votes and keeps them out of exile tally", () => {
    let state = createGame({ seed: 31 });
    state.phase = "DAY_VOTE";

    state = applyCommand(state, { type: "vote", actorSeatId: 1, reason: "信息不足，先弃票" });

    expect(state.votes["1"]).toBeNull();
    expect(() => applyCommand(state, { type: "vote", actorSeatId: 1, targetSeatId: 2 })).toThrow(/已经投过票/);

    state.votes = Object.fromEntries(state.seats.map((seat) => [String(seat.seatId), null]));
    state.phase = "EXILE_RESOLUTION";
    state = applySystemStep(state);

    const revealEvent = state.events.find((event) => event.type === "VOTE_REVEALED")!;
    const viewAfterReveal = buildHumanView(state);
    expect(revealEvent.payload).toMatchObject({ abstainCount: 9, tally: [] });
    expect(viewAfterReveal.tableSummary.voteSnapshot.abstainCount).toBe(9);
    expect(viewAfterReveal.tableSummary.voteSnapshot.votes[0]).toEqual(
      expect.objectContaining({ voter: expect.objectContaining({ seatId: 1 }), abstained: true }),
    );
    expect(state.seats.every((seat) => seat.alive)).toBe(true);
  });

  it("moves an exiled player into last words before the next night", () => {
    let state = createGame({ seed: 33 });
    const exiled = state.seats.find((seat) => seat.role !== "HUNTER")!;
    state.phase = "EXILE_RESOLUTION";
    state.votes = Object.fromEntries(state.seats.map((seat) => [String(seat.seatId), exiled.seatId]));

    state = applySystemStep(state);

    expect(state.phase).toBe("LAST_WORDS");
    expect(state.lastWordsSeatId).toBe(exiled.seatId);
    expect(getSeat(state, exiled.seatId).alive).toBe(false);
    expect(buildHumanView(state).availableActions[0]?.type).toBe(state.humanSeatId === exiled.seatId ? "lastWords" : "continue");

    state = applyCommand(state, {
      type: "lastWords",
      actorSeatId: exiled.seatId,
      message: "我遗言只留票型信息，今天谁跟票最快要重点回看。",
    });

    expect(state.phase).toBe("NIGHT_WOLVES");
    expect(state.events.at(-2)?.type).toBe("LAST_WORDS_CREATED");
  });

  it("lets an exiled hunter shoot before their last words", () => {
    let state = createGame({ seed: 35 });
    const hunter = state.seats.find((seat) => seat.role === "HUNTER")!;
    const target = state.seats.find((seat) => seat.seatId !== hunter.seatId)!;
    state.phase = "EXILE_RESOLUTION";
    state.votes = Object.fromEntries(state.seats.map((seat) => [String(seat.seatId), hunter.seatId]));

    state = applySystemStep(state);

    expect(state.phase).toBe("HUNTER_SHOT");
    expect(state.pendingHunterShot?.shooterSeatId).toBe(hunter.seatId);
    expect(state.lastWordsSeatId).toBeUndefined();
    expect(state.lastWordsQueue).toEqual([hunter.seatId]);

    state = applyCommand(state, {
      type: "hunterShoot",
      actorSeatId: hunter.seatId,
      targetSeatId: target.seatId,
    });

    expect(state.phase).toBe("LAST_WORDS");
    expect(state.lastWordsSeatId).toBe(hunter.seatId);
    expect(state.lastWordsQueue).toEqual([target.seatId]);

    state = applyCommand(state, {
      type: "lastWords",
      actorSeatId: hunter.seatId,
      message: "我先开枪再留遗言，枪口理由回看今天的票型压力。",
    });

    expect(state.phase).toBe("LAST_WORDS");
    expect(state.lastWordsSeatId).toBe(target.seatId);

    state = applyCommand(state, {
      type: "lastWords",
      actorSeatId: target.seatId,
      message: "我是被猎人带走的，最后提醒大家复盘猎人视角。",
    });

    expect(state.phase).toBe("NIGHT_WOLVES");
    const lastWordActors = state.events
      .filter((event) => event.type === "LAST_WORDS_CREATED")
      .map((event) => event.actorSeatId);
    expect(lastWordActors.slice(-2)).toEqual([hunter.seatId, target.seatId]);
  });

  it("gives the hunter-shot target last words before continuing", () => {
    let state = createGame({ seed: 34 });
    const hunter = state.seats.find((seat) => seat.role === "HUNTER")!;
    const target = state.seats.find((seat) => seat.seatId !== hunter.seatId && seat.role !== "HUNTER")!;
    state.phase = "HUNTER_SHOT";
    hunter.alive = false;
    hunter.deathReason = "EXILED";
    state.pendingHunterShot = { shooterSeatId: hunter.seatId, cause: "EXILED" };

    state = applyCommand(state, {
      type: "hunterShoot",
      actorSeatId: hunter.seatId,
      targetSeatId: target.seatId,
    });

    expect(state.phase).toBe("LAST_WORDS");
    expect(state.lastWordsSeatId).toBe(target.seatId);
    expect(getSeat(state, target.seatId).deathReason).toBe("HUNTER_SHOT");

    state = applyCommand(state, {
      type: "lastWords",
      actorSeatId: target.seatId,
      message: "我是被枪带走的，最后建议回看猎人开枪理由和前一轮站边。",
    });

    expect(state.phase).toBe("NIGHT_WOLVES");
    expect(state.events.some((event) => event.type === "LAST_WORDS_CREATED" && event.actorSeatId === target.seatId)).toBe(true);
  });

  it("offers the human vote immediately during simultaneous voting", () => {
    const state = createGame({ seed: 31 });
    state.phase = "DAY_VOTE";
    state.humanSeatId = 3;
    state.seats = state.seats.map((seat) => ({ ...seat, isAi: seat.seatId !== 3 }));

    const view = buildHumanView(state);

    expect(view.currentActorSeatId).toBe(3);
    expect(view.availableActions[0]?.type).toBe("vote");
  });

  it("batches AI votes after the human has voted", async () => {
    let state = createGame({ seed: 31, humanSeatId: 3 });
    state.phase = "DAY_VOTE";
    state = applyCommand(state, { type: "vote", actorSeatId: 3, targetSeatId: 1 });

    const advanced = await advanceOneAiStep(state);

    expect(advanced.state.phase).toBe("EXILE_RESOLUTION");
    expect(Object.keys(advanced.state.votes)).toHaveLength(9);
    expect(advanced.aiLogs.every((log) => log.phase === "DAY_VOTE")).toBe(true);
  });

  it("does not reveal AI night role actor seat in the human view", () => {
    const state = createGame({ seed: 32 });
    state.phase = "NIGHT_SEER";
    state.humanSeatId = state.seats.find((seat) => seat.role !== "SEER")!.seatId;
    state.seats = state.seats.map((seat) => ({ ...seat, isAi: seat.seatId !== state.humanSeatId }));

    const view = buildHumanView(state);

    expect(view.currentActorSeatId).toBeUndefined();
    expect(view.availableActions[0]?.type).toBe("continue");
    expect(view.availableActions[0]).toMatchObject({ label: "预言家行动中" });
  });

  it("evaluates slaughter-side win conditions", () => {
    const state = createGame({ seed: 9 });
    for (const seat of state.seats) {
      if (seat.role === "WEREWOLF") {
        seat.alive = false;
      }
    }
    expect(evaluateWinCondition(state)?.winner).toBe("GOOD");

    const wolfState = createGame({ seed: 10 });
    for (const seat of wolfState.seats) {
      if (seat.role === "VILLAGER") {
        seat.alive = false;
      }
    }
    expect(evaluateWinCondition(wolfState)?.winner).toBe("WEREWOLVES");
  });

  it("redacts role information from the human view", () => {
    const goodState = createGame({ seed: 1 });
    const goodView = buildHumanView(goodState);
    const hiddenRoles = goodView.seats.filter((seat) => !seat.isHuman && seat.role);
    expect(hiddenRoles).toHaveLength(goodView.myRole === "WEREWOLF" ? 2 : 0);

    const wolfState = Array.from({ length: 50 }, (_, seed) => createGame({ seed })).find(
      (state) => getSeat(state, 1).role === "WEREWOLF",
    )!;
    const wolfView = buildHumanView(wolfState);
    expect(wolfView.myRole).toBe("WEREWOLF");
    expect(wolfView.wolfTeammates).toHaveLength(2);
    expect(wolfView.seats.filter((seat) => seat.role === "WEREWOLF")).toHaveLength(3);
  });

  it("reveals all roles and includes review only after game over", async () => {
    const initialState = createGame({ seed: 15 });
    const earlyView = buildHumanView(initialState);
    expect(earlyView.review).toBeUndefined();

    const { state } = await advanceWithMockAi(initialState, {
      ignoreHuman: true,
      maxSteps: 500,
    });
    const terminalView = buildHumanView(state);
    const review = buildGameReview(state);

    expect(terminalView.review).toBeDefined();
    expect(terminalView.seats.every((seat) => seat.role)).toBe(true);
    expect(review.roleReveal).toHaveLength(9);
    expect(review.keyEvents.at(-1)?.message).toContain("获胜");
    expect(review.nightRounds.length).toBeGreaterThan(0);
    expect(review.turningPoints.length).toBeGreaterThanOrEqual(3);
    expect(review.aiInsights.length).toBeGreaterThan(0);
    expect(review.aiInsights[0]?.impact).toBeTruthy();
    expect(review.playerFeedback.length).toBeGreaterThan(0);
    expect(review.voteImpacts.length).toBeGreaterThan(0);
    expect(review.voteImpacts.some((impact) => impact.leaders.length > 0 || impact.outcome === "tie")).toBe(true);
  });

  it("keeps good AI table reads from hidden role information", () => {
    const state = createGame({ seed: 21 });
    const goodAi = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;
    const hiddenWolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const view = buildAgentView(state, goodAi.seatId);
    const read = buildAiTableRead(view);

    expect(view.privateKnowledge.wolfTeammates).toBeUndefined();
    expect(read.knownWolfSeatIds).toHaveLength(0);
    expect(read.seats.find((seat) => seat.seatId === hiddenWolf.seatId)?.isKnownWolf).toBe(false);
  });

  it("only gives wolf AI teammate private knowledge", () => {
    const state = createGame({ seed: 22 });
    const wolfAi = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    const view = buildAgentView(state, wolfAi.seatId);
    const read = buildAiTableRead(view);

    expect(view.privateKnowledge.wolfTeammates).toHaveLength(2);
    expect(read.wolfTeammateSeatIds).toHaveLength(2);
    expect(read.knownWolfSeatIds).toHaveLength(0);
  });

  it("stores private AI memory after an AI decision", async () => {
    let initialState = createGame({ seed: 64, humanSeatId: 9 });
    initialState.phase = "DAY_VOTE";
    initialState = applyCommand(initialState, { type: "vote", actorSeatId: 9, targetSeatId: 1 });

    const { state } = await advanceOneAiStep(initialState);
    const memory = state.aiMemories?.["1"];

    expect(memory?.seatId).toBe(1);
    expect(memory?.lastVoteTargetSeatId).toBeDefined();
    expect(memory?.beliefs.length).toBeGreaterThan(0);
  });

  it("uses AI memory for continuity without exposing it to the human view", () => {
    const state = createGame({ seed: 65, humanSeatId: 9 });
    const ai = state.seats.find((seat) => seat.isAi && seat.role !== "WEREWOLF")!;
    state.phase = "DAY_VOTE";
    const baselineView = buildAgentView(state, ai.seatId);
    const baselineRead = buildAiTableRead(baselineView);
    const rememberedTarget = baselineRead.focus!;
    const baselineSuspicion = rememberedTarget.suspicion;
    state.aiMemories = {
      [String(ai.seatId)]: {
        seatId: ai.seatId,
        day: 1,
        suspectedSeatId: rememberedTarget.seatId,
        lastSpeechTargetSeatId: rememberedTarget.seatId,
        lastVoteTargetSeatId: rememberedTarget.seatId,
        lastVoteReason: "上一轮已经施压",
        beliefs: [
          {
            seatId: rememberedTarget.seatId,
            suspicion: 96,
            trust: 4,
            reasons: ["上一轮已经施压"],
            updatedDay: 1,
          },
        ],
      },
    };

    const view = buildAgentView(state, ai.seatId);
    const read = buildAiTableRead(view);
    const rememberedRead = read.seats.find((seat) => seat.seatId === rememberedTarget.seatId)!;
    const votePlan = createVotePlan(view, read);
    const humanView = buildHumanView(state);

    expect(rememberedRead.suspicion).toBeGreaterThan(baselineSuspicion);
    expect(rememberedRead.pressure).toEqual(expect.arrayContaining(["延续上一轮发言焦点", "延续上一轮投票焦点"]));
    expect(votePlan.reason).toMatch(/上一轮|继续|保持一致/);
    expect(JSON.stringify(humanView)).not.toMatch(/aiMemories|aiMemory|lastSpeechTargetSeatId|beliefs/);
  });

  it("adds interaction and persona cues to AI speech plans", () => {
    let state = createGame({ seed: 66, humanSeatId: 9 });
    const speaker = state.seats.find((seat) => seat.isAi && seat.role !== "WEREWOLF")!;
    const previous = state.seats.find((seat) => seat.isAi && seat.seatId !== speaker.seatId)!;
    speaker.persona = {
      id: "strong-leader",
      name: "测试强势位",
      label: "强势带队型",
      style: "表达直接，会主动归票和压迫可疑玩家。",
      goal: "抢占白天节奏。",
      riskTolerance: 0.68,
      bluffing: 0.58,
    };
    state.phase = "DAY_SPEECH";
    state.speechQueue = [previous.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: previous.seatId,
      message: "我先不站死边，后面再看谁补逻辑。",
    });

    const plan = createSpeechPlan(buildAgentView(state, speaker.seatId));

    expect(plan.interaction?.sourceSpeaker?.seatId).toBe(previous.seatId);
    expect(plan.interaction?.line).toMatch(/上一位|接一下|转回|留疑问/);
    expect(plan.personaCue?.mode).toBe("press");
    expect(plan.talkingPoints).toEqual(expect.arrayContaining([plan.interaction!.line, plan.personaCue!.line]));
  });

  it("renders mock AI speech as a public reason chain", async () => {
    let state = createGame({ seed: 68, humanSeatId: 9 });
    const speaker = state.seats.find((seat) => seat.isAi && seat.role !== "WEREWOLF")!;
    const previous = state.seats.find((seat) => seat.isAi && seat.seatId !== speaker.seatId)!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [previous.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: previous.seatId,
      message: "我先点9号，他上一轮只给结论没有给过程，后面要看他怎么补。",
    });

    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);
    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(result.speech).toMatch(/理由是|拆因果|给边界|正面回答|两条线|身份和站边|听感/);
    expect(result.speech).toMatch(/如果/);
    expect(result.speech).not.toMatch(/队友|狼队|真实身份|隐藏身份|系统/);
  });

  it("does not pressure a reported gold-water target in fallback seer speech", async () => {
    const state = Array.from({ length: 30 }, (_, seed) => createGame({ seed: seed + 70, humanSeatId: 9 })).find((candidate) =>
      candidate.seats.some((seat) => seat.isAi && seat.role === "SEER"),
    )!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const target = state.seats.find((seat) => seat.role !== "WEREWOLF" && seat.seatId !== seer.seatId)!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    state.seerChecks = [{ day: state.day, seerSeatId: seer.seatId, targetSeatId: target.seatId, result: "GOOD" }];

    const result = await mockSpeechProvider.generateSpeech(buildAgentView(state, seer.seatId));

    expect(result.speech).toContain(`${target.seatId}号`);
    expect(result.speech).toContain("金水");
    expect(result.speech).toMatch(/硬踩金水|不作为今天出人焦点/);
    expect(result.speech).not.toMatch(new RegExp(`${target.seatId}号[^。]*(正面解释|压过去|只给结论)`));
  });

  it("accepts malformed JSON speech as free text", async () => {
    const state = createGame({ seed: 71, humanSeatId: 9 });
    const speaker = state.seats.find((seat) => seat.isAi)!;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "broken-json-speech",
      strictness: "guided",
      render: async () => "{\"speech\":\"我是6号。场上信息给得很快，2号跳女巫点9号",
    });

    const result = await provider.generateSpeech(buildAgentView(state, speaker.seatId));

    expect(result.isFallback).toBe(false);
    expect(result.speech).toBe("我是6号。场上信息给得很快，2号跳女巫点9号");
  });

  it("builds a table briefing that separates facts, unknowns, and speech order", () => {
    let state = createGame({ seed: 715, humanSeatId: 9 });
    const [firstSpeaker, currentSpeaker] = state.seats.filter((seat) => seat.isAi);
    state.phase = "DAY_SPEECH";
    state.speechQueue = [firstSpeaker!.seatId, currentSpeaker!.seatId];
    state.speechIndex = 0;

    state = applyCommand(state, {
      type: "speak",
      actorSeatId: firstSpeaker!.seatId,
      message: "我先点2号视角不足，后面再听完整。",
    });

    const input = buildConstrainedSpeechInput(buildAgentView(state, currentSpeaker!.seatId));

    expect(input.tableBriefing.text).toContain(`当前发言席：${currentSpeaker!.seatId}号`);
    expect(input.tableBriefing.text).toContain(`已经发言的人：${firstSpeaker!.seatId}号`);
    expect(input.tableBriefing.text).toContain("之后还没发言的人");
    expect(input.tableBriefing.text).toContain("公开边界");
    expect(input.tableBriefing.text).toContain("私有边界");
    expect(input.tableBriefing.text).toContain("不能越界");
    expect(input.tableBriefing.text).toContain("没有警上、警下、警徽、警长流程");
    expect(input.tableBriefing.speechProgress.spokenSeatIds).toEqual([firstSpeaker!.seatId]);
    expect(input.tableBriefing.speechProgress.unspokenSeatIds).not.toContain(firstSpeaker!.seatId);
    expect(input.tableBriefing.publicFacts.join("\n")).not.toContain("真实身份");
    expect(input.tableBriefing.privateBoundary.join("\n")).toContain("真实身份");
    expect(input.tableBriefing.legalSpeechFocus.join(" ")).toContain(`${firstSpeaker!.seatId}号`);
  });

  it("records public-only fact basis for AI speeches", async () => {
    let state = createGame({ seed: 716, humanSeatId: 9 });
    const [firstSpeaker, currentSpeaker] = state.seats.filter((seat) => seat.isAi);
    state.phase = "DAY_SPEECH";
    state.speechQueue = [firstSpeaker!.seatId, currentSpeaker!.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: firstSpeaker!.seatId,
      message: "我先点3号视角不足，后面再听完整。",
    });

    const { aiLogs } = await advanceOneAiStep(state);
    const basis = aiLogs[0]?.publicFactBasis ?? [];
    const serialized = basis.join("\n");

    expect(basis.length).toBeGreaterThan(3);
    expect(serialized).toContain(`本日已发言：${firstSpeaker!.seatId}号`);
    expect(serialized).toContain("我先点3号视角不足");
    expect(serialized).not.toMatch(/真实身份|狼队友|私有|privateKnowledge|ROLE_ASSIGNED/);
  });

  it("turns repeated public pressure into reasoning cues for LLM inputs", () => {
    const state = createGame({ seed: 817, humanSeatId: 9 });
    state.phase = "DAY_SPEECH";
    state.day = 1;
    state.stances = [
      {
        id: "stance-2-5",
        day: 1,
        actorSeatId: 2,
        targetSeatId: 5,
        kind: "PRESSURE",
        reason: "发言前后不一致",
        message: "5号这里前后不一致，我要先压一手。",
        sourceSpeechSeq: 10,
      },
      {
        id: "stance-6-5",
        day: 1,
        actorSeatId: 6,
        targetSeatId: 5,
        kind: "QUESTION",
        reason: "接着质疑",
        message: "我也觉得5号这轮需要解释。",
        sourceSpeechSeq: 11,
      },
      {
        id: "stance-7-5",
        day: 1,
        actorSeatId: 7,
        targetSeatId: 5,
        kind: "PRESSURE",
        reason: "继续施压",
        message: "5号这个点不能放。",
        sourceSpeechSeq: 12,
      },
    ];

    const memory = buildTableMemory(state);
    const influence = memory.speechInfluence[0];
    const view = buildAgentView(state, 6);
    const input = buildConstrainedSpeechInput(view);

    expect(influence).toMatchObject({
      sourceSpeechSeq: 10,
      followupCount: 2,
      speaker: { seatId: 2 },
      target: { seatId: 5 },
      direction: "pressure",
    });
    expect(memory.reasoningCues.some((cue) => cue.kind === "speech_influence" && cue.target?.seatId === 5)).toBe(true);
    expect(input.publicContext.tableMemory.reasoningCues.some((cue) => cue.kind === "speech_influence")).toBe(true);
    expect(input.tableBriefing.publicReasoningCues.length).toBeGreaterThan(0);
  });

  it("strips stage directions from AI speech before it reaches the table", async () => {
    const state = createGame({ seed: 72, humanSeatId: 9 });
    const speaker = state.seats.find((seat) => seat.isAi)!;
    state.phase = "DAY_SPEECH";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "stage-direction-speech",
      render: async () => "（缓缓起身，目光扫过全场，语气平稳）我先说结论，1号暂且不定，今天先听完再投。",
    });

    const result = await provider.generateSpeech(buildAgentView(state, speaker.seatId));

    expect(result.speech).toBe("我先说结论，1号暂且不定，今天先听完再投。");
    expect(result.speech).not.toMatch(/起身|目光|语气|全场/);
  });

  it("strips incomplete leading stage directions from live speech snapshots", () => {
    expect(stripSpeechStageDirections("（缓缓起身，目光")).toBe("");
    expect(stripSpeechStageDirections("平静，低沉：2号发言我先记一笔。")).toBe("2号发言我先记一笔。");
    expect(stripSpeechStageDirections("（起身，目光平视全场）2号发言我先记一笔。")).toBe(
      "2号发言我先记一笔。",
    );
  });

  it("varies mock AI speech shape by persona", async () => {
    const state = createGame({ seed: 69, humanSeatId: 9 });
    state.phase = "DAY_SPEECH";
    const [logicSpeaker, pressureSpeaker] = state.seats.filter((seat) => seat.isAi && seat.role === "VILLAGER");
    logicSpeaker!.persona = {
      id: "logic-checker",
      name: "DeepSeek",
      label: "逻辑校验型",
      style: "先拆因果，再给结论。",
      goal: "校验公开信息。",
      riskTolerance: 0.42,
      bluffing: 0.2,
    };
    pressureSpeaker!.persona = {
      id: "strong-leader",
      name: "豆包",
      label: "强势带队型",
      style: "主动施压，要求回应。",
      goal: "收束票型。",
      riskTolerance: 0.72,
      bluffing: 0.1,
    };

    const logicView = buildAgentView(state, logicSpeaker!.seatId);
    const pressureView = buildAgentView(state, pressureSpeaker!.seatId);
    const logicSpeech = (await mockSpeechProvider.generateSpeech(logicView, createSpeechPlan(logicView))).speech;
    const pressureSpeech = (await mockSpeechProvider.generateSpeech(pressureView, createSpeechPlan(pressureView))).speech;

    expect(logicSpeech).toMatch(/拆因果/);
    expect(pressureSpeech).toMatch(/正面回答/);
    expect(logicSpeech).not.toBe(pressureSpeech);
  });

  it("turns model preference profiles into different speech cues", () => {
    const state = createGame({ seed: 67, humanSeatId: 9 });
    state.phase = "DAY_SPEECH";

    const planFor = (name: string) => {
      const seat = state.seats.find((item) => item.name === name)!;
      return createSpeechPlan(buildAgentView(state, seat.seatId));
    };

    expect(planFor("DeepSeek").personaCue?.mode).toBe("verify");
    expect(planFor("豆包").personaCue?.mode).toBe("emotion");
    expect(planFor("Gemini").personaCue?.mode).toBe("hedge");
    expect(planFor("Kimi").personaCue?.mode).toBe("identity");
  });

  it("keeps speech plans out of guided LLM input but preserves them for strict mode", () => {
    let state = createGame({ seed: 67, humanSeatId: 9 });
    const speaker = state.seats.find((seat) => seat.isAi && seat.role !== "WEREWOLF")!;
    const previous = state.seats.find((seat) => seat.isAi && seat.seatId !== speaker.seatId)!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [previous.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: previous.seatId,
      message: "我觉得3号可以先放，票型不要太散。",
    });

    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan);
    const strictInput = buildConstrainedSpeechInput(view, plan, "strict");
    const serialized = JSON.stringify(input);

    expect(input.speechPlan).toBeUndefined();
    expect(strictInput.speechPlan?.interaction?.line).toBe(plan.interaction?.line);
    expect(strictInput.speechPlan?.personaCue?.directives.length).toBeGreaterThan(0);
    expect(serialized).not.toMatch(/privateKnowledge|wolfTeamPlan|ROLE_ASSIGNED/);
  });

  it("adds a soft player-style guide while preserving model characteristics", () => {
    let state = createGame({ seed: 67, humanSeatId: 9 });
    const speaker = state.seats.find((seat) => seat.name === "DeepSeek")!;
    const previous = state.seats.find((seat) => seat.isAi && seat.seatId !== speaker.seatId)!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [previous.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: previous.seatId,
      message: "我先压一下3号，他刚才只有结论，没有把投票口讲清楚。",
    });

    const view = buildAgentView(state, speaker.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view));
    const guideText = [
      ...input.playerSpeechGuide.tablePlayerStyle,
      ...input.playerSpeechGuide.softInteraction,
      ...input.playerSpeechGuide.avoid,
    ].join(" ");

    expect(input.playerSpeechGuide.modelStyle.modelName).toBe("DeepSeek");
    expect(input.playerSpeechGuide.modelStyle.softTendency).toContain("逻辑链");
    expect(guideText).toContain("像坐在桌边发言");
    expect(guideText).toContain("如果和你的判断有关");
    expect(guideText).toContain("不是必须照念");
    expect(guideText).toContain("不要为了接话强行回应上一位");
    expect(guideText).toContain("不要把模型特点说成自我介绍");
    expect(JSON.stringify(input)).not.toMatch(/privateKnowledge|wolfTeamPlan|ROLE_ASSIGNED/);
  });

  it("gives witch speech input explicit saved-target context", () => {
    let state = Array.from({ length: 30 }, (_, seed) => createGame({ seed: seed + 72, humanSeatId: 9 })).find((candidate) =>
      candidate.seats.some((seat) => seat.isAi && seat.role === "WITCH"),
    )!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const witch = state.seats.find((seat) => seat.isAi && seat.role === "WITCH")!;
    const victim = state.seats.find((seat) => seat.seatId !== witch.seatId && seat.role !== "WEREWOLF")!;
    state = applyCommand(state, {
      type: "wolfKill",
      actorSeatId: wolf.seatId,
      targetSeatId: victim.seatId,
    });
    state.phase = "NIGHT_WITCH";
    state = applyCommand(state, { type: "witchAction", actorSeatId: witch.seatId, mode: "save" });
    state = applySystemStep(state);

    const view = buildAgentView(state, witch.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view));

    expect(input.privateContext.witch?.currentVictim?.seatId).toBe(victim.seatId);
    expect(input.privateContext.witch?.savedTarget?.seatId).toBe(victim.seatId);
    expect(input.privateContext.witch?.antidoteUsedTonight).toBe(true);
    expect(input.speechPlan).toBeUndefined();
  });

  it("lets witch claim and lead when identity pressure needs a god anchor", () => {
    let state = createGame({ seed: 71, humanSeatId: 9 });
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const witch = state.seats.find((seat) => seat.role === "WITCH")!;
    witch.persona = {
      id: "god-leader-witch",
      name: "测试女巫",
      label: "强势带队型",
      style: "会在关键身份压力下拍身份带队。",
      goal: "收束票型。",
      riskTolerance: 0.9,
      bluffing: 0.5,
    };
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [seer.seatId, wolf.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seer.seatId,
      message: "我跳预言家，2号是金水。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: wolf.seatId,
      message: "我跳预言家，3号是查杀。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [witch.seatId];
    state.speechIndex = 0;

    const plan = createSpeechPlan(buildAgentView(state, witch.seatId));

    expect(plan.kind).toBe("rally");
    expect(plan.claimIntent).toEqual(expect.objectContaining({ claimedRole: "WITCH", strength: "hard" }));
    expect(plan.talkingPoints.join("。")).toContain("我拍女巫");
  });

  it("keeps the last hidden god from claiming when two god roles are already exposed", () => {
    let state = createGame({ seed: 72, humanSeatId: 9 });
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const witch = state.seats.find((seat) => seat.role === "WITCH")!;
    const hunter = state.seats.find((seat) => seat.role === "HUNTER")!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [seer.seatId, witch.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seer.seatId,
      message: "我跳预言家，2号是金水。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: witch.seatId,
      message: "我拍女巫，今天票型别散。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [hunter.seatId];
    state.speechIndex = 0;

    const plan = createSpeechPlan(buildAgentView(state, hunter.seatId));

    expect(plan.claimIntent).toBeUndefined();
    expect(`${plan.stance} ${plan.talkingPoints.join("。")}`).toMatch(/神坑.*藏|神坑.*够亮/);
  });

  it("keeps villagers hidden when too many villager claims are already exposed", () => {
    let state = createGame({ seed: 73, humanSeatId: 9 });
    const villagers = state.seats.filter((seat) => seat.role === "VILLAGER");
    const [first, second, third] = villagers;
    expect(third).toBeDefined();
    state.phase = "DAY_SPEECH";
    state.speechQueue = [first!.seatId, second!.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: first!.seatId,
      message: "我这里是平民牌，先按公开信息投。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: second!.seatId,
      message: "我是平民，今天不要散票。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [third!.seatId];
    state.speechIndex = 0;

    const plan = createSpeechPlan(buildAgentView(state, third!.seatId));

    expect(plan.claimIntent).toBeUndefined();
    expect(`${plan.stance} ${plan.talkingPoints.join("。")}`).toMatch(/民坑.*藏|民坑.*够亮/);
  });

  it("lets bold villagers fake a god identity to absorb night pressure", () => {
    let state = createGame({ seed: 74, humanSeatId: 9 });
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const villager = state.seats.find((seat) => seat.role === "VILLAGER")!;
    villager.persona = {
      id: "fake-god-villager",
      name: "测试挡刀民",
      label: "冒险挡刀型",
      style: "会用身份口径替真神吸引夜刀。",
      goal: "保护神职空间。",
      riskTolerance: 0.92,
      bluffing: 0.94,
    };
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seer.seatId,
      message: "我跳预言家，2号是金水。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [villager.seatId];
    state.speechIndex = 0;

    const plan = createSpeechPlan(buildAgentView(state, villager.seatId));

    expect(["WITCH", "HUNTER"]).toContain(plan.claimIntent?.claimedRole);
    expect(`${plan.stance} ${plan.talkingPoints.join("。")}`).toMatch(/狼夜里可以来试|身份坑/);
  });

  it("lets seer AI claim and vote a checked wolf first", () => {
    const state = createGame({ seed: 23 });
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    state.phase = "DAY_VOTE";
    state.seerChecks.push({
      day: 1,
      seerSeatId: seer.seatId,
      targetSeatId: wolf.seatId,
      result: "WEREWOLF",
    });

    const view = buildAgentView(state, seer.seatId);
    const speechPlan = createSpeechPlan(view);
    const votePlan = createVotePlan(view);

    expect(speechPlan.kind).toBe("claim-check");
    expect(speechPlan.stance).toContain("查验狼");
    expect(votePlan.target.seatId).toBe(wolf.seatId);
  });

  it("uses constrained LLM speech when the output follows the speech plan", async () => {
    const state = createGame({ seed: 23 });
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    state.phase = "DAY_SPEECH";
    state.seerChecks.push({
      day: 1,
      seerSeatId: seer.seatId,
      targetSeatId: wolf.seatId,
      result: "WEREWOLF",
    });
    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-llm",
      async render(input) {
        expect(JSON.stringify(input)).not.toMatch(/privateKnowledge|wolfTeamPlan|ROLE_ASSIGNED/);
        return JSON.stringify({
          speech: `我跳预言家，${wolf.seatId}号是查杀。今天先围绕${wolf.seatId}号归票，外置位不要散。`,
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.provider).toBe("test-llm");
    expect(result.speech).toContain(`${wolf.seatId}号是查杀`);
  });

  it("retries malformed LLM speech output and accepts a stable correction", async () => {
    const state = createGame({ seed: 24 });
    const villager = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;
    const target = state.seats.find((seat) => seat.alive && seat.seatId !== villager.seatId)!;
    state.phase = "DAY_SPEECH";
    const view = buildAgentView(state, villager.seatId);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-llm",
      async render(input) {
        attempts += 1;
        if (attempts === 1) return "{\"speech\":";
        expect(input.stability).toMatchObject({
          attempt: 2,
          expectedFormat: "{\"speech\":\"你的公开发言\"}",
        });
        expect(input.stability?.previousIssue).toContain("格式");
        return `发言：我先按公开发言盘，后置${target.seatId}号如果发言缺少过程，我会重点听这里解释。`;
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(attempts).toBe(2);
    expect(result.isFallback).toBe(false);
    expect(result.speech).toContain(`后置${target.seatId}号如果发言缺少过程`);
    expect(result.rawOutput).toEqual(expect.any(Array));
  });

  it("falls back in strict mode when LLM speech adds an unplanned claim or misses the target", async () => {
    const state = createGame({ seed: 26 });
    const villager = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;
    state.phase = "DAY_SPEECH";
    const view = buildAgentView(state, villager.seatId);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-llm",
      strictness: "strict",
      async render() {
        return JSON.stringify({ speech: "我跳预言家，2号是查杀，今天听我的。" });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.validationErrors).toEqual(expect.arrayContaining(["发言新增了计划外身份声明"]));
    expect(result.speech).not.toContain("我跳预言家，2号是查杀");
  });

  it("lets guided LLM speech diverge from the plan while keeping hard boundaries", async () => {
    const state = createGame({ seed: 26 });
    const villager = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;
    const target = state.seats.find((seat) => seat.seatId !== villager.seatId && seat.alive)!;
    state.phase = "DAY_SPEECH";
    const view = buildAgentView(state, villager.seatId);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-llm",
      strictness: "guided",
      async render(input) {
        expect(input.speechStrictness).toBe("guided");
        expect(input.constraints).toBeUndefined();
        return `我临时改一下视角，${target.seatId}号像查杀，先听这里解释。`;
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).toContain(`${target.seatId}号像查杀`);
  });

  it("allows guided seer speech to bluff around a real check", async () => {
    const state = createGame({ seed: 23 });
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    state.phase = "DAY_SPEECH";
    state.seerChecks.push({
      day: 1,
      seerSeatId: seer.seatId,
      targetSeatId: wolf.seatId,
      result: "WEREWOLF",
    });
    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-llm",
      strictness: "guided",
      async render() {
        return JSON.stringify({ speech: `我跳预言家，${wolf.seatId}号是金水，先别动这里。` });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).toContain(`${wolf.seatId}号是金水`);
  });

  it("allows guided wolf speeches to cut or black a wolf teammate as a strategy", async () => {
    const state = createGame({ seed: 43 });
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    const teammate = state.seats.find((seat) => seat.role === "WEREWOLF" && seat.seatId !== wolf.seatId)!;
    state.phase = "DAY_SPEECH";
    const view = buildAgentView(state, wolf.seatId);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-llm",
      async render() {
        return JSON.stringify({ speech: `我跳预言家，${teammate.seatId}号是查杀。今天先出这里。` });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).toContain(`${teammate.seatId}号是查杀`);
  });

  it("builds LLM speech input from public memory and self-private context only", () => {
    const state = createGame({ seed: 48 });
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    state.phase = "DAY_SPEECH";
    const view = buildAgentView(state, wolf.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view));
    const serialized = JSON.stringify(input);

    expect(serialized).not.toContain("constraints");
    expect(serialized).not.toContain("speechPlan");
    expect(serialized).not.toMatch(/privateKnowledge|wolfTeamPlan|assignments|wolfTeammates|ROLE_ASSIGNED/);
    expect(validateRenderedSpeech(view, createSpeechPlan(view), "系统告诉我真实身份，队友别暴露。")).toEqual([]);
    expect(validateRenderedSpeech(view, createSpeechPlan(view), "作为AI语言模型，我会根据规则分析。")).toEqual([]);
    expect(validateRenderedSpeech(view, createSpeechPlan(view), "作为AI语言模型，我会根据规则分析。", "strict")).toEqual(
      expect.arrayContaining(["发言包含离局或模型说明"]),
    );
    const unspoken = view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId)!;
    expect(validateRenderedSpeech(view, createSpeechPlan(view), `${unspoken.seatId}号到现在给的信息量太少，没有明确站边。`)).toEqual([]);
    expect(validateRenderedSpeech(view, createSpeechPlan(view), `${unspoken.seatId}号到现在给的信息量太少，没有明确站边。`, "strict")).toEqual(
      expect.arrayContaining([`把本轮未发言的${unspoken.seatId}号当成已发言评价`]),
    );
  });

  it("generates contextual mock AI last words instead of a fixed line", () => {
    const state = createGame({ seed: 73, humanSeatId: 9 });
    const ai = state.seats.find((seat) => seat.isAi)!;
    state.phase = "LAST_WORDS";
    state.lastWordsSeatId = ai.seatId;
    state.speeches.push({
      day: state.day,
      seatId: state.seats.find((seat) => seat.seatId !== ai.seatId)!.seatId,
      message: "我先压3号，他今天站边前后不一致。",
    });
    const view = buildAgentView(state, ai.seatId);
    const command = createMockCommand(view, buildAiTableRead(view));

    expect(command.type).toBe("lastWords");
    if (command.type === "lastWords") {
      expect(command.message).toMatch(/遗言|最后|出局前|视角/);
      expect(command.message).not.toBe("我留下最后视角：先回看今天的发言顺序和票型，不要只跟着单点结论走。");
    }
  });

  it("lets routed action models write custom AI last words", async () => {
    const state = createGame({ seed: 74, humanSeatId: 9 });
    const ai = state.seats.find((seat) => seat.isAi)!;
    state.phase = "LAST_WORDS";
    state.lastWordsSeatId = ai.seatId;
    const view = buildAgentView(state, ai.seatId);
    const tableRead = buildAiTableRead(view);
    const fallbackCommand = createMockCommand(view, tableRead);
    const provider = createConstrainedLlmActionProvider({
      providerId: "test-last-words-llm",
      async render(input) {
        expect(input.candidates.some((candidate) => candidate.id === "lastWords:custom")).toBe(true);
        return JSON.stringify({
          candidateId: "lastWords:custom",
          reason: "出局遗言补充公开视角",
          message: "我遗言只留一条：谁借我出局直接收票，明天先查谁；别让单点带队盖过票型。",
        });
      },
    });

    const result = await provider.generateCommand(view, { tableRead, fallbackCommand });

    expect(result.isFallback).toBe(false);
    expect(result.command).toMatchObject({
      type: "lastWords",
      message: "我遗言只留一条：谁借我出局直接收票，明天先查谁；别让单点带队盖过票型。",
    });
  });

  it("uses constrained LLM action when the chosen candidate is legal", async () => {
    const state = createGame({ seed: 61 });
    const voter = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);
    const provider = createConstrainedLlmActionProvider({
      providerId: "test-action-llm",
      async render(input) {
        expect(JSON.stringify(input)).not.toMatch(/privateKnowledge|wolfTeamPlan|ROLE_ASSIGNED/);
        const candidate = input.candidates.find((item) => item.command.type === "vote")!;
        return JSON.stringify({
          candidateId: candidate.id,
          reason: "public pressure and vote shape point there",
        });
      },
    });

    const result = await provider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    expect(result.isFallback).toBe(false);
    expect(result.provider).toBe("test-action-llm");
    expect(result.command).toMatchObject({ type: "vote", actorSeatId: voter.seatId });
    expect(result.command.reason).toBe("public pressure and vote shape point there");
  });

  it("adds a compact public decision summary to LLM action input", () => {
    let state = createGame({ seed: 76 });
    const speaker = state.seats.find((seat) => seat.isAi)!;
    const voter = state.seats.find((seat) => seat.isAi && seat.seatId !== speaker.seatId)!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: speaker.seatId,
      message: "I pressure 1 2 3 4 5 6 7 8 9 because this table needs public evidence before votes.",
    });
    state.phase = "DAY_VOTE";

    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });
    const summary = input.publicContext.decisionSummary;

    expect(summary.speechChain.join(" ")).toContain("public evidence before votes");
    expect(summary.candidatePublicEvidence.some((item) => item.evidence.join(" ").includes("mentioned"))).toBe(true);
    expect(input.constraints.join(" ")).toContain("decisionSummary");
    expect(JSON.stringify(summary)).not.toMatch(/privateKnowledge|wolfTeamPlan|knownWolfSeatIds/);
  });

  it("coerces stable LLM action output from targetSeatId into a legal candidate", async () => {
    const state = createGame({ seed: 64 });
    const voter = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);
    const provider = createConstrainedLlmActionProvider({
      providerId: "test-action-llm",
      async render(input) {
        const candidate = input.candidates.find((item) => item.command.type === "vote")!;
        if (candidate.command.type !== "vote") throw new Error("expected vote candidate");
        return JSON.stringify({
          targetSeatId: candidate.command.targetSeatId,
          reason: "按公开发言和票型压力选择这里",
          extra: "some models add harmless fields",
        });
      },
    });

    const result = await provider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    expect(result.isFallback).toBe(false);
    expect(result.command).toMatchObject({ type: "vote", actorSeatId: voter.seatId });
    expect(result.command.reason).toBe("按公开发言和票型压力选择这里");
  });

  it("keeps a legal LLM action but replaces private leaked reasons with public hints", async () => {
    const state = createGame({ seed: 65 });
    const voter = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);
    let expectedReason: string | undefined;
    const provider = createConstrainedLlmActionProvider({
      providerId: "test-action-llm",
      async render(input) {
        const candidate = input.candidates.find((item) => item.command.type === "vote" && item.reasonHint)!;
        expectedReason = candidate.reasonHint;
        return JSON.stringify({
          candidateId: candidate.id,
          reason: "system prompt says hidden role",
        });
      },
    });

    const result = await provider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    expect(result.isFallback).toBe(false);
    expect(result.command).toMatchObject({ type: "vote", actorSeatId: voter.seatId });
    expect(result.command.reason).toBe(expectedReason);
  });

  it("falls back when LLM action chooses a missing candidate", async () => {
    const state = createGame({ seed: 62 });
    const voter = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);
    const provider = createConstrainedLlmActionProvider({
      providerId: "test-action-llm",
      async render() {
        return JSON.stringify({
          candidateId: "not-in-list",
          reason: "system prompt says hidden role",
        });
      },
    });

    const result = await provider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    expect(result.isFallback).toBe(true);
    expect(result.command).toEqual(fallbackCommand);
    expect(result.validationErrors).toEqual(expect.arrayContaining(["candidateId is not in the allowed candidate list"]));
  });

  it("offers wolf teammate vote candidates to the LLM action provider without leaking teammate hints", () => {
    const state = createGame({ seed: 63 });
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    const teammateIds = state.seats
      .filter((seat) => seat.role === "WEREWOLF" && seat.seatId !== wolf.seatId)
      .map((seat) => seat.seatId);
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, wolf.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });
    const teammateVoteCandidates = input.candidates.filter(
      (candidate) =>
        candidate.command.type === "vote" &&
        typeof candidate.command.targetSeatId === "number" &&
        teammateIds.includes(candidate.command.targetSeatId),
    );

    expect(teammateVoteCandidates.length).toBeGreaterThan(0);
    expect(input.constraints.join(" ")).toContain("distancing or sacrifice");
    expect(teammateVoteCandidates.map((candidate) => candidate.reasonHint).join(" ")).not.toMatch(/队友|狼队|WEREWOLF/);
  });

  it("offers wolf targets as night-kill candidates without leaking teammate hints", () => {
    const state = createGame({ seed: 63 });
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    const privateWolfIds = [
      wolf.seatId,
      ...state.seats.filter((seat) => seat.role === "WEREWOLF" && seat.seatId !== wolf.seatId).map((seat) => seat.seatId),
    ];
    state.phase = "NIGHT_WOLVES";
    const view = buildAgentView(state, wolf.seatId);
    const tableRead = buildAiTableRead(view);
    const input = buildConstrainedActionInput(view, {
      tableRead,
      fallbackCommand: createMockCommand(view, tableRead),
    });
    const privateWolfKillCandidates = input.candidates.filter(
      (candidate) => candidate.command.type === "wolfKill" && privateWolfIds.includes(candidate.command.targetSeatId),
    );

    expect(privateWolfKillCandidates.length).toBeGreaterThan(0);
    expect(input.constraints.join(" ")).toContain("potion-bait");
    expect(privateWolfKillCandidates.map((candidate) => candidate.reasonHint).join(" ")).not.toMatch(/队友|狼队|WEREWOLF/);
  });

  it("records public role claims without truth fields before game over", () => {
    let state = createGame({ seed: 41 });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [state.humanSeatId];
    state.speechIndex = 0;

    state = applyCommand(state, {
      type: "speak",
      actorSeatId: state.humanSeatId,
      message: "我是预言家，2号查杀，3号金水。",
    });
    const view = buildHumanView(state);
    const claim = state.roleClaims[0];

    expect(claim).toMatchObject({
      claimantSeatId: state.humanSeatId,
      claimedRole: "SEER",
      strength: "hard",
    });
    expect(claim.checks).toEqual([
      expect.objectContaining({ targetSeatId: 2, result: "WEREWOLF" }),
      expect.objectContaining({ targetSeatId: 3, result: "GOOD" }),
    ]);
    expect(Object.keys(claim)).not.toContain("truthful");
    expect(JSON.stringify(view.tableSummary.claimBoard)).not.toMatch(/truth|actual|trueRole/);
    expect(view.review).toBeUndefined();
    expect(view.seats.filter((seat) => !seat.isHuman && seat.role)).toHaveLength(view.myRole === "WEREWOLF" ? 2 : 0);
  });

  it("recognizes natural villager wording and named seer checks", () => {
    let villageState = createGame({ seed: 411 });
    villageState.phase = "DAY_SPEECH";
    villageState.speechQueue = [villageState.humanSeatId];
    villageState.speechIndex = 0;
    villageState = applyCommand(villageState, {
      type: "speak",
      actorSeatId: villageState.humanSeatId,
      message: "我作为平民，先听前置位逻辑，不急着出人。",
    });

    expect(villageState.roleClaims[0]).toMatchObject({
      claimantSeatId: villageState.humanSeatId,
      claimedRole: "VILLAGER",
    });

    let seerState = createGame({ seed: 412 });
    seerState.phase = "DAY_SPEECH";
    seerState.speechQueue = [seerState.humanSeatId];
    seerState.speechIndex = 0;
    seerState = applyCommand(seerState, {
      type: "speak",
      actorSeatId: seerState.humanSeatId,
      message: "我是预言家，昨晚我查验的是9号Kimi，查杀，是狼人。",
    });

    expect(seerState.roleClaims[0]?.checks).toEqual([
      expect.objectContaining({ targetSeatId: 9, result: "WEREWOLF" }),
    ]);
  });

  it("does not treat discussing witch actions as a self witch claim", () => {
    let state = createGame({ seed: 413 });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [state.humanSeatId];
    state.speechIndex = 0;

    state = applyCommand(state, {
      type: "speak",
      actorSeatId: state.humanSeatId,
      message: "大家好，我是1号。昨晚平安夜，女巫用了药，狼人没刀到人。",
    });

    expect(state.roleClaims).toHaveLength(0);
  });

  it("does not treat confidence wording as a hunter claim", () => {
    let state = createGame({ seed: 42 });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [state.humanSeatId];
    state.speechIndex = 0;

    state = applyCommand(state, {
      type: "speak",
      actorSeatId: state.humanSeatId,
      message:
        "我先给一个边界，我底牌不虚但不乱拍身份。上一位DeepSeek先记下，但我这轮要转回9号的发言缺口。",
    });
    const view = buildHumanView(state);

    expect(state.roleClaims).toHaveLength(0);
    expect(view.tableSummary.claimBoard).toHaveLength(0);
  });

  it("does not treat referencing another seer report as your own claim", () => {
    let state = createGame({ seed: 43 });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [state.humanSeatId];
    state.speechIndex = 0;

    state = applyCommand(state, {
      type: "speak",
      actorSeatId: state.humanSeatId,
      message: "我这里先不跳身份，1号报3号金水先听着，今天投票别急着散。",
    });
    const view = buildHumanView(state);

    expect(state.roleClaims).toHaveLength(0);
    expect(view.tableSummary.claimBoard).toHaveLength(0);
  });

  it("records public stances and detects stance shifts without truth fields", () => {
    let state = createGame({ seed: 45 });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [state.humanSeatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: state.humanSeatId,
      message: "我认3号预言家，今天压4号。",
    });

    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [state.humanSeatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: state.humanSeatId,
      message: "我不认3号预言家，前后逻辑不顺。",
    });

    const view = buildHumanView(state);

    expect(state.stances.map((stance) => stance.kind)).toEqual(expect.arrayContaining(["SUPPORT", "PRESSURE", "QUESTION"]));
    expect(view.tableSummary.tableMemory.stanceBoard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "SUPPORT", target: expect.objectContaining({ seatId: 3 }), targetRole: "SEER" }),
        expect.objectContaining({ kind: "QUESTION", target: expect.objectContaining({ seatId: 3 }), targetRole: "SEER" }),
      ]),
    );
    expect(view.tableSummary.tableMemory.stanceShifts).toEqual([
      expect.objectContaining({
        actor: expect.objectContaining({ seatId: state.humanSeatId }),
        target: expect.objectContaining({ seatId: 3 }),
        fromKind: "SUPPORT",
        toKind: "QUESTION",
      }),
    ]);
    expect(JSON.stringify(view.tableSummary.tableMemory.stanceBoard)).not.toMatch(/truth|actual|trueRole/);
  });

  it("projects table memory to AI without exposing hidden roles", () => {
    let state = createGame({ seed: 42 });
    const claimant = state.seats.find((seat) => seat.seatId !== state.humanSeatId)!;
    const goodAi = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER" && seat.seatId !== claimant.seatId)!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [claimant.seatId];
    state.speechIndex = 0;

    state = applyCommand(state, {
      type: "speak",
      actorSeatId: claimant.seatId,
      message: "我跳预言家，4号是查杀。",
    });
    const view = buildAgentView(state, goodAi.seatId);
    const serializedMemory = JSON.stringify(view.publicSummary.tableMemory);

    expect(view.publicSummary.claimBoard).toHaveLength(1);
    expect(view.publicSummary.tableMemory.focus.some((item) => item.seat.seatId === 4)).toBe(true);
    expect(serializedMemory).not.toMatch(/trueRole|truthful|actualResult|WITCH|HUNTER|VILLAGER/);
    expect(view.privateKnowledge.wolfTeammates).toBeUndefined();
  });

  it("passes night-dead public seer claimant legacy to AI without confirming truth", () => {
    let state = createGame({ seed: 52 });
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const villager = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;

    state.phase = "DAY_SPEECH";
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seer.seatId,
      message: `我跳预言家，${wolf.seatId}号是查杀。今天先归${wolf.seatId}号。`,
    });

    seer.alive = false;
    seer.deathReason = "WOLF_KILL";
    state.day = 2;
    state.phase = "DAY_VOTE";
    state.events.push({
      seq: Math.max(...state.events.map((event) => event.seq)) + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 2,
      phase: "DAY_ANNOUNCEMENT",
      message: `第2天清晨，${seer.seatId}号 死亡。`,
      payload: { deadSeatIds: [seer.seatId] },
    });

    const view = buildAgentView(state, villager.seatId);
    const tableRead = buildAiTableRead(view);
    const wolfRead = tableRead.seats.find((seat) => seat.seatId === wolf.seatId)!;
    const votePlan = createVotePlan(view, tableRead);
    const actionInput = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });
    const serializedMemory = JSON.stringify(view.publicSummary.tableMemory);

    expect(view.publicSummary.tableMemory.seerLegacies).toEqual([
      expect.objectContaining({
        claimant: expect.objectContaining({ seatId: seer.seatId }),
        deathDay: 2,
        checks: [expect.objectContaining({ target: expect.objectContaining({ seatId: wolf.seatId }), result: "WEREWOLF" })],
      }),
    ]);
    expect(wolfRead.pressure).toContain(`${seer.name}夜死后遗留查杀`);
    expect(actionInput.publicContext.tableMemory.seerLegacies).toHaveLength(1);
    expect(actionInput.constraints.join("\n")).toContain("night-dead seer claimants");
    expect(serializedMemory).not.toMatch(/trueRole|truthful|actualResult|deathReason|WOLF_KILL/);
  });

  it("gives good AI a public reason not to weakly push unchallenged god claims", () => {
    const state = createGame({ seed: 60 });
    const witch = state.seats.find((seat) => seat.role === "WITCH")!;
    const villager = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;
    const counterclaimant = state.seats.find((seat) => seat.seatId !== witch.seatId && seat.seatId !== villager.seatId)!;

    state.phase = "DAY_VOTE";
    state.roleClaims.push({
      id: `${witch.seatId}:WITCH`,
      day: 1,
      claimantSeatId: witch.seatId,
      claimedRole: "WITCH",
      strength: "hard",
      checks: [],
      message: "我拍女巫。",
    });

    const protectedRead = buildAiTableRead(buildAgentView(state, villager.seatId));
    const protectedWitch = protectedRead.seats.find((seat) => seat.seatId === witch.seatId)!;

    expect(protectedWitch.pressure).toContain("女巫未对跳，先不弱推");
    expect(protectedWitch.trust).toBeGreaterThan(protectedWitch.suspicion);

    state.roleClaims.push({
      id: `${counterclaimant.seatId}:WITCH`,
      day: 1,
      claimantSeatId: counterclaimant.seatId,
      claimedRole: "WITCH",
      strength: "hard",
      checks: [],
      message: "我也拍女巫。",
    });

    const counterclaimedRead = buildAiTableRead(buildAgentView(state, villager.seatId));
    const counterclaimedWitch = counterclaimedRead.seats.find((seat) => seat.seatId === witch.seatId)!;

    expect(counterclaimedWitch.pressure).not.toContain("女巫未对跳，先不弱推");
  });

  it("lets wolf AI counterclaim seer with a fake check that does not black a teammate", () => {
    let found:
      | {
          state: ReturnType<typeof createGame>;
          wolfSeatId: number;
          teammateIds: number[];
          firstPlan: ReturnType<typeof createSpeechPlan>;
        }
      | undefined;

    for (let seed = 40; seed < 160 && !found; seed += 1) {
      let state = createGame({ seed });
      const seer = state.seats.find((seat) => seat.role === "SEER")!;
      state.phase = "DAY_SPEECH";
      state.speechQueue = [seer.seatId];
      state.speechIndex = 0;
      state = applyCommand(state, {
        type: "speak",
        actorSeatId: seer.seatId,
        message: "我跳预言家，1号是金水。",
      });

      for (const wolf of state.seats.filter((seat) => seat.role === "WEREWOLF")) {
        state.phase = "DAY_SPEECH";
        state.speechQueue = [wolf.seatId];
        state.speechIndex = 0;
        const firstPlan = createSpeechPlan(buildAgentView(state, wolf.seatId));
        if (firstPlan.kind !== "counterclaim") continue;
        found = {
          state,
          wolfSeatId: wolf.seatId,
          teammateIds: state.seats
            .filter((seat) => seat.role === "WEREWOLF" && seat.seatId !== wolf.seatId)
            .map((seat) => seat.seatId),
          firstPlan,
        };
        break;
      }
    }

    expect(found).toBeDefined();
    let state = found!.state;
    const { wolfSeatId, teammateIds, firstPlan } = found!;
    expect(firstPlan.kind).toBe("counterclaim");
    expect(firstPlan.claimIntent?.claimedRole).toBe("SEER");
    expect(firstPlan.claimIntent?.check?.result).toBe("WEREWOLF");
    expect(teammateIds).not.toContain(firstPlan.claimIntent?.check?.targetSeatId);

    state = applyCommand(state, {
      type: "speak",
      actorSeatId: wolfSeatId,
      message: `我跳预言家，${firstPlan.claimIntent?.check?.targetSeatId}号是查杀。今天先从我的查杀位归票。`,
    });
    const secondPlan = createSpeechPlan(buildAgentView(state, wolfSeatId));

    expect(secondPlan.claimIntent?.check?.targetSeatId).toBe(firstPlan.claimIntent?.check?.targetSeatId);
    expect(secondPlan.claimIntent?.check?.result).toBe(firstPlan.claimIntent?.check?.result);
  });

  it("does not force every wolf team to counterclaim a public seer", () => {
    let counterclaimGames = 0;
    let shadowGames = 0;

    for (let seed = 200; seed < 240; seed += 1) {
      let state = createGame({ seed });
      const seer = state.seats.find((seat) => seat.role === "SEER")!;
      state.phase = "DAY_SPEECH";
      state.speechQueue = [seer.seatId];
      state.speechIndex = 0;
      state = applyCommand(state, {
        type: "speak",
        actorSeatId: seer.seatId,
        message: "我跳预言家，1号是金水。",
      });

      const hasCounterclaim = state.seats
        .filter((seat) => seat.role === "WEREWOLF")
        .some((wolf) => {
          state.phase = "DAY_SPEECH";
          state.speechQueue = [wolf.seatId];
          state.speechIndex = 0;
          return createSpeechPlan(buildAgentView(state, wolf.seatId)).kind === "counterclaim";
        });

      if (hasCounterclaim) counterclaimGames += 1;
      else shadowGames += 1;
    }

    expect(counterclaimGames).toBeGreaterThan(0);
    expect(shadowGames).toBeGreaterThan(0);
  });

  it("only exposes wolf team plans to wolves", () => {
    const state = createGame({ seed: 47 });
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    const good = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;
    const wolfView = buildAgentView(state, wolf.seatId);
    const goodView = buildAgentView(state, good.seatId);

    expect(wolfView.privateKnowledge.wolfTeamPlan).toBeDefined();
    expect(wolfView.privateKnowledge.wolfTeamPlan?.assignments).toHaveLength(3);
    expect(goodView.privateKnowledge.wolfTeamPlan).toBeUndefined();
    expect(JSON.stringify(goodView.publicSummary.tableMemory)).not.toMatch(/COUNTERCLAIM_SEER|PUSH_MISLYNCH|狼队/);
  });

  it("has wolf AI coordinate around the private team plan without public teammate leakage", () => {
    let state = createGame({ seed: 48 });
    const externalSeer = state.seats.find((seat) => seat.role !== "WEREWOLF")!;

    state.phase = "DAY_SPEECH";
    state.speechQueue = [externalSeer.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: externalSeer.seatId,
      message: "我跳预言家，2号是金水。",
    });

    const pusherWolf = state.seats.find((seat) => {
      if (seat.role !== "WEREWOLF") return false;
      const view = buildAgentView(state, seat.seatId);
      return view.privateKnowledge.wolfTeamPlan?.assignments.some(
        (assignment) => assignment.seat.seatId === seat.seatId && assignment.task === "PUSH_MISLYNCH",
      );
    })!;
    const plan = createSpeechPlan(buildAgentView(state, pusherWolf.seatId));
    const publicText = `${plan.stance} ${plan.talkingPoints.join("。")}`;

    expect(publicText).toMatch(/暂时认|今天先压|公开身份线/);
    expect(publicText).not.toMatch(/队友|狼队友|WEREWOLF/);
  });

  it("targets public seer threats at night without hidden role knowledge", () => {
    let state = createGame({ seed: 49 });
    const claimant = state.seats.find((seat) => seat.role !== "WEREWOLF")!;
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;

    state.phase = "DAY_SPEECH";
    state.speechQueue = [claimant.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: claimant.seatId,
      message: "我跳预言家，4号是查杀。",
    });
    state.phase = "NIGHT_WOLVES";

    const command = createMockCommand(buildAgentView(state, wolf.seatId));
    expect(command).toMatchObject({ type: "wolfKill", targetSeatId: claimant.seatId });
    expect(command.reason).not.toMatch(/真实|SEER|WEREWOLF|队友/);
  });

  it("good AI questions public seer counterclaims and uses stance in voting reasons", () => {
    let state = createGame({ seed: 46 });
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const villager = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;

    state.phase = "DAY_SPEECH";
    state.speechQueue = [seer.seatId, wolf.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seer.seatId,
      message: "我跳预言家，2号是金水。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: wolf.seatId,
      message: "我跳预言家，3号是查杀。",
    });

    const speechPlan = createSpeechPlan(buildAgentView(state, villager.seatId));
    expect(speechPlan.talkingPoints.join("。")).toMatch(/我不认\d号预言家/);

    state.phase = "DAY_SPEECH";
    state.speechQueue = [villager.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: villager.seatId,
      message: speechPlan.talkingPoints.join("。"),
    });
    state.phase = "DAY_VOTE";
    const votePlan = createVotePlan(buildAgentView(state, seer.seatId));
    expect(votePlan.reason).toMatch(/站边|质疑|施压|公开疑点/);
  });

  it("marks seer claims that black another public seer as risky without hidden roles", () => {
    let state = createGame({ seed: 46 });
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const villager = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;

    state.phase = "DAY_SPEECH";
    state.speechQueue = [seer.seatId, wolf.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seer.seatId,
      message: "我跳预言家，2号是金水。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: wolf.seatId,
      message: `我跳预言家，${seer.seatId}号是查杀。`,
    });

    const read = buildAiTableRead(buildAgentView(state, villager.seatId));
    const wolfRead = read.seats.find((seat) => seat.seatId === wolf.seatId)!;
    const seerRead = read.seats.find((seat) => seat.seatId === seer.seatId)!;

    expect(wolfRead.pressure).toContain("查杀卷入预言家对跳");
    expect(wolfRead.pressure).toContain("后置查杀已跳预言家");
    expect(wolfRead.suspicion).toBeGreaterThan(wolfRead.trust);
    expect(seerRead.pressure).toContain("被后置预言家查杀，先按反打降权");
    expect(JSON.stringify(read)).not.toMatch(/trueRole|truthful|actualResult/);
  });

  it("consolidates good votes on trusted public seer black checks", () => {
    let state = Array.from({ length: 100 }, (_, seed) => createGame({ seed: seed + 50 })).find(
      (candidate) =>
        candidate.seats.some((seat) => seat.role === "SEER") &&
        candidate.seats.some((seat) => seat.isAi && seat.role === "VILLAGER") &&
        candidate.seats.some((seat) => seat.role === "WEREWOLF"),
    )!;
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const villager = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;

    state.phase = "DAY_SPEECH";
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seer.seatId,
      message: `我跳预言家，${wolf.seatId}号是查杀。今天先归${wolf.seatId}号。`,
    });
    state.phase = "DAY_VOTE";

    const votePlan = createVotePlan(buildAgentView(state, villager.seatId));
    expect(votePlan.target.seatId).toBe(wolf.seatId);
    expect(votePlan.reason).toContain("可信预言家线");
  });

  it("reviews claim truthfulness and counterclaims only at game over", () => {
    let state = createGame({ seed: 44 });
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;

    state.phase = "DAY_SPEECH";
    state.speechQueue = [seer.seatId, wolf.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seer.seatId,
      message: "我跳预言家，2号是金水。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: wolf.seatId,
      message: "我跳预言家，3号是查杀。",
    });
    state.result = { winner: "GOOD", reason: "测试终局" };
    state.phase = "GAME_OVER";
    const review = buildGameReview(state);

    expect(review.claims).toHaveLength(2);
    expect(review.claims.every((claim) => claim.isCounterclaim)).toBe(true);
    expect(review.claims.find((claim) => claim.claimant.seatId === wolf.seatId)?.truthful).toBe(false);
    expect(review.strategyNotes.some((note) => note.title === "狼队悍跳")).toBe(true);
    expect(review.turningPoints.some((point) => point.title.includes("对跳") || point.description.includes("声称"))).toBe(true);
  });

  it("lets bold wolf AI distance-vote a teammate from public identity pressure", () => {
    let state = createGame({ seed: 24 });
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    const teammate = state.seats.find((seat) => seat.role === "WEREWOLF" && seat.seatId !== wolf.seatId)!;
    wolf.persona = {
      id: "bold-distance-wolf",
      name: "测试倒钩狼",
      label: "高风险倒钩型",
      style: "敢卖队友做身份。",
      goal: "用公开身份线切割同边感。",
      riskTolerance: 0.95,
      bluffing: 0.95,
    };
    state.phase = "DAY_SPEECH";
    state.speechQueue = [teammate.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: teammate.seatId,
      message: "我跳预言家，2号是金水。",
    });
    state.phase = "DAY_VOTE";

    const plan = createVotePlan(buildAgentView(state, wolf.seatId));

    expect(plan.target.seatId).toBe(teammate.seatId);
    expect(plan.reason).not.toMatch(/队友|狼队|WEREWOLF/);
  });

  it("stores AI vote reasons without wolf teammate leakage", () => {
    let state = createGame({ seed: 25 });
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    state.phase = "DAY_VOTE";
    const command = createMockCommand(buildAgentView(state, wolf.seatId));
    state = applyCommand(state, command);
    const voteEvent = state.events.find((event) => event.type === "VOTE_CAST")!;

    expect(voteEvent.payload.reason).toBeTruthy();
    expect(String(voteEvent.payload.reason)).not.toMatch(/队友|狼队友|WEREWOLF/);
  });

  it("finishes 1000 mock games without illegal states or loops", async () => {
    const stats = {
      goodWins: 0,
      werewolfWins: 0,
      totalDays: 0,
      fallbackCount: 0,
      tiedVotes: 0,
    };

    for (let seed = 0; seed < 1000; seed += 1) {
      const { state, aiLogs } = await advanceWithMockAi(createGame({ seed }), {
        ignoreHuman: true,
        maxSteps: 500,
      });
      expect(state.phase).toBe("GAME_OVER");
      expect(state.result).toBeDefined();
      stats.totalDays += state.day;
      stats.fallbackCount += aiLogs.filter((log) => log.isFallback).length;
      stats.tiedVotes += state.events.filter((event) => event.type === "VOTE_TIED").length;
      if (state.result?.winner === "GOOD") stats.goodWins += 1;
      if (state.result?.winner === "WEREWOLVES") stats.werewolfWins += 1;
    }

    expect(stats.goodWins + stats.werewolfWins).toBe(1000);
    expect(stats.totalDays / 1000).toBeGreaterThan(0);
    expect(stats.fallbackCount).toBe(0);
    expect(stats.tiedVotes).toBeGreaterThanOrEqual(0);
  }, 40000);
});
