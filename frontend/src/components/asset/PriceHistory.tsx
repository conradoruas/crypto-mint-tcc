"use client";

import { useMemo, useRef, useState } from "react";
import { useActivityFeed } from "@/hooks/activity";

const W = 500;
const H = 150;
const PAD = { top: 10, right: 16, bottom: 36, left: 56 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function PriceHistory({
  nftContract,
  tokenId,
}: {
  nftContract: string;
  tokenId: string;
}) {
  const { events, isLoading } = useActivityFeed(nftContract, 200);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    price: string;
    date: string;
  } | null>(null);

  const sales = useMemo(
    () =>
      events
        .filter((e) => e.type === "sale" && e.tokenId === tokenId && e.priceETH)
        .map((e) => ({
          price: parseFloat(e.priceETH!),
          ts: e.timestamp ?? 0,
          txHash: e.txHash,
        }))
        .sort((a, b) => a.ts - b.ts),
    [events, tokenId],
  );

  const isSkeleton = isLoading && sales.length === 0;

  if (isSkeleton) {
    return (
      <div className="h-[150px] animate-pulse bg-surface-container-high rounded-sm" />
    );
  }

  if (sales.length < 2) {
    return (
      <div className="h-[150px] flex items-center justify-center text-xs text-on-surface-variant/40 uppercase tracking-widest border border-dashed border-outline-variant/15 rounded-sm">
        No sales recorded yet
      </div>
    );
  }

  const minP = Math.min(...sales.map((s) => s.price));
  const maxP = Math.max(...sales.map((s) => s.price));
  const minTs = sales[0].ts;
  const maxTs = sales[sales.length - 1].ts;
  const rangeP = maxP - minP || 1;
  const rangeTs = maxTs - minTs || 1;

  const sx = (ts: number) => PAD.left + ((ts - minTs) / rangeTs) * PLOT_W;
  const sy = (p: number) => PAD.top + (1 - (p - minP) / rangeP) * PLOT_H;

  const pts = sales.map((s) => ({ ...s, cx: sx(s.ts), cy: sy(s.price) }));
  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.cx},${p.cy}`)
    .join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1].cx},${PAD.top + PLOT_H} L${pts[0].cx},${PAD.top + PLOT_H} Z`;

  const yTicks = [minP, (minP + maxP) / 2, maxP];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    let closest = pts[0];
    let minDist = Math.abs(pts[0].cx - mouseX);
    for (const p of pts) {
      const d = Math.abs(p.cx - mouseX);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }
    setTooltip({
      x: (closest.cx / W) * 100,
      y: (closest.cy / H) * 100,
      price: closest.price.toFixed(4),
      date: fmtDate(closest.ts),
    });
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="priceAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-primary)"
              stopOpacity="0.25"
            />
            <stop
              offset="100%"
              stopColor="var(--color-primary)"
              stopOpacity="0.01"
            />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => {
          const y = sy(tick);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.06"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 12}
                y={y + 4.5}
                textAnchor="end"
                fontSize="14"
                fill="currentColor"
                fillOpacity="0.6"
              >
                {tick.toFixed(3)}
              </text>
            </g>
          );
        })}

        <text x={PAD.left} y={H - 6} fontSize="14" fill="currentColor" fillOpacity="0.6">
          {fmtDate(minTs)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          fontSize="14"
          textAnchor="end"
          fill="currentColor"
          fillOpacity="0.6"
        >
          {fmtDate(maxTs)}
        </text>

        <path d={areaPath} fill="url(#priceAreaGrad)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r="3"
            fill="var(--color-primary)"
            stroke="var(--color-background)"
            strokeWidth="1.5"
          />
        ))}

        {tooltip && (
          <line
            x1={(tooltip.x / 100) * W}
            y1={PAD.top}
            x2={(tooltip.x / 100) * W}
            y2={PAD.top + PLOT_H}
            stroke="var(--color-primary)"
            strokeOpacity="0.3"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-sm bg-surface-container-high border border-outline-variant/20 shadow-md text-xs"
          style={{
            left: `clamp(0%, calc(${tooltip.x}% - 48px), calc(100% - 96px))`,
            top: `calc(${tooltip.y}% - 38px)`,
          }}
        >
          <p className="font-headline font-bold text-primary">
            {tooltip.price} ETH
          </p>
          <p className="text-on-surface-variant">{tooltip.date}</p>
        </div>
      )}
    </div>
  );
}
