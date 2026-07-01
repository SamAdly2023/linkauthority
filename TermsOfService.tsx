import React from 'react';
import SEO from './SEO';

interface TermsOfServiceProps {
  onBack: () => void;
}

const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
  return (
    <div className="p-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SEO 
        title="Terms of Service - LinkAuthority" 
        description="Read the Terms of Service for LinkAuthority. Guidelines and rules for using our backlink exchange platform."
        canonical="https://www.linkauthority.live/terms-of-service"
      />
      
      <div className="bg-slate-900/50 rounded-3xl shadow-sm border border-slate-800 p-8">
        <h1 className="text-3xl font-bold text-white mb-6">Terms of Service</h1>
        <div className="prose prose-invert max-w-none text-slate-300 space-y-4">
          <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
          
          <section>
            <h2 className="text-xl font-bold text-white mt-8 mb-4">1. Acceptance of Terms</h2>
            <p>By accessing and using LinkAuthority, you accept and agree to be bound by the terms and provision of this agreement.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mt-8 mb-4">2. The Point System</h2>
            <p>LinkAuthority operates on a credit-based system called "Points".</p>
            <ul className="list-disc pl-5 space-y-2">
                <li>Points are earned by hosting other users' backlinks on your websites.</li>
                <li>Points are spent to place your own backlinks on other users' websites.</li>
                <li>Points have no cash redemption value and are solely for use within the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mt-8 mb-4">3. Website Quality & Content</h2>
            <p>You agree to only submit websites that you own or control. We prohibit:</p>
            <ul className="list-disc pl-5 space-y-2">
                <li>Adult, gambling, hate speech, or illegal content.</li>
                <li>Sites with malicious code, excessive ads, or "link farms".</li>
                <li>Fake validation or manipulation of Domain Authority metrics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mt-8 mb-4">4. Instant Widget Usage</h2>
            <p>If you use the "Instant Link Widget":</p>
             <ul className="list-disc pl-5 space-y-2">
                <li>You grant LinkAuthority permission to dynamically display links on portions of your website where the widget is installed.</li>
                <li>Links served by the widget will be Dofollow, as agreed in the exchange.</li>
                <li>Tampering with the widget code to hide links while collecting points constitutes fraud and will result in account bans.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mt-8 mb-4">5. Backlink Permanence</h2>
            <p>When you accept points for a link, you agree to keep the link active for as long as your account is active. Removing paid links ("Churning") will result in point deductions or account termination.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mt-8 mb-4">6. Disclaimer of Warranties</h2>
            <p>The service is provided "as is". We do not guarantee specific SEO rankings, as search engine algorithms are third-party systems outside our control.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mt-8 mb-4">7. Termination</h2>
            <p>We reserve the right to terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
