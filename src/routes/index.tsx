import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import WindTunnel from "@/components/sim/WindTunnel";
import DynamicSoaring from "@/components/sim/DynamicSoaring";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Albatross-Inspired Aircraft Wings — Aerodynamics Simulator" },
      {
        name: "description",
        content:
          "Interactive wind tunnel and dynamic soaring simulation comparing rigid wingtips with albatross-inspired hinged wingtips.",
      },
      {
        property: "og:title",
        content: "Albatross-Inspired Aircraft Wings — Aerodynamics Simulator",
      },
      {
        property: "og:description",
        content:
          "Compare gust loads on rigid vs hinged wingtips and watch dynamic soaring extract energy from a wind gradient.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TABS = [
  { id: "tunnel", label: "WIND TUNNEL SIMULATION" },
  { id: "soaring", label: "DYNAMIC SOARING SIMULATION" },
] as const;

function Index() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("tunnel");

  return (
    <main className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-6 sm:py-8">
      <header className="mb-5 sm:mb-8">
        <p className="tech-label text-[10px] text-accent sm:text-xs">
          Aerodynamics &amp; Biomimicry Project
        </p>
        <h1 className="mt-1 font-display text-xl font-extrabold leading-tight glow-text sm:text-3xl lg:text-4xl">
          Albatross-Inspired Aircraft Wings
        </h1>
        <p className="mt-2 max-w-3xl text-xs text-muted-foreground sm:text-sm">
          {"\n"}
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Simulations"
        className="glass mb-5 grid grid-cols-2 gap-1 rounded-2xl p-1 sm:mb-8 sm:inline-grid"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`tech-label min-h-[46px] rounded-xl px-3 text-[10px] font-semibold transition-all sm:px-6 sm:text-xs ${
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-[0_0_24px_oklch(0.8_0.14_200/40%)]"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tunnel" ? <WindTunnel /> : <DynamicSoaring />}

      <footer className="mt-8 pb-4 text-center text-[11px] text-muted-foreground">
        Illustrative simulation values for educational use — not verified engineering data.
      </footer>
    </main>
  );
}
