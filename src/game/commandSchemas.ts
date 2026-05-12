import { z } from "zod";
import type { Command } from "./types";

export const HumanCommandInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("wolfKill"),
    targetSeatId: z.number().int().min(1).max(9),
  }),
  z.object({
    type: z.literal("seerCheck"),
    targetSeatId: z.number().int().min(1).max(9),
  }),
  z.object({
    type: z.literal("witchAction"),
    mode: z.enum(["save", "poison", "skip"]),
    targetSeatId: z.number().int().min(1).max(9).optional(),
  }),
  z.object({
    type: z.literal("speak"),
    message: z.string().min(1).max(240),
  }),
  z.object({
    type: z.literal("vote"),
    targetSeatId: z.number().int().min(1).max(9),
  }),
  z.object({
    type: z.literal("hunterShoot"),
    targetSeatId: z.number().int().min(1).max(9).optional(),
  }),
]);

export type HumanCommandInput = z.infer<typeof HumanCommandInputSchema>;

export function toHumanCommand(input: HumanCommandInput, actorSeatId: number): Command {
  switch (input.type) {
    case "wolfKill":
      return { type: "wolfKill", actorSeatId, targetSeatId: input.targetSeatId };
    case "seerCheck":
      return { type: "seerCheck", actorSeatId, targetSeatId: input.targetSeatId };
    case "witchAction":
      return {
        type: "witchAction",
        actorSeatId,
        mode: input.mode,
        targetSeatId: input.targetSeatId,
      };
    case "speak":
      return { type: "speak", actorSeatId, message: input.message };
    case "vote":
      return { type: "vote", actorSeatId, targetSeatId: input.targetSeatId };
    case "hunterShoot":
      return { type: "hunterShoot", actorSeatId, targetSeatId: input.targetSeatId };
  }
}
