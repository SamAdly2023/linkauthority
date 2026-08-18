import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface AreaChartPanelProps {
  data: any[];
  /** Key on each datum holding the value to plot. */
  dataKey: string;
  /** Key on each datum holding the x-axis label. */
  labelKey: string;
  /** Unique gradient id - two of these can render on one page. */
  gradientId: string;
  showYAxis?: boolean;
}

/**
 * The only place recharts is imported outside the admin analytics screen.
 *
 * Keeping it in its own module lets App.tsx load it lazily: recharts is a few
 * hundred KB and none of it is needed by a logged-out visitor on the landing
 * page, which is the only page organic traffic ever sees.
 */
const AreaChartPanel: React.FC<AreaChartPanelProps> = ({
  data, dataKey, labelKey, gradientId, showYAxis = false
}) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" vertical={!showYAxis ? false : true} stroke="#1e293b" />
      <XAxis dataKey={labelKey} stroke="#64748b" axisLine={showYAxis} tickLine={showYAxis} />
      {showYAxis ? <YAxis stroke="#64748b" /> : <YAxis hide />}
      <Tooltip
        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
        itemStyle={{ color: '#fff' }}
      />
      <Area type="monotone" dataKey={dataKey} stroke="#3b82f6" fillOpacity={1} fill={`url(#${gradientId})`} strokeWidth={3} />
    </AreaChart>
  </ResponsiveContainer>
);

export default AreaChartPanel;
