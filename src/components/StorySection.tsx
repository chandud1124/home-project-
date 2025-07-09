import React, { useRef, useEffect, useState } from 'react';

interface StorySectionProps {
  title: string;
  content: string;
  imageSrc: string;
  imageAlt: string;
  imageLeft?: boolean;
  backgroundImage?: boolean;
  overlay?: boolean; // Optional: add a dark overlay for readability
}

const StorySection: React.FC<StorySectionProps> = ({
  title,
  content,
  imageSrc,
  imageAlt,
  imageLeft = true,
  backgroundImage = false,
  overlay = true,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className={`w-full py-16 ${backgroundImage ? 'relative' : ''} transition-all duration-700 ${isVisible ? 'animate-fade-in' : 'opacity-0 translate-y-8'}`}
      style={backgroundImage ? { minHeight: '28rem' } : {}}
      ref={sectionRef}
    >
      {backgroundImage && (
        <>
          <img
            src={imageSrc}
            alt={imageAlt}
            className="absolute inset-0 w-full h-full object-cover z-0 rounded-3xl"
            style={{ filter: 'brightness(0.7) blur(1px)' }}
          />
          {overlay && <div className="absolute inset-0 bg-black bg-opacity-30 rounded-3xl z-0" />}
        </>
      )}
      <div className={`container mx-auto px-4 relative z-10`}>
        <div className={`flex flex-col lg:flex-row items-center gap-12 ${!imageLeft ? 'lg:flex-row-reverse' : ''}`}>
          {/* Image */}
          <div className="w-full lg:w-1/2">
            {!backgroundImage && (
              <img
                src={imageSrc}
                alt={imageAlt}
                className="w-full h-80 md:h-[400px] object-cover rounded-3xl shadow-2xl"
              />
            )}
          </div>
          {/* Text content */}
          <div className="w-full lg:w-1/2">
            <div className="glass rounded-3xl p-8 md:p-12">
              <h2 className="text-3xl md:text-4xl font-dancing font-bold text-primary mb-4">{title}</h2>
              <p className="text-lg md:text-xl text-gray-800 leading-relaxed">{content}</p>
            </div>
          </div>
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
        .animate-fade-in {
          opacity: 1 !important;
          transform: none !important;
          animation: fadeIn 1s cubic-bezier(0.4,0,0.2,1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </section>
  );
};

export default StorySection;
