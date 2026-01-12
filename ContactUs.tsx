import React from 'react';
import SEO from './SEO';

const ContactUs: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto p-6 h-[800px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SEO 
                title="Contact Us - LinkAuthority" 
                description="Get in touch with the LinkAuthority team for support, partnership inquiries, or feedback."
                canonical="https://linkauthority.live/contact-us"
            />
            
            <div className="bg-slate-900/50 rounded-3xl p-4 border border-slate-800 h-full flex flex-col">
                <h1 className="text-3xl font-bold text-white mb-6 px-4 pt-4">Contact Us</h1>
                <div className="flex-1 rounded-xl overflow-hidden bg-white">
                    <iframe
                        src="https://api.xolby.com/widget/form/0QzEd6AkQw8etNDcqE3d"
                        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '0px' }}
                        id="inline-0QzEd6AkQw8etNDcqE3d" 
                        data-layout="{'id':'INLINE'}"
                        data-trigger-type="alwaysShow"
                        data-trigger-value=""
                        data-activation-type="alwaysActivated"
                        data-activation-value=""
                        data-deactivation-type="neverDeactivate"
                        data-deactivation-value=""
                        data-form-name="Wedding Photographer Service Request"
                        data-height="630"
                        data-layout-iframe-id="inline-0QzEd6AkQw8etNDcqE3d"
                        data-form-id="0QzEd6AkQw8etNDcqE3d"
                        title="Contact Form"
                    >
                    </iframe>
                    <script src="https://api.xolby.com/js/form_embed.js"></script>
                </div>
            </div>
        </div>
    );
};

export default ContactUs;
