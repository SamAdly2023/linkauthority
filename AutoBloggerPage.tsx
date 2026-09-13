import React, { useEffect, useState } from 'react';
import { Download, Share2, CheckCircle2, AlertCircle, ExternalLink, Facebook, Instagram, Linkedin, RefreshCw } from 'lucide-react';

/**
 * Auto Blogger: the second plugin, and the social-sharing relay behind it.
 *
 * The connect buttons live inside the plugin, not here, and that is a design
 * choice worth keeping: the OAuth tokens for someone's Facebook Page or
 * LinkedIn profile are handed to their own WordPress site and never stored on
 * LinkAuthority. This page tells them what is ready, gives them the plugin,
 * and shows the three-step flow - it does not ask for their accounts.
 */

type Health = {
  ok: boolean;
  providers: { meta: boolean; pinterest: boolean; linkedin: boolean };
  licensing: 'open' | 'required';
  callbacks: string[];
};

const PinterestIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.64 7.86 6.36 9.32-.09-.79-.17-2.01.03-2.87.18-.78 1.17-4.96 1.17-4.96s-.3-.6-.3-1.48c0-1.39.81-2.43 1.81-2.43.85 0 1.27.64 1.27 1.41 0 .86-.55 2.14-.83 3.33-.24.99.5 1.8 1.47 1.8 1.77 0 3.13-1.86 3.13-4.56 0-2.38-1.71-4.05-4.16-4.05-2.83 0-4.49 2.12-4.49 4.32 0 .86.33 1.78.74 2.28.08.1.09.19.07.29-.08.32-.25 1.01-.28 1.15-.04.19-.15.23-.34.14-1.25-.58-2.03-2.41-2.03-3.88 0-3.16 2.29-6.06 6.61-6.06 3.47 0 6.17 2.47 6.17 5.78 0 3.45-2.17 6.22-5.19 6.22-1.01 0-1.97-.53-2.29-1.15l-.62 2.38c-.23.87-.84 1.96-1.25 2.62.94.29 1.94.45 2.98.45 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
  </svg>
);

