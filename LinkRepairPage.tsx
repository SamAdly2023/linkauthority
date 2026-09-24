import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, Link2, Loader2,
  Plus, RefreshCw, Shield, XCircle
} from 'lucide-react';
import { Website } from './types';

/**
 * Link Repair: the links other sites are sending here, and which of them now
 * land on nothing.
 *
 * Everything on this page was fetched, not estimated. A row says "broken" only
 * when the linking page still carries the link and the page it points at
 * answers 404 - the one case a redirect wins something back. A link the other
 * site took down is reported as removed, because no redirect brings that back.
 */

type Link = {
  id: string;
  sourceUrl: string;
  sourceHost: string;
  targetUrl: string;
  targetPath: string;
  status: 'live' | 'target-missing' | 'removed' | 'source-gone' | 'unverified';
  targetStatus: number | null;
  discoveredVia: 'referrer' | '404' | 'manual';
  hits: number;
  anchor: string | null;
  dofollow: boolean | null;
  rel: string | null;
  dismissed?: boolean;
};

type Summary = {
  total: number; live: number; broken: number; removed: number;
  sourceGone: number; unverified: number; dofollow: number;
  brokenDomains: number; brokenTargets: number;
};

type Props = { sites: Website[] };

const idOf = (s: any) => String(s?._id || s?.id || '');
const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

