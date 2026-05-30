import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAiSpeechAudioContentType, resolveAiSpeechAudioCachePath } from "./route";

describe("AI speech audio cache route", () => {
  it("allows generated mp3 and wav files under public audio cache", () => {
    expect(resolveAiSpeechAudioCachePath("naegi-951f83c9c9ca68bf644f416d.wav")).toBe(
      path.resolve(process.cwd(), "public", "audio", "ai-speech", "naegi-951f83c9c9ca68bf644f416d.wav"),
    );
    expect(resolveAiSpeechAudioCachePath("mimo_default-abc123.mp3")).toBe(
      path.resolve(process.cwd(), "public", "audio", "ai-speech", "mimo_default-abc123.mp3"),
    );
  });

  it("blocks traversal and unsupported audio names", () => {
    expect(resolveAiSpeechAudioCachePath("../.env")).toBeNull();
    expect(resolveAiSpeechAudioCachePath("..%2F.env")).toBeNull();
    expect(resolveAiSpeechAudioCachePath("subdir\\voice.wav")).toBeNull();
    expect(resolveAiSpeechAudioCachePath("voice.ogg")).toBeNull();
  });

  it("sets browser-playable content types", () => {
    expect(getAiSpeechAudioContentType("voice.wav")).toBe("audio/wav");
    expect(getAiSpeechAudioContentType("voice.mp3")).toBe("audio/mpeg");
  });
});
