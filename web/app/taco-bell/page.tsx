import Link from "next/link";
import { Brandmark, HeroImage } from "@/components/Brand";

export default function TacoBellLanding() {
  return (
    <main className="relative overflow-hidden">
      {/* Top bar */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-white/55 hover:text-white">
            ← All brands
          </Link>
          <Brandmark />
        </div>
        <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">
          Unofficial demo · simulated data
        </span>
      </div>

      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-16 pt-10 text-center sm:pt-20">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-tb-magenta/40 bg-tb-magenta/10 px-4 py-1.5 text-sm font-semibold text-tb-yellow">
          🌮 Taco Bell · AI Win-Back CRM
        </div>

        <h1 className="font-display text-5xl uppercase leading-[0.92] tracking-tight sm:text-7xl">
          Bring back the <span className="text-tb-yellow">regulars</span>
          <br className="hidden sm:block" /> who stopped coming.
        </h1>

        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70">
          Just describe a goal in plain English. An <b className="text-white">AI agent</b> finds your
          lapsed shoppers, writes and sends personalised messages across WhatsApp, SMS & Email — then{" "}
          <b className="text-white">proves the revenue</b> it actually brought back.
        </p>

        <Link
          href="/app"
          className="group mt-10 inline-flex items-center gap-2 rounded-full bg-tb-yellow px-9 py-4 text-lg font-bold text-black shadow-[0_0_60px_-12px] shadow-tb-yellow/70 transition hover:scale-[1.04]"
        >
          <span>▶</span> Start the demo
          <span className="transition group-hover:translate-x-1">→</span>
        </Link>

        <div className="mt-6 text-sm text-white/55">
          Live data: <b className="text-white/90">564 regulars</b> have gone quiet ·{" "}
          <b className="text-white/90">₹18.4L</b> of value at risk
        </div>

        <HeroImage />
      </section>

      {/* Feature cards */}
      <section className="mx-auto grid max-w-5xl gap-5 px-6 pb-20 sm:grid-cols-3">
        <Feature
          emoji="🎯"
          title="Describe a goal"
          desc="Plain English in. The agent turns it into a precise, typed audience and shows you exactly who it'll reach."
          tint="from-tb-purple/50"
        />
        <Feature
          emoji="📣"
          title="It runs the campaign"
          desc="Personalised, per-channel copy sent through a real async delivery pipeline — with live engagement tracking."
          tint="from-tb-magenta/50"
        />
        <Feature
          emoji="💸"
          title="Proves the revenue"
          desc="A holdout control group measures true lift — so you see recovered revenue, not vanity metrics."
          tint="from-tb-pink/50"
        />
      </section>

      <footer className="px-6 pb-10 text-center text-xs leading-relaxed text-white/40">
        “Taco Bell” name & logo are trademarks of their respective owner, used here only for an
        unaffiliated engineering demo with fully simulated data.
      </footer>
    </main>
  );
}

function Feature({
  emoji,
  title,
  desc,
  tint,
}: {
  emoji: string;
  title: string;
  desc: string;
  tint: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-b ${tint} to-white/[0.02] p-6`}>
      <div className="text-3xl">{emoji}</div>
      <h3 className="mt-3 font-display text-xl uppercase tracking-wide">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{desc}</p>
    </div>
  );
}
