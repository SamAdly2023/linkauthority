import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Plug,
  Rocket,
  Search,
  ShieldCheck,
  Target,
  Twitter,
  Users,
  Wrench,
  Youtube,
  Zap
} from 'lucide-react';
import ParticleNetwork from './ParticleNetwork';
import PricingSection from './PricingSection';
import { PRICING_ENABLED } from './config';
import ChatWidget from './ChatWidget';
import SEO from './SEO';

interface LandingPageProps {
  onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  // Real counts, or nothing. The ticker showed "423 Links Exchanged Today" and
  // "1,204 New Websites Added" as literals for months; a visitor who joined and
  // found twenty partners knew at once what they had been told. If the fetch
  // fails the number is simply absent - never a placeholder that reads as data.
  const [stats, setStats] = useState<{ activeWebsites: number; linksPerMember: number; checkedEveryHours: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/stats')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d && typeof d.activeWebsites === 'number') setStats(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 font-inter selection:bg-blue-500/30 relative">
      <SEO
        title="Find Broken Backlinks to Your Site - Free WordPress Plugin | LinkAuthority"
        description="Renamed a page? The backlinks pointing at it now hit a 404 and nothing tells you. LinkAuthority finds broken backlinks to your WordPress site, fixes them with one click, and keeps old URLs working when you rename a page. Free plugin."
        canonical="https://www.linkauthority.live/"
        faq={[
          {
            q: 'How do I find backlinks pointing at a 404 on my site?',
            a: 'Install the free LinkAuthority plugin. When anyone follows a link from another site to a page of yours that no longer exists, the plugin records the linking page and the dead address, and LinkAuthority verifies both ends by fetching them. Broken links appear on the Link Repair screen with a field to point the old address at the page that replaced it.'
          },
          {
            q: 'Does changing a WordPress slug break my backlinks?',
            a: 'Yes. WordPress does not create a redirect when you change a post slug, so every external link to the old address starts returning 404 and nothing warns you. LinkAuthority watches the URLs other sites link to and creates the 301 automatically when you rename one of those pages.'
          },
          {
            q: 'Is LinkAuthority free?',
            a: 'Yes. Link repair, the WordPress plugin, the partner network and unlimited websites are free while the network grows. There is no card required and no trial that expires.'
          },
          {
            q: 'How is this different from Ahrefs or Semrush?',
            a: 'Those tools have a large backlink index and no code on your site. LinkAuthority runs inside WordPress, so it sees a broken backlink the moment a visitor follows one, and can fix it with a redirect in the same screen. It reports only links it has verified by fetching both pages, so it is not a substitute for a full backlink index.'
          },
          {
            q: 'What data does the plugin send?',
            a: 'Two URLs: the page a visitor came from, and the address on your site they asked for. No IP address, user agent or session is collected, so none can be sent. Link repair can be switched off in the plugin settings.'
          }
        ]}
      />
      <ChatWidget />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="LinkAuthority Logo" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              LinkAuthority
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#link-repair" className="hover:text-white transition-colors">Link Repair</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            {PRICING_ENABLED && <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>}
          </div>

          <button onClick={onLogin} className="bg-white text-slate-900 px-4 py-2 md:px-6 md:py-2.5 rounded-full font-bold text-xs md:text-sm hover:bg-slate-200 transition-all transform hover:scale-105 shadow-xl shadow-white/5 whitespace-nowrap flex items-center gap-2">
            <span>Log In</span>
            <span className="hidden md:inline">/ Sign Up</span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5 z-0"></div>
        <ParticleNetwork />

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Zap size={12} />
            Free WordPress plugin &mdash; no card, no trial
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-8 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            You Spent Years Earning Links.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">One Slug Change Killed Them.</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            Rename a page in WordPress and every backlink to the old address starts returning 404. The links still
            exist. They just stop counting &mdash; and nothing tells you. LinkAuthority catches it the first time
            somebody follows one, and fixes it in a click.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <a
              href="/api/wp/plugin"
              className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-3"
            >
              <Download size={20} />
              Download the free plugin
            </a>
            <button onClick={onLogin} className="w-full md:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3">
              <img src="https://www.google.com/favicon.ico" alt="" className="w-5 h-5 bg-white rounded-full p-0.5" />
              Create a free account
            </button>
          </div>

          <p className="mt-6 text-slate-500 text-sm animate-in fade-in duration-700 delay-500">
            Works with any WordPress site &middot; Install, paste your token, done
          </p>

          <div className="mt-16 flex flex-wrap justify-center gap-4 text-sm">
            {[
              'Finds links pointing at your 404s',
              'Keeps old URLs alive when you rename a page',
              'Reads every link\'s rel attribute, never guesses',
              'Free dofollow links from the member network'
            ].map(claim => (
              <span key={claim} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                <Check size={14} className="text-emerald-400 shrink-0" />
                {claim}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Live Stats Ticker */}
      <div className="bg-slate-900 border-y border-slate-800 py-4 overflow-hidden whitespace-nowrap">
        <div className="inline-flex gap-16 animate-infinite-scroll">
            {[...Array(2)].map((_, i) => (
                <div key={i} className="flex gap-16 items-center text-slate-400 font-mono text-sm">
                    {stats && (
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> {stats.activeWebsites.toLocaleString()} Active Websites in the Network</span>
                    )}
                    {stats && stats.linksPerMember > 0 && (
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> {stats.linksPerMember.toLocaleString()} Dofollow Links to Every New Member</span>
                    )}
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Free While We Grow</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Listed on Every Member Site Automatically</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> Every Link Verified Daily</span>
                </div>
            ))}
        </div>
      </div>

      {/* Link Repair: the problem, then the three things that solve it */}
      <section id="link-repair" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-blue-400 text-sm uppercase tracking-wider font-bold mb-4">Link Repair</p>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">The backlinks you are losing right now</h2>
            <p className="text-slate-400 max-w-3xl mx-auto text-lg">
              WordPress does not create a redirect when you change a slug, trash a post, or drop a path in a
              migration. Every link anyone ever built to those addresses quietly stops working. Google takes months
              to reflect it, and by then nobody connects the traffic drop to an edit made in March.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <FeatureCard
              icon={Search}
              title="Caught in the act"
              description="The plugin runs inside WordPress, so when a visitor follows a link from another site to a page that is gone, it sees the linking page and the dead address at that exact moment. No crawl schedule, no waiting for an index to refresh."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Verified, never estimated"
              description="Every link is confirmed by fetching both ends: their page, to check the link is still on it and read its rel attribute, and yours, to record the status code it actually returns. A link the other site removed is reported as removed, not sold to you as work."
            />
            <FeatureCard
              icon={Wrench}
              title="Fixed in one click"
              description="Each broken link gets one field: the page that replaced the old one. The plugin writes the 301 and the link starts counting again. Rename a page that other sites link to and it writes the redirect before the save can cost you anything."
            />
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 md:p-12 text-center">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">Install it and find out in ten minutes</h3>
            <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
              Install the plugin, create a free account, and paste your site token. The first report tells you which
              sites are linking to you and whether any of those links are landing on nothing.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <a
                href="/api/wp/plugin"
                className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-3"
              >
                <Download size={20} />
                Download the plugin
              </a>
              <button onClick={onLogin} className="w-full md:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-lg transition-all">
                Create a free account
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SEO Content & Features Grid */}
      <section id="features" className="py-24 bg-slate-900/50 border-t border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/5 rounded-full blur-3xl -z-10"></div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">What else is in it</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Everything below is built and working today. Nothing here is a roadmap item, and no figure on this page
              is estimated &mdash; if we have not measured something, we say so instead of printing a number.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Users}
              title="A free link network"
              description="Activate a site and it is listed on the Business Partners page of every other active member, with a dofollow link back. No credits, no requests, no outreach. Free while the network grows."
            />
            <FeatureCard
              icon={Target}
              title="Your page, your call"
              description="Browse every member by niche and decide who appears on your own page: hide one, or list only businesses in your category. Hiding is one-directional - you stay listed on theirs."
            />
            <FeatureCard
              icon={BarChart}
              title="Backlink value, explained"
              description="Each link is labelled strong, useful, modest or citation, with the reason: whether it is dofollow, the measured authority of the domain sending it, and whether that domain is in your line of business."
            />
            <FeatureCard
              icon={MapPin}
              title="Local citations"
              description="A checked list of directories worth a profile for your business, your address block formatted to match each one, and a bookmarklet that fills the form in. It never submits anything for you."
            />
            <FeatureCard
              icon={Lock}
              title="Checked daily"
              description="Every member is checked for a live Business Partners page. A site that stops hosting the directory is paused across the network until it is restored, so the links you receive come from members who are genuinely taking part."
            />
            <FeatureCard
              icon={Plug}
              title="Publisher and social"
              description="A second plugin writes posts with AI and shares them to your own LinkedIn, Pinterest, Facebook and Instagram accounts. You connect your accounts once, on linkauthority.live."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section - hidden while the network is free. See config.ts. */}
      {PRICING_ENABLED ? (
        <PricingSection />
      ) : (
        <section id="pricing" className="py-24 bg-slate-950 border-t border-slate-800">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider mb-8">
              <Zap size={12} />
              Free while we grow
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
              Everything is free. No plans, no credit card.
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed mb-10">
              LinkAuthority is free for every member while we build the network out. Unlimited websites,
              unlimited partner links, the WordPress plugin, and full support &mdash; all of it, at no cost.
              The more sites that join, the more links each member earns, so there is nothing to pay for yet.
            </p>
            <button
              onClick={onLogin}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-600/30"
            >
              Create Your Free Account
            </button>
          </div>
        </section>
      )}

