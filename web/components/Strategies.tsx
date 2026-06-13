"use client";

/** Strategy Playbook — showcases the platform's data-driven targeting capabilities.
 * Static content (no API). Honestly framed: the demo runs win-back end-to-end; these plug
 * into the same agent framework, and the signal-driven ones use live feeds in production. */

const STRATEGIES = [
  {
    icon: "🌐",
    title: "Regional language",
    desc: "Reach each shopper in the language they actually read — Hindi, Tamil, Hinglish & more — instead of English-only blasts.",
    impact: "Higher open & response rates in non-metro markets.",
  },
  {
    icon: "💸",
    title: "Channel-cost routing",
    desc: "Send low-value customers free Email and high-intent ones WhatsApp — so spend follows the customers most likely to pay back.",
    impact: "Protects margin without losing reach.",
  },
  {
    icon: "⏰",
    title: "Hunger-timed cart recovery",
    desc: "A Quesadilla added to cart at 8:30 PM Friday and abandoned gets a nudge right then — not a dead email next morning.",
    impact: "Sells when the stomach is actually rumbling — big conversion spike.",
  },
  {
    icon: "🌦️",
    title: "Weather-aware offers",
    desc: "42°C in Delhi? Push cold drinks. Monsoon evening in Mumbai? Hot, cheesy fries. The brand feels hyper-local and empathetic.",
    impact: "Lifts order value with no extra budget.",
  },
  {
    icon: "📅",
    title: "Payday-cycle pricing",
    desc: "Premium combos on the 1st–5th when salaries land; value deals by the 25th when wallets are tight.",
    impact: "Captures margin when there's cash, volume when there isn't.",
  },
  {
    icon: "🧠",
    title: "Loss-aversion win-back",
    desc: "For 120-day 'zombie' accounts, a flat 20% off is ignored. “Your free Crunchy Taco expires in 48h” reframes it as something to lose.",
    impact: "Wakes up deep-churn customers numb to normal discounts.",
  },
];

export function Strategies() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-wide">Strategy playbook</h2>
        <p className="mt-1 max-w-3xl text-sm text-white/60">
          Win-back is the play this demo runs end-to-end. The same agent framework supports the
          data-driven strategies below — the kind of intelligence a real CRM brings to a brand.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STRATEGIES.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl border border-white/10 bg-gradient-to-b from-tb-purple/20 to-white/[0.02] p-5"
          >
            <div className="text-3xl">{s.icon}</div>
            <h3 className="mt-2 font-display text-lg uppercase tracking-wide">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/70">{s.desc}</p>
            <p className="mt-2 text-xs text-tb-yellow/90">↳ {s.impact}</p>
            <div className="mt-3 inline-block rounded-full bg-tb-magenta/15 px-2 py-0.5 text-[11px] font-medium text-tb-yellow">
              Platform capability
            </div>
          </div>
        ))}
      </div>

      <p className="max-w-3xl text-xs leading-relaxed text-white/40">
        Honest scope: this build implements the win-back play fully. The signal-driven plays
        (weather, payday, cart-timing) integrate live data feeds in production — shown here to
        illustrate the platform&apos;s direction, not as completed integrations.
      </p>
    </div>
  );
}
