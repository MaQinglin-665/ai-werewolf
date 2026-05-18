import Link from "next/link";
import { FeedbackTemplateClient } from "./FeedbackTemplateClient";

export const metadata = {
  title: "Alpha 反馈模板 | AI 狼人杀",
};

export default function AlphaReportPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#101112] text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a45d]">AI Werewolf Alpha</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-white sm:text-4xl">反馈模板</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
              记录一次真实试玩问题。页面只在本地生成可复制文本，不提交数据、不保存浏览器指纹、不写入数据库。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-md border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-500/20" href="/rooms">
              联机房间
            </Link>
            <Link className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold text-zinc-100 hover:bg-white/10" href="/alpha-playtest">
              试玩说明
            </Link>
            <Link className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold text-zinc-100 hover:bg-white/10" href="/alpha-health">
              健康面板
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <InfoCard title="先判定等级" text="P0 阻塞，P1 严重，P2 体验。先修 P0/P1。" />
          <InfoCard title="保留房间码" text="房间码、座位、阶段能直接定位到具体流程。" />
          <InfoCard title="写最短复现" text="能稳定复现的问题优先修，不能复现也先记录条件。" />
        </section>

        <FeedbackTemplateClient />
      </div>
    </main>
  );
}

function InfoCard({ text, title }: { text: string; title: string }) {
  return (
    <section className="min-w-0 break-words rounded-lg border border-white/10 bg-[#17191b] p-4">
      <h2 className="text-base font-black text-white">{title}</h2>
      <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{text}</p>
    </section>
  );
}
