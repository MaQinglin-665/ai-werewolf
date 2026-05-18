import { headers } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Alpha 试玩说明 | AI 狼人杀",
};

const smokeCommandPrefix = "$env:ROOM_SMOKE_BASE_URL";

export default async function AlphaPlaytestPage() {
  const origin = (await readRequestOrigin()) ?? "https://ai-werewolf-free.onrender.com";
  const roomsUrl = buildPublicUrl(origin, "/rooms");
  const healthUrl = buildPublicUrl(origin, "/alpha-health");
  const preflightCommand = `${smokeCommandPrefix}="${origin}"; npm run preflight:production`;
  const voteSmokeCommand = `${smokeCommandPrefix}="${origin}"; npm run smoke:alpha:vote`;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#101112] text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a45d]">AI Werewolf Alpha</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-white sm:text-4xl">试玩说明</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
              阶段二用于小范围朋友试玩：先确认入口能打开，再完成一次双端加入、夜晚行动、发言、投票和刷新恢复检查。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-md border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-500/20" href="/rooms">
              开始联机房间
            </Link>
            <Link className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold text-zinc-100 hover:bg-white/10" href="/alpha-health">
              健康面板
            </Link>
            <Link className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold text-zinc-100 hover:bg-white/10" href="/alpha-report">
              反馈模板
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <Panel title="发给朋友的链接">
            <p className="text-sm leading-6 text-zinc-300">
              直接发联机房间入口。房主创建房间后，再把房间内生成的邀请码或邀请链接发给同局玩家。
            </p>
            <code className="mt-4 block break-all rounded-md border border-white/10 bg-black/35 p-3 text-sm font-bold leading-6 text-emerald-100">
              {roomsUrl}
            </code>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link className="rounded-md border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-center text-sm font-black text-emerald-100 hover:bg-emerald-500/20" href="/rooms">
                打开房间入口
              </Link>
              <Link className="rounded-md border border-white/15 px-3 py-2 text-center text-sm font-bold text-zinc-100 hover:bg-white/10" href="/alpha-health">
                先看服务状态
              </Link>
            </div>
          </Panel>

          <Panel title="发送前确认">
            <Checklist
              items={[
                "先打开健康面板，确认 productionMinimumReady=true。",
                "首次访问如果出现 Render 冷启动页，等待服务唤醒后再刷新。",
                "本轮只做小范围试玩，不公开扩散链接。",
                "默认是 mock AI，不会产生模型费用。",
              ]}
            />
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="房主步骤">
            <OrderedSteps
              items={[
                "打开联机房间入口。",
                "输入昵称，选择 6 人新手局作为首轮验证板子。",
                "创建房间并复制邀请链接或房间码。",
                "等待朋友加入后点击开局。",
                "按页面提示完成自己的夜晚行动、发言或投票。",
              ]}
            />
          </Panel>

          <Panel title="朋友步骤">
            <OrderedSteps
              items={[
                "打开房主发来的邀请链接。",
                "输入昵称并确认自己入座。",
                "不要共用房主的恢复链接；每个玩家使用自己的浏览器视角。",
                "轮到自己时只操作当前高亮的行动面板。",
                "刷新一次页面，确认还能回到自己的视角。",
              ]}
            />
          </Panel>

          <Panel title="验收清单">
            <Checklist
              items={[
                "两端都能看到同一个房间码和玩家列表。",
                "开局后不同玩家只能看到自己的私有身份。",
                "至少完成一次真人夜晚行动。",
                "至少完成一轮白天发言和投票。",
                "投票后页面能进入下一阶段或遗言阶段。",
              ]}
            />
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel title="已知限制">
            <Checklist
              items={[
                "免费 Render 资源可能休眠，第一次打开会慢。",
                "当前适合小范围 Alpha 试玩，不包含账号、匹配和公开运营保护。",
                "建议先保持一个房间少量玩家测试，不要同时开很多房间。",
                "真实 LLM/TTS 需要单独配置，阶段二默认不打开真实模型。",
              ]}
            />
          </Panel>

          <Panel title="问题反馈模板">
            <div className="rounded-md border border-white/10 bg-black/35 p-3 text-sm leading-6 text-zinc-200">
              <p>请记录：设备和浏览器、房间码、你是第几号玩家、发生在哪个阶段、页面提示或报错、是否刷新后恢复。</p>
              <p className="mt-3 text-zinc-400">如果能复现，再补一句“从创建房间开始的最短复现步骤”。</p>
            </div>
            <div className="mt-3 grid gap-2">
              <Link className="rounded-md border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-center text-sm font-black text-emerald-100 hover:bg-emerald-500/20" href="/alpha-report">
                打开反馈模板
              </Link>
              <InfoRow label="健康面板" value={healthUrl} />
              <InfoRow label="preflight" value={preflightCommand} />
              <InfoRow label="投票 smoke" value={voteSmokeCommand} />
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="min-w-0 break-words rounded-lg border border-white/10 bg-[#17191b] p-4 shadow-[0_16px_60px_rgba(0,0,0,0.24)]">
      <h2 className="text-lg font-black text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li className="min-w-0 break-words rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-zinc-200" key={item}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function OrderedSteps({ items }: { items: string[] }) {
  return (
    <ol className="grid gap-2">
      {items.map((item, index) => (
        <li className="flex min-w-0 gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-zinc-200" key={item}>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#c9a45d]/35 bg-[#c9a45d]/10 text-xs font-black text-[#f0cf79]">
            {index + 1}
          </span>
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-xs font-bold text-zinc-500">{label}</div>
      <div className="mt-1 break-all text-xs font-bold leading-5 text-emerald-100">{value}</div>
    </div>
  );
}

async function readRequestOrigin(): Promise<string | undefined> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return undefined;
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function buildPublicUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}
