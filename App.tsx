
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';
import { 
  LayoutDashboard, 
  Globe, 
  History, 
  Zap, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  BrainCircuit,
  Settings,
  User as UserIcon
} from 'lucide-react';
import { Tab, User, Website, Transaction } from './types';
import { getSEOAdvice } from './services/geminiService';

// Mock Data
const INITIAL_USER: User = {
  id: 'u1',
  name: 'Alex SEO',
  email: 'alex@example.com',
  points: 125,
  websites: [
    { id: 'w1', url: 'https://techblog.io', domainAuthority: 42, category: 'Technology', verified: true },
    { id: 'w2', url: 'https://devtips.com', domainAuthority: 31, category: 'Education', verified: true },
  ]
};

const MARKETPLACE_SITES: Website[] = [
  { id: 'm1', url: 'https://financesage.com', domainAuthority: 55, category: 'Finance', verified: true },
  { id: 'm2', url: 'https://healthyliving.net', domainAuthority: 38, category: 'Health', verified: true },
  { id: 'm3', url: 'https://gadgetmaster.xyz', domainAuthority: 45, category: 'Tech', verified: true },
  { id: 'm4', url: 'https://travelbuddy.org', domainAuthority: 29, category: 'Travel', verified: true },
  { id: 'm5', url: 'https://fashionforward.it', domainAuthority: 41, category: 'Lifestyle', verified: true },
];

