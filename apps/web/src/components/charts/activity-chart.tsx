"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { scanActivity } from "@/lib/mock";

export function ActivityChart() {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={scanActivity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gScans" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(172 80% 45%)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="hsl(172 80% 45%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gFlagged" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(239 84% 67%)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(239 84% 67%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={1}
        />
        <YAxis
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--surface))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 10,
            fontSize: 12,
          }}
          labelStyle={{ color: "hsl(var(--muted-foreground))" }}
        />
        <Area
          type="monotone"
          dataKey="scans"
          stroke="hsl(172 80% 45%)"
          strokeWidth={2}
          fill="url(#gScans)"
          name="Scans"
        />
        <Area
          type="monotone"
          dataKey="flagged"
          stroke="hsl(239 84% 67%)"
          strokeWidth={2}
          fill="url(#gFlagged)"
          name="Flagged"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
