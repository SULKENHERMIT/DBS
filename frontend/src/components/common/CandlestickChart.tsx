import React, { useState, useMemo } from 'react';
import { CandlePoint } from '../../types';
import { formatCurrency, formatNumber, formatDateTime } from '../../lib/formatters';

interface CandlestickChartProps {
  data: CandlePoint[];
  height?: number;
  symbol: string;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  height = 400,
  symbol,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { minPrice, maxPrice, maxVolume, padding } = useMemo(() => {
    if (!data.length) return { minPrice: 0, maxPrice: 100, maxVolume: 100, padding: 40 };
    let minP = Infinity;
    let maxP = -Infinity;
    let maxV = 0;
    for (const d of data) {
      if (d.low_price < minP) minP = d.low_price;
      if (d.high_price > maxP) maxP = d.high_price;
      if (d.total_volume > maxV) maxV = d.total_volume;
    }
    // Add small buffer to price range
    const range = maxP - minP || 1;
    minP = Math.max(0, minP - range * 0.05);
    maxP = maxP + range * 0.05;
    return { minPrice: minP, maxPrice: maxP, maxVolume: maxV || 1, padding: 50 };
  }, [data]);

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center h-80 rounded-xl bg-navy-900 border border-navy-800 text-slate-400">
        <p className="text-sm">No candlestick aggregate data available for this range</p>
      </div>
    );
  }

  const svgWidth = 800; // viewBox width for SVG responsiveness
  const chartHeight = height * 0.75;
  const volumeHeight = height * 0.25;
  const candleAreaWidth = svgWidth - padding;
  const candleWidth = Math.max(2, Math.min(18, (candleAreaWidth / data.length) * 0.7));

  const getY = (price: number) => {
    return chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * (chartHeight - 30) - 15;
  };

  const getVolY = (vol: number) => {
    return height - (vol / maxVolume) * (volumeHeight - 20) - 10;
  };

  const hoveredCandle = hoveredIndex !== null ? data[hoveredIndex] : data[data.length - 1];

  return (
    <div className="flex flex-col w-full bg-navy-900 rounded-xl border border-navy-800 p-4">
      {/* Header Info Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 mb-2 border-b border-navy-800 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200 text-sm">{symbol} / USD Hourly OHLC</span>
          <span className="text-slate-400">
            {hoveredCandle ? formatDateTime(hoveredCandle.candle_bucket) : ''}
          </span>
        </div>
        {hoveredCandle && (
          <div className="flex items-center gap-4 font-tabular">
            <span>
              <span className="text-slate-400">O: </span>
              <span className="text-slate-200 font-medium">{formatCurrency(hoveredCandle.open_price)}</span>
            </span>
            <span>
              <span className="text-slate-400">H: </span>
              <span className="text-emerald-400 font-medium">{formatCurrency(hoveredCandle.high_price)}</span>
            </span>
            <span>
              <span className="text-slate-400">L: </span>
              <span className="text-rose-400 font-medium">{formatCurrency(hoveredCandle.low_price)}</span>
            </span>
            <span>
              <span className="text-slate-400">C: </span>
              <span
                className={`font-semibold ${
                  hoveredCandle.close_price >= hoveredCandle.open_price ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatCurrency(hoveredCandle.close_price)}
              </span>
            </span>
            <span>
              <span className="text-slate-400">Vol: </span>
              <span className="text-slate-200">{formatNumber(hoveredCandle.total_volume)}</span>
            </span>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${height}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Grid lines (horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const price = minPrice + (maxPrice - minPrice) * pct;
            const y = getY(price);
            return (
              <g key={i}>
                <line x1={0} y1={y} x2={candleAreaWidth} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                <text x={candleAreaWidth + 6} y={y + 3} fill="#64748b" fontSize="10" fontFamily="JetBrains Mono">
                  ${price > 1000 ? (price / 1000).toFixed(1) + 'k' : price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Volume separator */}
          <line
            x1={0}
            y1={chartHeight}
            x2={candleAreaWidth}
            y2={chartHeight}
            stroke="#223254"
            strokeDasharray="2 2"
          />
          <text x={4} y={chartHeight + 14} fill="#64748b" fontSize="9" fontFamily="sans-serif">
            VOLUME (HOURLY BUCKET)
          </text>

          {/* Candlesticks & Volume Bars */}
          {data.map((c, i) => {
            const x = (i / Math.max(1, data.length - 1)) * (candleAreaWidth - 20) + 10;
            const isUp = c.close_price >= c.open_price;
            const color = isUp ? '#10b981' : '#f43f5e';
            const yHigh = getY(c.high_price);
            const yLow = getY(c.low_price);
            const yOpen = getY(c.open_price);
            const yClose = getY(c.close_price);
            const yBodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

            const volY = getVolY(c.total_volume);
            const volHeight = Math.max(1, height - 10 - volY);

            const isHovered = hoveredIndex === i;

            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
              >
                {/* Crosshair hover line */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={height}
                    stroke="#06b6d4"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.6"
                  />
                )}

                {/* Wick */}
                <line
                  x1={x}
                  y1={yHigh}
                  x2={x}
                  y2={yLow}
                  stroke={color}
                  strokeWidth={isHovered ? 2 : 1.2}
                />

                {/* Candle Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={yBodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={isUp ? '#10b981' : '#f43f5e'}
                  rx={1}
                  opacity={isHovered ? 1 : 0.9}
                />

                {/* Volume Bar */}
                <rect
                  x={x - candleWidth / 2}
                  y={volY}
                  width={candleWidth}
                  height={volHeight}
                  fill={isUp ? '#059669' : '#e11d48'}
                  opacity={isHovered ? 0.7 : 0.4}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-navy-800">
        <span>TimescaleDB Continuous Aggregate: price_history_hourly_candlestick</span>
        <span>Count: {data.length} Materialized Candles</span>
      </div>
    </div>
  );
};
