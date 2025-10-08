interface HistogramProps {
  title: string;
  data: number[];
  maxTicks?: number;
  color?: string;
  formatLabel?: (value: number, index: number) => string;
}

export function Histogram({ title, data, color = "#3b82f6" }: HistogramProps) {
  const maxValue = Math.max(...data, 1);
  const height = 120;
  const width = 320;
  const barWidth = Math.max(1, width / data.length);

  return (
    <div className="histogram">
      <div className="histogram-header">
        <h4>{title}</h4>
        <span>{maxValue.toLocaleString()} px</span>
      </div>
      <svg width={width} height={height} role="img" aria-label={title}>
        {data.map((value, idx) => {
          const barHeight = (value / maxValue) * (height - 4);
          return (
            <rect
              key={idx}
              x={idx * barWidth}
              y={height - barHeight}
              width={Math.max(1, barWidth - 0.5)}
              height={barHeight}
              fill={color}
            />
          );
        })}
      </svg>
    </div>
  );
}

