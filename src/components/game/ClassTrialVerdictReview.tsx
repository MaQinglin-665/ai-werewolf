"use client";

import type { HumanGameView } from "@/game/types";

function winnerLabel(game: HumanGameView): string {
  const winner = game.review?.result?.winner ?? game.result?.winner;
  return winner === "WEREWOLVES" ? "狼人阵营" : "好人阵营";
}

function resultReason(game: HumanGameView): string {
  return game.review?.result?.reason ?? game.result?.reason ?? "审判记录整理中";
}

export function ClassTrialVerdictReview({ game, onReturnHome }: { game: HumanGameView; onReturnHome: () => void }) {
  const review = game.review;
  const winner = winnerLabel(game);
  const reason = resultReason(game);

  if (!review) {
    return (
      <section className="class-trial-verdict-review class-trial-verdict-review-loading" aria-label="结案审判复盘">
        <header className="class-trial-verdict-header">
          <div>
            <span className="class-trial-verdict-kicker">Final Verdict</span>
            <h2>审判记录整理中</h2>
            <p>{winner}胜利 · {reason}</p>
          </div>
          <button type="button" onClick={onReturnHome} className="class-trial-table-secondary">
            返回首页
          </button>
        </header>
      </section>
    );
  }

  const evidence = review.turningPoints.slice(0, 5);
  const voteImpacts = review.voteImpacts.slice(-4);
  const keyEvents = review.keyEvents.slice(-6);

  return (
    <section className="class-trial-verdict-review" aria-label="结案审判复盘">
      <header className="class-trial-verdict-header">
        <div>
          <span className="class-trial-verdict-kicker">Final Verdict</span>
          <h2>最终裁决</h2>
          <p>
            {winner}胜利 · {reason}
          </p>
        </div>
        <button type="button" onClick={onReturnHome} className="class-trial-table-secondary">
          返回首页
        </button>
      </header>

      <section className="class-trial-verdict-hero">
        <span>本庭确认</span>
        <strong>{winner}胜利</strong>
        <p>{reason}</p>
      </section>

      {evidence.length > 0 && (
        <section className="class-trial-verdict-section">
          <h3>关键证据</h3>
          <div className="class-trial-verdict-grid">
            {evidence.map((point, index) => (
              <article key={`${point.day}-${point.title}-${index}`} className="class-trial-verdict-card">
                <span>证据 {index + 1} · D{point.day}</span>
                <strong>{point.title}</strong>
                <p>{point.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {voteImpacts.length > 0 && (
        <section className="class-trial-verdict-section">
          <h3>票型迷雾</h3>
          <div className="class-trial-verdict-grid">
            {voteImpacts.map((impact, index) => (
              <article key={`${impact.day}-${impact.title}-${index}`} className="class-trial-verdict-card class-trial-verdict-card-danger">
                <span>D{impact.day} · {impact.outcome === "tie" ? "平票" : impact.outcome === "exile" ? "放逐" : "未放逐"}</span>
                <strong>{impact.title}</strong>
                <p>{impact.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="class-trial-verdict-section">
        <h3>退场名单</h3>
        {review.deathTimeline.length === 0 ? (
          <p className="class-trial-verdict-empty">暂无退场记录。</p>
        ) : (
          <div className="class-trial-verdict-list">
            {review.deathTimeline.map((death, index) => (
              <div key={`${death.day}-${death.seat.seatId}-${index}`} className="class-trial-verdict-row">
                D{death.day} · {death.seat.seatId}号{death.seat.name} · {death.reasonLabel}
              </div>
            ))}
          </div>
        )}
      </section>

      {review.roleReveal.length > 0 && (
        <section className="class-trial-verdict-section">
          <h3>身份揭晓</h3>
          <div className="class-trial-role-reveal">
            {review.roleReveal.map((seat) => (
              <div key={seat.seatId} className={["class-trial-role-chip", seat.camp === "WEREWOLVES" ? "class-trial-role-chip-wolf" : ""].join(" ")}>
                <strong>{seat.seatId}号 · {seat.name}</strong>
                <span>{seat.roleLabel}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {keyEvents.length > 0 && (
        <details className="class-trial-verdict-section class-trial-verdict-details">
          <summary>审判记录</summary>
          <div className="class-trial-verdict-list">
            {keyEvents.map((event) => (
              <div key={event.seq} className="class-trial-verdict-row">
                D{event.day} · {event.message}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
