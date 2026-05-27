import { createGameRecord } from "@/server/gameService";
import {
  AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH,
  AI_FRIEND_ROLE_FIELD_MAX_LENGTH,
  AI_FRIEND_ROLE_SOURCE_MAX_LENGTH,
} from "@/game/aiFriends";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const aiFriendRoleCardSchema = z.object({
  source: z.string().max(AI_FRIEND_ROLE_SOURCE_MAX_LENGTH),
  speakingStyle: z.string().max(AI_FRIEND_ROLE_FIELD_MAX_LENGTH),
  reasoningStyle: z.string().max(AI_FRIEND_ROLE_FIELD_MAX_LENGTH),
  avoid: z.string().max(AI_FRIEND_ROLE_FIELD_MAX_LENGTH),
});

const createGameSchema = z
  .object({
    boardId: z.string().min(1).max(80).optional(),
    humanSeatId: z.number().int().min(1).max(12).nullable().optional(),
    aiFriends: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          nickname: z.string().min(1).max(16),
          basePersonaId: z.string().min(1).max(80),
          avatarDataUrl: z.string().min(1).max(AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH).startsWith("data:image/").optional(),
          roleCard: aiFriendRoleCardSchema.optional(),
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
    });
    return Response.json(view);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "创建对局失败。" }, { status: 400 });
  }
}
