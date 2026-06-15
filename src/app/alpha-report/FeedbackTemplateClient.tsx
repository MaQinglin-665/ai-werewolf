"use client";

import { useMemo, useState } from "react";
import { readCurrentGameId } from "@/components/game/recentGamesStore";

const phaseOptions = [
  "打开链接",
  "创建房间",
  "加入房间",
  "开局前大厅",
  "夜晚行动",
  "白天发言",
  "投票",
  "遗言/开枪",
  "复盘/结束",
  "刷新恢复",
];

const severityOptions = [
  { label: "P0 阻塞", value: "P0 阻塞：无法继续试玩" },
  { label: "P1 严重", value: "P1 严重：能绕过但明显影响试玩" },
  { label: "P2 体验", value: "P2 体验：不阻塞但不清楚或不顺手" },
];
const inputClass =
  "min-w-0 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-300/45";
const textareaClass = `${inputClass} min-h-24 resize-y leading-6`;

export function FeedbackTemplateClient() {
  const [feedbackId, setFeedbackId] = useState(() => readCurrentGameId());
  const [roomCode, setRoomCode] = useState("");
  const [seat, setSeat] = useState("");
  const [phase, setPhase] = useState(phaseOptions[0]);
  const [severity, setSeverity] = useState(severityOptions[0].value);
  const [device, setDevice] = useState("");
  const [browser, setBrowser] = useState(() => (typeof window === "undefined" ? "" : window.navigator.userAgent));
  const [actual, setActual] = useState("");
  const [expected, setExpected] = useState("");
  const [recovery, setRecovery] = useState("");
  const [steps, setSteps] = useState("");
  const [copyState, setCopyState] = useState<"copied" | "idle" | "manual">("idle");

  const report = useMemo(
    () =>
      [
        "AI 狼人杀 Alpha 试玩反馈",
        "",
        `严重程度：${severity}`,
        `反馈编号：${feedbackId.trim() || "未记录"}`,
        `房间码：${roomCode.trim() || "未记录"}`,
        `玩家座位：${seat.trim() || "未记录"}`,
        `发生阶段：${phase}`,
        `设备：${device.trim() || "未记录"}`,
        `浏览器：${browser.trim() || "未记录"}`,
        "",
        "实际情况：",
        actual.trim() || "未填写",
        "",
        "期望结果：",
        expected.trim() || "未填写",
        "",
        "刷新/重试后是否恢复：",
        recovery.trim() || "未填写",
        "",
        "最短复现步骤：",
        steps.trim() || "未填写",
      ].join("\n"),
    [actual, browser, device, expected, feedbackId, phase, recovery, roomCode, seat, severity, steps],
  );

  async function copyReport() {
    try {
      await window.navigator.clipboard.writeText(report);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <section className="min-w-0 break-words rounded-lg border border-white/10 bg-[#17191b] p-4">
        <h2 className="text-lg font-black text-white">填写问题</h2>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="反馈编号">
              <input
                className={inputClass}
                maxLength={80}
                onChange={(event) => setFeedbackId(event.target.value)}
                placeholder="单人局会自动填入"
                value={feedbackId}
              />
            </Field>
            <Field label="房间码">
              <input
                className={inputClass}
                maxLength={24}
                onChange={(event) => setRoomCode(event.target.value)}
                placeholder="例如 1MN53C"
                value={roomCode}
              />
            </Field>
            <Field label="玩家座位">
              <input
                className={inputClass}
                maxLength={24}
                onChange={(event) => setSeat(event.target.value)}
                placeholder="例如 2 号 / 房主"
                value={seat}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="发生阶段">
              <select className={inputClass} onChange={(event) => setPhase(event.target.value)} value={phase}>
                {phaseOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="严重程度">
              <select className={inputClass} onChange={(event) => setSeverity(event.target.value)} value={severity}>
                {severityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="设备">
              <input
                className={inputClass}
                maxLength={80}
                onChange={(event) => setDevice(event.target.value)}
                placeholder="例如 iPhone 15 / Windows Chrome"
                value={device}
              />
            </Field>
            <Field label="浏览器">
              <input className={inputClass} maxLength={240} onChange={(event) => setBrowser(event.target.value)} value={browser} />
            </Field>
          </div>

          <Field label="实际情况">
            <textarea
              className={textareaClass}
              maxLength={800}
              onChange={(event) => setActual(event.target.value)}
              placeholder="页面显示了什么，哪里卡住，按钮是否无反应，是否有报错。"
              value={actual}
            />
          </Field>

          <Field label="期望结果">
            <textarea
              className={textareaClass}
              maxLength={500}
              onChange={(event) => setExpected(event.target.value)}
              placeholder="你当时以为下一步应该发生什么。"
              value={expected}
            />
          </Field>

          <Field label="刷新/重试后是否恢复">
            <textarea
              className={textareaClass}
              maxLength={500}
              onChange={(event) => setRecovery(event.target.value)}
              placeholder="刷新后能否回到自己的视角，重新加入是否可行。"
              value={recovery}
            />
          </Field>

          <Field label="最短复现步骤">
            <textarea
              className={textareaClass}
              maxLength={900}
              onChange={(event) => setSteps(event.target.value)}
              placeholder={"1. 打开链接\n2. 加入房间\n3. 点击..."}
              value={steps}
            />
          </Field>
        </div>
      </section>

      <section className="min-w-0 break-words rounded-lg border border-white/10 bg-[#17191b] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-white">可复制反馈</h2>
          <button
            className="rounded-md border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-500/20"
            onClick={() => void copyReport()}
            type="button"
          >
            复制反馈文本
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          这里只在浏览器本地生成文本，不会上传到服务器。复制后发给维护者即可。
        </p>
        {copyState !== "idle" ? (
          <p className={`mt-3 rounded-md border px-3 py-2 text-sm font-bold ${copyState === "copied" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-amber-300/30 bg-amber-400/10 text-amber-100"}`}>
            {copyState === "copied" ? "反馈文本已复制。" : "浏览器阻止了复制，请手动选中文本复制。"}
          </p>
        ) : null}
        <pre className="mt-4 max-h-[680px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black/35 p-3 text-xs leading-5 text-zinc-100">
          {report}
        </pre>
      </section>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
