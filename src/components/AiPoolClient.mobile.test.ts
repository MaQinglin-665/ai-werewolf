import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AiPoolClient } from "./AiPoolClient";

describe("AiPoolClient mobile layout", () => {
  it("marks the AI pool with compact mobile card structure", () => {
    const html = renderToStaticMarkup(createElement(AiPoolClient));

    expect(html).toContain("mobile-ai-pool-page");
    expect(html).toContain("mobile-ai-pool-header");
    expect(html).toContain("mobile-ai-pool-list");
    expect(html).toContain("mobile-ai-pool-card");
    expect(html).toContain("mobile-ai-profile-summary");
    expect(html).toContain("mobile-ai-profile-panel");
    expect(html).toContain("mobile-ai-card-main");
    expect(html).toContain("mobile-ai-config-stack");
    expect(html).toContain("mobile-ai-config-section");
    expect(html).toContain("mobile-ai-avatar-actions");
    expect(html).toContain("mobile-ai-card-config");
  });

  it("keeps player type controls in the main panel without duplicate briefs or legacy tuning guidance", () => {
    const html = renderToStaticMarkup(createElement(AiPoolClient));

    expect(html).not.toContain("普通用户只需要选类型");
    expect(html).not.toContain("打法类型速览");
    expect(html).not.toContain("普通局玩家类型速览");
    expect(html).not.toContain("选择类型会自动套用默认倾向");
    expect(html).not.toContain("选择后会同步发言和行动倾向");
    expect(html).not.toContain("用公开事实链拆发言顺序");
    expect(html).not.toContain("用强压和即时反应带动桌面");
    expect(html).not.toContain("参数说明");
    expect(html).not.toContain("调参参考");
    expect(html).not.toContain("mobile-ai-persona-type-briefs");
    expect(html).toContain("普通局玩家类型");
    expect(html).toContain("急性子冲票型");
    expect(html).toContain("说话直接，容易先怀疑一个人");
    expect(html).toContain("情绪反应型");
  });

  it("shows inferred strategy-card summaries and a manual refresh entry", () => {
    const html = renderToStaticMarkup(createElement(AiPoolClient));

    expect(html).toContain("策略卡");
    expect(html).toContain("逻辑链推演");
    expect(html).toContain("本轮别套模板");
    expect(html).toContain("刷新策略卡");
  });

  it("shows ordinary player type presets and separates model routing from play style", () => {
    const html = renderToStaticMarkup(createElement(AiPoolClient));

    expect(html).toContain("普通局玩家类型");
    expect(html).toContain("急性子冲票型");
    expect(html).toContain("谨慎怕背锅型");
    expect(html).toContain("说话方式");
    expect(html).toContain("思考偏好");
    expect(html).toContain("行动策略");
    expect(html).toContain("模型只决定调用接口");
    expect(html).toContain("玩家类型决定发言和打法");
    expect(html).not.toContain("DeepSeek 冷静事实派");
  });

  it("puts AI mode before the pool and keeps quick add behind an overlay entry", () => {
    const html = renderToStaticMarkup(createElement(AiPoolClient));

    expect(html.indexOf("对局 AI 模式")).toBeLessThan(html.indexOf("AI池</h2>"));
    expect(html.indexOf("对局 AI 模式")).toBeLessThan(html.indexOf("批量 LLM 配置"));
    expect(html.indexOf("批量 LLM 配置")).toBeLessThan(html.indexOf("AI池</h2>"));
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
    const html = renderToStaticMarkup(createElement(AiPoolClient));

    expect(html).not.toContain("高级导入导出");
    expect(html).not.toContain("导出 JSON");
    expect(html).not.toContain("导入 JSON");
    expect(html).toContain("mobile-ai-quick-add-entry");
    expect(html).toContain("mobile-ai-queue-card");
    expect(html).not.toContain("mobile-ai-tuning-reference");
    expect(css).toMatch(/\.mobile-ai-pool-page\s*{\s*height: 100svh;\s*overflow: hidden;/);
    expect(css).toMatch(/\.mobile-ai-pool-layout\s*{\s*min-height: 0;\s*grid-template-rows: auto minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.mobile-ai-quick-add-entry p,\s*\.mobile-ai-queue-card,\s*\.mobile-ai-custom-note\s*{\s*display: none;/);
  });

  it("keeps mobile AI cards in a compact two-column grid even when expanded", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const html = renderToStaticMarkup(createElement(AiPoolClient));

    expect(css).toMatch(/\.mobile-ai-pool-grid\s*{\s*align-items: flex-start;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/\.mobile-ai-profile-panel\s*{\s*position: fixed;/);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("关闭");
    expect(css).not.toContain(".mobile-ai-pool-card:has(.mobile-ai-profile-card[open])");
  });
});
