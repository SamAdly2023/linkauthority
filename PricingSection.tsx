import React, { useState } from 'react';
import { Check, Sparkles, X, ShieldCheck } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  points: number;
  description: string;
}

const plans: Plan[] = [
  { id: 'starter-pack', name: 'Starter Pack', price: 19, points: 100, description: 'Perfect to start placing backlinks' },
  { id: 'growth-pack', name: 'Growth Pack', price: 49, points: 300, description: 'Best for growing website rankings' },
  { id: 'authority-pack', name: 'Authority Pack', price: 129, points: 1000, description: 'Ideal for scaling multiple sites' },
  { id: 'agency-pack', name: 'Agency Pack', price: 299, points: 3000, description: 'Best value for SEO agencies' }
];

const PricingSection: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showLoginHint, setShowLoginHint] = useState(false);

  const handlePlanClick = (plan: Plan) => {
    setSelectedPlan(plan);
  };

  return (
    <section id="pricing" className="py-24 bg-slate-950 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] bg-blue-600/5 rounded-full blur-[100px] -z-10"></div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Buy Exchange Credits</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Purchase point bundles to place dofollow backlinks on high-DA websites instantly. No monthly subscriptions required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Starter Pack */}
          <div className="flex flex-col p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors justify-between h-full">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-slate-100">{plans[0].name}</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold text-white">${plans[0].price}</span>
              </div>
              <p className="text-blue-400 text-sm font-semibold mt-2">{plans[0].points} Exchange Credits</p>
              <p className="text-slate-500 text-sm mt-2">{plans[0].description}</p>
            </div>
            
            <div>
              <div className="space-y-4 mb-8">
                <Feature text="Dofollow Link Placements" highlight />
                <Feature text="Verify Unlimited Sites" />
                <Feature text="Organic Point Earning" />
              </div>
              <button onClick={() => handlePlanClick(plans[0])} className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors text-center text-sm">
                Buy Starter Pack
              </button>
            </div>
          </div>

          {/* Growth Pack */}
          <div className="flex flex-col p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors justify-between h-full">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-slate-100">{plans[1].name}</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold text-white">${plans[1].price}</span>
                <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full ml-2">POPULAR</span>
              </div>
              <p className="text-blue-400 text-sm font-semibold mt-2">{plans[1].points} Exchange Credits</p>
              <p className="text-slate-500 text-sm mt-2">{plans[1].description}</p>
            </div>

            <div>
              <div className="space-y-4 mb-8">
                <Feature text="300 Credits Added Instantly" highlight />
                <Feature text="AI Niche Matching" />
                <Feature text="Priority Link Monitoring" />
              </div>
              <button onClick={() => handlePlanClick(plans[1])} className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors text-sm">
                Buy Growth Pack
              </button>
            </div>
          </div>

          {/* Authority Pack */}
          <div className="relative flex flex-col p-6 bg-slate-900 border-2 border-blue-600 rounded-2xl shadow-2xl shadow-blue-900/20 transform scale-105 z-10 justify-between h-full">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
              Best Value
            </div>
            <div className="mb-6 mt-2">
              <h3 className="text-lg font-medium text-slate-100">{plans[2].name}</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold text-white">${plans[2].price}</span>
              </div>
              <p className="text-blue-400 text-sm font-semibold mt-2">{plans[2].points} Exchange Credits</p>
              <p className="text-slate-500 text-sm mt-2">{plans[2].description}</p>
            </div>

            <div>
              <div className="space-y-4 mb-8">
                <Feature text="1,000 Credits Added" highlight />
                <Feature text="Priority Site Crawling" />
                <Feature text="Dofollow Backlink Silos" />
                <Feature text="Premium AI Analytics" />
              </div>
              <button onClick={() => handlePlanClick(plans[2])} className="w-full py-2.5 rounded-lg bg-white text-slate-900 font-bold hover:bg-slate-200 transition-colors text-sm shadow-lg shadow-white/10">
                Buy Authority Pack
              </button>
            </div>
          </div>

          {/* Agency Pack */}
          <div className="flex flex-col p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors justify-between h-full">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-slate-100">{plans[3].name}</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold text-white">${plans[3].price}</span>
              </div>
              <p className="text-blue-400 text-sm font-semibold mt-2">{plans[3].points} Exchange Credits</p>
              <p className="text-slate-500 text-sm mt-2">{plans[3].description}</p>
            </div>

            <div>
              <div className="space-y-4 mb-8">
                <Feature text="3,000 Credits Added" highlight />
                <Feature text="Dedicated Verification Support" />
                <Feature text="API Access" />
                <Feature text="Bulk Site Verification" />
              </div>
              <button onClick={() => handlePlanClick(plans[3])} className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors text-sm">
                Buy Agency Pack
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-md relative shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
            <button onClick={() => { setSelectedPlan(null); setShowLoginHint(false); }} className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors z-10">
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-white mb-2">Checkout: {selectedPlan.name}</h3>
            <p className="text-slate-400 text-sm mb-6">
                You are about to purchase <span className="text-white font-bold">{selectedPlan.points} Exchange Credits</span> for <span className="text-white font-bold">${selectedPlan.price}</span>.
            </p>
            
            {!showLoginHint ? (
                <div id="paypal-button-container" className="min-h-[150px]" ref={(el) => {
                    if (el && !el.hasChildNodes() && (window as any).paypal) {
                        (window as any).paypal.Buttons({
                            createOrder: (data: any, actions: any) => {
                                return actions.order.create({
                                    purchase_units: [{
                                        amount: {
                                            value: selectedPlan.price.toString()
                                        }
                                    }]
                                });
                            },
                            onApprove: (data: any, actions: any) => {
                                return actions.order.capture().then((details: any) => {
                                    fetch('/api/buy-points', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ 
                                            points: selectedPlan.points, 
                                            amount: selectedPlan.price,
                                            orderId: data.orderID
                                        })
                                    })
                                    .then(res => {
                                        if (res.status === 401 || res.status === 403) {
                                           setShowLoginHint(true);
                                           return; 
                                        }
                                        return res.json();
                                    })
                                    .then(data => {
                                        if (data && !data.error) {
                                            alert(`Transaction completed by ${details.payer.name.given_name}. Credits added!`);
                                            setSelectedPlan(null);
                                        }
                                    })
                                    .catch(err => {
                                        console.error(err);
                                        setShowLoginHint(true);
                                    });
                                });
                            },
                            onError: (err: any) => {
                                console.error(err);
                                alert('PayPal encountered an error.');
                            }
                        }).render(el);
                    }
                }}></div>
            ) : (
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                        <ShieldCheck size={32} />
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">Authentication Required</h4>
                    <p className="text-slate-400 mb-6">You need to be logged in to buy credits.</p>
                    <a href="/auth/google" className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-bold transition-colors">
                        Log In with Google
                    </a>
                </div>
            )}
          </div>
        </div>
      )}
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
