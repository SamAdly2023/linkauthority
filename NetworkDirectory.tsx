import React, { useMemo, useState } from 'react';
import { Search, Globe, MapPin, ExternalLink, EyeOff, Eye, ShieldCheck, Filter, Users } from 'lucide-react';
import { Website } from './types';

/**
 * The network directory: every active member, browsable by niche, with the
 * owner's control over who appears on their own page.
 *
 * The exchange itself stays automatic - every member links to every other -
 * which is the product's whole promise. What the owner controls is their own
 * page: hide a partner they would rather not list, or limit the page to their
 * own category. Hiding is one-directional; the owner still appears on the
 * hidden partner's page. Nothing here is requested or approved.
 */

type Member = Website & { name?: string | null; logo?: string | null; owner?: { name: string } };
type Own = Website & { hiddenPartners?: string[]; partnerScope?: 'all' | 'niche' };

type Props = {
  members: Member[];
  ownSites: Own[];
  /** Called after a curation change so the caller can reload the user's sites. */
  onCurated: () => void;
};

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

const NetworkDirectory: React.FC<Props> = ({ members, ownSites, onCurated }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [serviceType, setServiceType] = useState<'all' | 'local' | 'worldwide'>('all');
  const [curatingId, setCuratingId] = useState<string>(() => String((ownSites[0] as any)?._id || (ownSites[0] as any)?.id || ''));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const active = useMemo(() => members.filter(m => m.isActive), [members]);
  const categories = useMemo(() => [...new Set(active.map(m => m.category).filter(Boolean))].sort(), [active]);

  const curating = ownSites.find(s => String((s as any)._id || (s as any).id) === curatingId) || null;
  const hidden = new Set<string>(curating?.hiddenPartners || []);
  const nicheOnly = curating?.partnerScope === 'niche';

  const shown = active.filter(m => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || (m.category || '').toLowerCase().includes(q) || m.url.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q);
    const matchesCat = category === 'all' || m.category === category;
    const matchesType = serviceType === 'all' || m.serviceType === serviceType;
    return matchesSearch && matchesCat && matchesType;
  });

  const save = async (patch: { hiddenPartners?: string[]; partnerScope?: 'all' | 'niche' }, key: string) => {
    if (!curating) return;
    setSaving(key);
    setError('');
    try {
      const res = await fetch(`/api/websites/${curatingId}/curation`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Could not save.');
        return;
      }
      onCurated();
    } catch {
      setError('Could not save. Check your connection.');
    } finally {
      setSaving(null);
    }
  };

  const toggleHidden = (memberId: string) => {
    const next = hidden.has(memberId) ? [...hidden].filter(id => id !== memberId) : [...hidden, memberId];
    save({ hiddenPartners: next }, memberId);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
        <p className="text-slate-500 text-sm uppercase tracking-wider font-bold mb-2">The Network</p>
        <h3 className="text-3xl font-black text-white mb-2">
          {active.length.toLocaleString()} active {active.length === 1 ? 'site is' : 'sites are'} linking to you
        </h3>
        <p className="text-slate-400 text-sm max-w-2xl">
          Every site below carries a dofollow link to each of your active websites, and each of your Business
          Partners pages carries a link back to them. Listings update automatically as members join and leave
          &mdash; there is nothing to request. What you control is who appears on <em>your</em> page.
        </p>
      </div>

      {/* Curation: which of my sites am I editing, and its scope */}
      {ownSites.length > 0 && (
        <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm font-bold uppercase tracking-wider shrink-0">
              <ShieldCheck size={16} /> Your page
            </div>
            <select
              value={curatingId}
              onChange={e => setCuratingId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 outline-none focus:border-blue-500 md:w-72"
            >
              {ownSites.map(s => <option key={String((s as any)._id || (s as any).id)} value={String((s as any)._id || (s as any).id)}>{hostOf(s.url)}</option>)}
            </select>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <button
                type="button"
                role="switch"
                aria-checked={nicheOnly}
                disabled={saving === 'scope' || !curating}
                onClick={() => save({ partnerScope: nicheOnly ? 'all' : 'niche' }, 'scope')}
                className={`relative w-11 h-6 rounded-full transition-colors ${nicheOnly ? 'bg-blue-600' : 'bg-slate-700'} disabled:opacity-50`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${nicheOnly ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-sm text-slate-300">
                Only list partners in my category{curating?.category ? <span className="text-slate-500"> ({curating.category})</span> : null}
              </span>
            </label>
            {hidden.size > 0 && (
              <span className="text-xs text-slate-500 md:ml-auto">{hidden.size} hidden from this page</span>
            )}
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-2 mb-4 text-slate-400 text-sm font-bold uppercase tracking-wider">
          <Filter size={16} /> Browse
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by name, niche, or URL"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="md:col-span-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 outline-none focus:border-blue-500"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="all">All niches ({active.length})</option>
            {categories.map(c => <option key={c} value={c}>{c} ({active.filter(m => m.category === c).length})</option>)}
          </select>
          <select
            className="md:col-span-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 outline-none focus:border-blue-500"
            value={serviceType}
            onChange={e => setServiceType(e.target.value as any)}
          >
            <option value="all">Local and worldwide</option>
            <option value="local">Local businesses</option>
            <option value="worldwide">Worldwide</option>
          </select>
        </div>
      </div>

      {/* Members */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {shown.map(m => {
          const id = String((m as any)._id || (m as any).id);
          const isHidden = hidden.has(id);
          const outOfNiche = nicheOnly && curating?.category && m.category !== curating.category;
          const notOnMyPage = isHidden || outOfNiche;
          return (
            <div key={id} className={`bg-slate-900/50 rounded-3xl p-6 border transition-all group ${notOnMyPage ? 'border-slate-800/60 opacity-60' : 'border-slate-800 hover:border-blue-500/30'}`}>
              <div className="flex items-start gap-4 mb-4">
                {m.logo
                  ? <img src={m.logo} alt="" className="w-12 h-12 rounded-xl object-cover bg-slate-800 shrink-0" />
                  : <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 shrink-0"><Globe size={20} /></div>}
                <div className="min-w-0 flex-1">
                  <h4 className="text-white font-bold truncate group-hover:text-blue-400 transition-colors">{m.name || hostOf(m.url)}</h4>
                  <p className="text-slate-500 text-xs truncate">{hostOf(m.url)}</p>
                </div>
                <div className="text-right shrink-0">
                  {typeof m.domainAuthority === 'number'
                    ? <div className="text-blue-400 font-bold text-sm tabular-nums">{m.domainAuthority.toFixed(1)}<span className="text-slate-500 text-xs">/10</span></div>
                    : <div className="text-slate-600 text-xs">not measured</div>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                {m.category && <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-[11px] font-semibold uppercase tracking-wider">{m.category}</span>}
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  {m.serviceType === 'local' && m.location?.city
                    ? <><MapPin size={12} />{m.location.city}{m.location.country ? `, ${m.location.country}` : ''}</>
                    : <><Globe size={12} />Worldwide</>}
                </span>
              </div>

              {m.description && <p className="text-slate-400 text-sm mb-4 line-clamp-3">{m.description}</p>}

              {notOnMyPage && (
                <p className="text-xs text-amber-500/90 mb-3 flex items-center gap-1">
                  <EyeOff size={12} /> {isHidden ? 'Hidden from your page' : 'Outside your category — not on your page'}
                  {' '}&middot; still links to you
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => window.open(m.url, '_blank', 'noopener')}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  Visit <ExternalLink size={14} />
                </button>
                {curating && !outOfNiche && (
                  <button
                    onClick={() => toggleHidden(id)}
                    disabled={saving === id}
                    title={isHidden ? `Show ${hostOf(m.url)} on ${hostOf(curating.url)} again` : `Hide ${hostOf(m.url)} from ${hostOf(curating.url)}`}
                    className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5 disabled:opacity-50 ${isHidden ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 hover:bg-blue-600/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                  >
                    {isHidden ? <><Eye size={14} /> Show</> : <><EyeOff size={14} /> Hide</>}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {active.length === 0 && (
          <div className="col-span-full text-center py-10 text-slate-500">
            No other sites are active yet. As soon as one activates, it appears here &mdash; and your links appear on it.
          </div>
        )}
        {active.length > 0 && shown.length === 0 && (
          <div className="col-span-full text-center py-10 text-slate-500 flex flex-col items-center gap-2">
            <Users size={22} className="text-slate-600" />
            Nothing matches those filters.
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkDirectory;
