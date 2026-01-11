import React, { useState } from 'react';
import { MessageCircle, X, ExternalLink, Zap } from 'lucide-react';

const ChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    // Facebook Page Plugin configuration
    // using the page URL associated with the m.me link usually works for the plugin
    const pageUrl = "https://www.facebook.com/linkauthority2026"; 
    
    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 font-sans">
            {/* Chat Window */}
            <div 
                className={`
                    origin-bottom-right transition-all duration-300 ease-in-out
                    ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-10 pointer-events-none'}
                    bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden w-[340px] h-[500px] flex flex-col
                `}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="w-2 h-2 absolute bottom-0 right-0 bg-green-400 rounded-full border border-blue-600"></div>
                            <MessageCircle className="text-white" size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">LinkAuthority Support</h3>
                            <p className="text-blue-100 text-[10px]">Typically replies instantly</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 bg-slate-950 relative">
                     {/* Loading State / Background */}
                     <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                        <div className="animate-pulse flex flex-col items-center gap-2">
                             <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin"></div>
                             <span className="text-xs">Connecting to secure server...</span>
                        </div>
                     </div>

                    {/* Facebook Page Plugin Iframe */}
                    <iframe 
                        src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(pageUrl)}&tabs=messages&width=340&height=500&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`}
                        width="340" 
                        height="500" 
                        style={{ border: 'none', overflow: 'hidden', position: 'relative', zIndex: 10 }} 
                        scrolling="no" 
                        frameBorder="0" 
                        allowFullScreen={true} 
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        className="w-full h-full bg-white"
                    ></iframe>
                </div>
                
                {/* Footer Fallback */}
                <div className="bg-slate-900 p-3 border-t border-slate-800 shrink-0">
                    <a 
                        href="https://m.me/linkauthority2026" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors font-medium group"
                    >
                        <span>Open full chat experience</span>
                        <ExternalLink size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </a>
                </div>
            </div>

            {/* Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="group relative flex items-center justify-center"
            >
                {/* High Tech Glow Effect */}
                <div className={`absolute inset-0 bg-blue-500 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-500 ${isOpen ? 'animate-pulse' : ''}`}></div>
                
                <div className={`
                    relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg border border-white/10
                    transition-all duration-300 transform group-hover:scale-105 active:scale-95
                    ${isOpen ? 'bg-slate-800 rotate-90' : 'bg-gradient-to-br from-blue-600 to-indigo-600'}
                `}>
                     {isOpen ? (
                        <X size={24} className="text-white" />
                     ) : (
                        <>
                            <MessageCircle size={28} className="text-white fill-white/20" />
                            {/* Detailed Tech Bits */}
                            <Zap size={10} className="absolute top-3 right-3 text-blue-300 animate-pulse" />
                            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900"></span>
                        </>
                     )}
                </div>
                
                {/* Tooltip */}
                {!isOpen && (
                    <span className="absolute right-full mr-4 bg-white text-slate-900 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl pointer-events-none translate-x-2 group-hover:translate-x-0">
                        Chat Support
                        <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-4 border-transparent border-l-white"></div>
                    </span>
                )}
            </button>
        </div>
    );
};

export default ChatWidget;
