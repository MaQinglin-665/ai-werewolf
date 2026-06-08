import { describe, expect, it } from "vitest";
import type { AiSeatMemory, Command, SpeechPlan, VotePlan } from "@/game/types";
import { rememberAiDecision } from "./seatMemory";

describe("AI seat memory", () => {
  it("stores ordinary live intent after speech and carries it into vote continuity", () => {
    const memory: AiSeatMemory = {
      seatId: 2,
      day: 1,
      beliefs: [],
    };
    const speechPlan: SpeechPlan = {
      kind: "pressure",
      stance: "5号上一轮发言只给结论，没有解释投票动机",
      target: { seatId: 5, name: "Claude" },
      targetSpeechStatus: "spoken",
      allowedInteraction: "review_spoken",
      speechMove: "soft_pressure",
      talkingPoints: ["5号上一轮发言只给结论"],
      risk: 0.38,
    };
    const afterSpeech = rememberAiDecision(memory, { type: "speak", actorSeatId: 2, message: "先压5号。" }, speechPlan);

    expect(afterSpeech.liveIntent).toBe("push_vote");
    expect(afterSpeech.liveIntentTargetSeatId).toBe(5);
    expect(afterSpeech.liveIntentPublicReason).toContain("投票动机");
    expect(afterSpeech.liveIntentCommitment).toContain("5号");
    expect(afterSpeech.voteContinuity).toContain("发言和投票");

    const votePlan: VotePlan = {
      target: { seatId: 6, name: "Kimi" },
      reason: "6号公开票型和发言转向冲突更硬",
      confidence: 0.72,
      alternatives: [{ seatId: 5, name: "Claude" }],
    };
    const voteCommand: Command = {
      type: "vote",
      actorSeatId: 2,
      targetSeatId: 6,
      reason: "6号公开票型和发言转向冲突更硬",
    };
    const afterVote = rememberAiDecision(afterSpeech, voteCommand, speechPlan, votePlan);

    expect(afterVote.liveIntent).toBe("explain_pivot");
    expect(afterVote.liveIntentTargetSeatId).toBe(6);
    expect(afterVote.liveIntentPublicReason).toContain("公开票型");
    expect(afterVote.liveIntentCommitment).toContain("5号");
    expect(afterVote.liveIntentCommitment).toContain("6号");
    expect(afterVote.voteContinuity).toContain("转到6号");
    expect(JSON.stringify(afterVote)).not.toMatch(/狼队|队友|真实身份|隐藏身份/);
  });
});