const AutoBloggerPage: React.FC = () => {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthState, setHealthState] = useState<'loading' | 'ok' | 'unconfigured' | 'down'>('loading');

  useEffect(() => {
    let cancelled = false;

    fetch('/connect/health')
      .then(async (r) => {
        // 503 with JSON is the relay saying it is mounted but has no secret yet.
        if (r.status === 503) return { state: 'unconfigured' as const, body: null };
        if (!r.ok) return { state: 'down' as const, body: null };
        const ct = r.headers.get('content-type') || '';
        // HTML back means the SPA answered: the relay is not deployed at all.
        if (!ct.includes('json')) return { state: 'down' as const, body: null };
        return { state: 'ok' as const, body: (await r.json()) as Health };
      })
      .then(({ state, body }) => {
        if (cancelled) return;
        setHealthState(state);
        setHealth(body);
      })
      .catch(() => { if (!cancelled) setHealthState('down'); });

    return () => { cancelled = true; };
  }, []);

  const providers = [
    { key: 'meta' as const, name: 'Facebook & Instagram', icon: Facebook, note: 'Facebook Pages and Instagram Business accounts' },
    { key: 'linkedin' as const, name: 'LinkedIn', icon: Linkedin, note: 'Personal profiles now; Company Pages once LinkedIn approves it' },
    { key: 'pinterest' as const, name: 'Pinterest', icon: PinterestIcon, note: 'Boards on a business account' }
  ];

  const liveCount = health ? Object.values(health.providers).filter(Boolean).length : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Share2 className="text-pink-400" size={30} />
          Auto Blogger &amp; Social Sharing
        </h2>
        <p className="text-slate-400 max-w-2xl">
          A second plugin that researches, writes and publishes long-form posts on a schedule,
          generates a featured image, and shares each one to your social accounts. Connecting those
          accounts takes one click, because they authorise through LinkAuthority instead of you
          registering developer apps of your own.
        </p>
      </div>

      {/* Download */}
      <div className="bg-gradient-to-br from-pink-600/10 to-purple-600/10 border border-pink-500/20 rounded-3xl p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Get the plugin</h3>
            <p className="text-slate-400 text-sm max-w-xl">
              Install it on any WordPress site alongside LinkAuthority Partners. You will need a
              Manus API key for the writing and a Pexels key for photos - both free to create and
              entered inside the plugin.
            </p>
          </div>
          <a
            href="/api/wp/auto-blogger"
            className="inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-pink-600/20 shrink-0"
          >
            <Download size={18} />
            Download Auto Blogger
          </a>
        </div>
      </div>

      {/* Relay status - real, from the server */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Social networks you can connect</h3>
            <p className="text-slate-400 text-sm">
              Live status of the LinkAuthority connect service. A network only appears connectable
              here once its developer app is registered and approved.
            </p>
          </div>
          {healthState === 'ok' && (
            <span className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full ${liveCount ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
              {liveCount} of 3 live
            </span>
          )}
        </div>

        {healthState === 'loading' && (
          <div className="flex items-center gap-2 text-slate-500 text-sm"><RefreshCw size={14} className="animate-spin" /> Checking the connect service&hellip;</div>
        )}

        {healthState === 'down' && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm">
            <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div className="text-slate-300">
              <p className="font-semibold text-white">The connect service is not deployed.</p>
              <p className="text-slate-400 mt-1">Nothing answered at <code className="text-slate-300">/connect/health</code>. Deploy the latest server build, then set <code className="text-slate-300">CONNECT_SECRET</code> and <code className="text-slate-300">BASE_URL</code>.</p>
            </div>
          </div>
        )}

        {healthState === 'unconfigured' && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-sm">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-slate-300">
              <p className="font-semibold text-white">The connect service is deployed but not configured.</p>
              <p className="text-slate-400 mt-1">Set <code className="text-slate-300">CONNECT_SECRET</code> and <code className="text-slate-300">BASE_URL</code> in the hosting panel and restart. Networks light up as their app credentials are added.</p>
            </div>
          </div>
        )}

        {healthState === 'ok' && health && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {providers.map(({ key, name, icon: Icon, note }) => {
              const live = health.providers[key];
              return (
                <div key={key} className={`rounded-2xl border p-5 ${live ? 'border-green-500/30 bg-green-500/5' : 'border-slate-800 bg-slate-950/40'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <Icon size={22} className={live ? 'text-green-400' : 'text-slate-500'} />
                    {live
                      ? <span className="inline-flex items-center gap-1 text-xs font-bold text-green-500"><CheckCircle2 size={13} /> Ready</span>
                      : <span className="text-xs font-bold text-slate-500">Not set up</span>}
                  </div>
                  <p className="text-white font-semibold">{name}</p>
                  <p className="text-slate-500 text-xs mt-1">{note}</p>
                </div>
              );
            })}
          </div>
        )}

        {healthState === 'ok' && health && (
          <p className="text-slate-500 text-xs mt-5">
            Licensing is <span className="text-slate-300 font-semibold">{health.licensing === 'open' ? 'open' : 'required'}</span>
            {health.licensing === 'open'
              ? ' - any site running the plugin can connect. Switch to keys before charging for it.'
              : ' - sites need a licence key from LinkAuthority to connect.'}
          </p>
        )}
      </div>

      {/* How connecting works */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
        <h3 className="text-xl font-bold text-white mb-1">Connecting your accounts</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-2xl">
          The connect buttons are inside the plugin, on purpose. Your Facebook, LinkedIn and
          Pinterest tokens are handed to <em>your</em> WordPress site and never stored on
          LinkAuthority - this service only brokers the sign-in and keeps nothing afterwards.
        </p>

        <ol className="space-y-4">
          {[
            ['Install and activate', 'Upload the zip above in WordPress under Plugins → Add New → Upload.'],
            ['Open Auto Blogger → Social Sharing', 'In the WordPress admin menu. Paste your LinkAuthority licence key if one is required.'],
            ['Click Connect on a network', 'A popup takes you to Facebook, LinkedIn or Pinterest to log in and approve. Pick the Page, board or profile to post to.'],
            ['Done', 'Every post the plugin publishes is shared there automatically, with a caption written for that network. Reconnect from the same screen if a token expires.']
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="shrink-0 w-8 h-8 rounded-full bg-pink-500/10 text-pink-400 font-bold text-sm flex items-center justify-center">{i + 1}</span>
              <div>
                <p className="text-white font-semibold">{title}</p>
                <p className="text-slate-400 text-sm">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* What it needs from you */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
        <h3 className="text-xl font-bold text-white mb-4">Keys the plugin asks for</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a href="https://manus.im/" target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-slate-800 hover:border-slate-700 bg-slate-950/40 p-5 transition-colors">
            <p className="text-white font-semibold flex items-center gap-2">Manus API key <ExternalLink size={14} className="text-slate-600 group-hover:text-slate-400" /></p>
            <p className="text-slate-500 text-sm mt-1">Does the research, writing and featured-image generation. Each post spends Manus credits; the "Lite" profile is cheapest.</p>
          </a>
          <a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-slate-800 hover:border-slate-700 bg-slate-950/40 p-5 transition-colors">
            <p className="text-white font-semibold flex items-center gap-2">Pexels API key <ExternalLink size={14} className="text-slate-600 group-hover:text-slate-400" /></p>
            <p className="text-slate-500 text-sm mt-1">Free. Copyright-safe photos and video inside each article, credited automatically.</p>
          </a>
        </div>
      </div>
    </div>
  );
};

export default AutoBloggerPage;
