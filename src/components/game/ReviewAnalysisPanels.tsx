"use client";

import type { HumanGameView } from "@/game/types";
import { SectionTitle } from "./PanelPrimitives";

export function ReviewAnalysisDrawer({ game }: { game: HumanGameView }) {
  const insightCount = game.review?.aiInsights.length ?? 0;
  const callCount = game.reviewDebug?.aiCalls.length ?? 0;
  const fallbackCount = game.reviewDebug?.fallbackCount ?? 0;
  const publicFactBasisCount = game.reviewDebug?.publicFactBasisCount ?? 0;
  const matchedPublicLogicCount = game.reviewDebug?.matchedPublicLogicCount ?? 0;

  return (
    <details className="review-debug-details mt-4 rounded-2xl border border-[#77d898]/20 bg-black/18 p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#dff4df]">AI 行为解释与调试回放</div>
          <div className="mt-1 text-xs leading-5 text-[#9ecfac]">
            默认隐藏 · {insightCount} 个 AI 复盘 · {callCount} 次模型调用 · fallback {fallbackCount} · 公开依据 {publicFactBasisCount} · 命中逻辑{" "}
            {matchedPublicLogicCount}
          </div>
        </div>
        <span className="review-debug-chevron shrink-0 rounded-full border border-[#77d898]/20 bg-[#0f2118]/70 px-3 py-1 text-xs text-[#a8f0b6]">
          展开
        </span>
      </summary>

      <div className="mt-4 grid gap-4">
        {game.tableSummary.tableMemory.reasoningCues.length > 0 && <ReviewReasoningCuePanel game={game} />}
        {insightCount > 0 && <AiInsightsPanel game={game} embedded />}
        {game.reviewDebug && <ReviewDebugPanel debug={game.reviewDebug} />}
      </div>
    </details>
  );
}

