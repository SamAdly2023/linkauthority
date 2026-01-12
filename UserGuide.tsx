import React from 'react';
import { BookOpen, CheckCircle, Zap, Shield, Search, ArrowRight } from 'lucide-react';

const UserGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 to-slate-900 p-8 border border-white/10 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl font-bold text-white mb-4">LinkAuthority User Guide</h1>
          <p className="text-blue-200 text-lg">
            Master the art of high-authority backlink exchange. Learn how to verify your sites, install widgets, and automate your SEO growth.
          </p>
        </div>
        <BookOpen className="absolute -right-10 -bottom-10 text-white/5 w-64 h-64" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Getting Started */}
        <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="text-green-500" /> 1. Getting Started
          </h2>
          <ul className="space-y-3 text-slate-300">
            <li className="flex gap-2">
              <span className="font-bold text-white">1. Sign Up:</span>
              <span>Create your account to access the dashboard. You start with 0 points.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-white">2. Add Websites:</span>
              <span>Go to "My Websites" and add your domains. We accept all niches.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-white">3. Verify Ownership:</span>
              <span>Prove you own the site to unlock features. We have 3 methods (see below).</span>
            </li>
          </ul>
        </div>

        {/* Verification Methods */}
        <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="text-blue-500" /> 2. Site Verification
          </h2>
          <div className="space-y-4">
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <h4 className="font-bold text-blue-400 text-sm mb-1">Method 1: File Upload</h4>
              <p className="text-xs text-slate-400">Upload a small `.txt` file we provide to your server's root folder.</p>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <h4 className="font-bold text-blue-400 text-sm mb-1">Method 2: DNS Record</h4>
              <p className="text-xs text-slate-400">Add a TXT record to your domain's DNS settings.</p>
            </div>
            <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-800/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl">RECOMMENDED</div>
              <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-1"><Zap size={14} className="text-yellow-400"/> Method 3: Instant Widget</h4>
              <p className="text-xs text-slate-300">Copy & paste a Javascript code snippet to your homepage footer. This enables <strong>Instant Automation</strong>.</p>
            </div>
          </div>
        </div>
      </div>

      {/* The Core Workflows */}
      <h2 className="text-2xl font-bold text-white mt-8 mb-4">Core Workflows</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Earning Points */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-blue-500 transition-colors">
          <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
            <ArrowRight className="text-green-500" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">How to Earn Points</h3>
          <p className="text-sm text-slate-400 mb-4">
            You earn points when other users place backlinks on your verified websites.
          </p>
          <ul className="text-sm text-slate-300 space-y-2 list-disc pl-4">
             <li>Install the <strong>Instant Widget</strong> to automate this.</li>
             <li>Without the widget, you must manually add their link and wait for approval.</li>
             <li>Points are credited immediately upon verification.</li>
          </ul>
        </div>

        {/* Spending Points */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-blue-500 transition-colors">
          <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center mb-4">
            <ArrowRight className="text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">How to Get Backlinks</h3>
          <p className="text-sm text-slate-400 mb-4">
            Use your points to buy backlinks from other high-authority sites in the Marketplace.
          </p>
          <ul className="text-sm text-slate-300 space-y-2 list-disc pl-4">
             <li>Browse the <strong>Marketplace</strong> for relevant sites.</li>
             <li>Click "Get Link", choose your source site, and confirm cost.</li>
             <li>If they use the Widget, your link appears <strong>instantly</strong>.</li>
          </ul>
        </div>

        {/* Improved SEO */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-blue-500 transition-colors">
          <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
            <Search className="text-purple-500" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Improved SEO</h3>
          <p className="text-sm text-slate-400 mb-4">
            We focus on quality, contextual backlinks that drive real results.
          </p>
          <ul className="text-sm text-slate-300 space-y-2 list-disc pl-4">
             <li>Add <strong>Short Descriptions</strong> to your sites for contextual relevance.</li>
             <li>Use the <strong>AI SEO Expert</strong> tool to audit your pages.</li>
             <li>Monitor your Dashboard for DA growth.</li>
          </ul>
        </div>
      </div>
      
      {/* FAQ / Support */}
       <div className="bg-slate-900 rounded-xl p-8 border border-slate-800 text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Need More Help?</h3>
            <p className="text-slate-400 max-w-2xl mx-auto mb-6">
                Our support team is always available to assist you. If you encounter any issues with verification or transactions, please reach out.
            </p>
            <a href="mailto:support@linkauthority.live" className="bg-blue-600 hovered:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold transition-all">
                Contact Support
            </a>
       </div>
    </div>
  );
};

export default UserGuide;
