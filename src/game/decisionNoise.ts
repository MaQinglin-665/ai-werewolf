type DecisionPart = string | number | boolean | null | undefined;

export function stableRoll(parts: DecisionPart[]): number {
  let hash = 2166136261;
  const text = parts.map((part) => String(part ?? "")).join("|");

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967296;
}

export function stableSignedJitter(parts: DecisionPart[], magnitude: number): number {
  return (stableRoll(parts) - 0.5) * 2 * magnitude;
}

export function clampProbability(value: number): number {
  return Math.max(0, Math.min(1, value));
}