function ReviewReasoningCuePanel({ game }: { game: HumanGameView }) {
  const cues = game.tableSummary.tableMemory.reasoningCues.slice(0, 8);
  if (cues.length === 0) return null;

  return (
    <div>
      <SectionTitle>公开推理线索</SectionTitle>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {cues.map((cue) => (
          <div key={cue.cueId} className="rounded-2xl border border-[#f1c76e]/18 bg-[#261510]/40 p-3 text-sm text-[#dcc9a7]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#f7ead5]">{cue.summary}</span>
              <span className="rounded-full border border-[#f1c76e]/16 bg-black/16 px-2 py-0.5 text-[11px] text-[#f1d796]">
                {cue.weight}
              </span>
            </div>
            {cue.evidence.length > 0 && (
              <div className="mt-2 grid gap-1">
                {cue.evidence.slice(0, 3).map((line) => (
                  <div key={`${cue.cueId}-${line}`} className="rounded-xl bg-black/18 px-3 py-2 text-xs leading-5 text-[#dcc9a7]">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AiInsightsPanel({ game, embedded = false }: { game: HumanGameView; embedded?: boolean }) {
  const insights = game.review?.aiInsights ?? [];
  if (insights.length === 0) return null;

  return (
    <div className={embedded ? "" : "mt-4"}>
      <SectionTitle>AI 行为解释</SectionTitle>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {insights.map((insight) => (
          <div key={insight.seat.seatId} className="rounded-2xl border border-[#77d898]/18 bg-[#0f2118]/38 p-3 text-sm text-[#dff4df]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-[#f7ead5]">
                  {insight.seat.seatId}号 · {insight.seat.name}
                </div>
                <div className="mt-1 text-xs text-[#9ecfac]">
                  {insight.roleLabel}
                  {insight.personaLabel ? ` · ${insight.personaLabel}` : ""}
                </div>
              </div>
              {insight.finalFocus && (
                <span className="rounded-full border border-[#77d898]/20 bg-[#77d898]/10 px-2 py-1 text-xs text-[#a8f0b6]">
                  焦点 {insight.finalFocus.seatId}号
                </span>
              )}
            </div>

            <p className="mt-3 text-xs leading-5 text-[#ccefd3]">{insight.impact}</p>

            <div className="mt-3 grid gap-2 text-xs leading-5 text-[#b8d9bf]">
              {insight.lastVoteTarget && (
                <div>
                  最后投票：{insight.lastVoteTarget.seatId}号
                  {insight.lastVoteReason ? `，${insight.lastVoteReason}` : ""}
                </div>
              )}
              {insight.lastSpeechTarget && <div>发言施压：{insight.lastSpeechTarget.seatId}号</div>}
              {insight.suspected && <div>持续怀疑：{insight.suspected.seatId}号</div>}
              {insight.trusted && <div>相对信任：{insight.trusted.seatId}号</div>}
            </div>

            {insight.beliefSummary.length > 0 && (
              <div className="mt-3 grid gap-1">
                {insight.beliefSummary.map((line) => (
                  <div key={line} className="rounded-xl bg-black/22 px-3 py-2 text-xs leading-5 text-[#dff4df]">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewDebugPanel({ debug }: { debug: NonNullable<HumanGameView["reviewDebug"]> }) {
  return (
    <div>
      <SectionTitle>模型调用回放</SectionTitle>
      <div className="mt-3 grid gap-2 text-xs leading-5 text-[#ccefd3] sm:grid-cols-4">
        <div className="rounded-2xl border border-[#77d898]/18 bg-[#0f2118]/38 px-3 py-2">
          调用 {debug.aiCalls.length} 次
        </div>
        <div className="rounded-2xl border border-[#77d898]/18 bg-[#0f2118]/38 px-3 py-2">
          fallback {debug.fallbackCount} 次
        </div>
        <div className="rounded-2xl border border-[#77d898]/18 bg-[#0f2118]/38 px-3 py-2">
          公开依据 {debug.publicFactBasisCount} 条
        </div>
        <div className="rounded-2xl border border-[#77d898]/18 bg-[#0f2118]/38 px-3 py-2">
          命中逻辑 {debug.matchedPublicLogicCount} 条
        </div>
      </div>

      <div className="mt-2 rounded-2xl border border-[#77d898]/16 bg-black/16 px-3 py-2 text-xs leading-5 text-[#9ecfac]">
        Provider：{debug.providers.length > 0 ? debug.providers.join("、") : "unknown"}
      </div>

      <div className="review-debug-log mt-3 grid max-h-[520px] gap-2 overflow-y-auto pr-1">
        {debug.aiCalls.map((call, index) => (
          <div key={call.id} className="rounded-2xl border border-[#77d898]/14 bg-[#07140d]/62 p-3 text-xs leading-5 text-[#dff4df]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-[#f7ead5]">
                #{index + 1} · D{call.day} · {call.seat.seatId}号 · {call.provider}
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[#ccefd3]">
                  {call.phase}
                </span>
                {call.actionType && (
                  <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[#ccefd3]">
                    {formatCommandType(call.actionType)}
                  </span>
                )}
                {call.isFallback && (
                  <span className="rounded-full border border-[#e46d55]/30 bg-[#2b1110]/68 px-2 py-0.5 text-[#ffb1a4]">
                    fallback
                  </span>
                )}
              </div>
            </div>

            {(call.outputSummary || call.decisionReason || call.matchedPublicLogic.length > 0) && (
              <div className="mt-3 grid gap-2 rounded-xl border border-[#77d898]/14 bg-[#0f2118]/38 p-3">
                {call.outputSummary && (
                  <div className="font-semibold text-[#f7ead5]">
                    决策：{call.outputSummary}
                    {call.target ? ` · 目标 ${call.target.seatId}号` : ""}
                  </div>
                )}
                {call.decisionReason && <div className="text-[#ccefd3]">理由：{call.decisionReason}</div>}
                {call.matchedPublicLogic.length > 0 && (
                  <div className="grid gap-1">
                    <div className="text-[#9ecfac]">关联公开逻辑</div>
                    {call.matchedPublicLogic.map((fact) => (
                      <div key={`${call.id}-matched-${fact}`} className="rounded-xl bg-black/22 px-3 py-2 text-[#dff4df]">
                        {fact}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {call.publicFactBasis.length > 0 && (
              <div className="mt-3 grid gap-1">
                {call.publicFactBasis.slice(0, 5).map((fact) => (
                  <div key={`${call.id}-${fact}`} className="rounded-xl bg-black/24 px-3 py-2 text-[#ccefd3]">
                    {fact}
                  </div>
                ))}
                {call.publicFactBasis.length > 5 && (
                  <div className="px-3 text-[#9ecfac]">还有 {call.publicFactBasis.length - 5} 条公开依据</div>
                )}
              </div>
            )}

            {(call.error || call.validationErrors.length > 0 || call.rawOutput !== undefined) && (
              <details className="mt-3 rounded-xl border border-white/10 bg-black/18 px-3 py-2">
                <summary className="cursor-pointer text-[#9ecfac]">原始输出 / 错误</summary>
                {call.error && <div className="mt-2 text-[#ffb1a4]">{call.error}</div>}
                {call.validationErrors.length > 0 && (
                  <div className="mt-2 text-[#ffd8cf]">{call.validationErrors.join("；")}</div>
                )}
                {call.rawOutput !== undefined && <pre className="review-debug-pre mt-2">{formatDebugJson(call.rawOutput)}</pre>}
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCommandType(type: string): string {
  const labels: Record<string, string> = {
    wolfKill: "刀人",
    guardAction: "守护",
    seerCheck: "查验",
    witchAction: "用药",
    wolfBeautyCharm: "魅惑",
    speak: "发言",
    lastWords: "遗言",
    vote: "投票",
    hunterReveal: "翻牌",
    hunterShoot: "开枪",
    wolfKingShoot: "狼王枪",
    whiteWolfKingExplode: "白狼王自爆",
    knightDuel: "骑士决斗",
    sheriffNominate: "上警",
    sheriffSpeech: "警长发言",
    sheriffWithdraw: "退水",
    sheriffVote: "警长票",
    sheriffHandoff: "警徽",
  };
  return labels[type] ?? type;
}

function formatDebugJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}
