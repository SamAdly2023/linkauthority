import React, { useEffect, useState } from 'react';
import { X, RefreshCw, ExternalLink, Link2 } from 'lucide-react';
import { Website } from './types';

/**
 * The verified backlinks one site is receiving from the network.
 *
 * Same data the plugin's admin screen shows: every partner page actually
 * fetched, the rel attribute read off the link, the source's own measured
 * authority, and a value label with its reasoning. Nothing here is estimated;
 * a source that was never measured says so rather than showing a zero.
 */

type Value = { label: 'strong' | 'useful' | 'modest' | 'citation' | 'none'; reason: string; relevant: boolean };
type Link = {
  from: string; page: string | null; status: 'live' | 'missing' | 'unreachable' | 'no-directory';
  anchor: string | null; dofollow: boolean | null; rel: string | null;
  fromAuthority: number | null; fromCategory: string | null; value: Value;
};
type Report = {
  checkedAt: any; networkSize: number; cached: boolean;
  totals: { live: number; dofollow: number; nofollow: number; missing: number; unreachable: number; noDirectory: number };
  byValue: { strong: number; useful: number; modest: number; citation: number; none: number; relevant: number };
  links: Link[];
};

const VALUE_STYLE: Record<Value['label'], string> = {
  strong: 'bg-green-500/10 text-green-400',
  useful: 'bg-blue-500/10 text-blue-400',
  modest: 'bg-amber-500/10 text-amber-400',
  citation: 'bg-purple-500/10 text-purple-400',
  none: 'bg-slate-700/40 text-slate-500'
};
const VALUE_LABEL: Record<Value['label'], string> = { strong: 'Strong', useful: 'Useful', modest: 'Modest', citation: 'Citation', none: 'None' };
const STATUS_LABEL: Record<Link['status'], string> = { live: 'Live', missing: 'Missing', unreachable: 'Unreachable', 'no-directory': 'No page' };
const STATUS_STYLE: Record<Link['status'], string> = {
  live: 'text-green-400', missing: 'text-amber-400', unreachable: 'text-slate-500', 'no-directory': 'text-slate-500'
};

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

const checkedAgo = (checkedAt: any) => {
  const ms = checkedAt?._seconds ? checkedAt._seconds * 1000 : Date.parse(checkedAt);
  if (!ms) return null;
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
};

const BacklinksPanel: React.FC<{ site: Website; onClose: () => void }> = ({ site, onClose }) => {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const id = (site as any)._id || (site as any).id;
      const res = await fetch(`/api/websites/${id}/backlinks${refresh ? '?refresh=true' : ''}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'The backlink check could not be completed.');
        return;
      }
      setReport(await res.json());
    } catch {
      setError('The backlink check could not be completed. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(false); }, [site]);

  const tiles = report ? [
    ['Live links', report.totals.live, `of ${report.networkSize} partners`],
    ['Dofollow', report.totals.dofollow, 'pass ranking equity'],
    ['Nofollow', report.totals.nofollow, 'mentions only'],
    ['Strong', report.byValue.strong, 'from well-linked domains'],
    ['Same category', report.byValue.relevant, 'weighted by search engines']
  ] : [];

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 md:p-10" onClick={onClose}>
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 p-6 md:p-8 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Link2 size={20} className="text-blue-400" /> Backlinks to {hostOf(site.url)}</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Every partner page fetched and checked for a live link to you, with the <code className="text-slate-300">rel</code> read
              off the link rather than assumed. Links from the network only &mdash; not a crawl of the whole web.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors"
              title="Re-fetch every partner page now"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Re-check
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-2 rounded-lg hover:bg-slate-800" aria-label="Close"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {loading && !report && (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm gap-2"><RefreshCw size={16} className="animate-spin" /> Fetching partner pages&hellip;</div>
          )}

          {report && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {tiles.map(([label, value, note]) => (
                  <div key={String(label)} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-slate-500 text-[11px] uppercase tracking-wider">{label}</p>
                    <p className="text-2xl font-bold text-white mt-1 tabular-nums">{value}</p>
                    <p className="text-slate-500 text-xs">{note}</p>
                  </div>
                ))}
              </div>

              {report.links.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">No other active partners yet. Links appear here as members join.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="pb-3 pr-4 font-semibold">Linking site</th>
                        <th className="pb-3 pr-4 font-semibold">Status</th>
                        <th className="pb-3 pr-4 font-semibold">Type</th>
                        <th className="pb-3 pr-4 font-semibold">Their authority</th>
                        <th className="pb-3 font-semibold">Value to you</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {report.links.map(l => (
                        <tr key={l.from} className="align-top hover:bg-slate-800/30">
                          <td className="py-3 pr-4">
                            {l.page
                              ? <a href={l.page} target="_blank" rel="noopener noreferrer" className="text-white hover:text-blue-400 inline-flex items-center gap-1">{hostOf(l.from)} <ExternalLink size={12} className="text-slate-600" /></a>
                              : <span className="text-white">{hostOf(l.from)}</span>}
                            {l.anchor && <p className="text-slate-500 text-xs mt-0.5">&ldquo;{l.anchor}&rdquo;</p>}
                          </td>
                          <td className={`py-3 pr-4 font-semibold ${STATUS_STYLE[l.status]}`}>{STATUS_LABEL[l.status]}</td>
                          <td className="py-3 pr-4">
                            {l.status !== 'live' ? <span className="text-slate-600">&mdash;</span>
                              : l.dofollow ? <span className="text-blue-400 font-semibold">Dofollow</span>
                              : <span className="text-slate-400">{l.rel || 'nofollow'}</span>}
                          </td>
                          <td className="py-3 pr-4 tabular-nums">
                            {typeof l.fromAuthority === 'number'
                              ? <span className="text-white">{l.fromAuthority.toFixed(1)}<span className="text-slate-500 text-xs">/10</span></span>
                              : <span className="text-slate-500 text-xs">not measured</span>}
                          </td>
                          <td className="py-3">
                            <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${VALUE_STYLE[l.value.label]}`}>{VALUE_LABEL[l.value.label]}</span>
                            <p className="text-slate-500 text-xs mt-1 max-w-xs">{l.value.reason}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-slate-600 text-xs">
                {report.cached ? 'From the last check' : 'Checked just now'}{checkedAgo(report.checkedAt) ? ` · ${checkedAgo(report.checkedAt)}` : ''}.
                Cached for a day; Re-check fetches every partner page again.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BacklinksPanel;
