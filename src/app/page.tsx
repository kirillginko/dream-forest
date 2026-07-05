"use client";

import dynamic from "next/dynamic";

// The whole experience is WebGL + Web Audio — client only, no SSR.
const Experience = dynamic(() => import("@/components/experience/Experience"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black font-mono text-[10px] tracking-[0.4em] text-amber-200/70">
      THE FOREST IS FORMING…
    </div>
  ),
});

export default function Home() {
  return <Experience />;
}
