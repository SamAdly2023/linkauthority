import React from 'react';
import SEO from './SEO';

const AboutUs: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SEO 
                title="About Us - LinkAuthority" 
                description="Learn about LinkAuthority, the premier automated backlink exchange marketplace for SEO professionals."
                canonical="https://linkauthority.live/about-us"
            />
            
            <div className="bg-slate-900/50 rounded-3xl p-8 border border-slate-800">
                <h1 className="text-4xl font-bold text-white mb-6">About LinkAuthority</h1>
                
                <div className="prose prose-invert max-w-none text-slate-300 space-y-6">
                    <p className="text-lg text-blue-200">
                        LinkAuthority is the world's first fully automated, credit-based backlink marketplace designed to democratize high-authority SEO.
                    </p>
                    
                    <h2 className="text-2xl font-bold text-white">Our Mission</h2>
                    <p>
                        We believe that building authority shouldn't be reserved for big agencies with massive budgets. Our mission is to create a transparent, safe, and efficient ecosystem where website owners can grow together.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
                        <div className="bg-slate-800 p-6 rounded-xl">
                            <h3 className="font-bold text-white mb-2">Automated Verification</h3>
                            <p className="text-sm">Our "Instant Widget" technology verifies ownership and places links in milliseconds, removing the need for manual negotiation.</p>
                        </div>
                        <div className="bg-slate-800 p-6 rounded-xl">
                            <h3 className="font-bold text-white mb-2">Fair Exchange</h3>
                            <p className="text-sm">Our Point System ensures you give as much value as you take, creating a sustainable SEO economy.</p>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white">Who We Are</h2>
                     <p>
                        Founded by SEO veterans and software engineers, LinkAuthority addresses the biggest pain point in the industry: <strong>Link Building is hard, expensive, and risky.</strong>
                    </p>
                    <p>
                        We solved this by building a community-driven platform where quality and relevance come first.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AboutUs;
