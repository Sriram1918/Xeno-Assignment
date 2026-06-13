import Link from "next/link";

type Brand = { name: string; live?: boolean };
type Category = { title: string; icon: string; accent: string; brands: Brand[] };

// Real Xeno client verticals & brands. Only Taco Bell is built out as a live demo.
const CATEGORIES: Category[] = [
  {
    title: "Food & Beverage",
    icon: "🍔",
    accent: "from-tb-yellow/25",
    brands: [
      { name: "Taco Bell", live: true },
      { name: "Nando's" },
      { name: "Biryani By Kilo" },
      { name: "Mad Over Donuts" },
    ],
  },
  {
    title: "Fashion & Apparel",
    icon: "👕",
    accent: "from-tb-purple/30",
    brands: [
      { name: "Levi's" },
      { name: "Tommy Hilfiger" },
      { name: "Jack & Jones" },
      { name: "Vero Moda" },
      { name: "Forever New" },
    ],
  },
  {
    title: "Beauty & Wellness",
    icon: "💄",
    accent: "from-tb-magenta/30",
    brands: [{ name: "Forest Essentials" }, { name: "Kama Ayurveda" }, { name: "Colorbar" }],
  },
];

export default function PlatformHome() {
  return (
    <main className="relative overflow-hidden">
      {/* Top bar */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-tb-yellow font-display text-xl text-black">
            R
          </span>
          <span className="font-display text-2xl uppercase tracking-wide">Reach</span>
          <span className="ml-1 rounded-full bg-tb-magenta/20 px-2 py-0.5 text-xs font-medium text-tb-yellow">
            AI-native CRM
          </span>
        </div>
        <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">
          Unofficial demo · simulated data
        </span>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-10 pt-10 text-center sm:pt-16">
        <h1 className="font-display text-4xl uppercase leading-[0.95] tracking-tight sm:text-6xl">
          One AI-native CRM.
          <br /> <span className="text-tb-yellow">Every consumer brand.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
          Reach organises customer data, decides who to talk to, and runs personalised campaigns
          across WhatsApp, SMS, Email & RCS — for brands across food, fashion and beauty.
          <b className="text-white"> Pick a brand to open its workspace.</b>
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-tb-yellow/40 bg-tb-yellow/10 px-4 py-1.5 text-sm text-tb-yellow">
          ▶ This demo is built out end-to-end for <b>Taco Bell</b> — click it below
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-5xl space-y-8 px-6 pb-16">
        {CATEGORIES.map((cat) => (
          <div key={cat.title}>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-2xl">{cat.icon}</span>
              <h2 className="font-display text-xl uppercase tracking-wide">{cat.title}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {cat.brands.map((b) => (
                <BrandTile key={b.name} brand={b} accent={cat.accent} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <footer className="px-6 pb-10 text-center text-xs leading-relaxed text-white/40">
        “Reach” is a demo product. Brand names shown are trademarks of their respective owners and
        reflect Xeno&apos;s real client verticals — used here only for an unaffiliated engineering
        demo with fully simulated data. Only the Taco Bell workspace is built out.
      </footer>
    </main>
  );
}

function BrandTile({ brand, accent }: { brand: Brand; accent: string }) {
  if (brand.live) {
    return (
      <Link
        href="/taco-bell"
        className={`group relative flex h-28 flex-col items-center justify-center rounded-2xl border border-tb-yellow/50 bg-gradient-to-b ${accent} to-white/[0.03] p-4 text-center transition hover:scale-[1.03] hover:border-tb-yellow`}
      >
        <span className="absolute right-2 top-2 rounded-full bg-tb-yellow px-2 py-0.5 text-[10px] font-bold text-black">
          LIVE DEMO
        </span>
        <span className="font-display text-lg uppercase tracking-wide">{brand.name}</span>
        <span className="mt-1 text-xs text-tb-yellow">Open workspace →</span>
      </Link>
    );
  }
  return (
    <div
      title="Workspace ready — the Taco Bell demo is built out in this submission"
      className="flex h-28 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center opacity-70"
    >
      <span className="font-display text-lg uppercase tracking-wide text-white/80">{brand.name}</span>
      <span className="mt-1 text-[11px] text-white/40">Workspace ready</span>
    </div>
  );
}
