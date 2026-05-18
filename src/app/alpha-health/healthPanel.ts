export type StatusTone = "good" | "warn" | "bad" | "neutral";

export type AlphaHealthStatus = {
  cleanup?: {
    enabled?: boolean;
    lastRunAt?: string;
    policy?: {
      finishedIdleMs?: number;
      inGameIdleMs?: number;
      lobbyIdleMs?: number;
    };
    removedLastRun?: number;
    roomCodesLastRun?: string[];
  };
  deployment?: {
    multiInstanceSafe?: boolean;
    onlineReady?: boolean;
    processLocalEvents?: boolean;
    productionMinimumReady?: boolean;
    publicOrigin?: string;
    publicOriginConfigured?: boolean;
    requirements?: Record<string, boolean | undefined>;
    target?: string;
    warnings?: string[];
  };
  ok: boolean;
  presence?: {
    adapter?: string;
    heartbeatMs?: number;
    shared?: boolean;
    ttlMs?: number;
  };
  rateLimit?: {
    adapter?: string;
    enabled?: boolean;
    shared?: boolean;
    windowMs?: number;
  };
  realtime?: {
    channel?: string;
    crossProcessFanout?: boolean;
    heartbeatMs?: number;
    mode?: string;
    roomsWithSubscribers?: number;
    subscriberCount?: number;
  };
  rooms?: {
    finished?: number;
    inGame?: number;
    lobby?: number;
    maxRevision?: number;
    total?: number;
  };
  storage?: {
    adapter?: string;
    atomicWrites?: boolean;
    enabled?: boolean;
    envPathConfigured?: boolean;
    mode?: string;
    revisionMode?: string;
    revisioned?: boolean;
    writeMode?: string;
  };
};

export type ReadinessSummary = {
  description: string;
  label: string;
  tone: StatusTone;
};

export type SmokeCommand = {
  command: string;
  label: string;
  tone: StatusTone;
};

export type RequirementRow = {
  key: string;
  label: string;
  ok: boolean;
};

const REQUIREMENT_LABELS: Array<[string, string]> = [
  ["atomicRoomWrites", "原子房间写入"],
  ["persistentRoomStore", "房间状态持久化"],
  ["postgresRoomState", "PostgreSQL 房间状态"],
  ["sharedRealtime", "跨进程房间通知"],
  ["sharedPresence", "共享在线状态"],
  ["basicRateLimit", "基础限流"],
  ["sharedRateLimit", "共享限流"],
  ["httpsPublicOrigin", "HTTPS 公网入口"],
  ["singleNodeProcess", "单 Node 运行约束"],
  ["sseRealtime", "SSE 实时通道"],
];

export function selectReadinessSummary(health: AlphaHealthStatus): ReadinessSummary {
  if (!health.ok) {
    return {
      description: "健康接口未返回 ok=true，先看服务日志和启动状态。",
      label: "不可用",
      tone: "bad",
    };
  }

  if (health.deployment?.productionMinimumReady) {
    return {
      description: "PostgreSQL 房间状态、跨进程通知、共享 presence、共享限流和公网入口都已满足。",
      label: "生产最小闭环就绪",
      tone: "good",
    };
  }

  if (health.deployment?.onlineReady) {
    return {
      description: "公网单节点条件满足，但还没有达到 PostgreSQL 生产最小闭环。",
      label: "线上单节点就绪",
      tone: "warn",
    };
  }

  if (health.deployment?.target === "single-node-online") {
    return {
      description: "已声明线上模式，但还有部署要求未满足。",
      label: "线上配置未完成",
      tone: "warn",
    };
  }

  return {
    description: "当前适合本地、局域网或单进程 Alpha 验证，不应当按多实例生产环境宣传。",
    label: "本地 Alpha",
    tone: "neutral",
  };
}

export function buildSmokeCommands(health: AlphaHealthStatus, requestOrigin?: string): SmokeCommand[] {
  const origin = normalizeOrigin(health.deployment?.publicOrigin) ?? normalizeOrigin(requestOrigin);
  if (!origin) return [{ label: "等待访问来源", command: "npm run smoke:alpha", tone: "neutral" }];

  const prefix = `$env:ROOM_SMOKE_BASE_URL="${origin}";`;

  if (health.deployment?.productionMinimumReady) {
    return [
      { label: "生产预检", command: `${prefix} npm run preflight:production`, tone: "good" },
      { label: "房间 SSE", command: `${prefix} npm run smoke:room-sse`, tone: "good" },
      { label: "Alpha 聚合", command: `${prefix} npm run smoke:alpha`, tone: "neutral" },
    ];
  }

  if (health.deployment?.target === "single-node-online" && health.deployment.onlineReady) {
    return [{ label: "线上单节点", command: `${prefix} npm run smoke:online`, tone: "good" }];
  }

  if (!isLocalOrigin(origin)) {
    return [{ label: "公网/隧道", command: `${prefix} npm run smoke:tunnel`, tone: "warn" }];
  }

  return [{ label: "本地 Alpha", command: `${prefix} npm run smoke:alpha`, tone: "neutral" }];
}

export function buildRequirementRows(health: AlphaHealthStatus): RequirementRow[] {
  const requirements = health.deployment?.requirements ?? {};
  return REQUIREMENT_LABELS.map(([key, label]) => ({
    key,
    label,
    ok: requirements[key] === true,
  }));
}

export function countPassedRequirements(rows: RequirementRow[]): { passed: number; total: number } {
  return {
    passed: rows.filter((row) => row.ok).length,
    total: rows.length,
  };
}

export function formatDuration(ms: number | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "未配置";
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} 小时`;
  return `${Math.round(hours / 24)} 天`;
}

export function formatBoolean(value: boolean | undefined, yes = "是", no = "否"): string {
  return value ? yes : no;
}

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function isLocalOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]" || hostname === "0.0.0.0";
  } catch {
    return false;
  }
}
