import React, { useEffect, useRef, useState } from 'react';
import { Check, CreditCard, Loader2, ShieldCheck, Sparkles } from 'lucide-react';

/**
 * Pricing and subscription.
 *
 * The PayPal button is rendered by PayPal's own SDK, so card details never
 * touch this page or our server: the buyer approves in PayPal's window and we
 * receive a subscription id, which the server then checks with PayPal before
 * anything is unlocked.
 */

type Billing = {
  enabled: boolean;
  live: boolean;
  clientId: string | null;
  planId: string | null;
  plan: 'free' | 'pro';
  billing: { status: string | null; renewsAt: string | null; subscriptionId: string | null } | null;
  pro: { name: string; price: string; currency: string; interval: string; includes: string[] };
  freeLimits: { websites: number; manualLinks: number; verifyEveryHours: number };
};

const loadPayPal = (clientId: string) => new Promise<any>((resolve, reject) => {
  const w = window as any;
  if (w.paypal) return resolve(w.paypal);

  const existing = document.querySelector<HTMLScriptElement>('script[data-paypal-sdk]');
  if (existing) {
    existing.addEventListener('load', () => resolve((window as any).paypal));
    existing.addEventListener('error', () => reject(new Error('sdk')));
    return;
  }

  const script = document.createElement('script');
  script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription`;
  script.async = true;
  script.dataset.paypalSdk = 'true';
  script.onload = () => resolve((window as any).paypal);
  script.onerror = () => reject(new Error('sdk'));
  document.body.appendChild(script);
});

const BillingPage: React.FC = () => {
  const [data, setData] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const buttonRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  const load = async () => {
    try {
      const res = await fetch('/api/billing');
      if (!res.ok) throw new Error('billing');
      setData(await res.json());
    } catch {
      setError('Could not load your plan. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // The SDK is only fetched once there is something to buy and a configured
  // client id, so a deployment without billing loads no third-party script.
  useEffect(() => {
    if (!data?.enabled || !data.clientId || !data.planId || 'pro' === data.plan || rendered.current) return;

    let cancelled = false;
    loadPayPal(data.clientId)
      .then(paypal => {
        if (cancelled || !buttonRef.current || rendered.current) return;
        rendered.current = true;

        paypal.Buttons({
          style: { layout: 'vertical', shape: 'pill', color: 'blue', label: 'subscribe' },
          createSubscription: (_: unknown, actions: any) => actions.subscription.create({ plan_id: data.planId }),
          onApprove: async (approval: { subscriptionID: string }) => {
            setBusy(true);
            setError('');
            try {
              const res = await fetch('/api/billing/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: approval.subscriptionID })
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) { setError(body.error || 'PayPal approved it, but we could not confirm it. Press Refresh below.'); return; }
              setMessage('You are on Pro. Thank you.');
              load();
            } finally {
              setBusy(false);
            }
          },
          onError: () => setError('PayPal could not complete that. Nothing has been charged.')
        }).render(buttonRef.current);
      })
      .catch(() => setError('PayPal could not be loaded. Check your connection or an ad blocker.'));

    return () => { cancelled = true; };
  }, [data]);

  const post = async (path: string, ok: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(path, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || 'That did not work.'); return; }
      setMessage(body.message || ok);
      load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-3 text-slate-400 p-10"><Loader2 className="animate-spin" size={18} /> Loading your plan…</div>;
  }

  const isPro = 'pro' === data?.plan;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
      <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
        <p className="text-slate-500 text-sm uppercase tracking-wider font-bold mb-2">Your plan</p>
        <h3 className="text-3xl font-black text-white mb-2">{isPro ? 'Pro' : 'Free'}</h3>
        <p className="text-slate-400 text-sm max-w-2xl">
          {isPro
            ? 'Unlimited sites, checks whenever you want them, and an alert the day a link breaks.'
            : 'Finding broken links and the redirect guard are free, and stay free. Pro is for running more than one site and checking on your own schedule.'}
        </p>
        {data?.billing?.renewsAt && (
          <p className="text-slate-500 text-xs mt-3">
            {'ACTIVE' === data.billing.status ? 'Renews' : `${data.billing.status}, next date`}{' '}
            {new Date(data.billing.renewsAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {message && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm px-5 py-3 rounded-2xl">{message}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm px-5 py-3 rounded-2xl">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`rounded-3xl p-8 border ${isPro ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-900/50 border-blue-500/30'}`}>
          <h4 className="text-white font-bold text-xl mb-1">Free</h4>
          <p className="text-4xl font-black text-white mb-6">$0</p>
          <ul className="space-y-3 text-sm text-slate-300">
            {[
              `${data?.freeLimits.websites} website`,
              'Broken links found and listed',
              'The redirect guard, in full',
              'One-click redirects in the plugin',
              `Links re-checked every ${data?.freeLimits.verifyEveryHours} hours`,
              `${data?.freeLimits.manualLinks} placements added by hand`,
              'The partner network and its dofollow links'
            ].map(item => (
              <li key={item} className="flex gap-2"><Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />{item}</li>
            ))}
          </ul>
          {!isPro && <p className="text-blue-400 text-xs font-bold mt-6 uppercase tracking-wider">Your plan</p>}
        </div>

        <div className={`rounded-3xl p-8 border ${isPro ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-900/50 border-slate-800'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-blue-400" />
            <h4 className="text-white font-bold text-xl">{data?.pro.name}</h4>
          </div>
          <p className="text-4xl font-black text-white mb-1">
            ${data?.pro.price}<span className="text-slate-500 text-base font-bold">/{data?.pro.interval}</span>
          </p>
          <p className="text-slate-500 text-xs mb-6">Everything in Free, plus:</p>
          <ul className="space-y-3 text-sm text-slate-300 mb-8">
            {(data?.pro.includes || []).map(item => (
              <li key={item} className="flex gap-2"><Check size={16} className="text-blue-400 shrink-0 mt-0.5" />{item}</li>
            ))}
          </ul>

          {isPro ? (
            <div className="space-y-3">
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Your plan</p>
              <div className="flex gap-2">
                <button onClick={() => post('/api/billing/refresh', 'Plan refreshed.')} disabled={busy}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                  Refresh
                </button>
                <button onClick={() => post('/api/billing/cancel', 'Cancelled.')} disabled={busy}
                  className="flex-1 bg-slate-800 hover:bg-red-600/20 border border-slate-700 hover:border-red-500/30 text-slate-400 hover:text-red-300 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : data?.enabled ? (
            <>
              {busy && <div className="flex items-center gap-2 text-slate-400 text-sm mb-3"><Loader2 size={14} className="animate-spin" /> Confirming with PayPal…</div>}
              <div ref={buttonRef} />
              <p className="text-slate-500 text-xs mt-4 flex items-start gap-2">
                <ShieldCheck size={14} className="shrink-0 mt-0.5" />
                Paid through PayPal. Your card details never reach this site. Cancel any time from here or from
                your PayPal account.
              </p>
              {!data.live && (
                <p className="text-amber-400/80 text-xs mt-2">Sandbox mode &mdash; no real money will move.</p>
              )}
            </>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-slate-400 text-sm flex gap-2">
              <CreditCard size={16} className="shrink-0 mt-0.5" />
              Pro is not open for signups yet. Everything you can see today is free.
            </div>
          )}
        </div>
      </div>

      <p className="text-slate-600 text-xs max-w-3xl">
        Finding a broken link and the guard that keeps an old URL working are deliberately not behind the paywall.
        Charging for those would mean a paying customer&rsquo;s links survive while a free user&rsquo;s quietly die,
        which is the exact thing this was built to stop.
      </p>
    </div>
  );
};

export default BillingPage;
