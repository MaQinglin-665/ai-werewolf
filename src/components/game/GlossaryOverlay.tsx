"use client";

import { useMemo, useState } from "react";
import { GLOSSARY_SECTIONS, type GlossaryEntry, type GlossarySection } from "./RoleKnowledgeContent";

export function GlossaryOverlay({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearchQuery = normalizeGlossarySearch(searchQuery);
  const totalEntries = GLOSSARY_SECTIONS.reduce((total, section) => total + section.entries.length, 0);
  const filteredSections = useMemo(
    () =>
      normalizedSearchQuery
        ? GLOSSARY_SECTIONS.map((section) => ({
            ...section,
            entries: section.entries.filter((entry) => glossaryEntryMatchesSearch(section, entry, normalizedSearchQuery)),
          })).filter((section) => section.entries.length > 0)
        : GLOSSARY_SECTIONS,
    [normalizedSearchQuery],
  );
  const visibleEntryCount = filteredSections.reduce((total, section) => total + section.entries.length, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-title"
      className="role-intro-backdrop mobile-knowledge-overlay fixed inset-0 z-50 overflow-y-auto bg-black/86 px-3 py-5 backdrop-blur-md sm:px-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mobile-knowledge-card mx-auto w-full max-w-6xl rounded-[30px] border border-[#7da8e3]/30 bg-[#0d1118]/96 p-4 shadow-2xl shadow-black/70 sm:p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mobile-knowledge-head mb-4 flex flex-col gap-3 border-b border-[#7da8e3]/15 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex rounded-full border border-[#7da8e3]/24 bg-[#7da8e3]/10 px-3 py-1 text-xs text-[#b8d6ff]">
              术语表 · {normalizedSearchQuery ? `${visibleEntryCount}/${totalEntries}` : totalEntries} 个常见说法
            </div>
            <h2 id="glossary-title" className="text-2xl font-semibold leading-tight text-[#f7ead5] sm:text-3xl">
              狼人杀桌面用语
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#cdbb9a]">
              AI 发言、投票理由和复盘里常出现这些说法。这里按当前项目的规则语境解释，重点说明它们在桌面推理里通常代表什么。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full border border-[#7da8e3]/25 bg-black/18 px-4 py-2 text-sm font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/10"
          >
            关闭
          </button>
        </div>

        <div className="mobile-knowledge-tools mb-4 grid gap-2 rounded-2xl border border-[#7da8e3]/18 bg-black/22 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="搜索狼人杀术语"
            placeholder="搜索术语或关键词"
            className="min-h-11 w-full rounded-xl border border-[#7da8e3]/18 bg-[#07101a]/78 px-3 py-2 text-sm text-[#e4efff] outline-none transition placeholder:text-[#7f91ad] focus:border-[#7da8e3]/52 focus:bg-[#0d1623]"
          />
          <div className="flex items-center justify-between gap-3 text-xs text-[#9fb2d0] sm:justify-end">
            <span>{normalizedSearchQuery ? `匹配 ${visibleEntryCount} 个` : `共 ${totalEntries} 个`}</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/10"
              >
                清空
              </button>
            )}
          </div>
        </div>

        <div className="soft-scrollbar mobile-knowledge-scroll grid gap-5 overflow-y-auto pr-1" style={{ maxHeight: "min(74vh, 760px)" }}>
          {filteredSections.length > 0 ? (
            filteredSections.map((section) => (
              <section key={section.title} className="grid gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#e4efff]">{section.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#9fb2d0]">{section.description}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {section.entries.map((entry) => (
                    <GlossaryTermCard key={`${section.title}-${entry.term}`} entry={entry} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-2xl border border-[#7da8e3]/18 bg-[#0d1623]/54 px-4 py-8 text-center text-sm text-[#b8d6ff]">
              未找到匹配术语
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function normalizeGlossarySearch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function glossaryEntryMatchesSearch(section: GlossarySection, entry: GlossaryEntry, query: string): boolean {
  return [section.title, section.description, entry.term, entry.alias ?? "", entry.meaning, entry.tableUse, entry.example].some((value) =>
    normalizeGlossarySearch(value).includes(query),
  );
}

function GlossaryTermCard({ entry }: { entry: GlossaryEntry }) {
  const toneClass = glossaryToneClass(entry.tone);
  return (
    <article className={`${toneClass.card} mobile-knowledge-term-card grid min-h-[250px] gap-3 rounded-2xl border p-3 shadow-xl shadow-black/24`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${toneClass.pill} rounded-full border px-2.5 py-1 text-sm font-semibold`}>{entry.term}</span>
          {entry.alias && <span className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-xs text-white/55">也叫 {entry.alias}</span>}
        </div>
        <p className="mt-3 text-sm leading-6 text-[#f7ead5]">{entry.meaning}</p>
      </div>
      <div className="grid gap-2 text-xs leading-5">
        <GlossaryLine label="桌面含义" value={entry.tableUse} />
        <GlossaryLine label="常见说法" value={entry.example} />
      </div>
    </article>
  );
}

function GlossaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mobile-knowledge-line rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="mb-1 text-[11px] text-[#9fb2d0]">{label}</div>
      <div className="text-[#dce8f8]">{value}</div>
    </div>
  );
}

function glossaryToneClass(tone: GlossaryEntry["tone"]): { card: string; pill: string } {
  const tones = {
    gold: {
      card: "border-[#f1c76e]/20 bg-[#21180f]/72",
      pill: "border-[#f1c76e]/28 bg-[#f1c76e]/12 text-[#f1d796]",
    },
    green: {
      card: "border-[#77d898]/18 bg-[#0f2118]/68",
      pill: "border-[#77d898]/25 bg-[#1d4e33]/30 text-[#a8f0b6]",
    },
    blue: {
      card: "border-[#7da8e3]/20 bg-[#0d1623]/72",
      pill: "border-[#7da8e3]/25 bg-[#7da8e3]/12 text-[#b8d6ff]",
    },
    red: {
      card: "border-[#e46d55]/22 bg-[#2a1110]/72",
      pill: "border-[#e46d55]/28 bg-[#572017]/34 text-[#ffb1a4]",
    },
  };
  return tones[tone];
}
