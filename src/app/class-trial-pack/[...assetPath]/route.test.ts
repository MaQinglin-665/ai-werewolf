import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveClassTrialPackPath } from "./route";

describe("class trial local pack route", () => {
  it("allows files under local-assets/class-trial-pack", () => {
    const filePath = resolveClassTrialPackPath(["portraits", "naegi.png"]);

    expect(filePath).toBe(path.resolve(process.cwd(), "local-assets", "class-trial-pack", "portraits", "naegi.png"));
  });

  it("allows intro audio files under the local class-trial pack", () => {
    expect(resolveClassTrialPackPath(["intro", "audio", "naegi.wav"])).toBe(
      path.resolve(process.cwd(), "local-assets", "class-trial-pack", "intro", "audio", "naegi.wav"),
    );
    expect(resolveClassTrialPackPath(["intro", "audio", "naegi.mp3"])).toBe(
      path.resolve(process.cwd(), "local-assets", "class-trial-pack", "intro", "audio", "naegi.mp3"),
    );
  });

  it("blocks traversal and unsupported extensions", () => {
    expect(resolveClassTrialPackPath(["..", ".env"])).toBeNull();
    expect(resolveClassTrialPackPath(["intro", "audio", "..", ".env"])).toBeNull();
    expect(resolveClassTrialPackPath(["portraits\\secret.png"])).toBeNull();
    expect(resolveClassTrialPackPath(["portraits", "naegi.svg"])).toBeNull();
  });
});
