export type ClassTrialAudioLookaheadAction = {
  type: string;
};

export type ClassTrialAudioLookaheadSnapshot = {
  enabled: boolean;
  classTrialThemeActive: boolean;
  roleIntroActive: boolean;
  availableActions: ClassTrialAudioLookaheadAction[];
  sourceSpeechKey?: string;
  activeBufferedKey?: string | null;
};

export type ClassTrialAudioLookaheadSpeechStepSnapshot = {
  enabled: boolean;
  classTrialThemeActive: boolean;
  roleIntroActive: boolean;
  phase?: string;
  currentSpeakerSeatId?: number | null;
  availableActions: ClassTrialAudioLookaheadAction[];
  hasPendingSpeechCue: boolean;
};

export type ClassTrialAudioLookaheadRun<T> = {
  gameId: string;
  sourceSpeechKey: string;
  runId: number;
  promise: Promise<T>;
};

export function shouldStartClassTrialAudioLookahead(snapshot: ClassTrialAudioLookaheadSnapshot): boolean {
  if (!snapshot.enabled || !snapshot.classTrialThemeActive || snapshot.roleIntroActive) return false;
  if (!snapshot.sourceSpeechKey) return false;
  if (snapshot.activeBufferedKey) return false;
  return snapshot.availableActions.length === 1 && snapshot.availableActions[0]?.type === "continue";
}

export function shouldAdvanceClassTrialLookaheadToSpeech(
  snapshot: ClassTrialAudioLookaheadSpeechStepSnapshot,
): boolean {
  if (!snapshot.enabled || !snapshot.classTrialThemeActive || snapshot.roleIntroActive) return false;
  if (snapshot.hasPendingSpeechCue) return false;
  if (snapshot.phase !== "DAY_SPEECH" || !snapshot.currentSpeakerSeatId) return false;
  return snapshot.availableActions.length === 1 && snapshot.availableActions[0]?.type === "continue";
}

export function buildClassTrialLookaheadCompletedSpeechKeys(
  completedSpeechKeys: ReadonlySet<string>,
  sourceSpeechKey: string,
): Set<string> {
  const next = new Set(completedSpeechKeys);
  next.add(sourceSpeechKey);
  return next;
}

export function isMatchingClassTrialAudioLookahead<T>(
  run: ClassTrialAudioLookaheadRun<T> | null | undefined,
  options: {
    gameId: string;
    sourceSpeechKey: string;
    runId: number;
    activeRunId: number;
  },
): boolean {
  if (!run) return false;
  return (
    run.gameId === options.gameId &&
    run.sourceSpeechKey === options.sourceSpeechKey &&
    run.runId === options.runId &&
    options.activeRunId === options.runId
  );
}