const RECENT_TRANSACTIONS: Transaction[] = [
  { id: 't1', type: 'earn', points: 42, sourceUrl: 'https://techblog.io', targetUrl: 'https://other-guy.com', timestamp: '2023-11-20', status: 'completed' },
  { id: 't2', type: 'spend', points: 30, sourceUrl: 'https://premium-seo.net', targetUrl: 'https://devtips.com', timestamp: '2023-11-19', status: 'completed' },
  { id: 't3', type: 'earn', points: 31, sourceUrl: 'https://devtips.com', targetUrl: 'https://client-site.io', timestamp: '2023-11-18', status: 'completed' },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Dashboard);
  const [user, setUser] = useState<User | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/current_user')
      .then(res => res.json())
      .then(data => {
        if (data && data._id) {
           // Transform backend user to frontend user type if necessary
           // For now, we'll just use the data and ensure it matches or extend the type
           // We might need to map _id to id
           setUser({ ...data, id: data._id });
        } else {
            // For demo purposes, if no backend, maybe keep using mock?
            // But user asked for login functionality.
            // So we stay logged out.
        }
      })
      .catch(err => console.log(err));
  }, []);

  const handleGetAdvice = async () => {
    if (!user || !user.websites || user.websites.length === 0) return;
    setLoadingAi(true);
    const advice = await getSEOAdvice(user.websites[0].url, user.websites[0].domainAuthority);
    setAiAdvice(advice);
    setLoadingAi(false);
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center p-8 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl">
          <div className="bg-blue-600 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to LinkAuthority</h1>
          <p className="text-slate-400 mb-8">The #1 Marketplace for High-Quality Backlinks</p>
          <a 
            href="/auth/google" 
            className="inline-flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-xl font-bold hover:bg-slate-100 transition-all hover:scale-105"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
            Sign in with Google
          </a>
          <div className="mt-6">
             <button onClick={() => setUser(INITIAL_USER)} className="text-sm text-slate-500 hover:text-slate-300 underline">
                Continue as Guest (Demo)
             </button>
          </div>
        </div>
      </div>
    );
  }

  const SidebarItem = ({ tab, icon: Icon, label }: { tab: Tab, icon: any, label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        activeTab === tab 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 flex flex-col p-6 gap-8 shrink-0">
        <div className="flex items-center gap-2 px-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            LinkAuthority
          </h1>
        </div>

        <nav className="flex flex-col gap-2">
          <SidebarItem tab={Tab.Dashboard} icon={LayoutDashboard} label="Dashboard" />
          <SidebarItem tab={Tab.Marketplace} icon={Search} label="Marketplace" />
          <SidebarItem tab={Tab.MySites} icon={Globe} label="My Websites" />
          <SidebarItem tab={Tab.History} icon={History} label="Transactions" />
          <SidebarItem tab={Tab.AIExpert} icon={BrainCircuit} label="AI SEO Expert" />
        </nav>

        <div className="mt-auto bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
              {user.name ? user.name.substring(0, 2).toUpperCase() : 'U'}
            </div>
            <div>
              <p className="text-sm font-semibold truncate w-32">{user.name}</p>
              <p className="text-xs text-slate-500 truncate w-32">{user.email}</p>
            </div>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400 mb-3">
            <span>Points Balance</span>
            <span className="text-blue-400 font-bold">{user.points} DA</span>
          </div>
          <a href="/api/logout" className="w-full flex items-center justify-center gap-2 text-xs font-medium bg-slate-800 hover:bg-red-900/30 hover:text-red-400 py-2 rounded-lg transition-colors">
             Logout
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 capitalize">{activeTab}</h2>
            <p className="text-slate-400">Welcome back, {user.name.split(' ')[0]}!</p>
          </div>
          <div className="flex gap-4">
            <div className="relative group">
               <Zap className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={18} />
               <span className="pl-10 pr-4 py-2 bg-amber-400/10 text-amber-400 rounded-full border border-amber-400/20 font-bold text-sm">
                 {user.points} Points Available
               </span>
            </div>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 font-medium">
              <Plus size={18} />
              Add Website
            </button>
          </div>
        </header>

        {activeTab === Tab.Dashboard && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Active Sites', value: user.websites.length, icon: Globe, color: 'blue' },
                { label: 'Links Hosted', value: 124, icon: ArrowUpRight, color: 'green' },
                { label: 'Links Received', value: 86, icon: ArrowDownLeft, color: 'purple' },
              ].map((stat, i) => (
                <div key={i} className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                  </div>
                  <div className={`p-4 bg-${stat.color}-500/10 text-${stat.color}-500 rounded-2xl`}>
                    <stat.icon size={28} />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Chart */}
              <div className="lg:col-span-2 bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold">Points Growth</h3>
                  <select className="bg-slate-800 border-none rounded-lg text-sm px-3 py-1 text-slate-300">
                    <option>Last 30 Days</option>
                    <option>Last 6 Months</option>
                  </select>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[
                      { name: 'Mon', pts: 100 },
                      { name: 'Tue', pts: 120 },
                      { name: 'Wed', pts: 110 },
                      { name: 'Thu', pts: 140 },
                      { name: 'Fri', pts: 125 },
                      { name: 'Sat', pts: 135 },
                      { name: 'Sun', pts: 125 },
                    ]}>
                      <defs>
                        <linearGradient id="colorPts" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#64748b" axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                      <Area type="monotone" dataKey="pts" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPts)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
                <h3 className="text-xl font-bold mb-6">Recent Activity</h3>
                <div className="space-y-6">
                  {RECENT_TRANSACTIONS.map(tx => (
                    <div key={tx.id} className="flex gap-4 items-start">
                      <div className={`p-2 rounded-lg shrink-0 ${tx.type === 'earn' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {tx.type === 'earn' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{tx.type === 'earn' ? 'Point Credit' : 'Link Purchase'}</p>
                        <p className="text-xs text-slate-500 truncate">{tx.timestamp}</p>
                      </div>
                      <div className={`text-sm font-bold ${tx.type === 'earn' ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.type === 'earn' ? '+' : '-'}{tx.points}
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setActiveTab(Tab.History)}
                  className="w-full mt-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
                >
                  View Full History
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === Tab.Marketplace && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
              <input 
                type="text" 
                placeholder="Search categories or niches..." 
                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {MARKETPLACE_SITES.filter(s => s.category.toLowerCase().includes(searchQuery.toLowerCase()) || s.url.includes(searchQuery)).map(site => (
                <div key={site.id} className="bg-slate-900/50 rounded-3xl p-6 border border-slate-800 hover:border-blue-500/30 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold uppercase tracking-wider">{site.category}</span>
                    <div className="flex items-center gap-1 text-blue-400 font-bold bg-blue-500/10 px-3 py-1 rounded-lg">
                      <Zap size={14} />
                      <span>DA {site.domainAuthority}</span>
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2 truncate group-hover:text-blue-400 transition-colors">{site.url}</h4>
                  <div className="flex items-center gap-2 text-slate-500 text-sm mb-6">
                    <ShieldCheck size={16} className="text-green-500" />
                    Verified Publisher
                  </div>
                  <div className="flex gap-3">
                    <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50" disabled={user.points < site.domainAuthority}>
                      Request Link ({site.domainAuthority} pts)
                    </button>
                    <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all">
                      <ExternalLink size={20} className="text-slate-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {user.points < 1 && (
              <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl flex items-center gap-4 text-red-400">
                <Zap size={24} className="shrink-0" />
                <div>
                  <p className="font-bold">Account Restricted</p>
                  <p className="text-sm opacity-80">You have less than 1 point. Your sites are hidden from the marketplace. Host a link to earn points.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === Tab.MySites && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="border-b border-slate-800 text-slate-500 text-sm uppercase tracking-wider">
                       <th className="pb-4 font-semibold">Website URL</th>
                       <th className="pb-4 font-semibold text-center">Domain Authority</th>
                       <th className="pb-4 font-semibold text-center">Status</th>
                       <th className="pb-4 font-semibold text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/50">
                     {user.websites.map(site => (
                       <tr key={site.id} className="group hover:bg-slate-800/30">
                         <td className="py-6 pr-4">
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                               <Globe size={20} />
                             </div>
                             <div>
                               <p className="font-bold text-white truncate max-w-xs">{site.url}</p>
                               <p className="text-xs text-slate-500">{site.category}</p>
                             </div>
                           </div>
                         </td>
                         <td className="py-6 text-center">
                           <span className="text-xl font-bold text-blue-400">{site.domainAuthority}</span>
                         </td>
                         <td className="py-6 text-center">
                           <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold">
                             <span className="w-2 h-2 rounded-full bg-green-500"></span>
                             Verified
                           </div>
                         </td>
                         <td className="py-6 text-right">
                           <div className="flex justify-end gap-2">
                             <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                               <RefreshCw size={18} />
                             </button>
                             <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                               <Settings size={18} />
                             </button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
               <button className="w-full mt-6 py-4 border-2 border-dashed border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 rounded-2xl flex items-center justify-center gap-2 text-slate-500 hover:text-blue-400 transition-all font-medium">
                 <Plus size={20} />
                 Add Another Website
               </button>
             </div>
          </div>
        )}

        {activeTab === Tab.History && (
          <div className="bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold">Transaction Ledger</h3>
              <div className="flex gap-2">
                 <button className="px-4 py-2 bg-slate-800 text-sm font-medium rounded-xl text-slate-300">Export CSV</button>
              </div>
            </div>
            <div className="p-8">
               <div className="space-y-4">
                 {RECENT_TRANSACTIONS.map(tx => (
                   <div key={tx.id} className="flex items-center justify-between p-6 bg-slate-800/30 rounded-2xl border border-slate-800/50 hover:bg-slate-800/50 transition-all">
                     <div className="flex items-center gap-4">
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tx.type === 'earn' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                         {tx.type === 'earn' ? <Zap size={24} /> : <Zap size={24} className="opacity-50" />}
                       </div>
                       <div>
                         <div className="flex items-center gap-2">
                           <span className="font-bold text-white capitalize">{tx.type} Points</span>
                           <span className="text-xs px-2 py-0.5 bg-slate-800 rounded text-slate-500 font-bold uppercase">{tx.status}</span>
                         </div>
                         <p className="text-sm text-slate-400 mt-1">
                           From <span className="text-slate-300 font-mono text-xs">{tx.sourceUrl}</span> 
                           <span className="mx-2">→</span> 
                           To <span className="text-slate-300 font-mono text-xs">{tx.targetUrl}</span>
                         </p>
                       </div>
                     </div>
                     <div className="text-right">
                        <p className={`text-xl font-black ${tx.type === 'earn' ? 'text-green-500' : 'text-red-500'}`}>
                          {tx.type === 'earn' ? '+' : '-'}{tx.points}
                        </p>
                        <p className="text-xs text-slate-500 font-medium">{tx.timestamp}</p>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === Tab.AIExpert && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
               <BrainCircuit size={120} className="absolute -right-10 -bottom-10 opacity-10" />
               <h3 className="text-3xl font-black mb-4">Gemini AI SEO Expert</h3>
               <p className="text-blue-100 text-lg mb-8 max-w-xl opacity-90">
                 Get specialized advice on link placement, domain strategy, and how to maximize your points exchange efficiency using Google's most powerful AI.
               </p>
               <button 
                onClick={handleGetAdvice}
                disabled={loadingAi}
                className="bg-white text-blue-700 px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-blue-50 transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50"
               >
                 {loadingAi ? <RefreshCw className="animate-spin" /> : <BrainCircuit />}
                 Analyze my Website Profile
               </button>
            </div>

            {aiAdvice && (
              <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 animate-in fade-in zoom-in duration-500">
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl">
                     <Zap size={24} />
                   </div>
                   <h4 className="text-2xl font-bold">Expert Recommendations</h4>
                </div>
                <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {aiAdvice}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