const STATUS: Record<Link['status'], { label: string; tone: string; note: string }> = {
  'target-missing': { label: 'Broken', tone: 'text-red-400 bg-red-500/10 border-red-500/20', note: 'They still link here. The page is gone.' },
  live: { label: 'Working', tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', note: 'Verified on both ends.' },
  removed: { label: 'Removed', tone: 'text-slate-400 bg-slate-800 border-slate-700', note: 'Their page is up, but the link is no longer on it.' },
  'source-gone': { label: 'Source down', tone: 'text-amber-400 bg-amber-500/10 border-amber-500/20', note: 'The linking page could not be fetched.' },
  unverified: { label: 'Not checked yet', tone: 'text-slate-400 bg-slate-800 border-slate-700', note: 'Seen, but not yet verified.' }
};

const LinkRepairPage: React.FC<Props> = ({ sites }) => {
  const [siteId, setSiteId] = useState(() => idOf(sites[0]));
  const [data, setData] = useState<{ summary: Summary; links: Link[]; protectedPaths: Record<string, { links: number; domains: number }> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');

  const site = sites.find(s => idOf(s) === siteId) || null;

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/websites/${siteId}/links`);
      if (!res.ok) throw new Error('load');
      setData(await res.json());
    } catch {
      setError('Could not load your links. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  const verify = async () => {
    setVerifying(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch(`/api/websites/${siteId}/links/verify`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (429 === res.status) {
        setMessage('Checked recently. Each link is re-checked at most once every 15 minutes; the list below is the latest.');
        return;
      }
      if (!res.ok) throw new Error('verify');
      setData(d => (d ? { ...d, summary: body.summary, links: body.links } : d));
      setMessage(`Checked ${body.checked} ${1 === body.checked ? 'link' : 'links'}.${body.repaired ? ` ${body.repaired} now working again.` : ''}`);
    } catch {
      setError('The check could not be completed. Try again in a moment.');
    } finally {
      setVerifying(false);
    }
  };

  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError('');
    try {
      const res = await fetch(`/api/websites/${siteId}/links`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl: source, targetUrl: target })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || 'That link could not be added.'); return; }
      setSource(''); setTarget('');
      setMessage('Added. It will be checked on the next pass.');
      load();
    } finally {
      setAdding(false);
    }
  };

  const dismiss = async (link: Link) => {
    await fetch(`/api/websites/${siteId}/links/${link.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissed: true })
    });
    setData(d => (d ? { ...d, links: d.links.filter(l => l.id !== link.id) } : d));
  };

  if (!sites.length) {
    return (
      <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 text-center">
        <Link2 className="mx-auto text-slate-600 mb-4" size={36} />
        <h3 className="text-xl font-bold text-white mb-2">Add a website first</h3>
        <p className="text-slate-400 text-sm">Link Repair watches the sites on your account. Add one under My Websites, install the plugin, and it starts here.</p>
      </div>
    );
  }

  const summary = data?.summary;
  const broken = (data?.links || []).filter(l => 'target-missing' === l.status && !l.dismissed);
  const others = (data?.links || []).filter(l => 'target-missing' !== l.status);
  const guarded: Array<[string, { links: number; domains: number }]> = Object.entries(data?.protectedPaths || {});
  guarded.sort((a, b) => b[1].links - a[1].links);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <p className="text-slate-500 text-sm uppercase tracking-wider font-bold mb-2">Link Repair</p>
            <h3 className="text-3xl font-black text-white mb-2">
              {summary && summary.broken > 0
                ? <>{summary.broken} {1 === summary.broken ? 'link is' : 'links are'} pointing at a dead page</>
                : <>Nothing is broken right now</>}
            </h3>
            <p className="text-slate-400 text-sm max-w-2xl">
              Other sites link to you. When you rename or delete a page, those links keep existing &mdash; they just stop
              landing anywhere, and nothing tells you. This finds them by watching where your visitors actually arrive
              from, then checking both ends: their page, and yours.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <select
              value={siteId}
              onChange={e => setSiteId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 outline-none focus:border-blue-500 lg:w-64"
            >
              {sites.map(s => <option key={idOf(s)} value={idOf(s)}>{hostOf(s.url)}</option>)}
            </select>
            <button
              onClick={verify}
              disabled={verifying || loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
            >
              {verifying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {verifying ? 'Checking…' : 'Check links now'}
            </button>
          </div>
        </div>
      </div>

      {message && <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm px-5 py-3 rounded-2xl">{message}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm px-5 py-3 rounded-2xl">{error}</div>}

      {loading && !data && (
        <div className="flex items-center gap-3 text-slate-400 p-8"><Loader2 className="animate-spin" size={18} /> Loading your links…</div>
      )}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Broken', value: summary.broken, note: `${summary.brokenDomains} ${1 === summary.brokenDomains ? 'domain' : 'domains'} affected`, tone: summary.broken ? 'text-red-400' : 'text-slate-200', icon: AlertTriangle },
            { label: 'Working', value: summary.live, note: 'verified on both ends', tone: 'text-emerald-400', icon: CheckCircle2 },
            { label: 'Dofollow', value: summary.dofollow, note: 'pass ranking equity', tone: 'text-blue-400', icon: Link2 },
            { label: 'Protected URLs', value: guarded.length, note: 'renaming one is caught', tone: 'text-slate-200', icon: Shield }
          ].map(tile => (
            <div key={tile.label} className="bg-slate-900/50 border border-slate-800 rounded-3xl p-5">
              <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-bold mb-2">
                <tile.icon size={14} /> {tile.label}
              </div>
              <div className={`text-3xl font-black ${tile.tone} tabular-nums`}>{tile.value}</div>
              <div className="text-slate-500 text-xs mt-1">{tile.note}</div>
            </div>
          ))}
        </div>
      )}

      {broken.length > 0 && (
        <div className="bg-slate-900/50 border border-red-500/20 rounded-3xl p-6">
          <h4 className="text-white font-bold text-lg mb-1">Broken links</h4>
          <p className="text-slate-400 text-sm mb-5">
            Each of these is a real site still sending people to an address that answers 404. Fix them in the plugin,
            on the <span className="text-slate-300">LinkAuthority &rarr; Link Repair</span> screen, where one field
            points the old address at the page that replaced it.
          </p>
          <div className="space-y-3">
            {broken.map(link => (
              <div key={link.id} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <a href={link.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm font-bold flex items-center gap-1">
                      {link.sourceHost} <ExternalLink size={12} />
                    </a>
                    <ArrowRight size={14} className="text-slate-600" />
                    <code className="text-xs text-red-300 bg-red-500/10 px-2 py-0.5 rounded">{link.targetPath}</code>
                    <span className="text-xs text-red-400 font-bold">{link.targetStatus || 404}</span>
                  </div>
                  <p className="text-slate-500 text-xs">
                    {link.anchor ? <>Anchor: &ldquo;{link.anchor}&rdquo; &middot; </> : null}
                    {link.hits > 0 ? <>{link.hits} {1 === link.hits ? 'visitor' : 'visitors'} arrived this way</> : 'no visitors recorded yet'}
                  </p>
                </div>
                <button onClick={() => dismiss(link)} className="text-slate-500 hover:text-slate-300 text-xs shrink-0">Ignore</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {guarded.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <h4 className="text-white font-bold text-lg mb-1">Protected URLs</h4>
          <p className="text-slate-400 text-sm mb-5">
            Other sites link to these addresses. If you rename one of these pages in WordPress, the plugin keeps the old
            address working automatically and tells you it did.
          </p>
          <div className="flex flex-wrap gap-2">
            {guarded.slice(0, 40).map(([path, info]) => (
              <span key={path} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <code className="text-slate-300">{path}</code>
                <span className="text-slate-500 ml-2">{info.domains} {1 === info.domains ? 'domain' : 'domains'}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 overflow-x-auto">
          <h4 className="text-white font-bold text-lg mb-4">Every link we know about</h4>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wider">
                <th className="pb-3 font-bold">Linking site</th>
                <th className="pb-3 font-bold">Points at</th>
                <th className="pb-3 font-bold">State</th>
                <th className="pb-3 font-bold">Type</th>
                <th className="pb-3 font-bold text-right">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {others.map(link => {
                const s = STATUS[link.status] || STATUS.unverified;
                return (
                  <tr key={link.id} className="border-t border-slate-800/70">
                    <td className="py-3">
                      <a href={link.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-slate-200 hover:text-blue-400">{link.sourceHost}</a>
                    </td>
                    <td className="py-3"><code className="text-slate-400 text-xs">{link.targetPath}</code></td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-lg border text-xs font-bold ${s.tone}`} title={s.note}>{s.label}</span>
                    </td>
                    <td className="py-3 text-xs">
                      {'live' !== link.status
                        ? <span className="text-slate-600">&mdash;</span>
                        : link.dofollow
                          ? <span className="text-emerald-400 font-bold">Dofollow</span>
                          : <span className="text-slate-400">{link.rel || 'nofollow'}</span>}
                    </td>
                    <td className="py-3 text-right text-slate-400 tabular-nums">{link.hits || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && 0 === data.links.length && !loading && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 text-center">
          <Link2 className="mx-auto text-slate-600 mb-4" size={32} />
          <h4 className="text-white font-bold mb-2">No links discovered yet</h4>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Install the LinkAuthority plugin on {site ? hostOf(site.url) : 'your site'} and this fills in on its own:
            every time a visitor arrives from another site, that link is recorded and checked. If one ever breaks, it
            appears here the first time somebody follows it. You can also add a link you already know about below.
          </p>
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
        <h4 className="text-white font-bold mb-1">Add a link you already know about</h4>
        <p className="text-slate-400 text-sm mb-4">
          A placement you paid for, a press mention, or a row from a Search Console export. We will check it on the next
          pass and watch it from then on.
        </p>
        <form onSubmit={addLink} className="flex flex-col md:flex-row gap-3">
          <input
            type="url" required value={source} onChange={e => setSource(e.target.value)}
            placeholder="https://theirsite.com/the-page-that-links-to-you"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-blue-500"
          />
          <input
            type="url" required value={target} onChange={e => setTarget(e.target.value)}
            placeholder={site ? `${site.url.replace(/\/$/, '')}/your-page` : 'https://yoursite.com/your-page'}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-blue-500"
          />
          <button
            type="submit" disabled={adding}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Watch it
          </button>
        </form>
      </div>

      <p className="text-slate-600 text-xs max-w-3xl">
        <XCircle size={12} className="inline mr-1 -mt-0.5" />
        This covers links we can verify by fetching the page. It is not a crawl of the whole web: a complete backlink
        index needs a commercial data source, and nothing here is estimated to fill that gap.
      </p>
    </div>
  );
};

export default LinkRepairPage;
