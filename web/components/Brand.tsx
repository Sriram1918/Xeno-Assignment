"use client";

import { useState } from "react";

/** Taco Bell logo: bell mark (white badge) + wordmark. Falls back to a text wordmark. */
export function Brandmark({ size = "md" }: { size?: "sm" | "md" }) {
  const [imgOk, setImgOk] = useState(true);
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const text = size === "sm" ? "text-xl" : "text-2xl";
  return (
    <div className="flex items-center gap-2.5">
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo.jpg"
          alt="Taco Bell"
          className={`${box} rounded-lg object-contain`}
          onError={() => setImgOk(false)}
        />
      )}
      <span className={`font-display ${text} uppercase tracking-wide`}>Taco&nbsp;Bell</span>
    </div>
  );
}

/** Dramatic hero food shot (dark background blends into the page). Hides itself if missing. */
export function HeroImage() {
  const [imgOk, setImgOk] = useState(true);
  if (!imgOk) return null;
  return (
    <div className="mt-12 w-full max-w-3xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero.jpg"
        alt="A Taco Bell taco"
        className="w-full rounded-2xl border border-white/10 shadow-[0_30px_80px_-20px_rgba(228,0,124,0.45)]"
        onError={() => setImgOk(false)}
      />
    </div>
  );
}
