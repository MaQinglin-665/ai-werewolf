import { describe, expect, it } from "vitest";
import { applyCommand, createGame } from "./engine";
import { buildTableMemory } from "./tableMemory";

describe("table memory stance shifts", () => {
  it("detects role-side switches across different seer claimants", () => {
    let state = createGame({ seed: 45 });
    const actorSeatId = state.humanSeatId;

    state.phase = "DAY_SPEECH";
    state.speechQueue = [actorSeatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId,
      message: "我认3号预言家，今天先站3号这条线。",
    });

    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [actorSeatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId,
      message: "我认4号预言家，今天重新站4号这条线。",
    });

    const memory = buildTableMemory(state);

    expect(memory.stanceShifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actor: expect.objectContaining({ seatId: actorSeatId }),
          fromTarget: expect.objectContaining({ seatId: 3 }),
          toTarget: expect.objectContaining({ seatId: 4 }),
          fromKind: "SUPPORT",
          toKind: "SUPPORT",
        }),
      ]),
    );
  });
});

describe("table memory seer legacies", () => {
  it("keeps an exiled seer's last-words gold check as public legacy", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 32 });
    const seer = state.seats.find((seat) => seat.seatId === 8)!;
    const gold = state.seats.find((seat) => seat.seatId === 6)!;
    state.day = 2;
    state.roleClaims.push({
      id: `${seer.seatId}:SEER`,
      day: 2,
      claimantSeatId: seer.seatId,
      claimedRole: "SEER",
      strength: "hard",
      checks: [
        {
          day: 2,
          claimantSeatId: seer.seatId,
          targetSeatId: gold.seatId,
          result: "GOOD",
          sourceSpeechSeq: 55,
        },
      ],
      message: "I claim seer and leave this gold check.",
      sourceSpeechSeq: 55,
      updatedAtSeq: 55,
    });
    state.events.push(
      {
        seq: 66,
        type: "PLAYER_EXILED",
        visibility: "public",
        day: 2,
        phase: "EXILE_RESOLUTION",
        actorSeatId: seer.seatId,
        message: `${seer.seatId}号 被放逐出局。`,
        payload: { seatId: seer.seatId },
      },
      {
        seq: 67,
        type: "LAST_WORDS_CREATED",
        visibility: "public",
        day: 2,
        phase: "LAST_WORDS",
        actorSeatId: seer.seatId,
        message: `${seer.seatId}号 遗言：${gold.seatId}号是金水。`,
        payload: { seatId: seer.seatId, message: `${gold.seatId}号是金水。` },
      },
    );

    const memory = buildTableMemory(state);

    expect(memory.seerLegacies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimant: expect.objectContaining({ seatId: seer.seatId }),
          deathDay: 2,
          checks: expect.arrayContaining([
            expect.objectContaining({
              target: expect.objectContaining({ seatId: gold.seatId }),
              result: "GOOD",
            }),
          ]),
        }),
      ]),
    );
  });

  it("keeps soft role claims out of strong identity memory", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 33 });
    const first = state.seats[0]!;
    const second = state.seats[1]!;
    const target = state.seats[2]!;
    state.day = 2;
    state.roleClaims.push(
      {
        id: `${first.seatId}:SEER`,
        day: 2,
        claimantSeatId: first.seatId,
        claimedRole: "SEER",
        strength: "soft",
        checks: [
          {
            day: 2,
            claimantSeatId: first.seatId,
            targetSeatId: target.seatId,
            result: "GOOD",
            sourceSpeechSeq: 44,
          },
        ],
        message: "我先不跳身份，只说这个位置像金水。",
        sourceSpeechSeq: 44,
        updatedAtSeq: 44,
      },
      {
        id: `${second.seatId}:SEER`,
        day: 2,
        claimantSeatId: second.seatId,
        claimedRole: "SEER",
        strength: "soft",
        checks: [],
        message: "我偏神，不急着跳。",
        sourceSpeechSeq: 45,
        updatedAtSeq: 45,
      },
    );
    state.events.push({
      seq: 88,
      type: "PLAYER_EXILED",
      visibility: "public",
      day: 2,
      phase: "EXILE_RESOLUTION",
      actorSeatId: first.seatId,
      message: `${first.seatId}号 被放逐出局。`,
      payload: { seatId: first.seatId },
    });

    const memory = buildTableMemory(state);

    expect(state.roleClaims).toHaveLength(2);
    expect(memory.claimBoard).toHaveLength(0);
    expect(memory.counterclaims).toHaveLength(0);
    expect(memory.seerLegacies).toHaveLength(0);
    expect(memory.seats.flatMap((seat) => seat.claims)).toHaveLength(0);
    expect(memory.seats.flatMap((seat) => seat.publicReasons).join("\n")).not.toContain("声称");
  });
});

describe("table memory death-shape public cues", () => {
  it("treats a day-one single death as public potion-line context on no-guard witch boards", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91 });
    const deadSeat = state.seats.find((seat) => seat.role !== "WEREWOLF")!;
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: `第1天清晨，${deadSeat.seatId}号 死亡。`,
      payload: { deadSeatIds: [deadSeat.seatId] },
    });

    const memory = buildTableMemory(state);

    expect(memory.reasoningCues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "death_shape",
          weight: "medium",
          target: expect.objectContaining({ seatId: deadSeat.seatId }),
          summary: expect.stringMatching(/首夜单死.*女巫没救.*合理简称.*不应.*质疑/),
        }),
      ]),
    );
    expect(memory.publicSignals.join("\n")).toMatch(/首夜单死.*女巫没救.*合理简称/);
    expect(memory.publicSignals.join("\n")).not.toContain("狼人不能空刀");
  });

  it("treats a day-one peace night as potion-line context while keeping wolf no-kill low probability", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91 });
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: "第1天清晨，昨夜平安夜。",
      payload: { deadSeatIds: [] },
    });

    const memory = buildTableMemory(state);

    expect(memory.publicSignals.join("\n")).toMatch(/平安夜.*女巫用药了/);
    expect(memory.publicSignals.join("\n")).toMatch(/不需要让后置位重复解释平安夜本身/);
    expect(memory.publicSignals.join("\n")).toMatch(/空刀.*不作为发言主线/);
    expect(memory.publicSignals.join("\n")).not.toContain("狼人不能空刀");
  });

  it("does not add no-guard potion-line cues on guard boards", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91 });
    const deadSeat = state.seats.find((seat) => seat.role !== "WEREWOLF")!;
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: `第1天清晨，${deadSeat.seatId}号 死亡。`,
      payload: { deadSeatIds: [deadSeat.seatId] },
    });

    const memory = buildTableMemory(state);

    expect(memory.reasoningCues.some((cue) => cue.kind === "death_shape")).toBe(false);
    expect(memory.publicSignals.join("\n")).not.toMatch(/药线假设/);
  });
});
