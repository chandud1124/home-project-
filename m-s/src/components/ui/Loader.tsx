import React from 'react';
import { Heart } from 'lucide-react';

const Loader = () => (
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
    <div className="flex items-center space-x-4 animate-pulse">
      <Heart size={48} className="text-pink-400 animate-bounce" />
      <span className="text-3xl md:text-4xl font-bold text-pink-600 font-serif tracking-wide">Loading with Love...</span>
    </div>
  </div>
);

export default Loader;
