import type * as React from "react";

export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#f1c76e]/15 bg-black/20 px-3 py-2">
      <div className="mb-1 text-xs text-[#ad9c7d]">{label}</div>
      <div>{children}</div>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-[#f1d796]">{children}</h3>;
}

export function StatusPill({ children, tone }: { children: React.ReactNode; tone: "gold" | "green" | "red" | "blue" }) {
  const colors = {
    gold: "border-[#f1c76e]/35 bg-[#f1c76e]/10 text-[#f1d796]",
    green: "border-[#77d898]/30 bg-[#1d4e33]/45 text-[#a8f0b6]",
    red: "border-[#e46d55]/35 bg-[#572017]/45 text-[#ffb1a4]",
    blue: "border-[#6797d5]/35 bg-[#142845]/50 text-[#cfe4ff]",
  };

  return <span className={`${colors[tone]} rounded-full border px-3 py-1 text-xs font-medium`}>{children}</span>;
}
