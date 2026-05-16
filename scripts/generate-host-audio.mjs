import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "public", "audio", "host");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",").map((item) => item.trim()).filter(Boolean)) : undefined;
const providerArg = process.argv.find((arg) => arg.startsWith("--provider="));
const provider = providerArg?.slice("--provider=".length) ?? process.env.HOST_AUDIO_TTS_PROVIDER ?? "openai";
const modelArg = process.argv.find((arg) => arg.startsWith("--model="));
const voiceArg = process.argv.find((arg) => arg.startsWith("--voice="));
const formatArg = process.argv.find((arg) => arg.startsWith("--format="));
const styleArg = process.argv.find((arg) => arg.startsWith("--style="));

const model = modelArg?.slice("--model=".length) ?? process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
const voice = voiceArg?.slice("--voice=".length) ?? process.env.OPENAI_TTS_VOICE ?? "cedar";
const instructions =
  process.env.OPENAI_TTS_INSTRUCTIONS ??
  "中文狼人杀主持人。低沉、克制、清晰，有悬疑感，语速略慢，像真人桌游法官。不要夸张表演，不要读出多余标点。";
const mimoApiKey =
  process.env.MIMO_API_KEY ?? process.env.MIMO_LLM_API_KEY ?? process.env.XIAOMI_API_KEY ?? process.env.CXSEE_API_KEY;
const defaultMimoBaseUrl = mimoApiKey?.startsWith("tp-")
  ? "https://token-plan-cn.xiaomimimo.com"
  : "https://api.xiaomimimo.com";
const mimoModel = modelArg?.slice("--model=".length) ?? process.env.MIMO_TTS_MODEL ?? "mimo-v2.5-tts";
const mimoVoice = voiceArg?.slice("--voice=".length) ?? process.env.MIMO_TTS_VOICE ?? "mimo_default";
const mimoFormat = formatArg?.slice("--format=".length) ?? process.env.MIMO_TTS_FORMAT ?? "mp3";
const mimoBaseUrl = process.env.MIMO_TTS_BASE_URL ?? defaultMimoBaseUrl;
const mimoStyle = styleArg?.slice("--style=".length) ?? process.env.MIMO_TTS_STYLE ?? "低沉 悬疑 变慢";
const mimoUseStyleTag = process.env.MIMO_TTS_USE_STYLE_TAG === "true" || args.has("--style-tag");
const mimoAuthHeader =
  process.env.MIMO_AUTH_HEADER ?? (mimoBaseUrl.includes("cxsee") ? "api-key" : "Authorization");

function sanitizeOpenAiError(message) {
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").replace(/tp-[A-Za-z0-9_-]+/g, "tp-***");
}

const clips = [
  ["night-wolves", "天黑请闭眼，狼人请睁眼。请选择今晚的击杀目标。"],
  ["night-wolf-beauty", "狼美人请睁眼。请选择今晚魅惑的玩家，也可以选择不魅惑。"],
  ["night-guard", "守卫请睁眼。请选择一名玩家守护，也可以选择空守。"],
  ["night-seer", "预言家请睁眼。请选择一名玩家查验身份。"],
  ["night-witch", "女巫请睁眼。请确认昨夜刀口，选择是否使用药品。"],
  ["dawn-report", "天亮了，公布昨夜情况。"],
  ["dawn-peaceful", "昨夜平安夜。"],
  ["dawn-deaths", "昨夜死亡的是。"],
  ["dead", "死亡。"],
  ["day-speech-start", "开始白天发言。"],
  ["please", "请。"],
  ["speak", "发言。"],
  ["please-speak", "请发言。"],
  ["sheriff-nomination-start", "警长竞选开始，所有存活玩家选择是否上警。"],
  ["sheriff-nomination-human", "轮到你选择是否上警。"],
  ["sheriff-nomination-prompt", "请选择是否上警。"],
  ["sheriff-nominated", "选择上警。"],
  ["sheriff-nomination-none", "无人选择上警，本局没有产生警长。"],
  ["sheriff-speech-start", "警上发言开始。"],
  ["sheriff-speech-human", "轮到你发表警长竞选发言。"],
  ["sheriff-speech-prompt", "请发表警长竞选发言。"],
  ["sheriff-withdrawal-start", "进入退水阶段，警上候选人依次选择是否退水。"],
  ["sheriff-withdrew", "选择退水。"],
  ["sheriff-vote-start", "进入警长投票阶段，警下玩家开始投票。"],
  ["sheriff-pk-speech-start", "警长投票平票，进入 PK 发言。"],
  ["sheriff-pk-speech-human", "轮到你发表警长 PK 发言。"],
  ["sheriff-pk-speech-prompt", "请发表警长 PK 发言。"],
  ["sheriff-pk-vote-start", "进入警长 PK 复投。"],
  ["sheriff-handoff-start", "警徽移交窗口开启。"],
  ["sheriff-handoff-human", "轮到你选择移交警徽或撕掉警徽。"],
  ["sheriff-handoff-prompt", "请选择移交警徽或撕掉警徽。"],
  ["vote", "投票。"],
  ["day-vote-start", "进入投票阶段。"],
  ["vote-revealed", "公布票数。"],
  ["vote-tie", "平票，今日无人放逐。"],
  ["exiled", "被放逐出局。"],
  ["idiot-revealed", "白痴翻牌免死，失去投票权。"],
  ["hunter-taken", "被猎人带走。"],
  ["wolf-king-taken", "被狼王带走。"],
  ["white-wolf-king-exploded", "白狼王自爆。"],
  ["white-wolf-king-taken", "被白狼王带走。"],
  ["wolf-beauty-charmed", "狼美人出局，触发魅惑。"],
  ["wolf-beauty-taken", "殉情出局。"],
  ["last-words", "请发表遗言。"],
  ["hunter-shot", "猎人进入开枪窗口。"],
  ["hunter-shot-human", "猎人出局，轮到你选择是否开枪。"],
  ["wolf-king-shot", "狼王进入开枪窗口。"],
  ["wolf-king-shot-human", "狼王出局，轮到你选择是否开枪。"],
  ["knight-duel", "骑士进入决斗窗口。"],
  ["knight-duel-human", "轮到你选择是否发动骑士决斗。"],
  ["knight-duel-success", "骑士决斗成功。"],
  ["knight-duel-failed", "骑士决斗失败，骑士出局。"],
  ["knight-duel-taken", "被骑士决斗带走。"],
  ["your-turn-speak", "轮到你发言。"],
  ["your-turn-vote", "轮到你投票。"],
  ["game-over-good", "好人阵营获胜。"],
  ["game-over-wolves", "狼人阵营获胜。"],
  ["flow-next", "流程继续推进。"],
  ...Array.from({ length: 12 }, (_, index) => [`seat-${index + 1}`, `${index + 1}号。`]),
].filter(([name]) => !only || only.has(name));

