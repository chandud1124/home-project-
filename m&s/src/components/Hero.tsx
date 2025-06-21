import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Heart } from 'lucide-react';

const Hero = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targetDate = new Date('2025-08-04T09:40:00').getTime(); // updated to a future date

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.pageYOffset);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section 
      id="home" 
      ref={heroRef}
      className="relative min-h-screen overflow-hidden flex flex-col justify-center"
    >
      {/* Background Image with Parallax Effect */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1606800052052-a08af7148866?w=1920&h=1080&fit=crop')`,
          transform: `translateY(${scrollY * 0.5}px)`,
          scale: '1.1'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 via-purple-800/60 to-pink-700/70"></div>
      </div>

      {/* Floating Hearts Animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <Heart 
            key={`heart-${i}`}
            size={Math.random() * 20 + 10}
            className="absolute text-pink-300/30 animate-float-hearts"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 pt-32">
        <div className="text-center max-w-4xl mx-auto">
          
          {/* Names with Elegant Animation */}
          <div 
            className="mb-8 animate-fade-in-up"
            style={{ 
              animationDelay: '0s', // Show immediately
              animationDuration: '0.7s',
              transform: `translateY(${scrollY * -0.2}px)`
            }}
          >
            <h1 className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-bold mb-4 leading-tight flex items-center justify-center gap-6 relative" style={{ lineHeight: 1.2, paddingBottom: '0.25em' }}>
              <span className="bg-gradient-to-r from-yellow-300 via-pink-300 to-blue-300 bg-clip-text text-transparent hover:scale-105 transition-transform duration-500">
                Manoj
              </span>
              <span className="relative flex items-center justify-center">
                <span className="absolute -inset-4 animate-ping rounded-full bg-pink-300/40 z-0" style={{filter: 'blur(8px)'}}></span>
                <Heart size={48} className="text-red-400 drop-shadow-lg animate-bounce-slow z-10" style={{filter: 'drop-shadow(0 0 8px #f87171)'}} />
              </span>
              <span className="bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent hover:scale-105 transition-transform duration-500">
                Soniya
              </span>
            </h1>
          </div>

          {/* Wedding Date */}
          <div 
            className="mb-12 animate-fade-in-up"
            style={{ 
              animationDelay: '0s', // Show immediately
              animationDuration: '0.7s',
              transform: `translateY(${scrollY * -0.1}px)`
            }}
          >
            <div className="inline-flex items-center bg-white/20 backdrop-blur-md px-6 py-3 sm:px-8 sm:py-4 rounded-full shadow-xl border border-white/30">
              <Calendar size={24} className="text-yellow-300 mr-3" />
              <span className="font-bold text-lg sm:text-xl text-white">
                August 4th, 2025
              </span>
            </div>
          </div>

          {/* Countdown Timer */}
          <div 
            className="mb-12 animate-slide-up"
            style={{ 
              animationDelay: '0s', // Show immediately
              animationDuration: '0.7s',
              transform: `translateY(${scrollY * -0.05}px)`
            }}
          >
            <h3 className="text-xl sm:text-2xl font-serif text-white mb-6 font-medium">
              Countdown to Our Special Day
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 max-w-lg sm:max-w-2xl mx-auto">
              {[
                { label: 'Days', value: timeLeft.days, color: 'from-yellow-400 to-orange-500' },
                { label: 'Hours', value: timeLeft.hours, color: 'from-pink-400 to-red-500' },
                { label: 'Minutes', value: timeLeft.minutes, color: 'from-green-400 to-emerald-500' },
                { label: 'Seconds', value: timeLeft.seconds, color: 'from-blue-500 to-blue-700' }
              ].map((item) => (
                <div 
                  key={item.label} 
                  className={`bg-white/20 backdrop-blur-md rounded-xl p-3 sm:p-4 shadow-xl border border-white/20 hover:scale-105 transition-all duration-300`}
                >
                  <div className={`text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r ${item.color} bg-clip-text text-transparent mb-1 drop-shadow-lg`}>
                    {item.value}
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-white/90 uppercase tracking-wider">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simple Elegant Quote */}
          <div 
            className="animate-text-reveal"
            style={{ 
              animationDelay: '2s',
              transform: `translateY(${scrollY * -0.03}px)`
            }}
          >
            <div className="text-lg sm:text-xl text-white/90 font-light max-w-2xl mx-auto leading-relaxed">
              "Two hearts, one beautiful journey"
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