      {/* Comparison Section */}
      <section className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-white mb-6">Stop Wasting Money on Agencies</h2>
                <p className="text-slate-400">See how LinkAuthority compares to traditional link building methods.</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="p-6 bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 w-1/3">Feature</th>
                            <th className="p-6 bg-blue-900/20 text-blue-400 font-bold border-b border-blue-500/30 w-1/3">LinkAuthority</th>
                            <th className="p-6 bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 w-1/3">Typical Agency</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        <tr>
                            <td className="p-6 text-slate-300 font-medium">Cost Per Link</td>
                            <td className="p-6 text-white font-bold bg-blue-900/10">Free</td>
                            <td className="p-6 text-slate-400">$300 - $500+</td>
                        </tr>
                        <tr>
                            <td className="p-6 text-slate-300 font-medium">Time to Live</td>
                            <td className="p-6 text-white font-bold bg-blue-900/10">24-48 Hours</td>
                            <td className="p-6 text-slate-400">4-6 Weeks</td>
                        </tr>
                        <tr>
                            <td className="p-6 text-slate-300 font-medium">Transparency</td>
                            <td className="p-6 text-white font-bold bg-blue-900/10">100% Visibility</td>
                            <td className="p-6 text-slate-400">Black Box</td>
                        </tr>
                        <tr>
                            <td className="p-6 text-slate-300 font-medium">Control</td>
                            <td className="p-6 text-white font-bold bg-blue-900/10">You Choose Anchors</td>
                            <td className="p-6 text-slate-400">They Choose</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-slate-900/50 border-t border-slate-800">
        <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-white mb-12 text-center">Frequently Asked Questions</h2>
            <div className="space-y-6">
                <FAQItem
                    question="How do I find backlinks that point at a 404 on my site?"
                    answer="Install the free plugin. The moment anyone follows a link from another site to a page of yours that no longer exists, the plugin records the linking page and the dead address, and LinkAuthority confirms it by fetching both. You get the list, with one field each to point the old address at the page that replaced it."
                />
                <FAQItem
                    question="Does changing a slug in WordPress break my backlinks?"
                    answer="Yes. WordPress does not create a redirect when you change a post slug, so every external link to the old address starts returning 404, and nothing warns you. With the plugin installed, renaming a page that other sites link to writes the 301 automatically and tells you how many links it just saved."
                />
                <FAQItem
                    question="How is this different from Ahrefs or Semrush?"
                    answer="They have a large backlink index and no code on your site. This runs inside WordPress, so it sees a broken link the moment somebody follows one and can fix it in the same screen. It only reports links it has verified by fetching both pages, so it is not a replacement for a full backlink index - it is the half those tools cannot reach."
                />
                <FAQItem
                    question="What does the plugin send about my visitors?"
                    answer="Nothing about your visitors. It sends two URLs: the page someone arrived from, and the address on your site they asked for. No IP address, user agent or session is collected in the first place. Link repair can be switched off in the plugin settings."
                />
                <FAQItem
                    question="Is the link network safe for my SEO?"
                    answer="Judge it on what it is: a directory of real, active businesses on a page of your own site, editorially presented, with no money changing hands. We check daily that members are genuinely hosting their page. It is one part of a link profile, not a substitute for earning links, and we do not claim it is risk-free - excessive reciprocal linking is something Google's guidelines name directly."
                />
                <FAQItem
                    question="What does it cost?"
                    answer="Nothing. LinkAuthority is completely free while we grow the network - unlimited websites, unlimited partner links, the WordPress plugin and support included. All you contribute is a Business Partners page on your own site."
                />
                <FAQItem
                    question="Can I buy links without having a website?"
                    answer="Every active member is listed on every other active member's site automatically, so there is nothing to buy. Add a site, activate it, and the links appear."
                />
                <FAQItem
                    question="Are the links permanent?"
                    answer="Yes. We check every member site daily. If a site stops hosting its Business Partners page, its own listing is paused across the network until the page is restored - so the links you receive are backed by members who are genuinely participating."
                />
            </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-slate-950 border-t border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center gap-16">
                <div className="flex-1">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 leading-tight">
                        Ranking #1 Has Never Been Easier
                    </h2>
                    <div className="space-y-8">
                        <Step
                            number="1"
                            title="Connect Your Site"
                            description="Add your website to the platform. Our AI verifies ownership and estimates your Domain Authority."
                        />
                        <Step
                            number="2"
                            title="Activate Your Site"
                            description="Install the WordPress plugin or paste the snippet. The moment your site connects, you are listed on every other member's Business Partners page."
                        />
                        <Step
                            number="3"
                            title="Get Authority Backlinks"
                            description="Browse our marketplace and request dofollow links from authoritative sites in your exact niche."
                        />
                    </div>
                </div>
                <div className="flex-1 relative">
                    <div className="absolute inset-0 bg-blue-600/20 blur-3xl rounded-full"></div>
                    <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                        <div className="flex items-center gap-4 mb-6 border-b border-slate-800 pb-4">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <div className="ml-auto text-xs text-slate-500">dashboard.tsx</div>
                        </div>
                        <div className="space-y-4">
                            <div className="h-32 bg-slate-800/50 rounded-xl w-full"></div>
                            <div className="flex gap-4">
                                <div className="h-24 bg-blue-900/20 rounded-xl flex-1 border border-blue-500/30"></div>
                                <div className="h-24 bg-green-900/20 rounded-xl flex-1 border border-green-500/30"></div>
                            </div>
                            <div className="h-40 bg-slate-800/50 rounded-xl w-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* SEO Keywords Hidden Section (Visible to bots, styled for humans if they look) */}
      <section id="seo-tools" className="py-24 bg-slate-900 border-t border-slate-800">
          <div className="max-w-4xl mx-auto px-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-8">Trusted by Professionals for High Quality Link Building</h2>
              <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500">
                  <span>Backlink Management Software</span> &bull;
                  <span>White Hat Link Building</span> &bull;
                  <span>Guest Posting Marketplace</span> &bull;
                  <span>Domain Authority Checker</span> &bull;
                  <span>SEO Audit Tools</span> &bull;
                  <span>Link Exchange Network</span> &bull;
                  <span>Get Dofollow Backlinks</span> &bull;
                  <span>Local SEO Citations</span> &bull;
                  <span>Automated Link Building</span>
              </div>
          </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                <div className="md:col-span-2 space-y-6">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="LinkAuthority Logo" className="w-10 h-10 object-contain" />
                        <span className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        LinkAuthority
                        </span>
                    </div>
                    <p className="text-slate-400 leading-relaxed max-w-sm">
                        LinkAuthority: The AI-powered backlink exchange for SEO specialists. Automate your link building, verify domain ownership, and rank faster with high-DA niche-relevant links.
                    </p>
                    <div className="flex gap-4">
                        <SocialIcon href="https://www.facebook.com/linkauthority2026/" icon={Facebook} label="Facebook" />
                        <SocialIcon href="https://www.instagram.com/linkauthority/" icon={Instagram} label="Instagram" />
                        <SocialIcon href="https://www.linkedin.com/company/link-authority2026" icon={Linkedin} label="LinkedIn" />
                        <SocialIcon href="https://x.com/authority2026" icon={Twitter} label="X (Twitter)" />
                        <SocialIcon href="https://www.youtube.com/@LinkAuthority" icon={Youtube} label="YouTube" />
                    </div>
                </div>

