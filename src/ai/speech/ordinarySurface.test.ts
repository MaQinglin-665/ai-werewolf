import { describe, expect, it } from "vitest";
import { isOrdinaryTruncatedSpeechEnding } from "./ordinarySurface";

describe("ordinary speech surface validation", () => {
  it("flags check-line contrast endings that stop before landing the current judgment", () => {
    expect(
      isOrdinaryTruncatedSpeechEnding(
        "12号，最后一位，我有警徽，我直接说今天的票口。我上一轮从支持Claude改成施压Claude，当时是因为Kimi跳预言家报Claude查杀、豆包遗言也是Claude查杀，两条线压同一个人，我觉得比Claude单方面报查杀硬。但现在Claude夜死留了两条查杀",
      ),
    ).toBe(true);
  });
});
