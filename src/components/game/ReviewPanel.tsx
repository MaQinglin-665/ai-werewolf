"use client";

import { DEATH_LABELS } from "@/game/labels";
import { isWolfRole } from "@/game/roleUtils";
import type { HumanGameView } from "@/game/types";
import { SectionTitle } from "./PanelPrimitives";
import { ROLE_CARD_IMAGES, formatSystemMessage } from "./viewHelpers";

export function ReviewPanel({ game }: { game: HumanGameView }) {
  const review = game.review;
  if (!review) return null;

  return (
    <section id="review" className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1c76e]/15 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#f7ead5]">终局复盘</h2>
          <p className="mt-1 text-sm text-[#dcc9a7]">
            {review.result?.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜 · {review.result?.reason}
          </p>
        </div>
        <a
          href="#review-events"
          className="rounded-full border border-[#f1c76e]/30 px-4 py-2 text-sm text-[#f1d796] transition hover:bg-[#f1c76e]/10"
        >
          查看关键事件
        </a>
      </div>

      {review.turningPoints.length > 0 && (
        <div className="mt-4">
          <SectionTitle>关键转折</SectionTitle>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {review.turningPoints.map((point, index) => (
              <div key={`${point.day}-${point.title}-${index}`} className="rounded-2xl border border-[#f1c76e]/18 bg-[#261510]/75 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-[#f1c76e]/12 px-2 py-1 text-xs text-[#f1d796]">D{point.day}</span>
                  <span className="text-xs text-[#ad9c7d]">#{index + 1}</span>
                </div>
                <div className="text-sm font-semibold text-[#f7ead5]">{point.title}</div>
                <p className="mt-2 text-xs leading-5 text-[#dcc9a7]">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {review.playerFeedback.length > 0 && <PlayerFeedbackPanel game={game} />}

      {review.voteImpacts.length > 0 && <ReviewVoteImpactPanel game={game} />}

      {(review.aiInsights.length > 0 || game.reviewDebug) && <ReviewAnalysisDrawer game={game} />}

      {review.claims.length > 0 && (
        <div className="mt-4">
          <SectionTitle>声明复盘</SectionTitle>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {review.claims.map((claim) => (
              <div key={`${claim.claimant.seatId}-${claim.claimedRole}`} className="rounded-2xl border border-[#f1c76e]/18 bg-black/20 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#f7ead5]">
                    {claim.claimant.seatId}号 · {claim.claimant.name}
                  </span>
                  <span className={claim.truthful ? "text-[#9fe0a4]" : "text-[#ff8c78]"}>
                    声称{claim.claimedRoleLabel} · 真实{claim.trueRoleLabel}
                  </span>
                </div>
                {claim.isCounterclaim && <div className="mt-2 text-xs text-[#ffd8cf]">处在对跳关系中</div>}
                {claim.checks.length > 0 && (
                  <div className="mt-2 grid gap-1 text-xs leading-5 text-[#dcc9a7]">
                    {claim.checks.map((check) => (
                      <div key={`${claim.claimant.seatId}-${check.target.seatId}-${check.claimedResult}`}>
                        报{check.target.seatId}号{check.claimedResult === "WEREWOLF" ? "查杀" : "金水"} · 终局
                        {check.accurate ? "准确" : `实际为${check.actualResult === "WEREWOLF" ? "狼人" : "好人"}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {review.stanceShifts.length > 0 && (
        <div className="mt-4">
          <SectionTitle>站边变化</SectionTitle>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {review.stanceShifts.map((shift) => (
              <div key={`${shift.actor.seatId}-${shift.target.seatId}-${shift.fromDay}-${shift.toDay}`} className="rounded-2xl border border-[#e46d55]/18 bg-[#2b1110]/40 p-3 text-sm text-[#ffd8cf]">
                D{shift.fromDay}→D{shift.toDay} · {shift.actor.name} 对 {shift.target.name}：
                {shift.fromKindLabel} 改为 {shift.toKindLabel}
              </div>
            ))}
          </div>
        </div>
      )}

      {review.strategyNotes.length > 0 && (
        <div className="mt-4">
          <SectionTitle>阵营策略</SectionTitle>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {review.strategyNotes.map((note, index) => (
              <div
                key={`${note.day}-${note.title}-${index}`}
                className={[
                  "rounded-2xl border p-3 text-sm",
                  note.camp === "WEREWOLVES"
                    ? "border-[#e46d55]/22 bg-[#2b1110]/42 text-[#ffd8cf]"
                    : "border-[#8fd29a]/22 bg-[#0f2118]/45 text-[#dff4df]",
                ].join(" ")}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#f7ead5]">{note.title}</span>
                  <span className="text-xs opacity-75">D{note.day}</span>
                </div>
                <p className="text-xs leading-5 opacity-90">{note.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div>
          <SectionTitle>身份揭晓</SectionTitle>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {review.roleReveal.map((seat) => (
              <div key={seat.seatId} className="flex gap-3 rounded-2xl border border-[#f1c76e]/15 bg-black/20 p-3 text-sm">
                <div
                  className="h-16 w-11 shrink-0 rounded-md border border-[#f1c76e]/30 bg-cover bg-center"
                  style={{ backgroundImage: `url(${ROLE_CARD_IMAGES[seat.role]})` }}
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#f7ead5]">
                    {seat.seatId}号 · {seat.name}
                  </div>
                  <div className={isWolfRole(seat.role) ? "mt-1 text-[#ff8c78]" : "mt-1 text-[#9fe0a4]"}>
                    {seat.roleLabel}
                  </div>
                  <div className="mt-1 text-xs text-[#ad9c7d]">
                    {seat.alive ? "存活到终局" : seat.deathReason ? DEATH_LABELS[seat.deathReason] : "已出局"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>死亡时间线</SectionTitle>
          <div className="mt-3 grid gap-2">
            {review.deathTimeline.length === 0 ? (
              <p className="rounded-2xl border border-[#f1c76e]/15 bg-black/20 p-3 text-sm text-[#ad9c7d]">没有玩家死亡。</p>
            ) : (
              review.deathTimeline.map((death, index) => (
                <div key={`${death.day}-${death.seat.seatId}-${index}`} className="rounded-2xl bg-[#261510]/85 p-3 text-sm text-[#dcc9a7]">
                  D{death.day} · {death.seat.name} · {death.reasonLabel}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ReviewNightRounds game={game} />
        <ReviewDayRounds game={game} />
      </div>

      <div id="review-events" className="mt-5">
        <SectionTitle>关键事件</SectionTitle>
        <div className="mt-3 grid gap-2">
          {review.keyEvents.map((event) => (
            <div key={event.seq} className="border-l-2 border-[#f1c76e] bg-black/15 py-2 pl-3 text-sm leading-6 text-[#dcc9a7]">
              <span className="text-xs text-[#ad9c7d]">D{event.day} · {event.phase}</span>
              <br />
              {formatSystemMessage(game, event.message)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlayerFeedbackPanel({ game }: { game: HumanGameView }) {
  const feedback = game.review?.playerFeedback ?? [];
  if (feedback.length === 0) return null;

  return (
    <div className="mt-4">
      <SectionTitle>你的本局反馈</SectionTitle>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {feedback.map((item, index) => (
          <div
            key={`${item.title}-${index}`}
            className={[
              "rounded-2xl border p-3 text-sm",
              item.tone === "positive"
                ? "border-[#8fd29a]/22 bg-[#0f2118]/48 text-[#dff4df]"
                : item.tone === "warning"
                  ? "border-[#e46d55]/24 bg-[#2b1110]/45 text-[#ffd8cf]"
                  : "border-[#f1c76e]/18 bg-black/20 text-[#dcc9a7]",
            ].join(" ")}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold text-[#f7ead5]">{item.title}</span>
              {item.day && <span className="text-xs opacity-75">D{item.day}</span>}
            </div>
            <p className="text-xs leading-5 opacity-90">{item.description}</p>
            {item.relatedSeats.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {item.relatedSeats.slice(0, 4).map((seat) => (
                  <span key={`${item.title}-${seat.seatId}`} className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[11px] opacity-85">
                    {seat.seatId}号
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewVoteImpactPanel({ game }: { game: HumanGameView }) {
  const impacts = game.review?.voteImpacts ?? [];
  if (impacts.length === 0) return null;

  return (
    <div className="mt-4">
      <SectionTitle>票型影响</SectionTitle>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {impacts.map((impact) => {
          const targetIsWolf = isWolfRole(impact.targetRole);
          return (
            <div
              key={`${impact.day}-${impact.title}`}
              className={[
                "rounded-2xl border p-3 text-sm",
                impact.outcome === "tie"
                  ? "border-[#f1c76e]/22 bg-[#261510]/50 text-[#f1d796]"
                  : targetIsWolf
                    ? "border-[#8fd29a]/22 bg-[#0f2118]/48 text-[#dff4df]"
                    : "border-[#e46d55]/24 bg-[#2b1110]/45 text-[#ffd8cf]",
              ].join(" ")}
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="rounded-full bg-black/22 px-2 py-1 text-xs opacity-80">D{impact.day}</span>
                  <div className="mt-2 font-semibold text-[#f7ead5]">{impact.title}</div>
                </div>
                {impact.target && impact.targetRoleLabel && (
                  <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-xs">
                    {impact.target.seatId}号 · {impact.targetRoleLabel}
                  </span>
                )}
              </div>
              <p className="text-xs leading-5 opacity-90">{impact.description}</p>

              {impact.leaders.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {impact.leaders.map((leader) => (
                    <span key={`${impact.day}-${leader.target.seatId}`} className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-[11px] opacity-85">
                      {leader.target.seatId}号 {leader.count}票 · {leader.roleLabel}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] leading-5">
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  总票<br />
                  {impact.totalVotes}
                </div>
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  好人票<br />
                  {impact.goodVotes}
                </div>
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  狼票<br />
                  {impact.wolfVotes}
                </div>
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  弃票<br />
                  {impact.abstainCount}
                </div>
              </div>

              {impact.decisiveVoters.length > 0 && (
                <div className="mt-3 text-xs leading-5 opacity-80">
                  关键票：{impact.decisiveVoters.map((seat) => `${seat.seatId}号`).join("、")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewAnalysisDrawer({ game }: { game: HumanGameView }) {
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

function ReviewNightRounds({ game }: { game: HumanGameView }) {
  const review = game.review;
  if (!review) return null;

  return (
    <div>
      <SectionTitle>夜晚记录</SectionTitle>
      <div className="mt-3 grid gap-3">
        {review.nightRounds.map((round) => (
          <div key={round.day} className="rounded-2xl border border-[#5e87b9]/25 bg-[#0d1623]/55 p-3 text-sm leading-6 text-[#d8e6f7]">
            <strong>第 {round.day} 夜</strong>
            <div>狼人刀口：{round.wolfTarget?.name ?? "无"}</div>
            <div>
              查验：
              {round.seerCheck
                ? `${round.seerCheck.seer.name} 查验 ${round.seerCheck.target.name} 为 ${
                    round.seerCheck.result === "WEREWOLF" ? "狼人" : "好人"
                  }`
                : "无"}
            </div>
            <div>
              女巫：
              {round.witchAction
                ? round.witchAction.mode === "save"
                  ? `救了 ${round.witchAction.target?.name ?? "刀口"}`
                  : round.witchAction.mode === "poison"
                    ? `毒了 ${round.witchAction.target?.name ?? "未知目标"}`
                    : "未用药"
                : "无行动"}
            </div>
            <div>死亡：{round.deaths.length > 0 ? round.deaths.map((seat) => seat.name).join("、") : "平安夜"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewDayRounds({ game }: { game: HumanGameView }) {
  const review = game.review;
  if (!review) return null;

  return (
    <div>
      <SectionTitle>白天投票</SectionTitle>
      <div className="mt-3 grid gap-3">
        {review.dayRounds.map((round) => (
          <div key={round.day} className="rounded-2xl border border-[#8fd29a]/25 bg-[#0f2118]/60 p-3 text-sm leading-6 text-[#dff4df]">
            <strong>第 {round.day} 天</strong>
            <div>发言数：{round.speechCount}</div>
            <div>
              票数：
              {round.voteTally.length > 0
                ? round.voteTally.map((item) => `${item.target.name} ${item.count}票`).join("，")
                : "无"}
            </div>
            {round.votes.length > 0 && (
              <div>
                投票解释：
                {round.votes
                  .slice(0, 4)
                  .map((vote) => `${vote.voter.name}投${vote.target?.name ?? "弃票"}${vote.reason ? `（${vote.reason}）` : ""}`)
                  .join("；")}
              </div>
            )}
            <div>
              结果：
              {round.exiled
                ? `${round.exiled.name} 被放逐`
                : round.tiedSeatIds.length > 0
                  ? `平票：${round.tiedSeatIds.join("、")}号`
                  : "无放逐"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
