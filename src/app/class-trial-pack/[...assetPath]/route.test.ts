import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveClassTrialPackPath } from "./route";

describe("class trial local pack route", () => {
  it("allows files under local-assets/class-trial-pack", () => {
    const filePath = resolveClassTrialPackPath(["portraits", "苗木诚.png"]);

    expect(filePath).toBe(path.resolve(process.cwd(), "local-assets", "class-trial-pack", "portraits", "苗木诚.png"));
  });

  it("blocks traversal and unsupported extensions", () => {
    expect(resolveClassTrialPackPath(["..", ".env"])).toBeNull();
    expect(resolveClassTrialPackPath(["portraits\\secret.png"])).toBeNull();
    expect(resolveClassTrialPackPath(["portraits", "苗木诚.svg"])).toBeNull();
  });
});
