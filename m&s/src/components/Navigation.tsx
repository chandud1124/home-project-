import React, { useState, useEffect } from 'react';
import { Menu, X, Heart } from 'lucide-react';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsOpen(false);
    }
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-700 ${
      scrolled 
        ? 'bg-gradient-to-r from-orange-50/60 via-amber-50/60 to-red-50/60 backdrop-blur-sm shadow-lg border-b border-orange-200/30 h-14' 
        : 'bg-transparent h-14'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center space-x-3 group hover-scale">
            <img src="/logo1.png" alt="Logo" className="w-14 h-14 rounded-full" style={{ display: 'block', lineHeight: 1.2, paddingBottom: '0.25em' }} />
            <div className="relative">
              <Heart size={28} className="text-orange-600 animate-pulse group-hover:animate-bounce" />
              <div className="absolute inset-0 animate-ping opacity-20">
                <Heart size={28} className="text-orange-400" />
              </div>
            </div>
            <div className="font-serif text-3xl font-bold bg-gradient-to-r from-orange-600 via-amber-600 to-red-600 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">
              M & S
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8">
            {[
              { name: 'Home', id: 'home' },
              { name: 'Our Story', id: 'story' },
              { name: 'Sacred Details', id: 'details' },
              { name: 'Gallery', id: 'gallery' }
            ].map((item) => (
              <button
                key={item.name}
                onClick={() => scrollToSection(item.id)}
                className="relative text-orange-800 hover:text-transparent hover:bg-gradient-to-r hover:from-orange-600 hover:to-red-600 hover:bg-clip-text transition-all duration-500 font-bold text-lg group transform hover:scale-110 hover:-translate-y-1"
              >
                {item.name}
                <span className="absolute -bottom-2 left-0 w-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 group-hover:w-full transition-all duration-700 rounded-full"></span>
              </button>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-orange-800 hover:text-red-600 transition-all duration-300 transform hover:scale-125 hover:rotate-180"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden bg-gradient-to-br from-orange-50/95 via-amber-50/95 to-red-50/95 backdrop-blur-md rounded-2xl shadow-2xl mb-4 p-6 border-2 border-orange-200/50 animate-scale-in">
            {[
              { name: 'Home', id: 'home' },
              { name: 'Our Story', id: 'story' },
              { name: 'Sacred Details', id: 'details' },
              { name: 'Gallery', id: 'gallery' }
            ].map((item) => (
              <button
                key={item.name}
                onClick={() => scrollToSection(item.id)}
                className="block w-full text-left py-4 text-orange-800 hover:text-transparent hover:bg-gradient-to-r hover:from-orange-600 hover:to-red-600 hover:bg-clip-text transition-all duration-500 font-bold text-lg transform hover:translate-x-4 hover:scale-105"
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
