import { createGameRecord } from "@/server/gameService";
import { AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH } from "@/game/aiFriends";
import { ROLES } from "@/game/types";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roleCardSchema = z.object({
  id: z.string().min(1).max(80),
  displayName: z.string().min(1).max(40),
  theme: z.string().min(1).max(60),
  styleTags: z.array(z.string().min(1).max(40)).max(8).default([]),
  speechStyleZh: z.string().min(1).max(260),
  reasoningBias: z.string().min(1).max(220),
  voteBias: z.string().min(1).max(220),
  nightActionBias: z.string().min(1).max(220),
  asVillager: z.string().min(1).max(220),
  asWerewolf: z.string().min(1).max(220),
  pressureResponse: z.string().min(1).max(220),
  relationshipHints: z.array(z.string().min(1).max(120)).max(12).default([]),
  catchphrasePolicy: z.string().min(1).max(220),
  forbidden: z.array(z.string().min(1).max(120)).max(12).default([]),
  voiceProfileId: z.string().min(1).max(80).optional(),
  voiceLocale: z.string().min(1).max(20).optional(),
  voiceRewritePolicy: z.string().min(1).max(180).optional(),
  classTrialVoiceProfile: z
    .object({
      personalityCore: z.array(z.string().min(1).max(180)).max(8).default([]),
      valueBiases: z.array(z.string().min(1).max(180)).max(8).default([]),
      reactionTendencies: z.array(z.string().min(1).max(220)).max(10).default([]),
      lightCatchphrases: z.array(z.string().min(1).max(80)).max(6).default([]),
      overuseBans: z.array(z.string().min(1).max(160)).max(10).default([]),
      scenarioReactions: z
        .record(
          z.string().min(1).max(80),
          z.object({
            innerDrive: z.string().min(1).max(220),
            speechMove: z.string().min(1).max(220),
            mustAvoid: z.string().min(1).max(180),
          }),
        )
        .default({}),
      alignmentReactions: z
        .record(
          z.string().min(1).max(80),
          z.object({
            speechDrive: z.string().min(1).max(220),
            failureMode: z.string().min(1).max(180),
          }),
        )
        .default({}),
      acceptableForms: z.array(z.string().min(1).max(160)).max(8).default([]),
      unacceptableForms: z.array(z.string().min(1).max(160)).max(8).default([]),
      dramaticBoundaries: z.object({
        allowSharpConflict: z.boolean(),
        allowIrrationalMisread: z.boolean(),
        allowDeceptionWhenAligned: z.boolean(),
        mustStayInTurnOrder: z.literal(true),
        mustRemainWerewolfPlayable: z.literal(true),
      }),
    })
    .optional(),
});

const createGameSchema = z
  .object({
    boardId: z.string().min(1).max(80).optional(),
    humanSeatId: z.number().int().min(1).max(12).nullable().optional(),
    seatRoleOverrides: z.array(z.enum(ROLES)).max(12).optional(),
    aiFriends: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          nickname: z.string().min(1).max(16),
          basePersonaId: z.string().min(1).max(80),
          avatarDataUrl: z.string().min(1).max(AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH).startsWith("data:image/").optional(),
          llmConfig: z
            .object({
              provider: z.literal("openai-compatible"),
              label: z.string().min(1).max(40).optional(),
              baseUrl: z.string().min(1).max(260),
              model: z.string().min(1).max(120),
              mergeSystemIntoUser: z.boolean().optional(),
            })
            .optional(),
          ttsVoice: z.string().min(1).max(80).optional(),
          ttsConfig: z
            .object({
              provider: z.literal("mimo-compatible"),
              label: z.string().min(1).max(40).optional(),
              baseUrl: z.string().min(1).max(260),
              model: z.string().min(1).max(120),
              voice: z.string().min(1).max(80),
              format: z.string().min(1).max(16).optional(),
              authHeader: z.string().min(1).max(80).optional(),
            })
            .optional(),
          roleCard: roleCardSchema.optional(),
          riskTolerance: z.number().min(0).max(1),
          bluffing: z.number().min(0).max(1),
          preferences: z.object({
            logic: z.number().min(0).max(1),
            identity: z.number().min(0).max(1),
            vote: z.number().min(0).max(1),
            emotion: z.number().min(0).max(1),
            memory: z.number().min(0).max(1),
            leadership: z.number().min(0).max(1),
            deception: z.number().min(0).max(1),
            caution: z.number().min(0).max(1),
          }),
          createdAt: z.string().min(1).max(40),
          updatedAt: z.string().min(1).max(40),
        }),
      )
      .max(20)
      .optional(),
  })
  .optional();

export async function POST(request?: Request) {
  const body = request ? await request.json().catch(() => undefined) : undefined;
  const parsed = createGameSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "创建对局参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const view = await createGameRecord({
      boardId: parsed.data?.boardId,
      humanSeatId: parsed.data?.humanSeatId,
      aiFriends: parsed.data?.aiFriends,
      seatRoleOverrides: parsed.data?.seatRoleOverrides,
    });
    return Response.json(view);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "创建对局失败。" }, { status: 400 });
  }
}