                <div>
                    <h4 className="text-white font-bold mb-6">Contact Us</h4>
                    <div className="space-y-4">
                        <a href="mailto:info@linkauthority.live" className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group">
                           <Mail size={18} className="group-hover:text-blue-400 transition-colors" />
                           info@linkauthority.live
                        </a>
                         <a href="mailto:linkauthority2026@gmail.com" className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group">
                           <Mail size={18} className="group-hover:text-blue-400 transition-colors" />
                           linkauthority2026@gmail.com
                        </a>
                        <div className="flex items-center gap-3 text-slate-400">
                           <Globe size={18} />
                           Worldwide Service Area
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="text-white font-bold mb-6">Legal</h4>
                    <div className="space-y-3">
                        <a href="/terms-of-service" className="block text-slate-400 hover:text-white transition-colors">Terms of Service</a>
                        <a href="/privacy-policy" className="block text-slate-400 hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="block text-slate-400 hover:text-white transition-colors">Cookie Policy</a>
                        <a href="#" className="block text-slate-400 hover:text-white transition-colors">Sitemap</a>
                    </div>
                </div>
            </div>

            <div className="pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
                <p>&copy; {new Date().getFullYear()} LinkAuthority. All rights reserved.</p>
            </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <div className="p-8 rounded-3xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/10 group">
    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform duration-300">
      <Icon size={28} />
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-slate-400 leading-relaxed font-light">{description}</p>
  </div>
);

const Step = ({ number, title, description }: { number: string, title: string, description: string }) => (
    <div className="flex gap-6">
        <div className="flex-shrink-0 w-12 h-12 rounded-full border border-blue-500/30 text-blue-400 font-bold text-lg flex items-center justify-center bg-blue-500/5">
            {number}
        </div>
        <div>
            <h4 className="text-xl font-bold text-white mb-2">{title}</h4>
            <p className="text-slate-400 leading-relaxed max-w-md">{description}</p>
        </div>
    </div>
);

const FAQItem = ({ question, answer }: { question: string, answer: string }) => (
    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 hover:border-blue-500/20 transition-all">
        <h3 className="text-lg font-bold text-white mb-2">{question}</h3>
        <p className="text-slate-400 leading-relaxed text-sm">{answer}</p>
    </div>
);

const SocialIcon = ({ href, icon: Icon, label }: { href: string, icon: any, label: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="p-3 bg-slate-900 rounded-xl hover:bg-blue-600 hover:text-white text-slate-400 transition-all hover:-translate-y-1 block"
      aria-label={label}
    >
      <Icon size={20} />
    </a>
);

export default LandingPage;
