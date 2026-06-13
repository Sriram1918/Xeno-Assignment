"use client";

import { useState } from "react";

/** Taco Bell logo. Renders /logo.png if present; otherwise a styled wordmark fallback. */
export function Brandmark({ size = "md" }: { size?: "sm" | "md" }) {
  const [imgOk, setImgOk] = useState(true);
  const h = size === "sm" ? "h-8" : "h-10";
  return (
    <div className="flex items-center gap-3">
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo.png"
          alt="Taco Bell"
          className={`${h} w-auto`}
          onError={() => setImgOk(false)}
        />
      )}
      {!imgOk && (
        <span className={`font-display ${size === "sm" ? "text-xl" : "text-2xl"} uppercase tracking-wide`}>
          Taco&nbsp;Bell
        </span>
      )}
    </div>
  );
}

/** Optional decorative hero food image. Renders /hero.png if present; hides itself if missing. */
export function HeroImage() {
  const [imgOk, setImgOk] = useState(true);
  if (!imgOk) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/hero.png"
      alt=""
      className="pointer-events-none mt-10 max-h-72 w-auto drop-shadow-[0_20px_60px_rgba(228,0,124,0.45)]"
      onError={() => setImgOk(false)}
    />
  );
}
