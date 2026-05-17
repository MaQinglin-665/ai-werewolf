export type RoomMetricsAccess =
  | {
      allowed: true;
      mode: "token" | "dev-open";
    }
  | {
      allowed: false;
      reason: "missing-token" | "not-configured" | "wrong-token";
    };

export function checkRoomMetricsAccess(token: string | undefined): RoomMetricsAccess {
  const configuredToken = process.env.AI_WEREWOLF_METRICS_TOKEN?.trim();
  if (!configuredToken) {
    if (process.env.NODE_ENV === "production") {
      return { allowed: false, reason: "not-configured" };
    }
    return { allowed: true, mode: "dev-open" };
  }

  const cleanToken = token?.trim();
  if (!cleanToken) return { allowed: false, reason: "missing-token" };
  if (cleanToken !== configuredToken) return { allowed: false, reason: "wrong-token" };
  return { allowed: true, mode: "token" };
}

export function readRoomMetricsRequestToken(request: Request): string | undefined {
  const url = new URL(request.url);
  return url.searchParams.get("token") ?? request.headers.get("x-ai-werewolf-metrics-token") ?? undefined;
}
