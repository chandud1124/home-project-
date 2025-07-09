import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const Gallery = () => {
  const images = [
    { src: "/gallery/1.jpeg", alt: "Gallery Image 1" },
    { src: "/gallery/2.jpg", alt: "Gallery Image 2" },
    { src: "/gallery/3.jpeg", alt: "Gallery Image 3" },
    { src: "/gallery/4.jpeg", alt: "Gallery Image 4" },
    { src: "/gallery/5.webp", alt: "Gallery Image 5" },
    { src: "/gallery/6.jpg", alt: "Gallery Image 6" },
    { src: "/gallery/7.jpeg", alt: "Gallery Image 7" },
    { src: "/gallery/8.avif", alt: "Gallery Image 8" }
  ];
  const [current, setCurrent] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!videoContainerRef.current) return;
    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setShowVideo(entry.intersectionRatio === 1);
        });
      },
      { threshold: [0, 1] }
    );
    observer.observe(videoContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleChange = (nextIdx: number) => {
    setCurrent(nextIdx);
  };

  return (
    <section id="gallery" className="py-20 px-4 bg-white">
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-rose-600 via-pink-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg animate-gradient-move">
          Moments of Us
        </h2>
        <div className="w-32 h-1 bg-gradient-to-r from-rose-400 to-pink-400 mx-auto mb-6"></div>
        <p className="text-lg text-gray-600 mb-8 text-center">
          " Each frame holds a memory, each moment tells our story captured with love on the path to forever "
        </p>
        {/* Pre-Wedding Video as background/first item */}
        <div
          ref={videoContainerRef}
          className="w-full max-w-5xl aspect-video rounded-3xl overflow-hidden shadow-2xl border-4 border-pink-200 mb-12 relative flex items-center justify-center"
          style={{ minHeight: 400 }}
        >
          {!showVideo && (
            <img
              src="/gallery/sc1.webp"
              alt="Gallery Poster"
              className="absolute inset-0 w-full h-full object-cover z-10 bg-white"
              style={{ pointerEvents: 'none' }}
            />
          )}
          {showVideo && (
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/_9EOY9Pf40g?si=H07-z1kQCJE3ciF-&autoplay=1&mute=1&rel=0"
              title="YouTube video player"
              frameBorder="0"
              allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full object-contain relative z-0 bg-black"
              style={{ minHeight: 400, aspectRatio: '16/9', display: 'block' }}
            ></iframe>
          )}
        </div>
        <div className="relative w-full flex flex-col items-center">
          <div className="relative w-full flex items-center justify-center mb-8 overflow-hidden" style={{minHeight: 320}}>
            {/* Left arrow */}
            <button
              onClick={() => handleChange(current === 0 ? images.length - 1 : current - 1)}
              className="absolute left-4 z-10 bg-white/80 hover:bg-rose-100 rounded-full p-2 shadow transition disabled:opacity-50"
              aria-label="Previous image"
              style={{ top: '50%', transform: 'translateY(-50%)' }}
            >
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {images[current] && (
              <motion.img
                src={images[current].src}
                alt={images[current].alt}
                className="w-full max-h-[600px] object-contain rounded-2xl shadow-2xl border-4 border-white bg-gray-50 transition-all duration-200 ease-in-out"
                style={{ minHeight: 320, cursor: 'pointer' }}
              />
            )}
            {/* Right arrow */}
            <button
              onClick={() => handleChange(current === images.length - 1 ? 0 : current + 1)}
              className="absolute right-4 z-10 bg-white/80 hover:bg-rose-100 rounded-full p-2 shadow transition disabled:opacity-50"
              aria-label="Next image"
              style={{ top: '50%', transform: 'translateY(-50%)' }}
            >
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Gallery;
