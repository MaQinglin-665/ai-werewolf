import { describe, expect, it } from "vitest";
import { copyAiFriend, getDefaultAiFriends } from "@/game/aiFriends";
import type { HumanGameView } from "@/game/types";
import { POST as createGame } from "./route";

describe("game creation ai friends", () => {
  it("accepts ordinary player profiles and exposes safe setup metadata", async () => {
    const friend = {
      ...copyAiFriend(getDefaultAiFriends("test")[2], { id: "friend-api-profile", now: "2026-06-08T00:00:00.000Z" }),
      nickname: "抓话好友",
      ordinaryPlayerProfile: {
        playerTypeId: "one-line-catcher",
        sliders: {
          directness: 0.56,
          emotion: 0.34,
          speechLength: 0.42,
          questionBias: 0.72,
          factBias: 0.76,
          identityBias: 0.48,
          voteBias: 0.58,
          memoryBias: 0.82,
          nightAggression: 0.46,
          voteFollow: 0.34,
          deception: 0.36,
          caution: 0.56,
        },
      },
    };

    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", aiFriends: [friend] }),
      }),
    );
    const view = (await response.json()) as HumanGameView;
    const firstAiSeat = view.seats.find((seat) => seat.isAi);

    expect(response.status).toBe(200);
    expect(firstAiSeat?.name).toBe("抓话好友");
    expect(view.setup?.aiFriends[0]?.ordinaryPlayerProfile).toEqual(friend.ordinaryPlayerProfile);
  });

  it("accepts selected AI friend snapshots", async () => {
    const friend = {
      ...copyAiFriend(getDefaultAiFriends("test")[2], { id: "friend-api", now: "2026-05-15T00:00:00.000Z" }),
      nickname: "接口好友",
      avatarDataUrl: "data:image/webp;base64,AAAA",
      ttsVoice: "default_zh",
      ttsConfig: {
        provider: "mimo-compatible",
        baseUrl: "https://tts.example.com/v1",
        model: "api-tts",
        voice: "voice_api",
        apiKey: "secret-tts-key",
      },
    };
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", aiFriends: [friend] }),
      }),
    );
    const view = (await response.json()) as HumanGameView;
    const firstAiSeat = view.seats.find((seat) => seat.isAi);

    expect(response.status).toBe(200);
    expect(firstAiSeat?.name).toBe("接口好友");
    expect(firstAiSeat?.personaName).toBe("GPT");
    expect(firstAiSeat?.avatarDataUrl).toBe("data:image/webp;base64,AAAA");
    expect(firstAiSeat?.ttsVoice).toBe("default_zh");
    expect(firstAiSeat?.ttsConfig?.voice).toBe("voice_api");
    expect(JSON.stringify(view)).not.toContain("secret-tts-key");
    expect(view.setup?.aiFriends[0]).toMatchObject({
      friendId: "friend-api",
      nickname: "接口好友",
      personaName: "GPT",
      avatarDataUrl: "data:image/webp;base64,AAAA",
      ttsVoice: "default_zh",
      ttsConfig: {
        model: "api-tts",
        voice: "voice_api",
      },
    });
  });

  it("accepts custom LLM config but does not expose API keys in the game view", async () => {
    const friend = {
      ...copyAiFriend(getDefaultAiFriends("test")[2], { id: "friend-api-llm", now: "2026-05-15T00:00:00.000Z" }),
      nickname: "自选模型",
      llmConfig: {
        provider: "openai-compatible",
        label: "玩家模型",
        baseUrl: "https://llm.example.com/v1",
        model: "player-model",
        apiKey: "secret-key",
      },
    };
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", aiFriends: [friend] }),
      }),
    );
    const view = (await response.json()) as HumanGameView;
    const firstAiSeat = view.seats.find((seat) => seat.isAi);

    expect(response.status).toBe(200);
    expect(firstAiSeat?.name).toBe("自选模型");
    expect(firstAiSeat?.personaModelLabel).toBe("玩家模型 · player-model");
    expect(JSON.stringify(view)).not.toContain("secret-key");
  });

  it("accepts a local character role card and exposes only safe setup metadata", async () => {
    const friend = {
      ...copyAiFriend(getDefaultAiFriends("test")[2], { id: "class-trial:monokuma", now: "2026-05-27T00:00:00.000Z" }),
      nickname: "黑白熊",
      roleCard: {
        id: "monokuma",
        displayName: "黑白熊",
        theme: "class-trial",
        styleTags: ["taunting", "chaotic", "rule-bound"],
        speechStyleZh: "语气轻佻、爱嘲讽和挑拨，但必须像普通狼人杀玩家一样围绕公开桌面发言。",
        reasoningBias: "优先寻找矛盾、放大冲突、逼迫别人站边。",
        voteBias: "倾向推动高互动票口，但不能无理由乱投。",
        nightActionBias: "夜晚行动可以偏激进，但仍优先服务阵营胜利。",
        asVillager: "作为好人时用嘲讽压迫可疑位，不能假装知道隐藏身份。",
        asWerewolf: "作为狼人时用挑拨制造混乱，但公开理由必须来自桌面证据。",
        pressureResponse: "被怀疑时反咬对方逻辑漏洞，并要求对方落票口。",
        relationshipHints: ["可以调侃全场紧张气氛，但不能以主持人身份说话。"],
        catchphrasePolicy: "允许极短口癖式感叹，不复刻大段原台词。",
        forbidden: ["不能泄露隐藏身份。", "不能以主持人身份干预规则。"],
        voiceProfileId: "monokuma-ja-local",
        voiceLocale: "ja-JP",
        voiceRewritePolicy: "轻微意译，不改变狼人杀信息。",
        classTrialVoiceProfile: {
          personalityCore: ["用笑声掩盖真实站队"],
          valueBiases: ["喜欢把别人逼到公开站边"],
          reactionTendencies: ["压力来时先嘲讽再反咬漏洞"],
          lightCatchphrases: ["唔噗噗"],
          overuseBans: ["不要每句都笑"],
          scenarioReactions: {
            lowInfoOpening: {
              innerDrive: "想先把场面搅热。",
              speechMove: "用一个具体问题逼人站边。",
              mustAvoid: "不能替主持人宣布规则。",
            },
          },
          alignmentReactions: {
            asWerewolf: {
              speechDrive: "借公开矛盾制造混乱。",
              failureMode: "演得像局外主持人。",
            },
          },
          acceptableForms: ["嘲讽后仍有明确狼人杀目标"],
          unacceptableForms: ["只玩梗不推人"],
          dramaticBoundaries: {
            allowSharpConflict: true,
            allowIrrationalMisread: true,
            allowDeceptionWhenAligned: true,
            mustStayInTurnOrder: true,
            mustRemainWerewolfPlayable: true,
          },
        },
      },
    };

    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", humanSeatId: null, aiFriends: [friend] }),
      }),
    );
    const view = (await response.json()) as HumanGameView;
    const firstAiSeat = view.seats.find((seat) => seat.seatId === 1);

    expect(response.status).toBe(200);
    expect(firstAiSeat?.name).toBe("黑白熊");
    expect(firstAiSeat?.roleCard?.displayName).toBe("黑白熊");
    expect(firstAiSeat?.roleCard?.forbidden.join(" ")).toContain("不能泄露隐藏身份");
    expect(firstAiSeat?.roleCard?.classTrialVoiceProfile?.scenarioReactions.lowInfoOpening?.speechMove).toContain("站边");
    expect(view.setup?.aiFriends[0]?.roleCard?.id).toBe("monokuma");
    expect(view.setup?.aiFriends[0]?.roleCard?.classTrialVoiceProfile?.alignmentReactions.asWerewolf?.speechDrive).toContain("混乱");
    expect(JSON.stringify(view)).not.toContain("secret");
    expect(JSON.stringify(view)).not.toContain("apiKey");
  });

  it("accepts fixed seat role overrides for local class-trial games", async () => {
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({
          boardId: "9p-seer-witch-hunter",
          humanSeatId: null,
          seatRoleOverrides: ["SEER", "WITCH", "VILLAGER", "WEREWOLF", "WEREWOLF", "WEREWOLF", "HUNTER", "VILLAGER", "VILLAGER"],
        }),
      }),
    );

    expect(response.status).toBe(200);
  });

  it("rejects fixed seat role overrides that do not match the board", async () => {
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({
          boardId: "9p-seer-witch-hunter",
          seatRoleOverrides: ["SEER"],
        }),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("固定身份数量必须和板子座位数一致");
  });

  it("accepts a fixed human seat id", async () => {
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", humanSeatId: 4 }),
      }),
    );
    const view = (await response.json()) as HumanGameView;

    expect(response.status).toBe(200);
    expect(view.humanSeatId).toBe(4);
    expect(view.seats.find((seat) => seat.seatId === 4)?.isHuman).toBe(true);
  });

  it("rejects a human seat id outside the board", async () => {
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", humanSeatId: 12 }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("accepts spectator mode without a human seat", async () => {
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", humanSeatId: null }),
      }),
    );
    const view = (await response.json()) as HumanGameView;

    expect(response.status).toBe(200);
    expect(view.humanSeatId).toBeNull();
    expect(view.myRole).toBeUndefined();
    expect(view.seats.every((seat) => seat.isAi && !seat.isHuman)).toBe(true);
    expect(view.availableActions).toEqual([
      expect.objectContaining({
        type: "continue",
      }),
    ]);
  });
});