if (clips.length === 0) {
  console.log("No clips matched.");
  process.exit(0);
}

if (dryRun) {
  for (const [name, text] of clips) {
    console.log(`${name}.${provider === "mimo" ? mimoFormat : "mp3"} <- ${text}`);
  }
  process.exit(0);
}

if (provider === "openai" && !process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY. Set it in .env or the shell, then run npm run audio:host.");
  process.exit(1);
}

if (provider === "mimo" && !mimoApiKey) {
    console.error("Missing MIMO_API_KEY or MIMO_LLM_API_KEY. Set it in .env, then run npm run audio:host -- --provider=mimo.");
  process.exit(1);
}

if (!["openai", "mimo"].includes(provider)) {
  console.error(`Unknown provider "${provider}". Use --provider=openai or --provider=mimo.`);
  process.exit(1);
}

await mkdir(outputDir, { recursive: true });

for (const [name, text] of clips) {
  const extension = provider === "mimo" ? mimoFormat : "mp3";
  const filePath = path.join(outputDir, `${name}.${extension}`);
  if (!force && existsSync(filePath)) {
    console.log(`skip ${name}.${extension}`);
    continue;
  }

  console.log(`generate ${name}.${extension}`);
  const audioBytes = provider === "mimo" ? await generateWithMimo(text, name) : await generateWithOpenAi(text, name);
  await writeFile(filePath, audioBytes);
}

console.log(`Done. Wrote host audio clips to ${path.relative(rootDir, outputDir)}.`);

async function generateWithOpenAi(text, name) {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      instructions,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    console.error(`Failed to generate ${name}.mp3: ${response.status} ${sanitizeOpenAiError(message)}`);
    process.exit(1);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function generateWithMimo(text, name) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (mimoAuthHeader.toLowerCase() === "authorization") {
    headers.Authorization = `Bearer ${mimoApiKey}`;
  } else {
    headers[mimoAuthHeader] = mimoApiKey;
  }

  const response = await fetch(`${mimoBaseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: mimoModel,
      messages: [
        {
          role: "user",
          content: `请用狼人杀法官的沉浸式主持口吻朗读。风格要求：${mimoStyle}。只合成 assistant 消息里的台词，不要朗读这些风格要求。`,
        },
        {
          role: "assistant",
          content: `${mimoUseStyleTag ? `<style>${mimoStyle}</style>` : ""}${text}`,
        },
      ],
      audio: {
        format: mimoFormat,
        voice: mimoVoice,
      },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error(`Failed to generate ${name}.${mimoFormat}: ${response.status} ${sanitizeOpenAiError(raw)}`);
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Buffer.from(raw, "binary");
  }

  const audio = findAudio(payload);
  if (!audio) {
    console.error(`Failed to locate audio data in Mimo response for ${name}.${mimoFormat}.`);
    console.error(`Top-level response keys: ${Object.keys(payload).join(", ")}`);
    process.exit(1);
  }

  if (audio.type === "url") {
    const audioResponse = await fetch(audio.value);
    if (!audioResponse.ok) {
      console.error(`Failed to download Mimo audio for ${name}.${mimoFormat}: ${audioResponse.status}`);
      process.exit(1);
    }
    return Buffer.from(await audioResponse.arrayBuffer());
  }

  return Buffer.from(audio.value, "base64");
}

function findAudio(value) {
  if (!value) return undefined;
  if (typeof value === "string") {
    if (/^https?:\/\//.test(value)) return { type: "url", value };
    const dataUrl = value.match(/^data:audio\/[^;]+;base64,(.+)$/);
    if (dataUrl) return { type: "base64", value: dataUrl[1] };
    if (value.length > 200 && /^[A-Za-z0-9+/=_-]+$/.test(value)) return { type: "base64", value };
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAudio(item);
      if (found) return found;
    }
    return undefined;
  }

  if (typeof value === "object") {
    const preferredKeys = ["audio", "data", "b64_json", "base64", "url", "audio_url", "content"];
    for (const key of preferredKeys) {
      const found = findAudio(value[key]);
      if (found) return found;
    }
    for (const item of Object.values(value)) {
      const found = findAudio(item);
      if (found) return found;
    }
  }

  return undefined;
}
