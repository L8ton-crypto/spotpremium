"use client";

import { useEffect, useRef } from "react";

type Point = { takenAt: string; dealer: string; product: string; premiumPct: number };

const COLORS: Record<string, string> = {
  apmex: "#f59e0b",
  jm_bullion: "#22d3ee",
  sd_bullion: "#a78bfa",
  money_metals: "#10b981"
};

const DEALER_NAME: Record<string, string> = {
  apmex: "APMEX",
  jm_bullion: "JM Bullion",
  sd_bullion: "SD Bullion",
  money_metals: "Money Metals"
};

export default function PremiumChart({
  series,
  product
}: {
  series: Point[];
  product: "silver_eagle_1oz" | "gold_eagle_1oz";
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const Chart = (await import("chart.js/auto")).default;
      if (cancelled || !ref.current) return;

      const filtered = series.filter((p) => p.product === product);
      const dealers = Array.from(new Set(filtered.map((p) => p.dealer)));
      const datasets = dealers.map((d) => ({
        label: DEALER_NAME[d] ?? d,
        data: filtered
          .filter((p) => p.dealer === d)
          .map((p) => ({ x: new Date(p.takenAt).getTime(), y: p.premiumPct })),
        borderColor: COLORS[d] ?? "#9ca3af",
        backgroundColor: (COLORS[d] ?? "#9ca3af") + "33",
        tension: 0.25,
        pointRadius: 2,
        borderWidth: 2
      }));

      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(ref.current, {
        type: "line",
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: {
            x: {
              type: "linear",
              ticks: {
                color: "#9ca3af",
                callback: (v) => {
                  const d = new Date(Number(v));
                  return d.toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                  });
                }
              },
              grid: { color: "#1f2937" }
            },
            y: {
              ticks: {
                color: "#9ca3af",
                callback: (v) => `${Number(v).toFixed(1)}%`
              },
              grid: { color: "#1f2937" },
              title: { display: true, text: "Premium over spot", color: "#9ca3af" }
            }
          },
          plugins: {
            legend: { labels: { color: "#e5e7eb" } },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const ts = items[0]?.parsed?.x;
                  if (!ts) return "";
                  return new Date(ts).toLocaleString();
                },
                label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)}%`
              }
            }
          }
        }
      });
    }

    render();
    return () => {
      cancelled = true;
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [series, product]);

  return (
    <div className="relative h-72 sm:h-96 w-full">
      <canvas ref={ref} />
    </div>
  );
}
