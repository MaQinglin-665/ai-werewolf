import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FeedbackTemplateClient } from "./FeedbackTemplateClient";

describe("FeedbackTemplateClient", () => {
  it("prefills the current single-player feedback id", () => {
    withFakeWindow("game-current-feedback", () => {
      const html = renderToStaticMarkup(createElement(FeedbackTemplateClient));

      expect(html).toContain("反馈编号");
      expect(html).toContain('value="game-current-feedback"');
      expect(html).toContain("反馈编号：game-current-feedback");
    });
  });
});

function withFakeWindow(currentGameId: string, run: () => void): void {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => (key === "ai-werewolf-game-id" ? currentGameId : null),
    },
    navigator: { userAgent: "test-browser" },
  });
  try {
    run();
  } finally {
    vi.unstubAllGlobals();
  }
}
