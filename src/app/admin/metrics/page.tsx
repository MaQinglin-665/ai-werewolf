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

export default async function AdminMetricsPage({ searchParams }: AdminMetricsPageProps) {
  const params = await searchParams;
  const tokenParam = params.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const access = checkRoomMetricsAccess(token);
  if (!access.allowed) notFound();

  const metrics = await getRoomMetricsSnapshot();
  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-6 text-[#171914] sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-[#dfe4d8] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#65705c]">Admin Metrics</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">AI 狼人杀数据面板</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f6759]">
              只统计房间使用情况，不记录 IP。当前在线人数来自房间 SSE/presence，未进入房间的普通首页访问不会计入。
            </p>
          </div>
          <div className="rounded-md border border-[#dfe4d8] bg-white px-3 py-2 text-xs text-[#65705c]">
            更新时间：{formatDateTime(metrics.checkedAt)}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="累计玩家" value={metrics.history.totalPlayersEver} detail="创建房间和加入房间的去重玩家" />
          <MetricCard label="累计房间" value={metrics.history.totalRoomsEver} detail="从统计开启后记录的房间" />
          <MetricCard label="当前在线" value={metrics.current.onlinePlayers} detail={`${metrics.current.onlineConnections} 条实时连接`} />
          <MetricCard label="平均完局时长" value={formatMinutes(metrics.history.averageFinishedGameMinutes)} detail="仅统计有开始和结束记录的房间" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
          <Panel title="当前房间">
            <div className="grid grid-cols-2 gap-3">
              <CompactStat label="房间总数" value={metrics.current.rooms.total} />
              <CompactStat label="大厅中" value={metrics.current.rooms.lobby} />
              <CompactStat label="游戏中" value={metrics.current.rooms.activeInGame} />
              <CompactStat label="已结束未清理" value={metrics.current.rooms.finished} />
              <CompactStat label="当前真人玩家" value={metrics.current.humanPlayers} />
              <CompactStat label="统计存储" value={formatAnalyticsAdapter(metrics.history.adapter)} />
            </div>
          </Panel>

          <Panel title="最近 7 天">
            <RecentDaysChart metrics={metrics} />
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <MetricCard label="开局数" value={metrics.history.gamesStarted} detail="房主点击开始后记录" />
          <MetricCard label="完局数" value={metrics.history.gamesFinished} detail="检测到游戏胜负结果后记录" />
          <MetricCard label="统计起点" value={metrics.history.trackedSince ? formatDate(metrics.history.trackedSince) : "暂无"} detail="数据面板启用后的第一条事件" />
        </section>
      </div>
    </main>
  );
}

function MetricCard({ detail, label, value }: { detail: string; label: string; value: number | string }) {
  return (
    <article className="rounded-lg border border-[#dfe4d8] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#7a846f]">{label}</p>
      <div className="mt-3 text-3xl font-black tracking-normal text-[#171914]">{value}</div>
      <p className="mt-2 text-xs leading-5 text-[#65705c]">{detail}</p>
    </article>
  );
}

function CompactStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-[#dfe4d8] bg-[#f8faf5] p-3">
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-bold text-[#65705c]">{label}</div>
    </div>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-[#dfe4d8] bg-white p-4 shadow-sm">
      <h2 className="text-base font-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RecentDaysChart({ metrics }: { metrics: RoomMetricsSnapshot }) {
  const maxValue = Math.max(
    1,
    ...metrics.history.recentDays.map(
      (day) => day.roomsCreated + day.playersJoined + day.gamesStarted + day.gamesFinished,
    ),
  );
  return (
    <div className="space-y-3">
      {metrics.history.recentDays.map((day) => {
        const total = day.roomsCreated + day.playersJoined + day.gamesStarted + day.gamesFinished;
        return (
          <div key={day.date} className="grid grid-cols-[82px_1fr_42px] items-center gap-3">
            <div className="text-xs font-bold text-[#65705c]">{day.date.slice(5)}</div>
            <div className="h-8 overflow-hidden rounded-md border border-[#dfe4d8] bg-[#f4f6f0]">
              <div className="flex h-full" style={{ width: `${Math.max(6, (total / maxValue) * 100)}%` }}>
                <ChartSegment color="#2f6f4f" value={day.roomsCreated} total={total} />
                <ChartSegment color="#3e69a6" value={day.playersJoined} total={total} />
                <ChartSegment color="#d89a32" value={day.gamesStarted} total={total} />
                <ChartSegment color="#c8553d" value={day.gamesFinished} total={total} />
              </div>
            </div>
            <div className="text-right text-sm font-black">{total}</div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-3 pt-2 text-xs font-bold text-[#65705c]">
        <Legend color="#2f6f4f" label="建房" />
        <Legend color="#3e69a6" label="加入" />
        <Legend color="#d89a32" label="开局" />
        <Legend color="#c8553d" label="完局" />
      </div>
    </div>
  );
}

function ChartSegment({ color, total, value }: { color: string; total: number; value: number }) {
  if (value <= 0 || total <= 0) return null;
  return <div className="h-full" style={{ backgroundColor: color, width: `${(value / total) * 100}%` }} title={String(value)} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
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
