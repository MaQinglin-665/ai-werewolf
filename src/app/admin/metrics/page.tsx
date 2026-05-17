import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { checkRoomMetricsAccess } from "@/server/roomMetricsAccess";
import type { RoomMetricsSnapshot } from "@/server/roomService";
import { getRoomMetricsSnapshot } from "@/server/roomService";

export const metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "数据面板 | AI 狼人杀",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminMetricsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type PrimaryMetric = {
  accent: string;
  detail: string;
  label: string;
  tone: string;
  value: number | string;
};

type FunnelStep = {
  label: string;
  note: string;
  value: number;
};

const MAX_FREE_ONLINE_TARGET = 10;

export default async function AdminMetricsPage({ searchParams }: AdminMetricsPageProps) {
  const params = await searchParams;
  const tokenParam = params.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const access = checkRoomMetricsAccess(token);
  if (!access.allowed) notFound();

  const metrics = await getRoomMetricsSnapshot();
  const primaryMetrics: PrimaryMetric[] = [
    {
      accent: "#76e4a4",
      detail: "用户打开主界面的次数",
      label: "首页打开",
      tone: "from-[#0f3727] to-[#12231d]",
      value: metrics.history.homeViews,
    },
    {
      accent: "#79b7ff",
      detail: "主界面单人/观战模式创建的对局",
      label: "主界面开局",
      tone: "from-[#102b4a] to-[#111f31]",
      value: metrics.history.mainGamesStarted,
    },
    {
      accent: "#f2c56f",
      detail: `完成率 ${formatPercent(metrics.history.mainCompletionRate)}`,
      label: "主界面完局",
      tone: "from-[#4a3514] to-[#261f14]",
      value: metrics.history.mainGamesFinished,
    },
    {
      accent: "#f27e6f",
      detail: `${metrics.current.onlineConnections} 条联机实时连接`,
      label: "联机在线",
      tone: "from-[#4a1d19] to-[#251817]",
      value: metrics.current.onlinePlayers,
    },
  ];
  const mainFunnelSteps: FunnelStep[] = [
    { label: "打开", note: "Home View", value: metrics.history.homeViews },
    { label: "开局", note: "Main Game Started", value: metrics.history.mainGamesStarted },
    { label: "完局", note: "Main Game Finished", value: metrics.history.mainGamesFinished },
  ];
  const roomFunnelSteps: FunnelStep[] = [
    { label: "建房", note: "Room Created", value: metrics.history.totalRoomsEver },
    { label: "加入", note: "Room Players", value: metrics.history.totalPlayersEver },
    { label: "开局", note: "Room Started", value: metrics.history.gamesStarted },
    { label: "完局", note: "Room Finished", value: metrics.history.gamesFinished },
  ];
  const onlinePercent = Math.min(100, Math.round((metrics.current.onlinePlayers / MAX_FREE_ONLINE_TARGET) * 100));
  const roomStatusTotal = Math.max(1, metrics.current.rooms.total);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070a0f] text-[#edf3ea]">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:48px_48px] opacity-45" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(8,11,18,0.12),#070a0f_82%),radial-gradient(ellipse_at_top,rgba(118,228,164,0.12),transparent_46%)]" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-4 border-b border-white/10 pb-5 lg:grid-cols-[1fr_340px] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#76e4a4]/30 bg-[#10271d] px-3 py-1 text-xs font-black uppercase tracking-normal text-[#a9f4bf]">
                Owner Only
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-[#aeb8ad]">
                {formatAnalyticsAdapter(metrics.history.adapter)}
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl">
              AI 狼人杀运营驾驶舱
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#aeb8ad]">
              私有数据面板，统计主界面打开、主界面开局/完局、联机房间创建/加入/开局/完局和房间在线 presence；不记录 IP。
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-[#7f8a7f]">Live Snapshot</p>
                <p className="mt-1 text-sm font-bold text-white">{formatDateTime(metrics.checkedAt)}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#76e4a4]/25 bg-[#10271d] px-3 py-1 text-xs font-black text-[#a9f4bf]">
                <span className="h-2 w-2 rounded-full bg-[#76e4a4] shadow-[0_0_18px_rgba(118,228,164,0.85)]" />
                在线监测
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniHeaderStat label="大厅" value={metrics.current.rooms.lobby} />
              <MiniHeaderStat label="游戏中" value={metrics.current.rooms.activeInGame} />
              <MiniHeaderStat label="未清理" value={metrics.current.rooms.finished} />
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {primaryMetrics.map((item) => (
            <HeroMetricCard key={item.label} metric={item} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <GlassPanel title="实时在线容量" kicker="Room Presence">
            <div className="grid gap-4 sm:grid-cols-[190px_1fr] xl:grid-cols-1">
              <OnlineGauge percent={onlinePercent} value={metrics.current.onlinePlayers} />
              <div className="space-y-3">
                <ProgressRow
                  color="#76e4a4"
                  label="在线玩家"
                  max={MAX_FREE_ONLINE_TARGET}
                  value={metrics.current.onlinePlayers}
                />
                <ProgressRow
                  color="#79b7ff"
                  label="实时连接"
                  max={Math.max(MAX_FREE_ONLINE_TARGET, metrics.current.onlineConnections)}
                  value={metrics.current.onlineConnections}
                />
                <ProgressRow
                  color="#f2c56f"
                  label="当前真人玩家"
                  max={Math.max(1, metrics.history.totalPlayersEver, metrics.current.humanPlayers)}
                  value={metrics.current.humanPlayers}
                />
              </div>
            </div>
          </GlassPanel>

          <GlassPanel title="可用日期趋势" kicker="Daily Activity">
            <RecentDaysChart metrics={metrics} />
          </GlassPanel>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <GlassPanel title="主界面单人模式" kicker="Main Experience">
            <Funnel steps={mainFunnelSteps} />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <InsightTile label="累计游玩时长" value={formatMinutes(metrics.history.totalMainGameMinutes)} />
              <InsightTile label="平均完局时长" value={formatMinutes(metrics.history.averageMainGameMinutes)} />
              <InsightTile label="完局率" value={formatPercent(metrics.history.mainCompletionRate)} />
            </div>
          </GlassPanel>

          <GlassPanel title="联机房间模式" kicker="Rooms Experience">
            <Funnel steps={roomFunnelSteps} />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InsightTile label="累计房间" value={metrics.history.totalRoomsEver} />
              <InsightTile label="累计联机玩家" value={metrics.history.totalPlayersEver} />
            </div>
          </GlassPanel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <GlassPanel title="房间状态分布" kicker="Current Rooms">
            <div className="space-y-4">
              <RoomStatusBar
                color="#76e4a4"
                label="大厅中"
                percent={Math.round((metrics.current.rooms.lobby / roomStatusTotal) * 100)}
                value={metrics.current.rooms.lobby}
              />
              <RoomStatusBar
                color="#f2c56f"
                label="游戏中"
                percent={Math.round((metrics.current.rooms.activeInGame / roomStatusTotal) * 100)}
                value={metrics.current.rooms.activeInGame}
              />
              <RoomStatusBar
                color="#f27e6f"
                label="已结束未清理"
                percent={Math.round((metrics.current.rooms.finished / roomStatusTotal) * 100)}
                value={metrics.current.rooms.finished}
              />
              <div className="rounded-lg border border-white/10 bg-[#0c1119] p-4">
                <p className="text-xs font-black uppercase tracking-normal text-[#7f8a7f]">Tracked Since</p>
                <p className="mt-2 text-xl font-black text-white">
                  {metrics.history.trackedSince ? formatDate(metrics.history.trackedSince) : "暂无"}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#8f9a90]">历史累计从数据面板部署后的第一条房间事件开始。</p>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel title="数据口径" kicker="Definitions">
            <div className="grid gap-3 text-sm leading-6 text-[#c6d0c2]">
              <MetricDefinition label="首页打开" text="用户加载主界面 / 的次数，刷新也会计入。" />
              <MetricDefinition label="主界面开局" text="用户在主界面点击新开一局并成功创建单人/纯 AI 对局。" />
              <MetricDefinition label="主界面完局" text="主界面对局产生胜负结果。" />
              <MetricDefinition label="主界面时长" text="从主界面开局到产生胜负结果之间的累计和平均用时。" />
              <MetricDefinition label="联机在线" text="正在联机房间中保持 SSE/presence 连接的人。" />
            </div>
          </GlassPanel>
        </section>
      </div>
    </main>
  );
}

function MiniHeaderStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-2 py-3">
      <div className="text-xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs font-bold text-[#8f9a90]">{label}</div>
    </div>
  );
}

function HeroMetricCard({ metric }: { metric: PrimaryMetric }) {
  return (
    <article className={`relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br ${metric.tone} p-4 shadow-[0_24px_60px_rgba(0,0,0,0.24)]`}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: metric.accent }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-[#aeb8ad]">{metric.label}</p>
          <div className="mt-3 text-4xl font-black leading-none tracking-normal text-white">{metric.value}</div>
        </div>
        <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: metric.accent, boxShadow: `0 0 22px ${metric.accent}` }} />
      </div>
      <p className="mt-4 min-h-10 text-xs leading-5 text-[#c6d0c2]">{metric.detail}</p>
    </article>
  );
}

