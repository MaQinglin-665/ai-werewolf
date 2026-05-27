import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AiPoolClient } from "./AiPoolClient";

function renderAiPoolClientHtml(): string {
  return renderToStaticMarkup(createElement(AiPoolClient));
}

describe("AiPoolClient mobile layout", () => {
  it("marks the AI pool with compact mobile card structure", () => {
    const html = renderAiPoolClientHtml();

    expect(html).toContain("mobile-ai-pool-page");
    expect(html).toContain("mobile-ai-pool-header");
    expect(html).toContain("mobile-ai-pool-list");
    expect(html).toContain("mobile-ai-pool-card");
    expect(html).toContain("mobile-ai-profile-summary");
    expect(html).toContain("mobile-ai-profile-panel");
    expect(html).toContain("mobile-ai-card-main");
    expect(html).toContain("mobile-ai-config-stack");
    expect(html).toContain("mobile-ai-config-section");
    expect(html).toContain("mobile-ai-persona-type-briefs");
    expect(html).toContain("mobile-ai-avatar-actions");
    expect(html).toContain("mobile-ai-card-config");
  });

  it("shows concrete persona type explanations instead of generic tuning guidance", () => {
    const html = renderAiPoolClientHtml();

    expect(html).not.toContain("普通用户只需要选类型");
    expect(html).toContain("逻辑链推演型");
    expect(html).toContain("用公开事实链拆发言顺序");
    expect(html).toContain("快节奏压迫型");
    expect(html).toContain("用强压和即时反应带动桌面");
    expect(html).toContain("打法类型速览");
    expect(html).toContain("选择类型会自动套用默认倾向");
  });

  it("puts AI mode before the pool and keeps quick add behind an overlay entry", () => {
    const html = renderAiPoolClientHtml();

    expect(html.indexOf("对局 AI 模式")).toBeLessThan(html.indexOf("角色名册</h2>"));
    expect(html.indexOf("对局 AI 模式")).toBeLessThan(html.indexOf("批量 LLM 配置"));
    expect(html.indexOf("批量 LLM 配置")).toBeLessThan(html.indexOf("角色名册</h2>"));
    expect(html.indexOf("对局 AI 模式")).toBeLessThan(html.indexOf("快速新增AI"));
    expect(html).toContain("LLM 预设");
    expect(html).toContain("只补齐还没配置模型的 AI");
    expect(html).toContain("替换所有已勾选 AI 的 LLM 配置");
    expect(html).toContain("快速新增AI");
    expect(html).toContain("新增");
    expect(html).not.toContain("例如：冷静票型位");
  });

  it("styles the bulk LLM preset panel as a responsive AI pool surface", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain(".mobile-ai-bulk-llm-card");
    expect(css).toContain(".mobile-ai-bulk-llm-panel");
    expect(css).toContain(".mobile-ai-bulk-llm-results");
  });

  it("removes advanced import and keeps low priority mobile panels out of the phone viewport", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const html = renderAiPoolClientHtml();

    expect(html).not.toContain("高级导入导出");
    expect(html).not.toContain("导出 JSON");
    expect(html).not.toContain("导入 JSON");
    expect(html).toContain("mobile-ai-quick-add-entry");
    expect(html).toContain("mobile-ai-queue-card");
    expect(html).toContain("mobile-ai-tuning-reference");
    expect(css).toMatch(/\.mobile-ai-pool-page\s*{\s*height: 100svh;\s*overflow: hidden;/);
    expect(css).toMatch(/\.mobile-ai-pool-layout\s*{\s*min-height: 0;\s*grid-template-rows: auto minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.mobile-ai-quick-add-entry p,\s*\.mobile-ai-tuning-reference,\s*\.mobile-ai-queue-card,\s*\.mobile-ai-custom-note\s*{\s*display: none;/);
  });

  it("keeps mobile AI cards in a compact two-column grid even when expanded", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const html = renderAiPoolClientHtml();

    expect(css).toMatch(/\.mobile-ai-pool-grid\s*{\s*align-items: flex-start;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/\.mobile-ai-profile-panel\s*{\s*position: fixed;/);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("关闭");
    expect(css).not.toContain(".mobile-ai-pool-card:has(.mobile-ai-profile-card[open])");
  });

  it("renders the AI pool as a character roster with role-card fields", () => {
    const html = renderAiPoolClientHtml();

    expect(html).toContain("角色名册");
    expect(html).toContain("角色详情");
    expect(html).toContain("人物来源");
    expect(html).toContain("说话方式");
    expect(html).toContain("推理习惯");
    expect(html).toContain("不要做什么");
    expect(html).toContain("导入角色");
    expect(html).toContain("导出角色");
  });

  it("warns that role-play instructions require real LLM mode", () => {
    const html = renderAiPoolClientHtml();

    expect(html).toContain("人设和打法扮演只在真实 LLM 生效");
  });
});
