"use client";

import type { HumanGameView } from "@/game/types";

export function PhaseRhythm({ game }: { game: HumanGameView }) {
  const steps = game.tableSummary.phaseSteps;
  const currentIndex = Math.max(
    steps.findIndex((step) => step.status === "current"),
    0,
  );
  const progressWidth = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 100;

  return (
    <section
      key={`${game.id}-${game.day}-${game.phase}-rhythm`}
      className="phase-rhythm-panel rounded-[22px] border border-[#f1c76e]/20 bg-[#130d0b]/72 px-3 py-3 shadow-xl shadow-black/25 backdrop-blur-md"
    >
      <div className="phase-rhythm-track" aria-hidden="true">
        <div className="phase-rhythm-progress" style={{ width: `${progressWidth}%` }} />
      </div>
      <div className="grid grid-cols-5 gap-2">
        {steps.map((step, index) => (
          <div key={step.key} className={`phase-step phase-step-${step.status} min-w-0`} style={{ animationDelay: `${index * 55}ms` }}>
            <div className="flex items-center gap-2">
              <div
                className={[
                  "phase-step-dot grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  step.status === "done"
                    ? "border-[#77d898]/35 bg-[#1d4e33]/70 text-[#a8f0b6]"
                    : step.status === "current"
                      ? "border-[#f1c76e]/65 bg-[#4a2d12] text-[#f1d796] shadow-lg shadow-[#f1c76e]/10"
                      : "border-[#f1c76e]/18 bg-black/25 text-[#8f8065]",
                ].join(" ")}
              >
                {index + 1}
              </div>
              {index < game.tableSummary.phaseSteps.length - 1 && (
                <div
                  className={[
                    "phase-step-connector hidden h-px flex-1 sm:block",
                    step.status === "done" ? "bg-[#77d898]/35" : "bg-[#f1c76e]/15",
                  ].join(" ")}
                />
              )}
            </div>
            <div
              className={[
                "mt-2 truncate text-xs",
                step.status === "current" ? "font-semibold text-[#f1d796]" : step.status === "done" ? "text-[#a8f0b6]" : "text-[#8f8065]",
              ].join(" ")}
            >
              {step.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
