import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Globe,
  CheckCircle2,
  AlertCircle,
  Bot,
  Code,
  Search,
  Plus,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Zap,
  Copy,
  Check
} from 'lucide-react';
import { Website } from './types';

interface CitationsPageProps {
  websites: Website[];
}

const CitationsPage: React.FC<CitationsPageProps> = ({ websites }) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'builder' | 'schema'>('audit');
  const [selectedSiteUrl, setSelectedSiteUrl] = useState('');

  useEffect(() => {
    if (!selectedSiteUrl && websites.length > 0) {
      setSelectedSiteUrl(websites[0].url);
    }
  }, [websites, selectedSiteUrl]);
  const [schemaData, setSchemaData] = useState({
    name: '',
    type: 'LocalBusiness',
    street: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    website: ''
  });
  const [copied, setCopied] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);

  const showComingSoon = () => {
    setComingSoon(true);
    setTimeout(() => setComingSoon(false), 3000);
  };

  useEffect(() => {
    if (selectedSiteUrl) {
      setSchemaData(prev => ({ ...prev, website: selectedSiteUrl }));
    }
  }, [selectedSiteUrl]);

  const generateSchema = () => {
    const schema = {
      "@context": "https://schema.org",
      "@type": schemaData.type,
      "name": schemaData.name,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": schemaData.street,
        "addressLocality": schemaData.city,
        "addressRegion": schemaData.state,
        "postalCode": schemaData.zip,
        "addressCountry": "US"
      },
      "telephone": schemaData.phone,
      "url": schemaData.website
    };
    return JSON.stringify(schema, null, 2);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateSchema());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Real audit results. Nothing is shown until a scan has actually run - the
  // previous version rendered a hardcoded list of "synced / 100% consistency"
  // rows identically for every site, whether or not the business was listed
  // anywhere.
  const [report, setReport] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [bizName, setBizName] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizVertical, setBizVertical] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);

  // The canonical record every directory form is filled from.
  const [profile, setProfile] = useState<any>(null);
  const [profileForm, setProfileForm] = useState<any>({
    name: '', phone: '', address: '', email: '', website: '',
    description: '', categories: '', services: '', hours: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [copiedField, setCopiedField] = useState('');

  const selectedSite = websites.find(w => w.url === selectedSiteUrl) || websites[0];

  // Load the saved record whenever the selected site changes, so the audit and
  // the paste-ready fields both start from what was stored rather than blank.
  useEffect(() => {
    const site = websites.find(w => w.url === selectedSiteUrl) || websites[0];
    const id = site && ((site as any)._id || (site as any).id);
    if (!id) return;

    let cancelled = false;

    fetch(`/api/websites/${id}/profile`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        setProfile(data.profile ? data : null);
        if (data.saved) {
          setProfileForm({
            name: data.saved.name || '',
            phone: data.saved.phone || '',
            address: data.saved.address || '',
            email: data.saved.email || '',
            website: data.saved.website || '',
            description: data.saved.description || '',
            categories: (data.saved.categories || []).join(', '),
            services: (data.saved.services || []).join(', '),
            hours: data.saved.hours || ''
          });
          // The audit reads the same record, so it never disagrees with it.
          setBizName(data.saved.name || '');
          setBizPhone(data.saved.phone || '');
          setBizAddress(data.saved.address || '');
          setBizVertical(data.saved.vertical || '');
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [selectedSiteUrl, websites]);

  const saveProfile = async () => {
    const site = websites.find(w => w.url === selectedSiteUrl) || websites[0];
    const id = site && ((site as any)._id || (site as any).id);
    if (!id) return;

    if (!profileForm.name.trim()) {
      setProfileMsg('Business name is required.');
      return;
    }

    setProfileSaving(true);
    setProfileMsg('');

    try {
      const res = await fetch(`/api/websites/${id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profileForm, vertical: bizVertical })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setProfileMsg(err.error || 'Could not save the business details.');
        return;
      }

      const data = await res.json();
      setProfile(data);
      setBizName(data.saved.name || '');
      setBizPhone(data.saved.phone || '');
      setBizAddress(data.saved.address || '');
      setProfileMsg('Saved.');
    } catch (err) {
      setProfileMsg('Could not save the business details. Check your connection.');
    } finally {
      setProfileSaving(false);
    }
  };

  const copyField = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      setTimeout(() => setCopiedField(''), 1500);
    } catch (err) {
      // Clipboard access can be refused; the value is on screen to copy by hand.
    }
  };

  const runScan = async () => {
    if (!selectedSite) return;
    if (!bizName.trim()) {
      setScanError('Enter the business name exactly as it appears on your listings.');
      return;
    }

    setScanning(true);
    setScanError('');

    try {
      const res = await fetch(`/api/websites/${selectedSite._id || selectedSite.id}/citations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bizName, phone: bizPhone, address: bizAddress, vertical: bizVertical })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setScanError(err.error || 'The scan could not be completed.');
        return;
      }

      setReport(await res.json());
    } catch (err) {
      setScanError('The scan could not be completed. Check your connection and try again.');
    } finally {
      setScanning(false);
    }
  };

  const statusLabel: Record<string, string> = {
    listed: 'Listed',
    'not-found': 'Not found',
    'not-configured': 'Not connected',
    unsupported: 'Manual check',
    error: 'Check failed'
  };

  const statusStyle: Record<string, string> = {
    listed: 'bg-green-500/10 text-green-500',
    'not-found': 'bg-amber-500/10 text-amber-500',
    'not-configured': 'bg-slate-700/50 text-slate-400',
    unsupported: 'bg-slate-700/50 text-slate-400',
    error: 'bg-red-500/10 text-red-400'
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Citations & AI Presence</h2>
          <p className="text-slate-400">Manage your local presence across directories and AI assistants.</p>
        </div>
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button 
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'audit' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            AI Audit
          </button>
          <button 
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'builder' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Citation Builder
          </button>
          <button 
            onClick={() => setActiveTab('schema')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'schema' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Schema Gen
          </button>
        </div>
      </div>

      {/* Website Selector */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl shrink-0">
          <Globe size={18} />
        </div>
        {websites.length > 0 ? (
          <div className="flex-1 min-w-0">
            <label className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Website</label>
            <select
              value={selectedSiteUrl}
              onChange={(e) => setSelectedSiteUrl(e.target.value)}
              className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:border-blue-500 outline-none cursor-pointer"
            >
              {websites.map(w => (
                <option key={w.id} value={w.url}>{w.url}</option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Add a website on <strong>My Websites</strong> to see citation and AI-presence data for it here.</p>
        )}
      </div>

      {/* AI Assistant Audit Section */}
      {activeTab === 'audit' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Siri/Alexa Readiness */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Voice Search Readiness</h3>
                  <p className="text-slate-400 text-sm">Optimization for Siri, Alexa, and Google Assistant</p>
                </div>
                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
                  <Bot size={24} />
                </div>
              </div>
              
              <div className="flex items-center gap-6 mb-8">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                    <circle cx="48" cy="48" r="40" stroke="#3b82f6" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset="62.8" />
                  </svg>
                  <span className="absolute text-2xl font-bold text-white">75%</span>
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Siri</span>
                    <span className="text-green-400 font-bold">Good</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full w-[80%]"></div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Alexa</span>
                    <span className="text-yellow-400 font-bold">Fair</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-yellow-500 h-full w-[60%]"></div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
                <h4 className="text-sm font-bold text-white mb-2">Recommendations</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-xs text-slate-400">
                    <AlertCircle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                    Ensure business hours are consistent across Yelp and Apple Maps.
                  </li>
                  <li className="flex items-start gap-2 text-xs text-slate-400">
                    <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                    Name and Address match perfectly on Google.
                  </li>
                </ul>
              </div>
            </div>

            {/* Google SGE Optimization */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Google SGE Status</h3>
                  <p className="text-slate-400 text-sm">Search Generative Experience Optimization</p>
                </div>
                <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl">
                  <BrainCircuit size={24} />
                </div>
              </div>

              <div className="flex items-center gap-6 mb-8">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                    <circle cx="48" cy="48" r="40" stroke="#a855f7" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset="100.48" />
                  </svg>
                  <span className="absolute text-2xl font-bold text-white">60%</span>
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Entity Trust</span>
                    <span className="text-purple-400 font-bold">High</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full w-[85%]"></div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Review Sentiment</span>
                    <span className="text-red-400 font-bold">Low</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full w-[40%]"></div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
                <h4 className="text-sm font-bold text-white mb-2">AI Insights</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Google's AI connects your business with "affordable plumbing" but lacks recent positive reviews to confidently recommend you in top spots. Focus on getting 5 more detailed reviews.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Citation Builder Section */}
      {activeTab === 'builder' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          {comingSoon && (
            <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-xl px-4 py-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
              Automated citation syncing is coming soon. This section is a preview of what's on the way.
            </div>
          )}
          {/* Data Aggregators */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Data Aggregators & Networks</h3>
                <p className="text-slate-400 text-sm">Sync your business data to hundreds of sites at once.</p>
              </div>
              <button onClick={showComingSoon} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-green-600/20">
                Sync All ($59/mo)
              </button>
            </div>

            <div className="space-y-4">
              {[
                { name: 'Google Business Profile', icon: Globe, status: 'Synced', color: 'green' },
                { name: 'Facebook Local', icon: Globe, status: 'Synced', color: 'green' },
                { name: 'Apple Maps', icon: MapPin, status: 'Issue Found', color: 'red' },
                { name: 'Bing Places', icon: Globe, status: 'Synced', color: 'green' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                      <item.icon size={20} />
                    </div>
                    <span className="font-bold text-white">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase bg-${item.color}-500/10 text-${item.color}-500`}>
                      {item.status}
                    </span>
                    <button onClick={showComingSoon} className="text-slate-400 hover:text-white">
                      <Settings size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* The canonical business record. Sixty of these directories have no
              API, so a person fills the form - and the expensive part is not
              the clicking, it is retyping this and getting it subtly wrong. */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
            <h3 className="text-xl font-bold text-white mb-1">Business details</h3>
            <p className="text-slate-400 text-sm mb-6">
              Enter these once. Every directory form is filled from this record, so the
              name, address and phone stay identical everywhere &mdash; which is what
              search engines are actually checking.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              {[
                ['name', 'Business name (required)'],
                ['phone', 'Phone'],
                ['address', 'Full address, one line'],
                ['email', 'Email'],
                ['website', 'Website URL'],
                ['hours', 'Hours, e.g. Mon-Fri 7am-5pm']
              ].map(([key, placeholder]) => (
                <input
                  key={key}
                  type="text"
                  placeholder={placeholder}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500"
                  value={profileForm[key]}
                  onChange={e => setProfileForm({ ...profileForm, [key]: e.target.value })}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <input
                type="text"
                placeholder="Categories, comma separated"
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500"
                value={profileForm.categories}
                onChange={e => setProfileForm({ ...profileForm, categories: e.target.value })}
              />
              <input
                type="text"
                placeholder="Services, comma separated"
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500"
                value={profileForm.services}
                onChange={e => setProfileForm({ ...profileForm, services: e.target.value })}
              />
            </div>

            <textarea
              rows={4}
              placeholder="Description. Write around 750 characters &mdash; shorter versions are cut from this one."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 mb-4 resize-y"
              value={profileForm.description}
              onChange={e => setProfileForm({ ...profileForm, description: e.target.value })}
            />

            <div className="flex items-center gap-3">
              <button
                onClick={saveProfile}
                disabled={profileSaving}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                {profileSaving ? 'Saving…' : 'Save business details'}
              </button>
              {profileMsg && (
                <span className={`text-sm ${profileMsg === 'Saved.' ? 'text-green-500' : 'text-red-400'}`}>
                  {profileMsg}
                </span>
              )}
            </div>

            {/* Problems worth knowing about before sixty forms have been filled
                with them, rather than after. */}
            {profile?.issues?.length > 0 && (
              <div className="mt-5 space-y-2">
                {profile.issues.map((issue: any) => (
                  <div key={issue.field} className="flex items-start gap-2 text-sm">
                    <AlertCircle
                      size={16}
                      className={`mt-0.5 shrink-0 ${issue.severity === 'error' ? 'text-red-400' : 'text-amber-500'}`}
                    />
                    <span className="text-slate-400">{issue.message}</span>
                  </div>
                ))}
              </div>
            )}

            {profile?.fields?.length > 0 && (
              <div className="mt-6 border-t border-slate-800 pt-6">
                <p className="text-white font-bold mb-1">Ready to paste</p>
                <p className="text-slate-500 text-sm mb-4">
                  Each field formatted the way directory forms ask for it. Click to copy.
                </p>

                <div className="space-y-1.5">
                  {profile.fields.map((f: any) => (
                    <button
                      key={f.label}
                      onClick={() => copyField(f.label, f.value)}
                      className="w-full flex items-start gap-3 text-left bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-2.5 transition-colors group"
                    >
                      <span className="text-slate-500 text-xs w-40 shrink-0 pt-0.5">{f.label}</span>
                      <span className="text-slate-200 text-sm flex-1 break-words">{f.value}</span>
                      {copiedField === f.label
                        ? <Check size={15} className="text-green-500 shrink-0 mt-0.5" />
                        : <Copy size={15} className="text-slate-600 group-hover:text-slate-400 shrink-0 mt-0.5" />}
                    </button>
                  ))}
                </div>

                {profile.profile?.description?.full && (
                  <div className="mt-4">
                    <p className="text-slate-500 text-xs mb-2">
                      Description, cut to the limits these forms enforce
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {[80, 160, 250, 500, 750].map(limit => (
                        <button
                          key={limit}
                          onClick={() => copyField(`desc-${limit}`, profile.profile.description[limit])}
                          className="bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-2 text-center transition-colors"
                        >
                          <span className="block text-white text-sm font-bold">
                            {copiedField === `desc-${limit}` ? 'Copied' : limit}
                          </span>
                          <span className="block text-slate-500 text-xs">
                            {profile.profile.description[limit].length} char
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Citation audit */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
            <h3 className="text-xl font-bold text-white mb-1">Citation audit</h3>
            <p className="text-slate-400 text-sm mb-6">
              We check the directories that publish a lookup API and report exactly what is found.
              Directories without one are flagged for a manual check rather than guessed at.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <input
                type="text"
                placeholder="Business name (required)"
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500"
                value={bizName}
                onChange={e => setBizName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Phone"
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500"
                value={bizPhone}
                onChange={e => setBizPhone(e.target.value)}
              />
              <input
                type="text"
                placeholder="Address"
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500"
                value={bizAddress}
                onChange={e => setBizAddress(e.target.value)}
              />
            </div>

            {/* The industry decides which vertical directories are relevant.
                Without it, a remodeler would be told it is missing from Zillow. */}
            <select
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500 mb-4 w-full md:w-1/3"
              value={bizVertical}
              onChange={e => setBizVertical(e.target.value)}
            >
              <option value="">Industry — general listings only</option>
              <option value="home-services">Home services &amp; remodeling</option>
              <option value="hospitality">Hospitality &amp; travel</option>
              <option value="real-estate">Real estate</option>
              <option value="b2b-industrial">B2B &amp; industrial</option>
            </select>

            <button
              onClick={runScan}
              disabled={scanning}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
            >
              {scanning ? 'Scanning\u2026' : 'Run citation scan'}
            </button>

            {scanError && (
              <p className="text-red-400 text-sm mt-3">{scanError}</p>
            )}

            {!report && !scanning && (
              <div className="mt-6 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
                <Search size={28} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No scan has been run yet</p>
                <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                  Enter your business details above and run a scan to see which directories list you.
                </p>
              </div>
            )}

            {report && (
              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    ['Listed', report.totals.listed],
                    ['Not found', report.totals.missing],
                    ['NAP mismatches', report.totals.inconsistent],
                    ['To submit', report.totals.unsupported]
                  ].map(([label, value]: any) => (
                    <div key={label} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                      <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-2xl font-bold text-white">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Only what we actually looked up. Listing the seventy-odd
                    directories we cannot query alongside these would bury the
                    real findings in rows that all say the same thing. */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Directory</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {report.directories
                        .filter((d: any) => d.status !== 'unsupported')
                        .map((d: any) => (
                        <tr key={d.id} className="hover:bg-slate-800/30">
                          <td className="py-3 font-medium text-white">
                            {d.url
                              ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">{d.name}</a>
                              : d.name}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusStyle[d.status] || 'bg-slate-700/50 text-slate-400'}`}>
                              {statusLabel[d.status] || d.status}
                            </span>
                          </td>
                          <td className="py-3 text-sm text-slate-400">
                            {d.status === 'listed' && (
                              d.consistent
                                ? <span className="text-green-500">Details match</span>
                                : <span className="text-amber-500">Differs: {(d.napDiffers || []).join(', ')}</span>
                            )}
                            {d.status === 'not-found' && 'No listing found for this business'}
                            {d.status === 'not-configured' && 'Connect an API key to check this directory'}
                            {d.status === 'error' && (d.error || 'Lookup failed')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {report.totals.notConfigured > 0 && (
                  <p className="text-slate-500 text-xs">
                    {report.totals.notConfigured} director{report.totals.notConfigured === 1 ? 'y is' : 'ies are'} waiting on an API key,
                    so {report.totals.notConfigured === 1 ? 'it was' : 'they were'} not checked.
                  </p>
                )}

                {/* The rest cannot be queried, so they are the to-do list
                    rather than a result. Grouped by how much work each takes. */}
                {report.totals.unsupported > 0 && (
                  <div className="border-t border-slate-800 pt-5">
                    <button
                      onClick={() => setShowChecklist(!showChecklist)}
                      className="flex items-center justify-between w-full text-left group"
                    >
                      <div>
                        <p className="text-white font-bold">
                          {report.totals.unsupported} directories to submit by hand
                        </p>
                        <p className="text-slate-500 text-sm mt-0.5">
                          {report.totals.formSubmit} web forms, {report.totals.manualSubmit} needing
                          identity or licence verification, {report.totals.automatable} with an official API
                        </p>
                      </div>
                      <span className="text-slate-500 text-sm group-hover:text-white shrink-0 ml-4">
                        {showChecklist ? 'Hide' : 'Show'}
                      </span>
                    </button>

                    {showChecklist && (
                      <div className="mt-5 space-y-5">
                        {['A', 'B'].map(tier => {
                          const rows = report.directories.filter(
                            (d: any) => d.status === 'unsupported' && d.tier === tier
                          );
                          if (!rows.length) return null;

                          return (
                            <div key={tier}>
                              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">
                                {tier === 'A' ? 'Priority — do these first' : 'Worth doing'}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {rows.map((d: any) => (
                                  <a
                                    key={d.id}
                                    href={d.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start justify-between gap-3 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-3 transition-colors"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-white text-sm font-medium truncate">{d.name}</p>
                                      <p className="text-slate-500 text-xs mt-0.5">{d.note}</p>
                                    </div>
                                    <span className={`text-xs font-bold shrink-0 mt-0.5 ${
                                      d.submit === 'api' ? 'text-blue-400'
                                        : d.submit === 'manual' ? 'text-amber-500' : 'text-slate-500'
                                    }`}>
                                      {d.submit === 'api' ? 'API' : d.submit === 'manual' ? 'Verify' : 'Form'}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Local Schema Generator */}
      {activeTab === 'schema' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
                <Code size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Schema Generator</h3>
                <p className="text-slate-400 text-sm">Generate JSON-LD for your website.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Business Name</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                  value={schemaData.name}
                  onChange={e => setSchemaData({...schemaData, name: e.target.value})}
                  placeholder="e.g. Joe's Plumbing"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Business Type</label>
                  <select 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                    value={schemaData.type}
                    onChange={e => setSchemaData({...schemaData, type: e.target.value})}
                  >
                    <option value="LocalBusiness">Local Business</option>
                    <option value="Restaurant">Restaurant</option>
                    <option value="MedicalBusiness">Medical Business</option>
                    <option value="LegalService">Legal Service</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Phone</label>
                  <input 
                    type="tel" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                    value={schemaData.phone}
                    onChange={e => setSchemaData({...schemaData, phone: e.target.value})}
                    placeholder="+1 555-0123"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-2">Street Address</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                  value={schemaData.street}
                  onChange={e => setSchemaData({...schemaData, street: e.target.value})}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-slate-400 text-sm mb-2">City</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                    value={schemaData.city}
                    onChange={e => setSchemaData({...schemaData, city: e.target.value})}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-slate-400 text-sm mb-2">State</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                    value={schemaData.state}
                    onChange={e => setSchemaData({...schemaData, state: e.target.value})}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-slate-400 text-sm mb-2">Zip</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                    value={schemaData.zip}
                    onChange={e => setSchemaData({...schemaData, zip: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-2">Website URL</label>
                <input 
                  type="url" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                  value={schemaData.website}
                  onChange={e => setSchemaData({...schemaData, website: e.target.value})}
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">JSON-LD Code</h3>
              <button 
                onClick={handleCopy}
                className="flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            
            <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-sm text-slate-300 overflow-auto relative group">
              <pre>{generateSchema()}</pre>
            </div>
            
            <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
              <div className="shrink-0 text-blue-400">
                <Zap size={20} />
              </div>
              <p className="text-sm text-blue-200">
                Paste this code into the <code className="bg-blue-900/50 px-1 rounded">&lt;head&gt;</code> section of your website to help search engines understand your local business details.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { Settings, BrainCircuit } from 'lucide-react';

export default CitationsPage;
