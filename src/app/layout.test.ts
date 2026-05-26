import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("RootLayout", () => {
  test("allows browser translation extensions to add root attributes without a dev overlay", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "src", "app", "layout.tsx"), "utf8");

    expect(layout).toContain("<html");
    expect(layout).toContain("<body");
    expect(layout.match(/suppressHydrationWarning/g)).toHaveLength(2);
  });
});
