import React from 'react';
import { 
  ShieldCheck, 
  BarChart, 
  Globe, 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  Search, 
  Users, 
  Lock, 
  ChevronDown, 
  Rocket, 
  Target, 
  Award,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  MessageCircle,
  Mail
} from 'lucide-react';
import ParticleNetwork from './ParticleNetwork';
import Testimonials from './Testimonials';
import PricingSection from './PricingSection';
import ChatWidget from './ChatWidget';
import SEO from './SEO';

const LandingPage: React.FC = () => {
  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 font-inter selection:bg-blue-500/30 relative">
      <SEO 
        title="LinkAuthority - Free Backlink Exchange Platform | Boost SEO" 
        description="Join LinkAuthority to exchange high-quality backlinks, increase your Domain Authority (DA), and rank higher on Google safely. The #1 community for SEO growth."
        canonical="https://www.linkauthority.live/"
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
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Testimonials</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>

          <a href="/auth/google" className="bg-white text-slate-900 px-4 py-2 md:px-6 md:py-2.5 rounded-full font-bold text-xs md:text-sm hover:bg-slate-200 transition-all transform hover:scale-105 shadow-xl shadow-white/5 whitespace-nowrap flex items-center gap-2">
            <span>Log In</span>
            <span className="hidden md:inline">/ Sign Up</span>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5 z-0"></div>
        <ParticleNetwork />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Zap size={12} />
            The #1 Marketplace for High-Quality Backlinks
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-8 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Build High <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Authority Links</span><br />
            Rank #1 on Google
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
             Stop playing the guessing game. Connect with real website owners, exchange authority points, and boost your Domain Authority (DA) with our intelligent backlink marketplace.
          </p>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <a href="/auth/google" className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-3">
              <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5 bg-white rounded-full p-0.5" />
              Start For Free
            </a>
            <a href="#how-it-works" className="w-full md:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 group">
              How it works
              <ChevronDown className="group-hover:translate-y-1 transition-transform" size={20} />
            </a>
          </div>

          <div className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16 text-slate-500 grayscale opacity-60">
             <div className="flex items-center gap-2">
                <Target size={24} />
                <span className="font-bold text-lg">SEMRush</span>
             </div>
             <div className="flex items-center gap-2">
                <Award size={24} />
                <span className="font-bold text-lg">Ahrefs</span>
             </div>
             <div className="flex items-center gap-2">
                <Rocket size={24} />
                <span className="font-bold text-lg">Moz</span>
             </div>
             <div className="flex items-center gap-2">
                <Globe size={24} />
                <span className="font-bold text-lg">Google</span>
             </div>
          </div>
        </div>
      </header>
      
      {/* Live Stats Ticker */}
      <div className="bg-slate-900 border-y border-slate-800 py-4 overflow-hidden whitespace-nowrap">
        <div className="inline-flex gap-16 animate-infinite-scroll">
            {[...Array(2)].map((_, i) => (
                <div key={i} className="flex gap-16 items-center text-slate-400 font-mono text-sm">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> 423 Links Exchanged Today</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 1,204 New Websites Added</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500"></span> $45 Average Link Value</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 98% Customer Satisfaction</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> 24/7 AI Monitoring Active</span>
                </div>
            ))}
        </div>
      </div>

      {/* SEO Content & Features Grid */}
      <section id="features" className="py-24 bg-slate-900/50 border-t border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/5 rounded-full blur-3xl -z-10"></div>
        
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Why LinkAuthority?</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              We streamline the entire off-page SEO process. No cold emails, no sketchy PBNs, just real verified websites exchanging value.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Globe}
              title="Global Link Marketplace"
              description="Access a calibrated network of 10,000+ verified websites across every niche from Technology to Local Plumbing."
            />
            <FeatureCard 
              icon={ShieldCheck}
              title="No Spam, Just Authority"
              description="Our AI continuously monitors Spam Score and Domain Authority. Toxic links are automatically flagged and blocked."
            />
            <FeatureCard 
              icon={BarChart}
              title="AI SEO Analysis"
              description="Get instant, deep-dive SEO reports for any website. Identify technical errors and keyword opportunities in seconds."
            />
            <FeatureCard 
              icon={Users}
              title="Community Driven"
              description="Earn points by hosting links, spend points to get links. A fair, circular economy for sustainable growth."
            />
            <FeatureCard 
              icon={Search}
              title="Competitor Intelligence"
              description="See where your competitors are getting their backlinks and replicate their strategy with our gap analysis tools."
            />
            <FeatureCard 
              icon={Lock}
              title="Secure Transactions"
              description="Links are verified automatically. Points are held in escrow until the backlink is confirmed live and dofollow."
            />
            <FeatureCard 
              icon={Award}
              title="White Label Reporting"
              description="Generate professional PDF reports with your branding to show clients exactly what links you've built."
            />
            <FeatureCard 
              icon={Target}
              title="Niche Filtering"
              description="Drill down by specific vertical, language, and estimated traffic to find the perfect link partner."
            />
            <FeatureCard 
              icon={Zap}
              title="Instant Indexing"
              description="Our premium indexer ensures Google sees your new backlinks within hours, not weeks."
            />
          </div>
        </div>
      </section>

      {/* Testimonials Slider */}
      <div id="testimonials">
        <Testimonials />
      </div>

      {/* Pricing Section */}
      <PricingSection />

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
                            <td className="p-6 text-white font-bold bg-blue-900/10">$0 (with Points)</td>
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
                    question="Is this safe for my SEO? Will Google penalize me?"
                    answer="Yes, it is safe. We focus on high-quality, relevant content exchanges between real websites. We strictly prohibit spam farms, PBNs, and gambling/casino sites. Our AI monitors link patterns to ensure natural growth."
                />
                <FAQItem 
                    question="How do I earn points?"
                    answer="You earn points by accepting guest posts or link insertions on your own website. The amount of points you earn depends on your website's Domain Authority (DA). Higher DA = More Points."
                />
                <FAQItem 
                    question="Can I buy links without having a website?"
                    answer="Yes! You can purchase points directly via PayPal and use them to acquire backlinks for your clients or new projects without needing to host links yourself."
                />
                <FAQItem 
                    question="Are the links permanent?"
                    answer="Yes. Our terms of service require links to remain active for at least 12 months. We continually monitor all links. If a link is removed, the seller is penalized and points are refunded."
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
                            description="Add your website to our platform. Our AI verifies ownership and calculates your initial Domain Authority points."
                        />
                        <Step 
                            number="2"
                            title="Earn or Buy Points"
                            description="Host high-quality content on your site to earn points, or simply purchase points to fast-track your campaign."
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
