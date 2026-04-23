"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { formatTaka } from "@/lib/format";

interface WeekData {
  week: string;
  total: number; // in poisha
}

interface SpendingBarChartProps {
  data: WeekData[];
}

export default function SpendingBarChart({ data }: SpendingBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
        No signal yet
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="bar-cool" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#00e5ff" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#0097b2" stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="bar-warm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ffd600" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#ff7a00" stopOpacity={0.45} />
          </linearGradient>
          <linearGradient id="bar-hot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ff2bd6" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#ff3b5c" stopOpacity={0.5} />
          </linearGradient>
          <filter id="bar-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid
          strokeDasharray="2 4"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: "#8794b8", fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#505876", fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `৳${Math.round(v / 100)}`}
        />
        <Tooltip
          formatter={(v) => [formatTaka(Number(v)), "Spent"]}
          contentStyle={{
            background: "rgba(12,13,26,0.92)",
            border: "1px solid rgba(0,229,255,0.3)",
            borderRadius: "10px",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "#eef1ff",
            boxShadow: "0 0 30px -5px rgba(0,229,255,0.25)",
          }}
          cursor={{ fill: "rgba(0,229,255,0.05)" }}
          labelStyle={{ color: "#8794b8", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.15em" }}
        />
        <Bar dataKey="total" radius={[6, 6, 2, 2]} filter="url(#bar-glow)">
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={
                entry.total > max * 0.9
                  ? "url(#bar-hot)"
                  : entry.total > max * 0.7
                  ? "url(#bar-warm)"
                  : "url(#bar-cool)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
