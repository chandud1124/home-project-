import React from 'react';

const HeroStorySection = () => {
  return (
    <section
      id="story-hero"
      className="w-full min-h-[60vh] flex items-center justify-center py-0 relative overflow-hidden bg-gradient-to-br from-pink-100 via-blue-100 to-purple-100"
      style={{ minHeight: '60vh' }}
    >
      {/* No background image, just text */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center">
        <div className="glass rounded-3xl p-10 md:p-16 shadow-2xl w-full max-w-3xl mx-auto transition-all duration-1000">
          <h1 className="text-4xl md:text-5xl font-dancing font-bold text-primary mb-6 text-center">From Strangers to Soulmates</h1>
          <p className="text-xl md:text-2xl text-gray-700 mb-6 font-light text-center">
            Guided by family, nurtured by tradition, and sealed with eternal love
          </p>
          <p className="text-lg md:text-xl text-pink-600 font-medium italic mt-2 text-center">
            " A match made by PARENTS, a love made by US "
          </p>
        </div>
      </div>
      <style>{`
        .glass {
          background: rgba(255, 255, 255, 0.5);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 182, 193, 0.18);
        }
        .font-dancing {
          font-family: 'Dancing Script', cursive;
        }
      `}</style>
    </section>
  );
};

export default HeroStorySection;
