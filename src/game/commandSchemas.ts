import { z } from "zod";
import type { Command } from "./types";

const seatIdSchema = z.number().int().min(1).max(20);

export const HumanCommandInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("continue"),
  }),
  z.object({
    type: z.literal("wolfKill"),
    targetSeatId: seatIdSchema,
  }),
  z.object({
    type: z.literal("guardAction"),
    targetSeatId: seatIdSchema.optional(),
  }),
  z.object({
    type: z.literal("seerCheck"),
    targetSeatId: seatIdSchema,
  }),
  z.object({
    type: z.literal("witchAction"),
    mode: z.enum(["save", "poison", "skip"]),
    targetSeatId: seatIdSchema.optional(),
  }),
  z.object({
    type: z.literal("wolfBeautyCharm"),
    targetSeatId: seatIdSchema.optional(),
  }),
  z.object({
    type: z.literal("speak"),
    message: z.string().min(1).max(800),
  }),
  z.object({
    type: z.literal("lastWords"),
    message: z.string().min(1).max(800),
  }),
  z.object({
    type: z.literal("vote"),
    targetSeatId: seatIdSchema.optional(),
  }),
  z.object({
    type: z.literal("hunterReveal"),
    reveal: z.boolean(),
  }),
  z.object({
    type: z.literal("hunterShoot"),
    targetSeatId: seatIdSchema.optional(),
  }),
  z.object({
    type: z.literal("wolfKingShoot"),
    targetSeatId: seatIdSchema.optional(),
  }),
  z.object({
    type: z.literal("whiteWolfKingExplode"),
    targetSeatId: seatIdSchema,
  }),
  z.object({
    type: z.literal("knightDuel"),
    targetSeatId: seatIdSchema.optional(),
  }),
  z.object({
    type: z.literal("sheriffNominate"),
    run: z.boolean(),
  }),
  z.object({
    type: z.literal("sheriffSpeech"),
    message: z.string().min(1).max(800),
  }),
  z.object({
    type: z.literal("sheriffWithdraw"),
    withdraw: z.boolean(),
  }),
  z.object({
    type: z.literal("sheriffVote"),
    targetSeatId: seatIdSchema.optional(),
  }),
  z.object({
    type: z.literal("sheriffHandoff"),
    targetSeatId: seatIdSchema.optional(),
  }),
]);

export type HumanCommandInput = z.infer<typeof HumanCommandInputSchema>;
type HumanRuleCommandInput = Exclude<HumanCommandInput, { type: "continue" }>;

export function toHumanCommand(input: HumanRuleCommandInput, actorSeatId: number): Command {
  switch (input.type) {
    case "wolfKill":
      return { type: "wolfKill", actorSeatId, targetSeatId: input.targetSeatId };
    case "guardAction":
      return { type: "guardAction", actorSeatId, targetSeatId: input.targetSeatId };
    case "seerCheck":
      return { type: "seerCheck", actorSeatId, targetSeatId: input.targetSeatId };
    case "witchAction":
      return {
        type: "witchAction",
        actorSeatId,
        mode: input.mode,
        targetSeatId: input.targetSeatId,
      };
    case "wolfBeautyCharm":
      return { type: "wolfBeautyCharm", actorSeatId, targetSeatId: input.targetSeatId };
    case "speak":
      return { type: "speak", actorSeatId, message: input.message };
    case "lastWords":
      return { type: "lastWords", actorSeatId, message: input.message };
    case "vote":
      return { type: "vote", actorSeatId, targetSeatId: input.targetSeatId };
    case "hunterReveal":
      return { type: "hunterReveal", actorSeatId, reveal: input.reveal };
    case "hunterShoot":
      return { type: "hunterShoot", actorSeatId, targetSeatId: input.targetSeatId };
    case "wolfKingShoot":
      return { type: "wolfKingShoot", actorSeatId, targetSeatId: input.targetSeatId };
    case "whiteWolfKingExplode":
      return { type: "whiteWolfKingExplode", actorSeatId, targetSeatId: input.targetSeatId };
    case "knightDuel":
      return { type: "knightDuel", actorSeatId, targetSeatId: input.targetSeatId };
    case "sheriffNominate":
      return { type: "sheriffNominate", actorSeatId, run: input.run };
    case "sheriffSpeech":
      return { type: "sheriffSpeech", actorSeatId, message: input.message };
    case "sheriffWithdraw":
      return { type: "sheriffWithdraw", actorSeatId, withdraw: input.withdraw };
    case "sheriffVote":
      return { type: "sheriffVote", actorSeatId, targetSeatId: input.targetSeatId };
    case "sheriffHandoff":
      return { type: "sheriffHandoff", actorSeatId, targetSeatId: input.targetSeatId };
  }
}
