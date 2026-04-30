// Shared period definitions used by both LatencyChart and UptimeBadge lists.
// `hours` is compared against RETENTION_HOURS to decide which options to show.
export const ALL_PERIODS = [
  { label: '1m',  value: '1min',  hours: 1 / 60 },
  { label: '5m',  value: '5min',  hours: 5 / 60 },
  { label: '10m', value: '10min', hours: 10 / 60 },
  { label: '30m', value: '30min', hours: 0.5 },
  { label: '1h',  value: '1h',   hours: 1 },
  { label: '6h',  value: '6h',   hours: 6 },
  { label: '24h', value: '24h',  hours: 24 },
  { label: '7d',  value: '7d',   hours: 168 },
  { label: '30d', value: '30d',  hours: 720 },
];

export function filterPeriods(retentionHours) {
  const visible = ALL_PERIODS.filter((p) => p.hours <= retentionHours);
  return visible.length > 0 ? visible : [ALL_PERIODS[0]];
}
