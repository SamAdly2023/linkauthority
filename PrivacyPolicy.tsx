import React from 'react';
import SEO from './SEO';

interface PrivacyPolicyProps {
  onBack: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="p-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SEO 
        title="Privacy Policy - LinkAuthority" 
        description="Our Privacy Policy explains how LinkAuthority collects and uses your data. Your privacy is our priority."
        canonical="https://linkauthority.live/privacy-policy"
      />
      
      <div className="bg-slate-900/50 rounded-3xl shadow-sm border border-slate-800 p-8">
        <h1 className="text-3xl font-bold text-white mb-6">Privacy Policy</h1>
        <div className="prose prose-invert max-w-none text-slate-300 space-y-4">
          <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
          
          <section>
             <h2 className="text-xl font-bold text-white mt-8 mb-4">1. Introduction</h2>
             <p>Welcome to LinkAuthority. We are committed to protecting your personal information and your right to privacy. This policy explains how we handle your data when you use our SEO marketplace and automation tools.</p>
          </section>

          <section>
             <h2 className="text-xl font-bold text-white mt-8 mb-4">2. Information We Collect</h2>
             <ul className="list-disc pl-5 space-y-2">
                <li><strong>Personal Data:</strong> Name, email address, and phone number provided during registration.</li>
                <li><strong>Website Data:</strong> URLs, content descriptions ("Short Bios"), and analytics (Domain Authority) of sites you add.</li>
                <li><strong>Technical Data:</strong> IP address, browser type, and device information for security and functionality.</li>
             </ul>
          </section>
          
           <section>
             <h2 className="text-xl font-bold text-white mt-8 mb-4">3. How We Use Your Data</h2>
             <p>We use your data to:</p>
             <ul className="list-disc pl-5 space-y-2">
                <li>Facilitate the exchange of backlinks between users.</li>
                <li>Verify website ownership via Files, DNS, or our <strong>Instant Widget</strong> script.</li>
                <li>Send transactional notifications (e.g., "Link Purchased", "Verification Successful").</li>
                <li>Sync contact details with our CRM (GoHighLevel) to improve customer support and communication.</li>
             </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mt-8 mb-4">4. The "Instant Widget" & Data</h2>
            <p>If you choose to install our optional <strong>Instant Backlink Widget</strong>:</p>
            <ul className="list-disc pl-5 space-y-2">
                <li>The widget script allows our servers to display specific links on your website dynamically.</li>
                <li>We do <strong>not</strong> track your website's visitors. The widget only fetches link data from our API to be displayed.</li>
                <li>We do not inject ads or content other than the backlinks you have agreed to host in exchange for points.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mt-8 mb-4">5. Data Sharing</h2>
            <p>We do not sell your personal data. We may share data with:</p>
             <ul className="list-disc pl-5 space-y-2">
                <li><strong>Service Providers:</strong> Hosting (Render), Database (MongoDB), and CRM (GoHighLevel) services necessary to run the app.</li>
                <li><strong>Other Users:</strong> Your website URL and Description are visible in the Marketplace to allow others to buy links. Your email/phone is kept private unless explicitly shared.</li>
             </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mt-8 mb-4">6. Security</h2>
            <p>We use industry-standard encryption (SSL/TLS) and secure database practices. However, no internet transmission is 100% secure.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mt-8 mb-4">7. Contact Us</h2>
            <p>If you have questions about this policy, please contact us at <a href="mailto:support@linkauthority.live" className="text-blue-400 hover:text-blue-300">support@linkauthority.live</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
