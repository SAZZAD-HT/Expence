"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatTaka } from "@/lib/format";

interface SegmentData {
  name: string;
  value: number; // in poisha
  color: string;
}

interface SegmentDonutChartProps {
  data: SegmentData[];
}

const NEON_PALETTE = [
  "#00e5ff",
  "#ff2bd6",
  "#c6ff00",
  "#9d4dff",
  "#00ffa3",
  "#ffb300",
  "#ff6ec7",
  "#5effd6",
];

export default function SegmentDonutChart({ data }: SegmentDonutChartProps) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="flex items-center justify-center h-48 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
        No signal this month
      </div>
    );
  }

  const colored = data.map((d, i) => ({
    ...d,
    color: NEON_PALETTE[i % NEON_PALETTE.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <defs>
          <filter id="donut-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <Pie
          data={colored}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={88}
          paddingAngle={3}
          dataKey="value"
          stroke="#050510"
          strokeWidth={2}
          filter="url(#donut-glow)"
        >
          {colored.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [formatTaka(Number(v)), "Spent"]}
          contentStyle={{
            background: "rgba(12,13,26,0.92)",
            border: "1px solid rgba(255,43,214,0.3)",
            borderRadius: "10px",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "#eef1ff",
            boxShadow: "0 0 30px -5px rgba(255,43,214,0.25)",
          }}
          labelStyle={{ color: "#8794b8", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.15em" }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "#8794b8",
          }}
          formatter={(v) => <span style={{ color: "#8794b8" }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
