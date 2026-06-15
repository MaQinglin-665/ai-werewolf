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
    expect(html).toContain("ai-edit-profile-card");
    expect(html).toContain("ai-edit-work-panel");
    expect(html).toContain("ai-config-summary-card");
    expect(html).toContain("ai-edit-footer");
    expect(html).toContain("mobile-ai-card-config");
    expect(html).toContain("mobile-ai-view-switch");
    expect(html).toContain("mobile-ai-lineup-rail");
    expect(html).toContain("mobile-ai-lineup-board");
    expect(html).toContain("mobile-ai-config-board");
    expect(html).toContain("mobile-ai-inspector");
  });

  it("renders the edit dialog as a role card plus configuration workstation", () => {
    const html = renderToStaticMarkup(createElement(AiPoolClient));

    expect(html).toContain("编辑 AI：");
    expect(html).toContain("配置总览");
    expect(html).toContain("快速操作");
    expect(html).toContain("配置摘要");
    expect(html).toContain("前往 LLM 配置");
    expect(html).toContain("前往 TTS 配置");
    expect(html).toContain("保存为预设");
    expect(html).toContain("应用预设到当前阵容");
    expect(html).toContain("策略卡预览");
    expect(html).toContain("角色底稿");
    expect(html).toContain("保存修改");
  });

  it("switches edit tabs with local state instead of scrolling through stacked sections", () => {
    const source = readFileSync("src/components/AiPoolClient.tsx", "utf8");

    expect(source).toContain('type AiEditSection = "overview" | "role" | "llm" | "tts" | "bulk"');
    expect(source).toContain("activeEditSections");
    expect(source).toContain("data-ai-active-edit-section");
    expect(source).toContain('hidden={activeEditSection !== "llm"}');
    expect(source).toContain('hidden={activeEditSection !== "tts"}');
    expect(source).not.toContain("scrollAiEditSection");
    expect(source).not.toContain('details className="mobile-ai-config-section');
  });

  it("keeps player type cards clickable while showing tuning values as read-only meters", () => {
    const html = renderToStaticMarkup(createElement(AiPoolClient));
    const source = readFileSync("src/components/AiPoolClient.tsx", "utf8");

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
    expect(html).toContain("ordinary-player-readout-panel");
    expect(html).toContain("ordinary-player-type-card");
    expect(html).toContain("ordinary-player-meter");
    expect(html).toContain('aria-pressed="true"');
    expect(source).toContain("onSelectOrdinaryPlayerType");
    expect(source).not.toContain('type="range"');
    expect(source).not.toContain("onUpdateSlider");
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
    expect(html).toContain("点击类型卡切换发言和打法");
    expect(html).not.toContain("DeepSeek 冷静事实派");
  });

  it("puts AI mode before the pool and keeps quick add behind an overlay entry", () => {
    const html = renderToStaticMarkup(createElement(AiPoolClient));
    const source = readFileSync("src/components/AiPoolClient.tsx", "utf8");

    expect(html.indexOf("对局 AI 模式")).toBeLessThan(html.indexOf("AI角色库</h2>"));
    expect(html.indexOf("对局 AI 模式")).toBeLessThan(html.indexOf("批量 LLM 配置"));
    expect(html.indexOf("AI角色库</h2>")).toBeLessThan(html.indexOf("批量 LLM 配置"));
    expect(html.indexOf("对局 AI 模式")).toBeLessThan(html.indexOf("快速新增AI"));
    expect(html).toContain("LLM 预设");
    expect(html).toContain("批量 TTS 配置");
    expect(html).toContain("TTS 预设");
    expect(html).toContain("目标：当前阵容");
    expect(html).toContain("补齐只处理还没有自定义 LLM 的 AI");
    expect(html).toContain("覆盖会替换当前阵容全部 AI 的 LLM 配置");
    expect(source).toContain("补齐当前阵容未配置 AI");
    expect(source).toContain("覆盖当前阵容全部 AI");
    expect(html).toContain("复制此 AI 的 LLM 到未配置");
    expect(html).toContain("复制此 AI 的 TTS 到未配置");
    expect(html).toContain("快速新增AI");
    expect(html).toContain("新增");
    expect(html).not.toContain("已勾选 AI");
    expect(source).not.toContain("已勾选 AI");
    expect(source).not.toContain("当前勾选");
    expect(html).not.toContain("例如：冷静票型位");
  });

  it("adds a mobile-first overview with lineup and configuration shortcuts", () => {
    const html = renderToStaticMarkup(createElement(AiPoolClient));
    const source = readFileSync("src/components/AiPoolClient.tsx", "utf8");

    expect(html).toContain("AI池移动端视图");
    expect(html).toContain("角色总览");
    expect(html).toContain("当前阵容");
    expect(html).toContain("搜索AI/模型/打法");
    expect(html).toContain("本局阵容");
    expect(html).toContain("移动端配置页签");
    expect(source).toContain("打开完整配置");
    expect(source).toContain('type AiMobilePoolView = "overview" | "lineup" | "config"');
    expect(source).toContain("mobileLineupFriends");
    expect(source).toContain("openFriendEditor");
    expect(source).toContain("mobileEditor");
    expect(source).toContain("data-ai-friend-editor");
    expect(source).toContain("mobile-ai-lineup-board");
    expect(source).toContain("mobile-ai-config-board");
  });

  it("keeps mobile card selection separate from editing and mode changes", () => {
    const source = readFileSync("src/components/AiPoolClient.tsx", "utf8");

    expect(source).toContain("isPhoneAiPoolViewport()");
    expect(source).toContain("event.preventDefault();");
    expect(source).toContain("setMobileFocusedFriendId(friend.id);");
    expect(source).toContain("setMobileEditor({ friendId: friend.id, section });");
    expect(source).not.toContain('setMobileView("lineup");');
  });

  it("puts editable name and avatar controls inside role information", () => {
    const html = renderToStaticMarkup(createElement(AiPoolClient));
    const source = readFileSync("src/components/AiPoolClient.tsx", "utf8");

    expect(html).toContain("角色名称");
    expect(html).toContain("保存名称");
    expect(html).toContain("上传头像");
    expect(source).toContain("saveAiFriendProfile");
    expect(source).toContain("onProfileSave");
    expect(source).toContain("onAvatarUpload");
    expect(source).toContain("onClearAvatar");
  });

  it("styles the bulk LLM preset panel as a responsive AI pool surface", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain(".mobile-ai-bulk-llm-card");
    expect(css).toContain(".mobile-ai-bulk-llm-panel");
    expect(css).toContain(".mobile-ai-bulk-llm-results");
    expect(css).toContain(".mobile-ai-bulk-tts-card");
    expect(css).toContain(".mobile-ai-bulk-tts-panel");
    expect(css).toContain(".mobile-ai-bulk-tts-results");
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

  it("keeps mobile AI cards readable in a compact overview while expanded editing stays modal", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const html = renderToStaticMarkup(createElement(AiPoolClient));

    expect(css).toMatch(/\.mobile-ai-pool-grid\s*{\s*align-items: flex-start;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(css).toContain(".mobile-ai-inspector");
    expect(css).toContain(".mobile-ai-lineup-rail");
    expect(css).toContain(".mobile-ai-lineup-board");
    expect(css).toContain(".mobile-ai-config-board");
    expect(css).toContain(".mobile-ai-standalone-editor");
    expect(css).toContain('.mobile-ai-pool-list[data-mobile-ai-view="config"] .mobile-ai-pool-grid');
    expect(css).toMatch(/overflow-y: auto;/);
    expect(css).toMatch(/\.mobile-ai-profile-panel\s*{\s*position: fixed;/);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("关闭");
    expect(css).not.toContain(".mobile-ai-pool-card:has(.mobile-ai-profile-card[open])");
  });
});
