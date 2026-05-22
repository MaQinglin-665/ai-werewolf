import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
});
