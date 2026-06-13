"use client";

import { useEffect, useState } from "react";

/** First-visit welcome overlay so a recruiter instantly understands what they're seeing.
 * Self-gated via localStorage; costs nothing (no API). */
export function Onboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("tb_onboarded")) setShow(true);
  }, []);

  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem("tb_onboarded", "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="animate-rise w-full max-w-lg rounded-2xl border border-tb-magenta/30 bg-[#190a25] p-6 shadow-2xl">
        <div className="text-sm font-semibold text-tb-yellow">👋 Welcome — here&apos;s what you&apos;re looking at</div>
        <h2 className="mt-2 font-display text-2xl uppercase tracking-wide">
          An AI agent that wins back customers
        </h2>
        <ol className="mt-4 space-y-2.5 text-sm text-white/75">
          <li>
            <b className="text-tb-yellow">1.</b> This is <b className="text-white">Taco Bell&apos;s 2,500
            customers</b> and their order history — fully simulated demo data.
          </li>
          <li>
            <b className="text-tb-yellow">2.</b> The agent has already <b className="text-white">analyzed
            them</b> and surfaced the best <b className="text-white">win-back opportunities</b>.
          </li>
          <li>
            <b className="text-tb-yellow">3.</b> Pick one (or type your own goal) → it{" "}
            <b className="text-white">targets the right people, writes the messages, sends them</b> via
            WhatsApp/SMS/Email, and <b className="text-white">proves the recovered revenue</b> with a
            holdout control group.
          </li>
        </ol>
        <button
          onClick={close}
          className="mt-6 w-full rounded-full bg-tb-yellow py-3 font-bold text-black transition hover:brightness-110"
        >
          ▶ Show me the demo
        </button>
        <p className="mt-3 text-center text-xs text-white/40">
          Unaffiliated engineering demo · simulated data · not affiliated with Taco Bell
        </p>
      </div>
    </div>
  );
}
