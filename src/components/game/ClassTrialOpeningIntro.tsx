"use client";

import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import type { ClassTrialIntroConfig } from "./classTrialIntro";

export type ClassTrialOpeningIntroProps = {
  config: ClassTrialIntroConfig;
  onComplete: () => void;
  onSkip: () => void;
};

type IntroStyle = CSSProperties & {
  "--class-trial-intro-theme": string;
  "--class-trial-intro-accent": string;
};

const REDUCED_MOTION_MIN_DURATION_MS = 350;
const REDUCED_MOTION_MAX_DURATION_MS = 1200;
const INTRO_AUDIO_VOLUME = 1;

export function getNextClassTrialIntroIndex(
  currentIndex: number,
  total: number,
): { index: number; complete: boolean } {
  if (total <= 0) return { index: 0, complete: true };

  const safeIndex = Math.min(Math.max(0, currentIndex), total - 1);
  if (safeIndex >= total - 1) return { index: safeIndex, complete: true };

  return { index: safeIndex + 1, complete: false };
}

export function ClassTrialOpeningIntro({ config, onComplete, onSkip }: ClassTrialOpeningIntroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const runGuardRef = useRef(0);

  const characters = config.characters;
  const activeCharacter = characters[activeIndex];

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => setReducedMotion(mediaQuery.matches);

    updateReducedMotion();
    mediaQuery.addEventListener("change", updateReducedMotion);
    return () => mediaQuery.removeEventListener("change", updateReducedMotion);
  }, []);

  useEffect(() => {
    if (!activeCharacter) {
      onComplete();
      return;
    }

    const runId = runGuardRef.current + 1;
    runGuardRef.current = runId;
    stopCurrentPlayback(audioRef, timerRef);

    if (typeof Audio !== "undefined") {
      const audio = new Audio(activeCharacter.audioUrl);
      audio.volume = INTRO_AUDIO_VOLUME;
      audioRef.current = audio;
      void audio.play().catch(() => undefined);
    }

    timerRef.current = window.setTimeout(() => {
      if (runGuardRef.current !== runId) return;

      const next = getNextClassTrialIntroIndex(activeIndex, characters.length);
      if (next.complete) {
        runGuardRef.current += 1;
        stopCurrentPlayback(audioRef, timerRef);
        onComplete();
        return;
      }

      setActiveIndex(next.index);
    }, getClassTrialIntroDuration(activeCharacter.durationMs, reducedMotion));

    return () => {
      if (runGuardRef.current === runId) {
        stopCurrentPlayback(audioRef, timerRef);
      }
    };
  }, [activeCharacter, activeIndex, characters.length, onComplete, reducedMotion]);

  if (!activeCharacter) return null;

  const sectionStyle: IntroStyle = {
    "--class-trial-intro-theme": activeCharacter.themeColor,
    "--class-trial-intro-accent": activeCharacter.accentColor,
  };

  const handleSkip = () => {
    runGuardRef.current += 1;
    stopCurrentPlayback(audioRef, timerRef);
    onSkip();
  };

  return (
    <section
      className={`class-trial-opening-intro class-trial-opening-intro-${activeCharacter.pattern}`}
      style={sectionStyle}
      aria-label="学级裁判开场片头"
    >
      <div className="class-trial-opening-intro-bg" aria-hidden="true" />
      <div className="class-trial-opening-intro-slice" aria-hidden="true" />
      <div className="class-trial-opening-intro-shadow" aria-hidden="true" />
      <div className="class-trial-opening-intro-character">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="class-trial-opening-intro-portrait"
          src={activeCharacter.portraitUrl}
          alt={activeCharacter.displayNameJa}
        />
      </div>
      <div className="class-trial-opening-intro-title-band">
        <span>{activeCharacter.titleJa}</span>
        <strong>{activeCharacter.displayNameJa}</strong>
      </div>
      <p className="class-trial-opening-intro-subtitle">{activeCharacter.subtitleJa}</p>
      <div className="class-trial-opening-intro-progress" aria-label="片头进度">
        {characters.map((character, index) => (
          <span
            key={character.id}
            className={index <= activeIndex ? "class-trial-opening-intro-progress-active" : undefined}
            aria-label={character.displayNameJa}
          />
        ))}
      </div>
      <button type="button" className="class-trial-opening-intro-skip" onClick={handleSkip}>
        跳过
      </button>
    </section>
  );
}

function getClassTrialIntroDuration(durationMs: number, reducedMotion: boolean): number {
  const safeDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : REDUCED_MOTION_MAX_DURATION_MS;
  if (!reducedMotion) return safeDuration;

  return Math.min(REDUCED_MOTION_MAX_DURATION_MS, Math.max(REDUCED_MOTION_MIN_DURATION_MS, safeDuration));
}

function stopCurrentPlayback(
  audioRef: MutableRefObject<HTMLAudioElement | null>,
  timerRef: MutableRefObject<number | null>,
) {
  if (timerRef.current) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = "";
    audioRef.current = null;
  }
}
