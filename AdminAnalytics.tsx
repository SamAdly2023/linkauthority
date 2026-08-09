import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Users, Globe, Coins, DollarSign, ShieldCheck, Link2, Radio } from 'lucide-react';
import { User, Website, Transaction } from './types';

interface AdminAnalyticsProps {
  users: User[];
  websites: Website[];
  transactions: Transaction[];
}

const PALETTE = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  pending: '#f59e0b',
  failed: '#ef4444'
};

const shortUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ users, websites, transactions }) => {
  const totalUsers = users.length;
  const totalWebsites = websites.length;
  const verifiedWebsites = websites.filter(w => w.isVerified).length;
  const activePartnerSites = websites.filter(w => w.isActive).length;
  const pointsInCirculation = users.reduce((sum, u) => sum + (u.points || 0), 0);

  const revenueTransactions = transactions.filter(t => t.sourceUrl === 'PayPal Purchase');
  const totalRevenue = revenueTransactions.reduce((sum, t: any) => sum + (t.amount || 0), 0);

  const backlinkExchanges = transactions.filter(t => t.type === 'spend' && t.sourceUrl !== 'PayPal Purchase' && t.sourceUrl !== 'Admin Adjustment').length;

  // Transaction volume over the last 14 days (real timestamps)
  const days: { key: string; label: string; earn: number; spend: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toDateString(),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      earn: 0,
      spend: 0
    });
  }
  const dayIndex = new Map(days.map((d, i) => [d.key, i]));
  transactions.forEach((t: any) => {
    const ts = t.timestamp ? new Date(t.timestamp) : null;
    if (!ts || isNaN(ts.getTime())) return;
    const idx = dayIndex.get(ts.toDateString());
    if (idx === undefined) return;
    if (t.type === 'earn') days[idx].earn += t.points || 0;
    else days[idx].spend += t.points || 0;
  });

  // Transaction status breakdown
  const statusCounts: Record<string, number> = {};
  transactions.forEach((t: any) => {
    const status = t.status || 'pending';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Website category breakdown
  const categoryCounts: Record<string, number> = {};
  websites.forEach(w => {
    const cat = w.category || 'Uncategorized';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  const categoryData = Object.entries(categoryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Top websites by Domain Authority
  const topWebsites = [...websites]
    .sort((a, b) => (b.domainAuthority || 0) - (a.domainAuthority || 0))
    .slice(0, 8)
    .map(w => ({ name: shortUrl(w.url), da: w.domainAuthority || 0 }));

  const kpis = [
    { label: 'Total Users', value: totalUsers.toLocaleString(), icon: Users, color: 'blue' },
    { label: 'Websites (Verified)', value: `${totalWebsites} (${verifiedWebsites})`, icon: Globe, color: 'green' },
    { label: 'Live via Plugin', value: activePartnerSites.toLocaleString(), icon: Radio, color: 'indigo' },
    { label: 'Points in Circulation', value: pointsInCirculation.toLocaleString(), icon: Coins, color: 'purple' },
    { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'amber' },
    { label: 'Backlinks Exchanged', value: backlinkExchanges.toLocaleString(), icon: Link2, color: 'cyan' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {kpis.map((stat, i) => (
          <div key={i} className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
            <div className={`p-3 bg-${stat.color}-500/10 text-${stat.color}-500 rounded-2xl shrink-0`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {/* Transaction Volume + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
          <h3 className="text-xl font-bold mb-8">Transaction Volume (Last 14 Days)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days}>
                <defs>
                  <linearGradient id="colorEarn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis hide />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="earn" name="Points Earned" stroke="#22c55e" fillOpacity={1} fill="url(#colorEarn)" strokeWidth={2} />
                <Area type="monotone" dataKey="spend" name="Points Spent" stroke="#ef4444" fillOpacity={1} fill="url(#colorSpend)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
          <h3 className="text-xl font-bold mb-8">Transaction Status</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || PALETTE[i % PALETTE.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px', textTransform: 'capitalize' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Breakdown + Top Websites */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
          <h3 className="text-xl font-bold mb-8">Websites by Category</h3>
          <div className="h-72">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No websites yet</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
          <h3 className="text-xl font-bold mb-8">Top Websites by Domain Authority</h3>
          <div className="h-72">
            {topWebsites.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topWebsites} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" axisLine={false} tickLine={false} width={140} fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                  <Bar dataKey="da" name="Domain Authority" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No websites yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-slate-900/30 border border-slate-800 rounded-2xl p-4 text-xs text-slate-500">
        <ShieldCheck size={16} className="shrink-0 mt-0.5" />
        <p>
          Revenue and backlink-exchange figures are computed from live transaction records. Signup/website-creation
          dates were not tracked before this dashboard shipped, so historical cohort trends will fill in going forward
          as <code className="text-slate-400">createdAt</code> is now recorded for new users and websites.
        </p>
      </div>
    </div>
  );
};

export default AdminAnalytics;
