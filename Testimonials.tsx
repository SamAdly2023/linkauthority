import React, { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const testimonials = [
  {
    name: "Sarah Jenkins",
    role: "SEO Director, TechFlow",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
    content: "LinkAuthority completely transformed our link building strategy. Instead of cold emailing for weeks, we now secure relevant, high-DA links in minutes.",
    rating: 5
  },
  {
    name: "Michael Chen",
    role: "Founder, Growthify",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80",
    content: "The credit system is genius. I used the points from my niche blog to get a massive backlink from a DA 80+ news site. My traffic doubled in 3 months.",
    rating: 5
  },
  {
    name: "Elena Rodriguez",
    role: "Marketing Head, LocalBoost",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&h=150&q=80",
    content: "As a local SEO agency, finding geographically relevant links was a nightmare. This platform's location filter is a game changer for our clients.",
    rating: 5
  }
];

const Testimonials: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const next = () => {
    setIsAutoPlaying(false);
    setCurrent((prev) => (prev + 1) % testimonials.length);
  };

  const prev = () => {
    setIsAutoPlaying(false);
    setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section className="py-24 bg-slate-900 border-t border-slate-800 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -z-10 -translate-x-1/2 translate-y-1/2"></div>

        <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Trusted by 10,000+ SEOs</h2>
                <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                    See why agencies, freelancers, and business owners are switching to the smart way of building authority.
                </p>
            </div>

            <div className="relative max-w-4xl mx-auto">
                <div className="overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 relative shadow-2xl shadow-black/50">
                    <div 
                        className="flex transition-transform duration-500 ease-in-out" 
                        style={{ transform: `translateX(-${current * 100}%)` }}
                    >
                        {testimonials.map((t, i) => (
                            <div key={i} className="w-full flex-shrink-0 p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center md:items-start">
                                <div className="flex-shrink-0">
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-800 shadow-xl">
                                        <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                <div className="flex-1 text-center md:text-left">
                                    <div className="flex justify-center md:justify-start gap-1 mb-4 text-amber-500">
                                        {[...Array(t.rating)].map((_, i) => <Star key={i} size={20} fill="currentColor" />)}
                                    </div>
                                    <Quote className="text-slate-700 mb-4 mx-auto md:mx-0 transform -scale-x-100" size={40} />
                                    <p className="text-xl md:text-2xl text-slate-200 italic mb-6 leading-relaxed">"{t.content}"</p>
                                    <div>
                                        <h4 className="text-lg font-bold text-white">{t.name}</h4>
                                        <p className="text-slate-500">{t.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Controls */}
                    <button 
                        onClick={prev}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 text-white hover:bg-blue-600 transition-colors border border-slate-700 backdrop-blur-sm z-10"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button 
                        onClick={next}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 text-white hover:bg-blue-600 transition-colors border border-slate-700 backdrop-blur-sm z-10"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>

                {/* Dots */}
                <div className="flex justify-center gap-2 mt-8">
                    {testimonials.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => { setIsAutoPlaying(false); setCurrent(i); }}
                            className={`w-3 h-3 rounded-full transition-all ${current === i ? 'bg-blue-600 w-8' : 'bg-slate-700 hover:bg-slate-600'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    </section>
  );
};

export default Testimonials;
