import React from 'react';
import { ArrowLeft } from 'lucide-react';
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
        canonical="https://linkauthority.live/terms-of-service"
      />
      <button 
        onClick={onBack}
        className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </button>
      
      <div className="bg-slate-900/50 rounded-3xl shadow-sm border border-slate-800 p-8">
        <h1 className="text-3xl font-bold text-white mb-6">Terms of Service</h1>
        <div className="prose prose-invert max-w-none text-slate-300 space-y-4">
          <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using LinkAuthority ("the Service"), you accept and agree to be bound by the terms and provision of this agreement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              LinkAuthority provides a platform for website owners to exchange guest posts and improve their SEO through a credit-based system.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. User Conduct</h2>
            <p>
              You agree to use the Service only for lawful purposes. You are prohibited from posting or transmitting any unlawful, threatening, libelous, defamatory, obscene, scandalous, inflammatory, pornographic, or profane material.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Quality Standards</h2>
            <p>
              All websites submitted to the platform must meet our quality guidelines. We reserve the right to reject or remove any website that does not meet our standards for content quality, domain authority, or traffic.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Points and Credits</h2>
            <p>
              Points earned on LinkAuthority have no monetary value outside of the platform and cannot be exchanged for cash. Points are used solely for obtaining guest posts on other member sites.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Termination</h2>
            <p>
              We reserve the right to terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Changes to Terms</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. What constitutes a material change will be determined at our sole discretion.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
