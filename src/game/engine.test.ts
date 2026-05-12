import { describe, expect, it } from "vitest";
import { advanceWithMockAi } from "@/ai/mockAgent";
import { buildHumanView } from "./projection";
import { buildGameReview } from "./review";
import { applyCommand, applySystemStep, createGame, evaluateWinCondition, getSeat } from "./engine";

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

  it("randomizes the human role across seeded games", () => {
    const roles = new Set(Array.from({ length: 20 }, (_, seed) => getSeat(createGame({ seed }), 1).role));
    expect(roles.size).toBeGreaterThan(1);
  });

  it("rejects actions in the wrong phase", () => {
    const state = createGame({ seed: 2 });
    expect(() => applyCommand(state, { type: "vote", actorSeatId: 1, targetSeatId: 2 })).toThrow(/当前阶段/);
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
  });

  it("finishes 1000 mock games without illegal states or loops", async () => {
    const stats = {
      goodWins: 0,
      werewolfWins: 0,
      totalDays: 0,
    };

    for (let seed = 0; seed < 1000; seed += 1) {
      const { state } = await advanceWithMockAi(createGame({ seed }), {
        ignoreHuman: true,
        maxSteps: 500,
      });
      expect(state.phase).toBe("GAME_OVER");
      expect(state.result).toBeDefined();
      stats.totalDays += state.day;
      if (state.result?.winner === "GOOD") stats.goodWins += 1;
      if (state.result?.winner === "WEREWOLVES") stats.werewolfWins += 1;
    }

    expect(stats.goodWins + stats.werewolfWins).toBe(1000);
    expect(stats.totalDays / 1000).toBeGreaterThan(0);
  });
});
