// components/OrdersAreaChart.jsx
// ─────────────────────────────────────────────────────────────────────────────
// CHANGE vs previous version:
//   • Now accepts EITHER the new `dailyData` prop (from /api/store/dashboard)
//     OR the legacy `allOrders` array — both are supported.
//   • `dailyData` shape: [{ date: "DD MMM", revenue: 1234, orders: 5 }, ...]
//     — this is what /api/store/dashboard already returns, no API change needed.
//   • When `dailyData` is provided it is used directly (no client-side grouping).
//   • Falls back to grouping `allOrders` by date if `dailyData` is absent.
//   • Dual Y-axis: left = Orders, right = Revenue.
//   • Tooltip shows both metrics.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.dataKey === 'revenue'
            ? `₹${Number(entry.value).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
            : entry.value}
        </p>
      ))}
    </div>
  );
}

/**
 * Props:
 *   dailyData  — [{ date, revenue, orders }]  ← preferred (from dashboard API)
 *   allOrders  — raw Order[] array             ← legacy fallback
 *   showRevenue — boolean (default true)
 */
export default function OrdersAreaChart({ dailyData, allOrders, showRevenue = true }) {
  // ── Build chart data ──────────────────────────────────────────────────────
  let chartData = [];

  if (dailyData && dailyData.length > 0) {
    // New format — already aggregated by the server
    chartData = dailyData.map((d) => ({
      date:    d.date,
      orders:  Number(d.orders  || 0),
      revenue: Number(d.revenue || 0),
    }));
  } else if (allOrders && allOrders.length > 0) {
    // Legacy format — group client-side
    const grouped = allOrders.reduce((acc, order) => {
      const date = new Date(order.createdAt).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = { orders: 0, revenue: 0 };
      acc[date].orders  += 1;
      acc[date].revenue += Number(order.total || 0);
      return acc;
    }, {});
    chartData = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date:    date,
        orders:  vals.orders,
        revenue: vals.revenue,
      }));
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center text-slate-400 text-sm">
        No order data yet
      </div>
    );
  }

  return (
    <div className="w-full h-[300px] text-xs">
      <h3 className="text-lg font-medium text-slate-800 mb-4 pt-2 text-right">
        <span className="text-slate-500">Orders /</span> Day
      </h3>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2}  />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />

          {/* Left Y — orders */}
          <YAxis
            yAxisId="left"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'Orders', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94a3b8' } }}
          />

          {/* Right Y — revenue (optional) */}
          {showRevenue && (
            <YAxis
              yAxisId="right"
              orientation="right"
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
            />
          )}

          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

          <Area
            yAxisId="left"
            type="monotone"
            dataKey="orders"
            name="Orders"
            stroke="#4f46e5"
            fill="url(#colorOrders)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />

          {showRevenue && (
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="revenue"
              name="Revenue (₹)"
              stroke="#10b981"
              fill="url(#colorRevenue)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}