function GlassPanel({ children, kicker, title }: { children: ReactNode; kicker: string; title: string }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#0b1018]/92 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-[#7f8a7f]">{kicker}</p>
          <h2 className="mt-1 text-lg font-black tracking-normal text-white">{title}</h2>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function OnlineGauge({ percent, value }: { percent: number; value: number }) {
  return (
    <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-full border border-white/10 bg-[#0c1119] p-4">
      <div
        className="flex h-full w-full items-center justify-center rounded-full p-4"
        style={{
          background: `conic-gradient(#76e4a4 ${percent}%, rgba(255,255,255,0.08) ${percent}% 100%)`,
        }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#080c12] text-center">
          <div className="text-5xl font-black leading-none tracking-normal text-white">{value}</div>
          <div className="mt-2 text-xs font-black uppercase tracking-normal text-[#a9f4bf]">Online</div>
          <div className="mt-1 text-xs text-[#7f8a7f]">目标 {MAX_FREE_ONLINE_TARGET} 人内</div>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({ color, label, max, value }: { color: string; label: string; max: number; value: number }) {
  const width = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold">
        <span className="text-[#c6d0c2]">{label}</span>
        <span className="text-white">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full" style={{ backgroundColor: color, width: `${Math.max(3, width)}%` }} />
      </div>
    </div>
  );
}

function InsightTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0c1119] p-4">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs font-bold text-[#8f9a90]">{label}</div>
    </div>
  );
}

function RecentDaysChart({ metrics }: { metrics: RoomMetricsSnapshot }) {
  const maxValue = Math.max(
    1,
    ...metrics.history.recentDays.map(
      (day) =>
        day.homeViews +
        day.mainGamesStarted +
        day.mainGamesFinished +
        day.roomsCreated +
        day.playersJoined +
        day.gamesStarted +
        day.gamesFinished,
    ),
  );
  return (
    <div>
      <div
        className="grid min-h-72 items-end gap-2 border-b border-white/10 pb-4"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, metrics.history.recentDays.length)}, minmax(72px, 1fr))` }}
      >
        {metrics.history.recentDays.map((day) => {
          const total =
            day.homeViews +
            day.mainGamesStarted +
            day.mainGamesFinished +
            day.roomsCreated +
            day.playersJoined +
            day.gamesStarted +
            day.gamesFinished;
          return (
            <div key={day.date} className="flex min-w-0 flex-col items-center gap-2">
              <div className="text-xs font-black text-white">{total}</div>
              <div className="flex h-56 w-full max-w-16 items-end rounded-md border border-white/10 bg-white/[0.04] p-1">
                <div className="flex w-full flex-col justify-end overflow-hidden rounded" style={{ height: `${Math.max(5, (total / maxValue) * 100)}%` }}>
                  <StackSegment color="#f27e6f" total={total} value={day.gamesFinished} />
                  <StackSegment color="#f2c56f" total={total} value={day.gamesStarted} />
                  <StackSegment color="#3e69a6" total={total} value={day.playersJoined} />
                  <StackSegment color="#2f9f68" total={total} value={day.roomsCreated} />
                  <StackSegment color="#79b7ff" total={total} value={day.mainGamesFinished} />
                  <StackSegment color="#76e4a4" total={total} value={day.mainGamesStarted} />
                  <StackSegment color="#8f9a90" total={total} value={day.homeViews} />
                </div>
              </div>
              <div className="truncate text-xs font-bold text-[#8f9a90]">{day.date.slice(5)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-[#aeb8ad]">
        <Legend color="#8f9a90" label="首页打开" />
        <Legend color="#76e4a4" label="主开局" />
        <Legend color="#79b7ff" label="主完局" />
        <Legend color="#2f9f68" label="房间建房" />
        <Legend color="#3e69a6" label="房间加入" />
        <Legend color="#f2c56f" label="房间开局" />
        <Legend color="#f27e6f" label="房间完局" />
      </div>
    </div>
  );
}

function StackSegment({ color, total, value }: { color: string; total: number; value: number }) {
  if (value <= 0 || total <= 0) return null;
  return <div style={{ backgroundColor: color, height: `${(value / total) * 100}%` }} title={String(value)} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Funnel({ steps }: { steps: FunnelStep[] }) {
  const maxValue = Math.max(1, ...steps.map((step) => step.value));
  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const width = Math.max(10, (step.value / maxValue) * 100);
        const previous = index === 0 ? step.value : steps[index - 1].value;
        const conversion = index === 0 ? 100 : Math.round((step.value / Math.max(1, previous)) * 100);
        return (
          <div key={step.label} className="grid gap-2 sm:grid-cols-[86px_1fr_70px] sm:items-center">
            <div>
              <div className="text-sm font-black text-white">{step.label}</div>
              <div className="text-xs text-[#7f8a7f]">{step.note}</div>
            </div>
            <div className="h-10 rounded-md border border-white/10 bg-white/[0.05] p-1">
              <div
                className="flex h-full items-center justify-end rounded px-3 text-sm font-black text-[#07100c]"
                style={{
                  background: "linear-gradient(90deg, #76e4a4, #f2c56f)",
                  width: `${width}%`,
                }}
              >
                {step.value}
              </div>
            </div>
            <div className="text-right text-xs font-black text-[#a9f4bf]">{conversion}%</div>
          </div>
        );
      })}
    </div>
  );
}

function RoomStatusBar({ color, label, percent, value }: { color: string; label: string; percent: number; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[#c6d0c2]">{label}</span>
        <span className="text-sm font-black text-white">{value}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full" style={{ backgroundColor: color, width: `${Math.max(3, percent)}%` }} />
      </div>
    </div>
  );
}

function MetricDefinition({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <div className="text-sm font-black text-white">{label}</div>
      <div className="mt-1 text-xs text-[#8f9a90]">{text}</div>
    </div>
  );
}

function formatAnalyticsAdapter(value: RoomMetricsSnapshot["history"]["adapter"]): string {
  return value === "postgres" ? "PostgreSQL" : "内存";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date(value));
}

function formatMinutes(value: number | null): string {
  return value === null ? "暂无" : `${value} 分钟`;
}

function formatPercent(value: number | null): string {
  return value === null ? "暂无" : `${value}%`;
}
