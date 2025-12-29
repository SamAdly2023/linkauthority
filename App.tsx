
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
  User as UserIcon,
  X,
  BookOpen,
  CreditCard,
  CheckCircle2,
  Users,
  Database,
  FileText,
  Sliders,
  Menu
} from 'lucide-react';
import { Tab, User, Website, Transaction } from './types';
import { getSEOAdvice } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Dashboard);
  const [user, setUser] = useState<User | null>(null);
  const [marketplaceSites, setMarketplaceSites] = useState<Website[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteCategory, setNewSiteCategory] = useState('');

  // Admin State
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminWebsites, setAdminWebsites] = useState<Website[]>([]);
  const [adminTransactions, setAdminTransactions] = useState<Transaction[]>([]);

  // Modal States
  const [purchaseModal, setPurchaseModal] = useState<{ isOpen: boolean, site: Website | null }>({ isOpen: false, site: null });
  const [verifyModal, setVerifyModal] = useState<{ isOpen: boolean, transaction: Transaction | null }>({ isOpen: false, transaction: null });
  const [messageModal, setMessageModal] = useState<{ isOpen: boolean, title: string, message: string, type: 'success' | 'error' }>({ isOpen: false, title: '', message: '', type: 'success' });
  const [checkoutModal, setCheckoutModal] = useState<{ isOpen: boolean, plan: { name: string, points: number, price: number } | null }>({ isOpen: false, plan: null });
  
  // Input States for Modals
  const [purchaseSourceUrl, setPurchaseSourceUrl] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  
  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchMarketplace();
      fetchTransactions();
      if (user.email === 'samadly728@gmail.com') {
        // Pre-fetch admin data if admin
        fetchAdminData();
      }
    }
  }, [user]);

  const fetchAdminData = async () => {
    try {
      const [usersRes, sitesRes, txRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/websites'),
        fetch('/api/admin/transactions')
      ]);
      
      if (usersRes.ok) setAdminUsers(await usersRes.json());
      if (sitesRes.ok) setAdminWebsites(await sitesRes.json());
      if (txRes.ok) setAdminTransactions(await txRes.json());
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    }
  };

  const fetchUser = () => {
    fetch('/api/current_user')
      .then(res => res.json())
      .then(data => {
        if (data && (data._id || data.googleId)) {
           setUser({ ...data, id: data._id });
        }
      })
      .catch(err => console.log(err));
  };

  const fetchMarketplace = () => {
    fetch('/api/marketplace')
      .then(res => res.json())
      .then(data => setMarketplaceSites(data.map((d: any) => ({ ...d, id: d._id }))))
      .catch(err => console.log(err));
  };

  const fetchTransactions = () => {
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => setTransactions(data.map((d: any) => ({ ...d, id: d._id }))))
      .catch(err => console.log(err));
  };

  const handleAddWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteUrl || !newSiteCategory) return;

    try {
      const res = await fetch('/api/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newSiteUrl, category: newSiteCategory })
      });
      
      if (res.ok) {
        setShowAddSiteModal(false);
        setNewSiteUrl('');
        setNewSiteCategory('');
        fetchUser(); // Refresh user to see new site
        setMessageModal({ isOpen: true, title: 'Success', message: 'Website added successfully!', type: 'success' });
      } else {
        setMessageModal({ isOpen: true, title: 'Error', message: 'Failed to add website', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessageModal({ isOpen: true, title: 'Error', message: 'An unexpected error occurred', type: 'error' });
    }
  };

  const openVerifyModal = (tx: Transaction) => {
    setVerifyModal({ isOpen: true, transaction: tx });
    setVerificationUrl('');
  };

  const submitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyModal.transaction || !verificationUrl) return;

    try {
      const res = await fetch('/api/transaction/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: verifyModal.transaction._id || verifyModal.transaction.id, verificationUrl })
      });

      if (res.ok) {
        setVerifyModal({ isOpen: false, transaction: null });
        fetchUser();
        fetchTransactions();
        setMessageModal({ isOpen: true, title: 'Success', message: 'Verification successful! Points credited.', type: 'success' });
      } else {
        const err = await res.json();
        setMessageModal({ isOpen: true, title: 'Verification Failed', message: err.error || 'Verification failed', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessageModal({ isOpen: true, title: 'Error', message: 'Verification failed due to network error', type: 'error' });
    }
  };

  const openPurchaseModal = (site: Website) => {
    if (!user || user.websites.length === 0) {
      setMessageModal({ 
        isOpen: true, 
        title: 'Action Required', 
        message: "You need to add a website first to be the source of the link (or just to have an account context).", 
        type: 'error' 
      });
      return;
    }
    setPurchaseModal({ isOpen: true, site });
    setPurchaseSourceUrl('');
  };

  const submitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseModal.site || !purchaseSourceUrl) return;

    try {
      const res = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: purchaseModal.site.url, // The seller's site
          sourceUrl: purchaseSourceUrl, // My site
          cost: purchaseModal.site.domainAuthority
        })
      });

      if (res.ok) {
        setPurchaseModal({ isOpen: false, site: null });
        fetchUser();
        fetchTransactions();
        setMessageModal({ isOpen: true, title: 'Success', message: 'Transaction initiated! Awaiting verification.', type: 'success' });
      } else {
        const err = await res.json();
        setMessageModal({ isOpen: true, title: 'Transaction Failed', message: err.error || 'Transaction failed', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessageModal({ isOpen: true, title: 'Error', message: 'Transaction failed due to network error', type: 'error' });
    }
  };

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
    <div className="flex h-screen bg-slate-950 overflow-hidden relative">
      {/* Add Site Modal */}
      {showAddSiteModal && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md relative shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowAddSiteModal(false)} className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-white mb-6">Add New Website</h3>
            <form onSubmit={handleAddWebsite} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Website URL</label>
                <input 
                  type="url" 
                  required
                  placeholder="https://example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                  value={newSiteUrl}
                  onChange={e => setNewSiteUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Category</label>
                <select 
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                  value={newSiteCategory}
                  onChange={e => setNewSiteCategory(e.target.value)}
                >
                  <option value="">Select Category</option>
                  <option value="Technology">Technology</option>
                  <option value="Finance">Finance</option>
                  <option value="Health">Health</option>
                  <option value="Lifestyle">Lifestyle</option>
                  <option value="Education">Education</option>
                  <option value="Travel">Travel</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20">
                Verify & Add Website
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {purchaseModal.isOpen && purchaseModal.site && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md relative shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
            <button onClick={() => setPurchaseModal({ isOpen: false, site: null })} className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-600/20 text-blue-500 rounded-xl">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Request Backlink</h3>
                <p className="text-slate-400 text-sm">From {purchaseModal.site.url}</p>
              </div>
            </div>
            
            <form onSubmit={submitPurchase} className="space-y-6">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Cost</span>
                  <span className="text-white font-bold">{purchaseModal.site.domainAuthority} Points</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Your Balance</span>
                  <span className={`${(user?.points || 0) < purchaseModal.site.domainAuthority ? 'text-red-400' : 'text-green-400'} font-bold`}>
                    {user?.points} Points
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-2">Your Website URL (Source)</label>
                <input 
                  type="url" 
                  required
                  placeholder="https://my-site.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                  value={purchaseSourceUrl}
                  onChange={e => setPurchaseSourceUrl(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-2">
                  This is the site you want to promote. The seller will place a link to this URL on their site.
                </p>
              </div>

              <button 
                type="submit" 
                disabled={(user?.points || 0) < purchaseModal.site.domainAuthority}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20"
              >
                Confirm Purchase
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {verifyModal.isOpen && verifyModal.transaction && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md relative shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
            <button onClick={() => setVerifyModal({ isOpen: false, transaction: null })} className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-white mb-2">Verify Backlink</h3>
            <p className="text-slate-400 text-sm mb-6">
              Submit the URL where you placed the link to <span className="text-white font-mono">{verifyModal.transaction.sourceUrl}</span>
            </p>
            
            <form onSubmit={submitVerification} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Verification URL</label>
                <input 
                  type="url" 
                  required
                  placeholder={`https://${verifyModal.transaction.targetUrl}/blog/post-1`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                  value={verificationUrl}
                  onChange={e => setVerificationUrl(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Our system will scan this page for a dofollow link to the buyer's site.
                </p>
              </div>
              <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-green-600/20">
                Verify & Claim Points
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutModal.isOpen && checkoutModal.plan && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-md max-h-[90vh] overflow-y-auto relative shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            <button onClick={() => setCheckoutModal({ isOpen: false, plan: null })} className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors z-10">
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-white mb-1">Checkout</h3>
            <p className="text-slate-400 text-sm mb-4">Purchasing <span className="text-white font-bold">{checkoutModal.plan.points} Points</span> for <span className="text-white font-bold">${checkoutModal.plan.price}</span></p>
            
            <div id="paypal-button-container" className="min-h-[150px]" ref={(el) => {
                if (el && !el.hasChildNodes() && (window as any).paypal) {
                    (window as any).paypal.Buttons({
                        createOrder: (data: any, actions: any) => {
                            return actions.order.create({
                                purchase_units: [{
                                    amount: {
                                        value: checkoutModal.plan?.price.toString()
                                    }
                                }]
                            });
                        },
                        onApprove: (data: any, actions: any) => {
                            return actions.order.capture().then((details: any) => {
                                // Call backend to credit points
                                fetch('/api/buy-points', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ 
                                        points: checkoutModal.plan?.points, 
                                        amount: checkoutModal.plan?.price,
                                        orderId: data.orderID
                                    })
                                })
                                .then(res => res.json())
                                .then(() => {
                                    setCheckoutModal({ isOpen: false, plan: null });
                                    setMessageModal({ isOpen: true, title: 'Payment Successful', message: `Transaction completed by ${details.payer.name.given_name}. Points added!`, type: 'success' });
                                    fetchUser();
                                });
                            });
                        },
                        onError: (err: any) => {
                            console.error(err);
                            setMessageModal({ isOpen: true, title: 'Payment Error', message: 'Something went wrong with PayPal.', type: 'error' });
                        }
                    }).render(el);
                }
            }}></div>
          </div>
        </div>
      )}

      {/* Message Modal (Alert Replacement) */}
      {messageModal.isOpen && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-sm relative shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${messageModal.type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
              {messageModal.type === 'success' ? <ShieldCheck size={32} /> : <X size={32} />}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{messageModal.title}</h3>
            <p className="text-slate-400 mb-6">{messageModal.message}</p>
            <button 
              onClick={() => setMessageModal({ ...messageModal, isOpen: false })}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <ShieldCheck className="text-white" size={20} />
          </div>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            LinkAuthority
          </h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-400 hover:text-white">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-950 border-r border-slate-800 flex flex-col p-6 gap-8 transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center gap-2 px-2 md:flex hidden">
          <div className="bg-blue-600 p-2 rounded-lg">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            LinkAuthority
          </h1>
        </div>
        
        {/* Mobile Menu Header Spacer */}
        <div className="md:hidden h-10"></div>

        {user?.email === 'samadly728@gmail.com' && (
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button 
              onClick={() => { setIsAdminMode(false); setActiveTab(Tab.Dashboard); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!isAdminMode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Client
            </button>
            <button 
              onClick={() => { setIsAdminMode(true); setActiveTab(Tab.AdminUsers); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${isAdminMode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Admin
            </button>
          </div>
        )}

        <nav className="flex flex-col gap-2">
          {!isAdminMode ? (
            <>
              <SidebarItem tab={Tab.Dashboard} icon={LayoutDashboard} label="Dashboard" />
              <SidebarItem tab={Tab.Marketplace} icon={Search} label="Marketplace" />
              <SidebarItem tab={Tab.MySites} icon={Globe} label="My Websites" />
              <SidebarItem tab={Tab.History} icon={History} label="Transactions" />
              <SidebarItem tab={Tab.AIExpert} icon={BrainCircuit} label="AI SEO Expert" />
              <SidebarItem tab={Tab.Guide} icon={BookOpen} label="Guide & Pricing" />
            </>
          ) : (
            <>
              <SidebarItem tab={Tab.AdminUsers} icon={Users} label="All Users" />
              <SidebarItem tab={Tab.AdminWebsites} icon={Globe} label="All Websites" />
              <SidebarItem tab={Tab.AdminTransactions} icon={FileText} label="All Transactions" />
              <SidebarItem tab={Tab.AdminSettings} icon={Sliders} label="Settings" />
            </>
          )}
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
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 md:pt-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 capitalize">{activeTab.replace('admin_', 'Admin ')}</h2>
            <p className="text-slate-400 text-sm md:text-base">Welcome back, {user.name.split(' ')[0]}!</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative group flex-1 md:flex-none">
               <Zap className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={18} />
               <span className="block w-full md:w-auto pl-10 pr-4 py-2 bg-amber-400/10 text-amber-400 rounded-full border border-amber-400/20 font-bold text-sm text-center">
                 {user.points} Points
               </span>
            </div>
            <button 
              onClick={() => setShowAddSiteModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 md:px-5 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 font-medium whitespace-nowrap"
            >
              <Plus size={18} />
              <span className="hidden md:inline">Add Website</span>
              <span className="md:hidden">Add</span>
            </button>
          </div>
        </header>

        {activeTab === Tab.Dashboard && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Active Sites', value: user.websites.length, icon: Globe, color: 'blue' },
                { label: 'Links Hosted', value: transactions.filter(t => t.type === 'earn').length, icon: ArrowUpRight, color: 'green' },
                { label: 'Links Received', value: transactions.filter(t => t.type === 'spend').length, icon: ArrowDownLeft, color: 'purple' },
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
                  {transactions.slice(0, 3).map(tx => (
                    <div key={tx.id} className="flex gap-4 items-start">
                      <div className={`p-2 rounded-lg shrink-0 ${tx.type === 'earn' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {tx.type === 'earn' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{tx.type === 'earn' ? 'Point Credit' : 'Link Purchase'}</p>
                        <p className="text-xs text-slate-500 truncate">{new Date(tx.timestamp).toLocaleDateString()}</p>
                      </div>
                      <div className={`text-sm font-bold ${tx.type === 'earn' ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.type === 'earn' ? '+' : '-'}{tx.points}
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && <p className="text-slate-500 text-sm">No transactions yet.</p>}
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
              {marketplaceSites.filter(s => s.category.toLowerCase().includes(searchQuery.toLowerCase()) || s.url.includes(searchQuery)).map(site => (
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
                    <button 
                      onClick={() => openPurchaseModal(site)}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50" 
                      disabled={user.points < site.domainAuthority}
                    >
                      Request Link ({site.domainAuthority} pts)
                    </button>
                    <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all">
                      <ExternalLink size={20} className="text-slate-400" />
                    </button>
                  </div>
                </div>
              ))}
              {marketplaceSites.length === 0 && (
                <div className="col-span-full text-center py-10 text-slate-500">
                  No websites available in the marketplace yet. Be the first to add one!
                </div>
              )}
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
               <button 
                onClick={() => setShowAddSiteModal(true)}
                className="w-full mt-6 py-4 border-2 border-dashed border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 rounded-2xl flex items-center justify-center gap-2 text-slate-500 hover:text-blue-400 transition-all font-medium"
               >
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
                 {transactions.map(tx => (
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
                           Link From <span className="text-slate-300 font-mono text-xs">{tx.targetUrl}</span> 
                           <span className="mx-2">→</span> 
                           To <span className="text-slate-300 font-mono text-xs">{tx.sourceUrl}</span>
                         </p>
                       </div>
                     </div>
                     <div className="text-right flex flex-col items-end">
                        <p className={`text-xl font-black ${tx.type === 'earn' ? 'text-green-500' : 'text-red-500'}`}>
                          {tx.type === 'earn' ? '+' : '-'}{tx.points}
                        </p>
                        <p className="text-xs text-slate-500 font-medium mb-2">{new Date(tx.timestamp).toLocaleDateString()}</p>
                        
                        {tx.status === 'pending' && tx.type === 'earn' && (
                            <button 
                                onClick={() => openVerifyModal(tx)}
                                className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-colors"
                            >
                                Verify Link
                            </button>
                        )}
                        {tx.status === 'pending' && tx.type === 'spend' && (
                            <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-xs font-bold rounded-lg border border-yellow-500/20">
                                Awaiting Verification
                            </span>
                        )}
                        {tx.status === 'completed' && tx.verificationUrl && (
                             <a href={tx.verificationUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                                 View Proof
                             </a>
                        )}
                     </div>
                   </div>
                 ))}
                 {transactions.length === 0 && <p className="text-slate-500 text-center">No transactions found.</p>}
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

        {activeTab === Tab.Guide && (
          <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Guide Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                  <Globe size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">1. Connect Your Site</h3>
                <p className="text-slate-400 leading-relaxed">
                  Add your website to the platform. Our AI will analyze your Domain Authority (DA) and assign a point value.
                </p>
              </div>

              <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 relative overflow-hidden group hover:border-green-500/30 transition-all">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all"></div>
                <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-2xl flex items-center justify-center mb-6">
                  <Zap size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">2. Earn Points</h3>
                <p className="text-slate-400 leading-relaxed">
                  Accept link requests from other users. Place their link on your site, verify it, and earn points equal to your DA.
                </p>
              </div>

              <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 relative overflow-hidden group hover:border-purple-500/30 transition-all">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all"></div>
                <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-6">
                  <ArrowUpRight size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">3. Boost SEO</h3>
                <p className="text-slate-400 leading-relaxed">
                  Use your points to buy high-quality backlinks from other verified sites in your niche. Watch your rankings climb!
                </p>
              </div>
            </div>

            {/* Pricing Section */}
            <div>
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-white mb-4">Fast Track Your Growth</h2>
                <p className="text-slate-400 max-w-2xl mx-auto">
                  Don't want to wait to earn points? Purchase points directly or subscribe for monthly benefits.
                  Secure payment via PayPal.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { name: 'Starter Pack', points: 50, price: 49, popular: false },
                  { name: 'Growth Pack', points: 100, price: 89, popular: true },
                  { name: 'Pro Pack', points: 250, price: 199, popular: false },
                  { name: 'Agency Pack', points: 1000, price: 699, popular: false },
                ].map((plan, i) => (
                  <div key={i} className={`bg-slate-900 p-8 rounded-3xl border ${plan.popular ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-800'} relative flex flex-col`}>
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Most Popular
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-3xl font-bold text-white">${plan.price}</span>
                      <span className="text-slate-500 text-sm">USD</span>
                    </div>
                    
                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-3 text-sm text-slate-300">
                        <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                        <span>{plan.points} Authority Points</span>
                      </li>
                      <li className="flex items-center gap-3 text-sm text-slate-300">
                        <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                        <span>Instant Credit</span>
                      </li>
                      <li className="flex items-center gap-3 text-sm text-slate-300">
                        <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                        <span>No Expiration</span>
                      </li>
                    </ul>

                    <button 
                      onClick={() => setCheckoutModal({ isOpen: true, plan })}
                      className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        plan.popular 
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20' 
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      <CreditCard size={18} />
                      Buy Now
                    </button>
                  </div>
                ))}
              </div>

              {/* Subscription Option */}
              <div className="mt-12 bg-gradient-to-r from-indigo-900/50 to-blue-900/50 p-8 rounded-3xl border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold text-white">Pro Membership</h3>
                    <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-lg">COMING SOON</span>
                  </div>
                  <p className="text-indigo-200 max-w-xl">
                    Get 30 points every month, priority support, and advanced SEO analytics for a flat monthly fee.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-bold text-white mb-1">$29<span className="text-lg text-indigo-300 font-normal">/mo</span></p>
                  <button disabled className="bg-indigo-600/50 text-indigo-200 px-8 py-3 rounded-xl font-bold cursor-not-allowed">
                    Join Waitlist
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Tabs */}
        {activeTab === Tab.AdminUsers && (
          <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-6">All Users</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-sm uppercase tracking-wider">
                    <th className="pb-4 font-semibold">Name</th>
                    <th className="pb-4 font-semibold">Email</th>
                    <th className="pb-4 font-semibold">Points</th>
                    <th className="pb-4 font-semibold">Websites</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {adminUsers.map((u: any) => (
                    <tr key={u._id} className="hover:bg-slate-800/30">
                      <td className="py-4 text-white font-medium">{u.name}</td>
                      <td className="py-4 text-slate-400">{u.email}</td>
                      <td className="py-4 text-blue-400 font-bold">{u.points}</td>
                      <td className="py-4 text-slate-400">{u.websites?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === Tab.AdminWebsites && (
          <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-6">All Websites</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-sm uppercase tracking-wider">
                    <th className="pb-4 font-semibold">URL</th>
                    <th className="pb-4 font-semibold">Owner</th>
                    <th className="pb-4 font-semibold">DA</th>
                    <th className="pb-4 font-semibold">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {adminWebsites.map((w: any) => (
                    <tr key={w._id} className="hover:bg-slate-800/30">
                      <td className="py-4 text-white font-medium">{w.url}</td>
                      <td className="py-4 text-slate-400">{w.owner?.name || 'Unknown'}</td>
                      <td className="py-4 text-blue-400 font-bold">{w.domainAuthority}</td>
                      <td className="py-4 text-slate-400">{w.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === Tab.AdminTransactions && (
          <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-6">All Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-sm uppercase tracking-wider">
                    <th className="pb-4 font-semibold">Date</th>
                    <th className="pb-4 font-semibold">User</th>
                    <th className="pb-4 font-semibold">Type</th>
                    <th className="pb-4 font-semibold">Points</th>
                    <th className="pb-4 font-semibold">Status</th>
                    <th className="pb-4 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {adminTransactions.map((t: any) => (
                    <tr key={t._id} className="hover:bg-slate-800/30">
                      <td className="py-4 text-slate-400 text-sm">{new Date(t.timestamp).toLocaleDateString()}</td>
                      <td className="py-4 text-white font-medium">{t.user?.name || 'Unknown'}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${t.type === 'earn' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="py-4 text-white font-bold">{t.points}</td>
                      <td className="py-4">
                         <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${t.status === 'completed' ? 'bg-blue-500/10 text-blue-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-4 text-slate-500 text-xs font-mono max-w-xs truncate">
                        {t.sourceUrl} -&gt; {t.targetUrl}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === Tab.AdminSettings && (
          <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-6">Platform Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-slate-300">Pricing Configuration</h4>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">Point Price (USD)</label>
                    <input type="number" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white" defaultValue="1.00" />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">Minimum Purchase</label>
                    <input type="number" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white" defaultValue="50" />
                  </div>
                  <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl">Save Changes</button>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-slate-300">System Status</h4>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Maintenance Mode</span>
                    <div className="w-12 h-6 bg-slate-800 rounded-full relative cursor-pointer">
                      <div className="absolute left-1 top-1 w-4 h-4 bg-slate-500 rounded-full"></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Allow New Registrations</span>
                    <div className="w-12 h-6 bg-green-500/20 rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
