import { Area, AreaChart, ResponsiveContainer } from 'recharts';

export function Sparkline({
  data,
  color = 'var(--chart-1)',
  className,
}: {
  data: number[];
  color?: string;
  className?: string;
}) {
  if (!data || data.length === 0) return null;
  const chartData = data.map((value, i) => ({ i, value }));
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <div className={className ?? 'h-8 w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
