"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

import { confidenceTrend } from "@/lib/mock";

export function ConfidenceTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={confidenceTrend} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
        <YAxis domain={[80, 95]} hide />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--surface))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 10,
            fontSize: 12,
          }}
          labelStyle={{ color: "hsl(var(--muted-foreground))" }}
          formatter={(v: number) => [`${v}%`, "Avg confidence"]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(172 80% 45%)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
