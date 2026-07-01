import React, { useState } from 'react';
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

const CitationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'builder' | 'schema'>('audit');
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

  const citations = [
    { name: 'Google Business Profile', status: 'synced', da: 98, consistency: '100%' },
    { name: 'Bing Places', status: 'synced', da: 92, consistency: '100%' },
    { name: 'Yelp', status: 'error', da: 94, consistency: '85%' },
    { name: 'Apple Maps', status: 'pending', da: 99, consistency: 'Pending' },
    { name: 'Facebook Local', status: 'synced', da: 96, consistency: '100%' },
    { name: 'Foursquare', status: 'synced', da: 90, consistency: '100%' },
    { name: 'YellowPages', status: 'pending', da: 85, consistency: 'Pending' },
    { name: 'MapQuest', status: 'synced', da: 88, consistency: '100%' },
  ];

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
          {/* Data Aggregators */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Data Aggregators & Networks</h3>
                <p className="text-slate-400 text-sm">Sync your business data to hundreds of sites at once.</p>
              </div>
              <button className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-green-600/20">
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
                    <button className="text-slate-400 hover:text-white">
                      <Settings size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Citation Manager Table */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Manual Citation Manager</h3>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-700">Filter</button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 flex items-center gap-2">
                  <Plus size={16} /> Add New
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-sm uppercase tracking-wider">
                    <th className="pb-4 font-semibold pl-4">Directory Name</th>
                    <th className="pb-4 font-semibold">Status</th>
                    <th className="pb-4 font-semibold">Domain Authority</th>
                    <th className="pb-4 font-semibold">NAP Consistency</th>
                    <th className="pb-4 font-semibold text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {citations.map((citation, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 pl-4 font-medium text-white">{citation.name}</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold capitalize
                          ${citation.status === 'synced' ? 'bg-green-500/10 text-green-500' : 
                            citation.status === 'error' ? 'bg-red-500/10 text-red-500' : 
                            'bg-yellow-500/10 text-yellow-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full 
                            ${citation.status === 'synced' ? 'bg-green-500' : 
                              citation.status === 'error' ? 'bg-red-500' : 
                              'bg-yellow-500'}`}></span>
                          {citation.status}
                        </span>
                      </td>
                      <td className="py-4 text-slate-400">{citation.da}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                citation.consistency === '100%' ? 'bg-green-500' : 
                                citation.consistency === 'Pending' ? 'bg-slate-600' : 'bg-yellow-500'
                              }`} 
                              style={{ width: citation.consistency === 'Pending' ? '0%' : citation.consistency }}
                            ></div>
                          </div>
                          <span className="text-xs text-slate-400">{citation.consistency}</span>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-right">
                        <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                          <ExternalLink size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
