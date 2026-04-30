import { useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getEndpointChart, getSystemInfo } from '../services/api';
import { ALL_PERIODS, filterPeriods } from '../utils/periods';

// Number of aggregation buckets per period
const PERIOD_POINTS = {
  '1min': 60, '5min': 60, '10min': 60, '30min': 60,
  '1h': 60, '6h': 72, '24h': 72, '7d': 84, '30d': 90,
};

// Window size in ms for the live sliding-window trimmer
const PERIOD_MS = {
  '1min':  60_000,
  '5min':  300_000,
  '10min': 600_000,
  '30min': 1_800_000,
  '1h':    3_600_000,
  '6h':    21_600_000,
  '24h':   86_400_000,
  '7d':    604_800_000,
  '30d':   2_592_000_000,
};

const LINE_COLOR = '#60a5fa'; // fixed blue — the chart shows latency, not status

function formatTick(ts, period) {
  const d = new Date(ts);
  if (period === '30d' || period === '7d')
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  if (period === '24h' || period === '6h')
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LatencyChart({ endpointId, latestEvent }) {
  const [availablePeriods, setAvailablePeriods] = useState(ALL_PERIODS);
  const [period, setPeriod] = useState('1h');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const periodRef = useRef(period);
  periodRef.current = period;

  // Fetch retention hours once and compute which period options to show.
  // Periods whose window exceeds RETENTION_HOURS are hidden — showing them
  // would produce an empty or misleading chart.
  useEffect(() => {
    getSystemInfo().then(({ retention_hours }) => {
      const visible = filterPeriods(retention_hours);
      setAvailablePeriods(visible);
      // If the currently selected period is no longer available, pick the longest visible one
      setPeriod((cur) => (visible.find((p) => p.value === cur) ? cur : visible[visible.length - 1].value));
    }).catch(() => {}); // keep defaults on error
  }, []);

  // Reload chart data whenever endpoint or period changes
  useEffect(() => {
    setLoading(true);
    setData([]);
    const points = PERIOD_POINTS[period] ?? 60;
    getEndpointChart(endpointId, period, points)
      .then((pts) => setData(pts.map((p) => ({ ...p, ts: new Date(p.timestamp).getTime() }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [endpointId, period]);

  // Append live WS event as a new point and trim the sliding window
  useEffect(() => {
    if (!latestEvent || latestEvent.id_endpoint !== endpointId) return;
    const newPoint = {
      timestamp: latestEvent.checked_at,
      ts: new Date(latestEvent.checked_at).getTime(),
      avg_latency_ms: latestEvent.latency_ms ?? null,
      status: latestEvent.status,
    };
    const windowMs = PERIOD_MS[periodRef.current] ?? PERIOD_MS['1h'];
    setData((prev) => {
      const cutoff = Date.now() - windowMs;
      return [...prev.filter((p) => p.ts >= cutoff), newPoint];
    });
  }, [latestEvent, endpointId]);


  return (
    <div>
      {/* Period selector */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {availablePeriods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              period === p.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="h-48 flex items-center justify-center text-gray-500 animate-pulse text-sm">
          Loading chart…
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          No data for this period yet.
        </div>
      )}

      {!loading && data.length > 0 && (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tickFormatter={(ts) => formatTick(ts, period)}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickCount={6}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" ms" width={55} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb', marginBottom: 4 }}
              labelFormatter={(ts) => new Date(ts).toLocaleString()}
              formatter={(val) => [`${val} ms`, 'Latency']}
            />
            <Line
              type="monotone"
              dataKey="avg_latency_ms"
              stroke={LINE_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
