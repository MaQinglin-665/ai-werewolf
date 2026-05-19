import { headers } from "next/headers";
import Link from "next/link";
import { getRoomRuntimeStatus } from "@/server/roomService";
import {
  buildRequirementRows,
  buildSmokeCommands,
  countPassedRequirements,
  formatBoolean,
  formatDuration,
  selectReadinessSummary,
  type AlphaHealthStatus,
  type StatusTone,
} from "./healthPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Alpha 健康 | AI 狼人杀",
};

const toneClasses: Record<StatusTone, string> = {
  bad: "border-red-400/40 bg-red-500/10 text-red-100",
  good: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  neutral: "border-white/15 bg-white/7 text-zinc-100",
  warn: "border-amber-300/40 bg-amber-400/10 text-amber-100",
};

export default async function AlphaHealthPage() {
  const health = (await getRoomRuntimeStatus()) satisfies AlphaHealthStatus;
  const requestOrigin = await readRequestOrigin();
  const readiness = selectReadinessSummary(health);
  const commands = buildSmokeCommands(health, requestOrigin);
  const requirements = buildRequirementRows(health);
  const requirementCount = countPassedRequirements(requirements);
  const checkedAt = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Shanghai",
  }).format(new Date());

  return (
    <main className="min-h-screen bg-[#101112] text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a45d]">AI Werewolf Ops</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-white sm:text-4xl">Alpha 健康面板</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
              用来判断当前服务是冷启动、单节点 Alpha，还是已经满足可公网试玩的生产最小闭环。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-md border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-500/20" href="/alpha-playtest">
              试玩说明
            </Link>
            <Link className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold text-zinc-100 hover:bg-white/10" href="/rooms">
              联机房间
            </Link>
            <Link className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold text-zinc-100 hover:bg-white/10" href="/">
              单人入口
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Panel>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-zinc-400">当前状态</p>
                <h2 className="mt-2 text-2xl font-black text-white">{readiness.label}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">{readiness.description}</p>
              </div>
              <Pill tone={readiness.tone}>{health.ok ? "HEALTH OK" : "CHECK LOGS"}</Pill>
            </div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="部署模式" value={health.deployment?.target ?? "unknown"} />
              <Metric
                label="生产最小闭环"
                value={formatBoolean(health.deployment?.productionMinimumReady, "ready", "not ready")}
                tone={health.deployment?.productionMinimumReady ? "good" : "warn"}
              />
              <Metric
                label="多实例安全"
                value={formatBoolean(health.deployment?.multiInstanceSafe, "safe", "single-node")}
                tone={health.deployment?.multiInstanceSafe ? "good" : "warn"}
              />
              <Metric label="检查时间" value={checkedAt} />
            </dl>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-zinc-400">部署要求</p>
                <h2 className="mt-2 text-xl font-black text-white">
                  {requirementCount.passed}/{requirementCount.total} 已满足
                </h2>
              </div>
              <Pill tone={requirementCount.passed === requirementCount.total ? "good" : "warn"}>
                {requirementCount.passed === requirementCount.total ? "COMPLETE" : "PARTIAL"}
              </Pill>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {requirements.map((requirement) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2"
                  key={requirement.key}
                >
                  <span className="text-xs font-bold text-zinc-300">{requirement.label}</span>
                  <span className={requirement.ok ? "text-xs font-black text-emerald-200" : "text-xs font-black text-amber-200"}>
                    {requirement.ok ? "OK" : "WAIT"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel>
            <PanelTitle title="房间状态" />
            <dl className="mt-4 grid gap-3">
              <Metric label="总房间" value={health.rooms?.total ?? 0} />
              <Metric label="大厅 / 游戏中" value={`${health.rooms?.lobby ?? 0} / ${health.rooms?.inGame ?? 0}`} />
              <Metric label="最大 revision" value={health.rooms?.maxRevision ?? 0} />
              <Metric label="本次清理" value={`${health.cleanup?.removedLastRun ?? 0} 个房间`} />
            </dl>
          </Panel>

          <Panel>
            <PanelTitle title="存储与同步" />
            <dl className="mt-4 grid gap-3">
              <Metric label="房间存储" value={`${health.storage?.adapter ?? "unknown"} · ${health.storage?.mode ?? "unknown"}`} />
              <Metric
                label="单机存档"
                value={`${health.mainGameStorage?.adapter ?? "unknown"} · ${health.mainGameStorage?.mode ?? "unknown"}`}
                tone={health.mainGameStorage?.durableAcrossInstanceRestart ? "good" : "warn"}
              />
              <Metric label="写入模式" value={health.storage?.writeMode ?? "unknown"} tone={health.storage?.atomicWrites ? "good" : "warn"} />
              <Metric
                label="实时通道"
                value={`${health.realtime?.mode ?? "unknown"} · ${health.realtime?.subscriberCount ?? 0} subscribers`}
                tone={health.realtime?.crossProcessFanout ? "good" : "warn"}
              />
              <Metric
                label="存档耐重启"
                value={formatBoolean(health.mainGameStorage?.durableAcrossInstanceRestart, "已开启", "未开启")}
                tone={health.mainGameStorage?.durableAcrossInstanceRestart ? "good" : "warn"}
              />
            </dl>
          </Panel>

          <Panel>
            <PanelTitle title="Presence 与限流" />
            <dl className="mt-4 grid gap-3">
              <Metric
                label="Presence"
                value={`${health.presence?.adapter ?? "unknown"} · ${formatBoolean(health.presence?.shared, "shared", "local")}`}
                tone={health.presence?.shared ? "good" : "warn"}
              />
              <Metric label="Presence TTL" value={formatDuration(health.presence?.ttlMs)} />
              <Metric
                label="限流"
                value={`${formatBoolean(health.rateLimit?.enabled, "enabled", "disabled")} · ${health.rateLimit?.adapter ?? "unknown"}`}
                tone={health.rateLimit?.enabled ? "good" : "warn"}
              />
              <Metric label="限流窗口" value={formatDuration(health.rateLimit?.windowMs)} />
            </dl>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Panel>
            <PanelTitle title="下一条验证命令" />
            <div className="mt-4 grid gap-3">
              {commands.map((item) => (
                <div className="rounded-md border border-white/10 bg-black/30 p-3" key={item.label}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-white">{item.label}</span>
                    <Pill tone={item.tone}>{item.tone === "good" ? "PREFERRED" : "CHECK"}</Pill>
                  </div>
                  <code className="block whitespace-pre-wrap break-all rounded bg-black/45 p-3 text-xs leading-5 text-emerald-100">
                    {item.command}
                  </code>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelTitle title="告警与限制" />
            {health.deployment?.warnings?.length ? (
              <ul className="mt-4 grid gap-2">
                {health.deployment.warnings.map((warning) => (
                  <li className="rounded-md border border-amber-300/15 bg-amber-400/10 px-3 py-2 text-sm leading-6 text-amber-50" key={warning}>
                    {warning}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-md border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
                当前健康接口没有返回部署告警。
              </p>
            )}
            <div className="mt-4 grid gap-3 text-sm text-zinc-300">
              <InfoRow label="公网入口" value={health.deployment?.publicOrigin ?? "未配置"} />
              <InfoRow label="请求来源" value={requestOrigin ?? "未识别"} />
              <InfoRow label="上次清理" value={health.cleanup?.lastRunAt ?? "尚未记录"} />
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0 rounded-lg border border-white/10 bg-[#17191b] p-4 shadow-[0_16px_60px_rgba(0,0,0,0.25)]">{children}</div>;
}

function PanelTitle({ title }: { title: string }) {
  return <h2 className="text-lg font-black text-white">{title}</h2>;
}

function Pill({ children, tone }: { children: React.ReactNode; tone: StatusTone }) {
  return <span className={`rounded-md border px-2.5 py-1 text-xs font-black ${toneClasses[tone]}`}>{children}</span>;
}

function Metric({ label, tone = "neutral", value }: { label: string; tone?: StatusTone; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <dt className="text-xs font-bold text-zinc-500">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-black ${metricToneClass(tone)}`}>{value}</dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-white/10 bg-black/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-bold text-zinc-500">{label}</span>
      <span className="break-all text-sm font-bold text-zinc-100">{value}</span>
    </div>
  );
}

function metricToneClass(tone: StatusTone): string {
  switch (tone) {
    case "bad":
      return "text-red-100";
    case "good":
      return "text-emerald-100";
    case "warn":
      return "text-amber-100";
    case "neutral":
      return "text-zinc-100";
  }
}

async function readRequestOrigin(): Promise<string | undefined> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return undefined;
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
