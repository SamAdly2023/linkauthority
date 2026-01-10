import React from 'react';
import { Check, Sparkles } from 'lucide-react';

const PricingSection: React.FC = () => {
  return (
    <section id="pricing" className="py-24 bg-slate-950 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] bg-blue-600/5 rounded-full blur-[100px] -z-10"></div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Simple, Transparent Pricing</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Choose the perfect plan to boost your domain authority. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Free Plan */}
          <div className="flex flex-col p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-slate-100">Free</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold text-white">$0</span>
              </div>
              <p className="text-slate-500 text-sm mt-1">Always free</p>
            </div>
            
            <a href="/auth/google" className="w-full py-2.5 rounded-lg border border-slate-700 text-white font-medium hover:bg-slate-800 transition-colors text-center text-sm mb-8">
              Current plan
            </a>

            <div className="space-y-4 flex-1">
              <Feature text="100 Starter Points" highlight />
              <Feature text="Browse Marketplace" />
              <Feature text="Basic Analytics" />
              <Feature text="Community Support" />
            </div>
          </div>

          {/* Basic Plan */}
          <div className="flex flex-col p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors">
            <div className="mb-4">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-medium text-slate-100">Basic</h3>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-bold text-white">$7</span>
                <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">SAVE 12%</span>
              </div>
              <p className="text-slate-500 text-sm mt-1">per month, billed annually</p>
            </div>

            <button className="w-full py-2.5 rounded-lg border border-slate-700 text-white font-medium hover:bg-slate-800 transition-colors text-sm mb-8">
              Get Basic plan
            </button>

            <div className="space-y-4 flex-1">
              <Feature text="500 Monthly Points" />
              <Feature text="5 Active Links" />
              <Feature text="Standard Analytics" />
              <Feature text="Email Support" />
            </div>
          </div>

          {/* Plus Plan (Most Popular) */}
          <div className="relative flex flex-col p-6 bg-slate-900 border-2 border-blue-600 rounded-2xl shadow-2xl shadow-blue-900/20 transform scale-105 z-10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
              Most Popular
            </div>
            <div className="mb-4 mt-2">
              <h3 className="text-lg font-medium text-slate-100">Plus</h3>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-bold text-white">$15</span>
                <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">SAVE 25%</span>
              </div>
              <p className="text-slate-500 text-sm mt-1">per month, billed annually</p>
            </div>

            <button className="w-full py-2.5 rounded-lg bg-white text-slate-900 font-bold hover:bg-slate-200 transition-colors text-sm mb-8 shadow-lg shadow-white/10">
              Get Plus plan
            </button>

            <div className="space-y-4 flex-1">
              <Feature text="1,500 Monthly Points" highlight />
              <Feature text="Unlimited Active Links" />
              <Feature text="Advanced AI Analytics" />
              <Feature text="Priority Support" />
              <Feature text="Lower Transaction Fees" />
            </div>
          </div>

          {/* Pro Plan */}
          <div className="flex flex-col p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-slate-100">Pro</h3>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-bold text-white">$42</span>
                <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">SAVE 30%</span>
              </div>
              <p className="text-slate-500 text-sm mt-1">per month, billed annually</p>
            </div>

            <button className="w-full py-2.5 rounded-lg border border-slate-700 text-white font-medium hover:bg-slate-800 transition-colors text-sm mb-8">
              Get Pro plan
            </button>

            <div className="space-y-4 flex-1">
              <Feature text="5,000 Monthly Points" />
              <Feature text="White Label Reports" />
              <Feature text="API Access" />
              <Feature text="Dedicated Account Manager" />
              <Feature text="0% Transaction Fees" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Feature: React.FC<{ text: string; highlight?: boolean }> = ({ text, highlight }) => (
  <div className="flex items-start gap-3">
    <div className={`mt-0.5 p-0.5 rounded-full ${highlight ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
      <Check size={14} strokeWidth={3} />
    </div>
    <span className={`text-sm ${highlight ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>{text}</span>
  </div>
);

export default PricingSection;
