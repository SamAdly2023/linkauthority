
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
  Menu,
  MapPin
} from 'lucide-react';
import { Tab, User, Website, Transaction, AIReport } from './types';
import { getSEOAdvice } from './services/geminiService';
import TermsOfService from './TermsOfService';
import PrivacyPolicy from './PrivacyPolicy';
import CitationsPage from './CitationsPage';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Dashboard);
  const [user, setUser] = useState<User | null>(null);
  const [marketplaceSites, setMarketplaceSites] = useState<Website[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [selectedAiSite, setSelectedAiSite] = useState<string>('');
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [isAiDropdownOpen, setIsAiDropdownOpen] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterServiceType, setFilterServiceType] = useState<'all' | 'local' | 'worldwide'>('all');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteCategory, setNewSiteCategory] = useState('');
  const [newSiteServiceType, setNewSiteServiceType] = useState<'worldwide' | 'local'>('worldwide');
  const [newSiteCountry, setNewSiteCountry] = useState('');
  const [newSiteCity, setNewSiteCity] = useState('');
  
  // Profile State
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', avatar: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAddingSite, setIsAddingSite] = useState(false);

  // Admin State
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminWebsites, setAdminWebsites] = useState<Website[]>([]);
  const [adminTransactions, setAdminTransactions] = useState<Transaction[]>([]);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [addPointsModal, setAddPointsModal] = useState<{ isOpen: boolean, user: any | null }>({ isOpen: false, user: null });
  const [pointsToAdd, setPointsToAdd] = useState<number>(0);

  // Modal States
  const [purchaseModal, setPurchaseModal] = useState<{ isOpen: boolean, site: Website | null }>({ isOpen: false, site: null });
  const [verifyModal, setVerifyModal] = useState<{ isOpen: boolean, transaction: Transaction | null }>({ isOpen: false, transaction: null });
  const [domainVerificationModal, setDomainVerificationModal] = useState<{ isOpen: boolean, website: Website | null }>({ isOpen: false, website: null });
  const [messageModal, setMessageModal] = useState<{ isOpen: boolean, title: string, message: string, type: 'success' | 'error' }>({ isOpen: false, title: '', message: '', type: 'success' });
  const [checkoutModal, setCheckoutModal] = useState<{ isOpen: boolean, plan: { name: string, points: number, price: number } | null }>({ isOpen: false, plan: null });
  const [editSiteModal, setEditSiteModal] = useState<{ isOpen: boolean, website: Website | null }>({ isOpen: false, website: null });
  const [editSiteCategory, setEditSiteCategory] = useState('');
  const [editSiteServiceType, setEditSiteServiceType] = useState<'worldwide' | 'local'>('worldwide');
  const [editSiteCountry, setEditSiteCountry] = useState('');
  const [editSiteCity, setEditSiteCity] = useState('');
  
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
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
        avatar: user.avatar || ''
      });
    }
  }, [user]);

  const handleAddPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPointsModal.user) return;

    try {
      const res = await fetch('/api/admin/users/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: addPointsModal.user._id, points: pointsToAdd })
      });

      if (res.ok) {
        setAddPointsModal({ isOpen: false, user: null });
        setPointsToAdd(0);
        fetchAdminData();
        setMessageModal({ isOpen: true, title: 'Success', message: 'Points added successfully', type: 'success' });
      } else {
        setMessageModal({ isOpen: true, title: 'Error', message: 'Failed to add points', type: 'error' });
      }
    } catch (err) {
      setMessageModal({ isOpen: true, title: 'Error', message: 'Something went wrong', type: 'error' });
    }
  };

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        setMessageModal({ isOpen: true, title: 'Success', message: 'Profile updated successfully', type: 'success' });
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (err) {
      setMessageModal({ isOpen: true, title: 'Error', message: 'Could not update profile', type: 'error' });
    } finally {
      setIsSavingProfile(false);
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

    setIsAddingSite(true);
    try {
      const res = await fetch('/api/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            url: newSiteUrl,
            category: newSiteCategory,
            serviceType: newSiteServiceType,
            location: newSiteServiceType === 'local' ? {
                country: newSiteCountry,
                city: newSiteCity
            } : undefined
        })
      });
      
      if (res.ok) {
        const website = await res.json();
        setShowAddSiteModal(false);
        setNewSiteUrl('');
        setNewSiteCategory('');
        setNewSiteServiceType('worldwide');
        setNewSiteCountry('');
        setNewSiteCity('');
        
        if (website.isVerified) {
            fetchUser(); // Refresh user to see new site
            setMessageModal({ isOpen: true, title: 'Success', message: 'Website added successfully!', type: 'success' });
        } else {
            setDomainVerificationModal({ isOpen: true, website });
        }
      } else {
        const err = await res.json();
        setMessageModal({ isOpen: true, title: 'Error', message: err.error || 'Failed to add website', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessageModal({ isOpen: true, title: 'Error', message: 'Something went wrong', type: 'error' });
    } finally {
      setIsAddingSite(false);
    }
  };

  const handleUpdateWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSiteModal.website) return;

    try {
      const res = await fetch(`/api/websites/${editSiteModal.website._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editSiteCategory,
          serviceType: editSiteServiceType,
          location: editSiteServiceType === 'local' ? { country: editSiteCountry, city: editSiteCity } : undefined
        })
      });

      if (res.ok) {
        const updatedSite = await res.json();
        // Update local state
        setUser(prev => prev ? {
            ...prev,
            websites: prev.websites.map(w => w._id === updatedSite._id ? updatedSite : w)
        } : null);
        
        setEditSiteModal({ isOpen: false, website: null });
        setMessageModal({ isOpen: true, title: 'Success', message: 'Website updated successfully', type: 'success' });
      } else {
        setMessageModal({ isOpen: true, title: 'Error', message: 'Failed to update website', type: 'error' });
      }
    } catch (err) {
      setMessageModal({ isOpen: true, title: 'Error', message: 'Something went wrong', type: 'error' });
    }
  };

  const handleVerifyDomain = async (websiteId: string, method: 'file' | 'dns') => {
      try {
          const res = await fetch('/api/websites/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ websiteId, method })
          });
          const data = await res.json();
          
          if (res.ok) {
              setDomainVerificationModal({ isOpen: false, website: null });
              fetchUser();
              setMessageModal({ isOpen: true, title: 'Success', message: 'Domain verified successfully!', type: 'success' });
          } else {
              setMessageModal({ isOpen: true, title: 'Verification Failed', message: data.error || 'Could not verify domain', type: 'error' });
          }
      } catch (err) {
          setMessageModal({ isOpen: true, title: 'Error', message: 'Verification request failed', type: 'error' });
      }
  };

  const handleReanalyzeAll = async () => {
    if (!confirm('Are you sure you want to re-analyze ALL websites? This may take a while.')) return;
    
    setIsReanalyzing(true);
    try {
      const res = await fetch('/api/admin/reanalyze-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessageModal({ isOpen: true, title: 'Success', message: data.message, type: 'success' });
        fetchAdminData(); // Refresh data
      } else {
        setMessageModal({ isOpen: true, title: 'Error', message: data.error || 'Failed to re-analyze', type: 'error' });
      }
    } catch (err) {
      setMessageModal({ isOpen: true, title: 'Error', message: 'Something went wrong', type: 'error' });
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleVerifyWebsite = async (websiteId: string) => {
    if (!confirm('Are you sure you want to manually verify this website?')) return;

    try {
      const res = await fetch('/api/admin/websites/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId })
      });
      
      if (res.ok) {
        setMessageModal({ isOpen: true, title: 'Success', message: 'Website verified successfully', type: 'success' });
        fetchAdminData(); // Refresh list
      } else {
        const data = await res.json();
        setMessageModal({ isOpen: true, title: 'Error', message: data.error || 'Failed to verify website', type: 'error' });
      }
    } catch (err) {
      setMessageModal({ isOpen: true, title: 'Error', message: 'Something went wrong', type: 'error' });
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
    if (!selectedAiSite) return;
    const site = user?.websites.find(w => w.url === selectedAiSite);
    if (!site) return;

    setLoadingAi(true);
    const report = await getSEOAdvice(site.url, site.domainAuthority);
    setAiReport(report);
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
                  disabled={isAddingSite}
                />
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-2">Niche / Category</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Technology, Health, Plumbing"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                  value={newSiteCategory}
                  onChange={e => setNewSiteCategory(e.target.value)}
                  disabled={isAddingSite}
                />
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-2">Service Type</label>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setNewSiteServiceType('worldwide')}
                        className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                            newSiteServiceType === 'worldwide' 
                            ? 'bg-blue-600 border-blue-500 text-white' 
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                        }`}
                    >
                        <Globe size={24} />
                        <span className="font-bold text-sm">Worldwide</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setNewSiteServiceType('local')}
                        className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                            newSiteServiceType === 'local' 
                            ? 'bg-blue-600 border-blue-500 text-white' 
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                        }`}
                    >
                        <MapPin size={24} />
                        <span className="font-bold text-sm">Local Business</span>
                    </button>
                </div>
              </div>

              {newSiteServiceType === 'local' && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <label className="block text-slate-400 text-sm mb-2">Country</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. USA"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                          value={newSiteCountry}
                          onChange={e => setNewSiteCountry(e.target.value)}
                          disabled={isAddingSite}
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-sm mb-2">City</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. New York"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                          value={newSiteCity}
                          onChange={e => setNewSiteCity(e.target.value)}
                          disabled={isAddingSite}
                        />
                      </div>
                  </div>
              )}
              
              <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                <div className="flex gap-3">
                  <BrainCircuit className="text-blue-400 shrink-0" size={20} />
                  <p className="text-sm text-blue-200">
                    We will automatically calculate your Domain Authority (DA).
                  </p>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isAddingSite}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingSite ? (
                  <>
                    <RefreshCw className="animate-spin" size={20} />
                    Processing...
                  </>
                ) : (
                  'Verify & Add Website'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Site Modal */}
      {editSiteModal.isOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md relative shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
            <button onClick={() => setEditSiteModal({ isOpen: false, website: null })} className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-white mb-6">Edit Website</h3>
            <form onSubmit={handleUpdateWebsite} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Website URL</label>
                <input 
                  type="url" 
                  disabled
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-slate-500 cursor-not-allowed"
                  value={editSiteModal.website?.url || ''}
                />
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-2">Niche / Category</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Technology, Health, Plumbing"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                  value={editSiteCategory}
                  onChange={e => setEditSiteCategory(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-2">Service Type</label>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setEditSiteServiceType('worldwide')}
                        className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                            editSiteServiceType === 'worldwide' 
                            ? 'bg-blue-600 border-blue-500 text-white' 
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                        }`}
                    >
                        <Globe size={24} />
                        <span className="font-bold text-sm">Worldwide</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setEditSiteServiceType('local')}
                        className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                            editSiteServiceType === 'local' 
                            ? 'bg-blue-600 border-blue-500 text-white' 
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                        }`}
                    >
                        <MapPin size={24} />
                        <span className="font-bold text-sm">Local Business</span>
                    </button>
                </div>
              </div>

              {editSiteServiceType === 'local' && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <label className="block text-slate-400 text-sm mb-2">Country</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. USA"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                          value={editSiteCountry}
                          onChange={e => setEditSiteCountry(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-sm mb-2">City</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. New York"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                          value={editSiteCity}
                          onChange={e => setEditSiteCity(e.target.value)}
                        />
                      </div>
                  </div>
              )}

              <button 
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Domain Verification Modal */}
      {domainVerificationModal.isOpen && domainVerificationModal.website && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md relative shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
            <button onClick={() => setDomainVerificationModal({ isOpen: false, website: null })} className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-white mb-6">Verify Domain Ownership</h3>
            <p className="text-slate-400 mb-4">
                Please verify that you own <strong>{domainVerificationModal.website.url}</strong>.
            </p>
            
            <div className="space-y-6">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                    <h4 className="text-white font-bold mb-2">Method 1: File Upload</h4>
                    <p className="text-sm text-slate-400 mb-2">Upload a file named <code className="bg-slate-950 px-1 py-0.5 rounded text-blue-400">linkauthority-verification.txt</code> to your root directory with the following content:</p>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-sm text-green-400 break-all">
                        {domainVerificationModal.website.verificationToken}
                    </div>
                    <button 
                        onClick={() => handleVerifyDomain(domainVerificationModal.website!._id!, 'file')}
                        className="mt-3 w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm transition-colors"
                    >
                        Verify File
                    </button>
                </div>

                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                    <h4 className="text-white font-bold mb-2">Method 2: DNS Record</h4>
                    <p className="text-sm text-slate-400 mb-2">Add a TXT record to your domain with the following value:</p>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-sm text-green-400 break-all">
                        linkauthority-verification={domainVerificationModal.website.verificationToken}
                    </div>
                    <p className="text-xs text-yellow-500/80 mt-2 flex items-start gap-1">
                        DNS changes can take time. If it fails, please wait 15 minutes and try again.
                    </p>
                    <button 
                        onClick={() => handleVerifyDomain(domainVerificationModal.website!._id!, 'dns')}
                        className="mt-3 w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm transition-colors"
                    >
                        Verify DNS
                    </button>
                </div>
            </div>
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
              <SidebarItem tab={Tab.Citations} icon={MapPin} label="Citations & AI" />
              <SidebarItem tab={Tab.Guide} icon={BookOpen} label="Guide & Pricing" />
              <SidebarItem tab={Tab.Profile} icon={UserIcon} label="My Profile" />
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
          <div className="flex justify-center gap-4 mt-4 text-[10px] text-slate-600">
            <button onClick={() => setActiveTab(Tab.TermsOfService)} className="hover:text-slate-400 transition-colors">Terms</button>
            <button onClick={() => setActiveTab(Tab.PrivacyPolicy)} className="hover:text-slate-400 transition-colors">Privacy</button>
          </div>
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
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
                <div className="flex items-center gap-2 mb-4 text-slate-400 text-sm font-bold uppercase tracking-wider">
                    <Sliders size={16} />
                    Filters
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-5 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                        <input 
                        type="text" 
                        placeholder="Search categories, niches, or URLs..." 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="md:col-span-3">
                        <select 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 outline-none focus:border-blue-500 appearance-none cursor-pointer"
                            value={filterServiceType}
                            onChange={(e) => setFilterServiceType(e.target.value as any)}
                        >
                            <option value="all">All Service Types</option>
                            <option value="worldwide">Worldwide Only</option>
                            <option value="local">Local Business Only</option>
                        </select>
                    </div>

                    {filterServiceType === 'local' && (
                        <div className="md:col-span-4 flex gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                            <input 
                                type="text" 
                                placeholder="Country" 
                                className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-blue-500"
                                value={filterCountry}
                                onChange={(e) => setFilterCountry(e.target.value)}
                            />
                            <input 
                                type="text" 
                                placeholder="City" 
                                className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-blue-500"
                                value={filterCity}
                                onChange={(e) => setFilterCity(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {marketplaceSites.filter(s => {
                const matchesSearch = s.category.toLowerCase().includes(searchQuery.toLowerCase()) || s.url.includes(searchQuery);
                const matchesType = filterServiceType === 'all' || s.serviceType === filterServiceType;
                const matchesCountry = !filterCountry || s.location?.country?.toLowerCase().includes(filterCountry.toLowerCase());
                const matchesCity = !filterCity || s.location?.city?.toLowerCase().includes(filterCity.toLowerCase());
                
                return matchesSearch && matchesType && matchesCountry && matchesCity;
              }).map(site => (
                <div key={site.id} className="bg-slate-900/50 rounded-3xl p-6 border border-slate-800 hover:border-blue-500/30 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold uppercase tracking-wider w-fit">{site.category}</span>
                      {site.serviceType === 'local' && site.location ? (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin size={12} />
                          {site.location.city}, {site.location.country}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Globe size={12} />
                          Worldwide
                        </span>
                      )}
                    </div>
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
                    <button 
                      onClick={() => window.open(site.url, '_blank')}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
                    >
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
                       <th className="pb-4 font-semibold">Niche</th>
                       <th className="pb-4 font-semibold">Location</th>
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
                             </div>
                           </div>
                         </td>
                         <td className="py-6 text-slate-400">
                            <span className="bg-slate-800 px-2 py-1 rounded text-sm">{site.category}</span>
                         </td>
                         <td className="py-6 text-slate-400 text-sm">
                            {site.serviceType === 'local' && site.location ? (
                                <span className="flex items-center gap-1">
                                    <MapPin size={14} />
                                    {site.location.city}, {site.location.country}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1">
                                    <Globe size={14} />
                                    Worldwide
                                </span>
                            )}
                         </td>
                         <td className="py-6 text-center">
                           <span className="text-xl font-bold text-blue-400">{site.domainAuthority}</span>
                         </td>
                         <td className="py-6 text-center">
                           {site.isVerified ? (
                               <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold">
                                 <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                 Verified
                               </div>
                           ) : (
                               <button 
                                   onClick={() => setDomainVerificationModal({ isOpen: true, website: site })}
                                   className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-bold hover:bg-yellow-500/20 transition-colors"
                               >
                                 <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                                 Verify Now
                               </button>
                           )}
                         </td>
                         <td className="py-6 text-right">
                           <div className="flex justify-end gap-2">
                             <button 
                                onClick={() => {
                                    // Placeholder for single site refresh
                                    setMessageModal({ isOpen: true, title: 'Info', message: 'Single site refresh coming soon. Use Admin Re-analyze for now.', type: 'success' });
                                }}
                                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                             >
                               <RefreshCw size={18} />
                             </button>
                             <button 
                                onClick={() => {
                                    setEditSiteCategory(site.category || '');
                                    setEditSiteServiceType(site.serviceType as 'worldwide' | 'local' || 'worldwide');
                                    setEditSiteCountry(site.location?.country || '');
                                    setEditSiteCity(site.location?.city || '');
                                    setEditSiteModal({ isOpen: true, website: site });
                                }}
                                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                             >
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
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
               <BrainCircuit size={120} className="absolute -right-10 -bottom-10 opacity-10" />
               <h3 className="text-3xl font-black mb-4">Gemini AI SEO Expert</h3>
               <p className="text-blue-100 text-lg mb-8 max-w-xl opacity-90">
                 Get specialized advice on link placement, domain strategy, and how to maximize your points exchange efficiency using Google's most powerful AI.
               </p>
               
               <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                 <div className="relative w-full max-w-md">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={20} />
                        <input
                            type="text"
                            placeholder="Select a website..."
                            value={selectedAiSite || aiSearchQuery}
                            onChange={(e) => {
                                setAiSearchQuery(e.target.value);
                                setSelectedAiSite('');
                                setIsAiDropdownOpen(true);
                            }}
                            onFocus={() => setIsAiDropdownOpen(true)}
                            className="w-full bg-blue-800/50 border border-blue-400/30 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {selectedAiSite && (
                            <button 
                                onClick={() => { setSelectedAiSite(''); setAiSearchQuery(''); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        )}
                        
                        {isAiDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsAiDropdownOpen(false)}></div>
                                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto">
                                    {user?.websites
                                        .filter(w => (w.isVerified || w.verified) && w.url.toLowerCase().includes(aiSearchQuery.toLowerCase()))
                                        .map(site => (
                                        <button
                                            key={site.id}
                                            onClick={() => {
                                                setSelectedAiSite(site.url);
                                                setAiSearchQuery('');
                                                setIsAiDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-800 text-white transition-colors flex justify-between items-center border-b border-slate-800 last:border-0"
                                        >
                                            <span className="font-medium">{site.url}</span>
                                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded font-bold">DA: {site.domainAuthority}</span>
                                        </button>
                                    ))}
                                    {user?.websites.length === 0 && (
                                        <div className="p-4 text-slate-500 text-center">No websites added yet.</div>
                                    )}
                                    {user?.websites.length > 0 && user?.websites.filter(w => (w.isVerified || w.verified) && w.url.toLowerCase().includes(aiSearchQuery.toLowerCase())).length === 0 && (
                                        <div className="p-4 text-slate-500 text-center">No matching verified websites found.</div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                 </div>

                 <button 
                    onClick={handleGetAdvice}
                    disabled={loadingAi || !selectedAiSite}
                    className="bg-white text-blue-700 px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-blue-50 transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    {loadingAi ? <RefreshCw className="animate-spin" /> : <BrainCircuit />}
                    Generate Report
                 </button>
               </div>
            </div>

            {aiReport && (
              <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                {/* Top Section: Screenshot & Score */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 z-10"></div>
                        {aiReport.screenshotUrl && (
                            <img 
                                src={aiReport.screenshotUrl} 
                                alt="Website Screenshot" 
                                className="w-full h-full object-cover absolute inset-0 opacity-50 group-hover:scale-105 transition-transform duration-700"
                            />
                        )}
                        <div className="relative z-20 h-full flex flex-col justify-end">
                            <h2 className="text-4xl font-black text-white mb-2">{selectedAiSite}</h2>
                            <p className="text-slate-300 text-lg line-clamp-2">{aiReport.summary}</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-blue-500/5 blur-3xl"></div>
                        <div className="relative z-10">
                            <div className="w-40 h-40 rounded-full border-8 border-blue-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                                <span className="text-6xl font-black text-white">{aiReport.seoScore}</span>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">SEO Score</h3>
                            <div className="flex gap-4 justify-center mt-4">
                                <div className="text-center">
                                    <div className="text-green-400 font-bold text-xl">{aiReport.performanceScore}</div>
                                    <div className="text-xs text-slate-500 uppercase font-bold">Perf</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-yellow-400 font-bold text-xl">{aiReport.accessibilityScore}</div>
                                    <div className="text-xs text-slate-500 uppercase font-bold">Access</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-purple-400 font-bold text-xl">{aiReport.bestPracticesScore}</div>
                                    <div className="text-xs text-slate-500 uppercase font-bold">Best</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts & Technical SEO */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800">
                        <h4 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                            <ArrowUpRight className="text-green-500" />
                            Projected Growth
                        </h4>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={aiReport.monthlyGrowth}>
                                    <defs>
                                        <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis dataKey="month" stroke="#64748b" />
                                    <YAxis stroke="#64748b" />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="traffic" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTraffic)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800">
                        <h4 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                            <Settings className="text-slate-400" />
                            Technical Audit
                        </h4>
                        <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {aiReport.technicalSeo.map((item, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
                                    <div className={`mt-1 w-3 h-3 rounded-full shrink-0 ${
                                        item.status === 'pass' ? 'bg-green-500' : 
                                        item.status === 'fail' ? 'bg-red-500' : 'bg-yellow-500'
                                    }`} />
                                    <div>
                                        <h5 className="font-bold text-white text-sm">{item.title}</h5>
                                        <p className="text-slate-400 text-xs mt-1">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Strategy Section */}
                <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800">
                    <h4 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                        <BrainCircuit className="text-purple-500" />
                        AI Strategy Recommendations
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800">
                            <h5 className="text-slate-400 text-sm font-bold uppercase mb-3">Strategic Focus</h5>
                            <p className="text-white font-medium">{aiReport.backlinkStrategy.focus}</p>
                        </div>
                        <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800">
                            <h5 className="text-slate-400 text-sm font-bold uppercase mb-3">Target Niches</h5>
                            <div className="flex flex-wrap gap-2">
                                {aiReport.backlinkStrategy.targetNiches.map((niche, i) => (
                                    <span key={i} className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-bold">
                                        {niche}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800">
                            <h5 className="text-slate-400 text-sm font-bold uppercase mb-3">Anchor Text</h5>
                            <div className="flex flex-wrap gap-2">
                                {aiReport.backlinkStrategy.recommendedAnchors.map((anchor, i) => (
                                    <span key={i} className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-bold">
                                        {anchor}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === Tab.Citations && (
          <CitationsPage />
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

        {activeTab === Tab.Profile && (
          <div className="max-w-2xl mx-auto bg-slate-900/50 rounded-3xl border border-slate-800 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-indigo-600/20 overflow-hidden">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name ? user.name.substring(0, 2).toUpperCase() : 'U'
                )}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{user.name}</h3>
                <p className="text-slate-400">{user.email}</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400">Full Name</label>
                  <input 
                    type="text" 
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Your Name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400">Phone Number</label>
                  <input 
                    type="tel" 
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400">Avatar URL</label>
                <input 
                  type="url" 
                  value={profileForm.avatar}
                  onChange={(e) => setProfileForm({...profileForm, avatar: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  placeholder="https://example.com/avatar.jpg"
                />
                <p className="text-xs text-slate-500">Link to an image file for your profile picture.</p>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button 
                  type="submit" 
                  disabled={isSavingProfile}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSavingProfile ? (
                    <>
                      <RefreshCw className="animate-spin" size={20} />
                      Saving Changes...
                    </>
                  ) : (
                    'Save Profile'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === Tab.TermsOfService && (
          <TermsOfService onBack={() => setActiveTab(Tab.Dashboard)} />
        )}

        {activeTab === Tab.PrivacyPolicy && (
          <PrivacyPolicy onBack={() => setActiveTab(Tab.Dashboard)} />
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
                    <th className="pb-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {adminUsers.map((u: any) => (
                    <tr key={u._id} className="hover:bg-slate-800/30">
                      <td className="py-4 text-white font-medium">{u.name}</td>
                      <td className="py-4 text-slate-400">{u.email}</td>
                      <td className="py-4 text-blue-400 font-bold">{u.points}</td>
                      <td className="py-4 text-slate-400">{u.websites?.length || 0}</td>
                      <td className="py-4 text-right">
                        <button 
                            onClick={() => {
                                setPointsToAdd(0);
                                setAddPointsModal({ isOpen: true, user: u });
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                            Add Points
                        </button>
                      </td>
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
                    <th className="pb-4 font-semibold">Location</th>
                    <th className="pb-4 font-semibold">Status</th>
                    <th className="pb-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {adminWebsites.map((w: any) => (
                    <tr key={w._id} className="hover:bg-slate-800/30">
                      <td className="py-4 text-white font-medium">{w.url}</td>
                      <td className="py-4 text-slate-400">{w.owner?.name || 'Unknown'}</td>
                      <td className="py-4 text-blue-400 font-bold">{w.domainAuthority}</td>
                      <td className="py-4 text-slate-400">{w.category}</td>
                      <td className="py-4 text-slate-400 text-sm">
                        {w.serviceType === 'local' && w.location ? (
                            <span className="flex items-center gap-1">
                                <MapPin size={14} />
                                {w.location.city}, {w.location.country}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1">
                                <Globe size={14} />
                                Worldwide
                            </span>
                        )}
                      </td>
                      <td className="py-4">
                        {w.isVerified ? (
                            <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs font-bold rounded uppercase">Verified</span>
                        ) : (
                            <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-xs font-bold rounded uppercase">Pending</span>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        {!w.isVerified && (
                            <button 
                                onClick={() => handleVerifyWebsite(w._id)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                                Verify
                            </button>
                        )}
                      </td>
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
                <h4 className="text-lg font-bold text-slate-300">System Maintenance</h4>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <button 
                    onClick={handleReanalyzeAll}
                    disabled={isReanalyzing}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isReanalyzing ? <RefreshCw className="animate-spin" size={20} /> : <BrainCircuit size={20} />}
                    Re-analyze All Websites (AI)
                  </button>
                  <p className="text-xs text-slate-500 text-center">
                    This will re-run the AI categorization and location detection for every website in the database.
                  </p>
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

      {/* Add Points Modal */}
      {addPointsModal.isOpen && addPointsModal.user && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md relative shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
            <button onClick={() => setAddPointsModal({ isOpen: false, user: null })} className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-white mb-6">Add Points</h3>
            <p className="text-slate-400 mb-4">
                Adding points to <strong>{addPointsModal.user.name}</strong> ({addPointsModal.user.email})
            </p>
            
            <form onSubmit={handleAddPoints} className="space-y-6">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Points Amount</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                  value={pointsToAdd}
                  onChange={e => setPointsToAdd(parseInt(e.target.value))}
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20"
              >
                Add Points
              </button>
            </form>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

export default App;
