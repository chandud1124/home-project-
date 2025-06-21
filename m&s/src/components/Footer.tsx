import React from 'react';
import { Crown, Sparkles, Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gradient-to-r from-orange-600 via-amber-600 to-red-600 text-white py-20 relative overflow-hidden">
      {/* Enhanced Background decoration */}
      <div className="absolute inset-0 opacity-15">
        <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-white rounded-full animate-pulse delay-500"></div>
        <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-white rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-1/4 right-1/4 w-24 h-24 bg-white rounded-full animate-pulse delay-700"></div>
      </div>

      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <Crown 
            key={`crown-${i}`}
            size={Math.random() * 20 + 8}
            className="absolute text-white/20 animate-float-hearts"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${4 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-4 text-center relative z-10">
        <div className="mb-12 hover-scale">
          <h3 className="font-serif text-5xl md:text-6xl font-bold mb-8 hover:scale-105 transition-transform duration-500">
            Manoj & Soniya
          </h3>
          <div className="flex items-center justify-center space-x-6 text-2xl md:text-3xl mb-2">
            <Sparkles size={28} className="text-amber-200 animate-sparkle-float" />
            <span className="font-bold font-serif">Together, Always</span>
            <Sparkles size={28} className="text-amber-200 animate-sparkle-float delay-500" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-white mb-4">4th August 2024</div>
        </div>

        <div className="border-t-2 border-amber-300/50 pt-12 mb-10">
          <p className="text-amber-100 mb-8 text-xl md:text-2xl italic font-medium max-w-4xl mx-auto leading-relaxed">
            In a sacred tradition where two souls are brought together with the blessings of family and ancestors, we take our first steps into a life of togetherness.<br /><br />
            With the seven sacred steps, we vow to walk side by side in trust, understanding, and love.<br />
            With the three sacred knots, we are bound in heart, spirit, and purpose to share a journey rooted in unity and devotion.<br /><br />
            This is not just a wedding, but the beginning of a timeless bond a promise, a partnership, and a future shaped by love
          </p>
          <p className="text-amber-300 text-xl font-semibold">
            We look forward to having you with us as we begin our journey together
          </p>
        </div>

        <div className="mt-12 text-center">
          <div className="flex justify-center space-x-3 mb-6">
            <div className="w-3 h-3 bg-amber-200 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-100"></div>
            <div className="w-3 h-3 bg-red-200 rounded-full animate-bounce delay-200"></div>
            <div className="w-3 h-3 bg-amber-200 rounded-full animate-bounce delay-300"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-400"></div>
          </div>
          <p className="text-lg text-amber-200 flex items-center justify-center hover:scale-105 transition-transform duration-500 font-medium">
            Crafted with <Heart size={18} className="inline mx-2 text-red-200 animate-heart-beat" /> for Manoj & Soniya's Wedding
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
