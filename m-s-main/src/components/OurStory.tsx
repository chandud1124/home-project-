import React, { useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';

const OurStory = () => {
  // Intersection Observer for image zoom effect
  const firstMeetingImgRef = useRef<HTMLImageElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null); // NEW: ref for hero image
  const finallyImgRef = useRef<HTMLImageElement>(null); // ref for 'Finally, Here We Are' image
  // Refs for text animation
  const firstMeetingTextRef = useRef<HTMLDivElement>(null);
  const finallyTextRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const arrangementTextRef = useRef<HTMLDivElement>(null);
  const growingTextRef = useRef<HTMLDivElement>(null);
  // Intersection Observer for The Arrangement text
  useEffect(() => {
    const text = arrangementTextRef.current;
    if (!text) return;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          text.classList.add('fade-in-up');
        } else {
          text.classList.remove('fade-in-up');
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(text);
    return () => observer.disconnect();
  }, []);

  // Intersection Observer for Growing Together text
  useEffect(() => {
    const text = growingTextRef.current;
    if (!text) return;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          text.classList.add('fade-in-up');
        } else {
          text.classList.remove('fade-in-up');
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(text);
    return () => observer.disconnect();
  }, []);
  // Intersection Observer for From Strangers to Soulmates text
  useEffect(() => {
    const text = heroTextRef.current;
    if (!text) return;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          text.classList.add('fade-in-up');
        } else {
          text.classList.remove('fade-in-up');
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(text);
    return () => observer.disconnect();
  }, []);
  // Intersection Observer for First Meeting text
  useEffect(() => {
    const text = firstMeetingTextRef.current;
    if (!text) return;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          text.classList.add('fade-in-up');
        } else {
          text.classList.remove('fade-in-up');
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(text);
    return () => observer.disconnect();
  }, []);

  // Intersection Observer for Finally, Here We Are text
  useEffect(() => {
    const text = finallyTextRef.current;
    if (!text) return;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          text.classList.add('fade-in-up');
        } else {
          text.classList.remove('fade-in-up');
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(text);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const img = firstMeetingImgRef.current;
    if (!img) return;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          img.classList.add('in-view');
        } else {
          img.classList.remove('in-view');
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(img);
    return () => observer.disconnect();
  }, []);

  // NEW: Intersection Observer for hero image
  useEffect(() => {
    const hero = heroImgRef.current;
    if (!hero) return;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hero.classList.add('in-view');
        } else {
          hero.classList.remove('in-view');
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  // Intersection Observer for 'Finally, Here We Are' image
  useEffect(() => {
    const finallyImg = finallyImgRef.current;
    if (!finallyImg) return;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          finallyImg.classList.add('in-view');
        } else {
          finallyImg.classList.remove('in-view');
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(finallyImg);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const zoomElements = document.querySelectorAll('.image-zoom-container');
      zoomElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('in-view');
        } else {
          el.classList.remove('in-view');
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Fullscreen glassmorphic rectangle with image slightly inset */}
      <section id="story" className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 via-blue-100 to-purple-100 relative p-0 m-0">
        <div className="glass shadow-2xl flex flex-col lg:flex-row items-center w-full h-screen max-w-none mx-0 overflow-hidden relative rounded-none">
          {/* Image left, with correct aspect ratio, spacing, and rounded corners */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-2 md:p-4">
            <div
              className="image-container"
              style={{
                width: '100%',
                maxWidth: '750px', // Increased from 600px
                aspectRatio: '3/2',
                background: 'transparent',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.2)',
                margin: '16px',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                ref={heroImgRef}
                src="/gallery/s11.JPG"
                alt="From Strangers to Soulmates"
                className="rounded-image w-full h-full object-cover"
                style={{
                  borderRadius: '16px',
                  width: '100%',
                  height: '100%',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  aspectRatio: '3/2',
                  transition: 'transform 0.4s ease-out',
                  willChange: 'transform',
                  objectPosition: 'center',
                  display: 'block',
                }}
              />
            </div>
          </div>
          {/* Text right */}
          <div
            ref={heroTextRef}
            className="w-full lg:w-1/2 flex flex-col justify-center p-8 md:p-12 text-center md:text-left opacity-0 translate-y-8 transition-all duration-700"
          >
            <h1 className="text-4xl md:text-5xl font-dancing font-bold text-primary mb-4">From Strangers to Soulmates</h1>
            <p className="text-xl md:text-2xl text-gray-700 mb-6 font-light">Guided by family, nurtured by tradition, and sealed with eternal love</p>
            <p className="text-lg md:text-xl text-pink-600 font-medium italic mt-2">" A match made by PARENTS, a love made by US "</p>
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
          .image-container {
            overflow: hidden;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.2);
            background: transparent;
            margin: 16px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .rounded-image {
            border-radius: 16px;
            width: 100%;
            height: 100%;
            max-width: 100%;
            max-height: 100%;
            aspect-ratio: 3/2;
            transition: transform 0.4s ease-out;
            will-change: transform;
            object-fit: cover;
            object-position: center;
            display: block;
            transform: scale(0.95);
          }
          .rounded-image.in-view {
            transform: scale(1.05);
          }
          @media (max-width: 768px) {
            .image-container {
              max-width: 350px; /* Increased from 300px */
              min-width: 200px;
              aspect-ratio: 3/2;
              margin: 8px auto;
            }
            .rounded-image {
              aspect-ratio: 3/2;
              max-width: 100%;
              max-height: 100%;
            }
          }
        `}</style>
      </section>
      {/* The Arrangement section with parallax/fixed background and animated text */}
      <section
        className="w-full min-h-screen flex items-center justify-end bg-gradient-to-br from-pink-100 via-blue-100 to-purple-100 relative px-2 md:px-0 p-0 m-0"
        style={{ height: '100vh', overflowX: 'hidden' }}
      >
        <div
          className="absolute inset-0 w-full h-full z-0"
          style={{
            backgroundImage: 'url(/gallery/01.jpeg)',
            backgroundAttachment: 'fixed',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover'
          }}
        >
          <div style={{width: '100%', height: '100%', background: 'rgba(0,0,0,0.15)'}} />
        </div>
        <div className="relative z-10 flex items-center min-h-screen w-full justify-end md:justify-end justify-center px-0 md:px-0">
          <div
            className="glass rounded-3xl shadow-2xl sm:max-w-xs md:max-w-sm lg:max-w-md w-full mr-0 md:mr-20 p-4 sm:p-6 md:p-16 flex flex-col justify-center items-center text-center mx-auto md:mx-0 arrangement-content-box"
            style={{
              minHeight: '60vh',
              color: '#fff',
              background: 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(18px) saturate(120%)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              boxShadow: '0 8px 32px 0 rgba(31,38,135,0.18)',
              WebkitBackdropFilter: 'blur(18px) saturate(120%)',
              borderRadius: '1.5rem',
              transition: 'background 0.3s, box-shadow 0.3s',
            }}
          >
            <div ref={arrangementTextRef} className="opacity-0 translate-y-8 transition-all duration-700">
              <h1 className="text-4xl md:text-5xl font-dancing font-bold mb-6 whitespace-nowrap" style={{ color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>The Arrangement</h1>
              <p className="text-xl md:text-2xl mb-4 font-light" style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                In the presence of tradition and the wisdom of our families, a match was made thoughtfully, respectfully, and with love from those who know us best.
              </p>
              <p className="text-lg md:text-xl font-light" style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                What began as an arrangement between two families became the beginning of a meaningful journey of mutual understanding, shared values, and a bond that continues to grow each day.
              </p>
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
          @keyframes fade-slide {
            0% { opacity: 0; transform: translateY(40px) scale(0.98); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          .animate-fade-slide {
            animation: fade-slide 1s cubic-bezier(0.23, 1, 0.32, 1) both;
          }
        `}</style>
      </section>
      {/* First Meeting section, styled like the hero section */}
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 via-blue-100 to-purple-100 relative p-0 m-0">
        <div className="glass shadow-2xl flex flex-col lg:flex-row items-center w-full h-screen max-w-none mx-0 overflow-hidden relative rounded-none">
          {/* Image left, with correct aspect ratio, spacing, and rounded corners */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-2 md:p-4">
            <div
              className="image-container"
              style={{
                width: '100%',
                maxWidth: '750px', // Increased from 600px
                aspectRatio: '3/2',
                background: 'transparent',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.2)',
                margin: '16px',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                ref={firstMeetingImgRef}
                src="/gallery/02.jpeg"
                alt="First Meeting"
                className="rounded-image w-full h-full object-cover"
                style={{
                  borderRadius: '16px',
                  width: '100%',
                  height: '100%',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  aspectRatio: '3/2',
                  transition: 'transform 0.4s ease-out',
                  willChange: 'transform',
                  objectPosition: 'center',
                  display: 'block',
                }}
              />
            </div>
          </div>
          {/* Text right */}
          <div
            ref={firstMeetingTextRef}
            className="w-full lg:w-1/2 flex flex-col justify-center p-8 md:p-12 text-center md:text-left opacity-0 translate-y-8 transition-all duration-700"
          >
            <h1 className="text-4xl md:text-5xl font-dancing font-bold text-primary mb-4">First Meeting</h1>
            <p className="text-xl md:text-2xl text-gray-700 mb-6 font-light">There were butterflies, shy smiles, and a little nervousness in the air.</p>
            <p className="text-lg md:text-xl text-gray-700 font-light">But as we talked gently, naturally time seemed to pause. That first meeting, arranged lovingly by our families, held a quiet spark.</p>
            <p className="text-lg md:text-xl text-gray-700 font-light">It wasn’t love at first sight, but it was a beginning filled with warmth and hope.</p>
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
          .image-container {
            overflow: hidden;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.2);
            background: transparent;
            margin: 16px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .rounded-image {
            border-radius: 16px;
            width: 100%;
            height: 100%;
            max-width: 100%;
            max-height: 100%;
            aspect-ratio: 3/2;
            transition: transform 0.4s ease-out;
            will-change: transform;
            object-fit: cover;
            object-position: center;
            display: block;
            transform: scale(0.95);
          }
          .rounded-image.in-view {
            transform: scale(1.05);
          }
          @media (max-width: 768px) {
            .image-container {
              max-width: 350px; /* Increased from 300px */
              min-width: 200px;
              aspect-ratio: 3/2;
              margin: 8px auto;
            }
            .rounded-image {
              aspect-ratio: 3/2;
              max-width: 100%;
              max-height: 100%;
            }
          }
        `}</style>
      </section>
      {/* Growing Together section, styled like The Arrangement */}
      <section
        className="w-full min-h-screen flex items-center justify-end bg-gradient-to-br from-pink-100 via-blue-100 to-purple-100 relative px-2 md:px-0 p-0 m-0"
        style={{ height: '100vh', overflowX: 'hidden' }}
      >
        <div
          className="absolute inset-0 w-full h-full z-0"
          style={{
            backgroundImage: 'url(/gallery/03.jpeg)',
            backgroundAttachment: 'fixed',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover'
          }}
        >
          <div style={{width: '100%', height: '100%', background: 'rgba(0,0,0,0.15)'}} />
        </div>
        <div className="relative z-10 flex items-center min-h-screen w-full justify-end md:justify-end justify-center px-0 md:px-0">
          <div
            className="glass rounded-3xl shadow-2xl sm:max-w-xs md:max-w-sm lg:max-w-md w-full mr-0 md:mr-20 p-4 sm:p-6 md:p-16 flex flex-col justify-center items-center text-center mx-auto md:mx-0 arrangement-content-box"
            style={{
              minHeight: '60vh',
              color: '#fff',
              background: 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(18px) saturate(120%)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              boxShadow: '0 8px 32px 0 rgba(31,38,135,0.18)',
              WebkitBackdropFilter: 'blur(18px) saturate(120%)',
              borderRadius: '1.5rem',
              transition: 'background 0.3s, box-shadow 0.3s',
            }}
          >
            <div ref={growingTextRef} className="opacity-0 translate-y-8 transition-all duration-700">
              <h1 className="text-4xl md:text-5xl font-dancing font-bold mb-6 whitespace-nowrap" style={{ color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>Growing Together</h1>
              <p className="text-xl md:text-2xl mb-4 font-light" style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                With every conversation, every shared smile, and every new experience, our bond deepened. We learned, adapted, and supported each other through joys and challenges alike.
              </p>
              <p className="text-lg md:text-xl font-light" style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                Our journey is a beautiful mosaic of laughter, understanding, and growth—two souls, hand in hand, growing stronger together every day.
              </p>
            </div>
          </div>
        </div>
        <style>{`
          @media (max-width: 768px) {
            .arrangement-content-box {
              min-height: 0 !important;
              max-height: 80vh !important;
              overflow-y: auto !important;
            }
          }
          .glass {
            background: rgba(255, 255, 255, 0.5);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 182, 193, 0.18);
          }
          .font-dancing {
            font-family: 'Dancing Script', cursive;
          }
          @keyframes fade-slide {
            0% { opacity: 0; transform: translateY(40px) scale(0.98); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          .animate-fade-slide {
            animation: fade-slide 1s cubic-bezier(0.23, 1, 0.32, 1) both;
          }
        `}</style>
      </section>
      {/* Finally, Here We Are section, styled like First Meeting */}
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 via-blue-100 to-purple-100 relative p-0 m-0">
        <div className="glass shadow-2xl flex flex-col lg:flex-row items-center w-full h-screen max-w-none mx-0 overflow-hidden relative rounded-none">
          {/* Image left, with correct aspect ratio, spacing, and rounded corners */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-2 md:p-4">
            <div
              className="image-container"
              style={{
                width: '100%',
                maxWidth: '750px',
                aspectRatio: '3/2',
                background: 'transparent',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.2)',
                margin: '16px',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                ref={finallyImgRef}
                src="/gallery/04.jpg"
                alt="Finally, Here We Are"
                className="rounded-image w-full h-full object-cover"
                style={{
                  borderRadius: '16px',
                  width: '100%',
                  height: '100%',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  aspectRatio: '3/2',
                  transition: 'transform 0.4s ease-out',
                  willChange: 'transform',
                  objectPosition: 'center',
                  display: 'block',
                }}
              />
            </div>
          </div>
          {/* Text right */}
          <div
            ref={finallyTextRef}
            className="w-full lg:w-1/2 flex flex-col justify-center p-8 md:p-12 text-center md:text-left opacity-0 translate-y-8 transition-all duration-700"
          >
            <h1 className="text-4xl md:text-5xl font-dancing font-bold text-primary mb-4">Finally, Here We Are</h1>
            <p className="text-xl md:text-2xl text-gray-700 mb-6 font-light">Through every twist and turn, every moment of laughter and learning, we have arrived at this beautiful chapter—together.</p>
            <p className="text-lg md:text-xl text-pink-600 font-medium italic mt-2">Our story is just beginning, and we can't wait to write the next pages hand in hand.</p>
          </div>
        </div>
        <style>{`
          .fade-in-up {
            opacity: 1 !important;
            transform: translateY(0) !important;
            transition: opacity 0.7s cubic-bezier(0.23, 1, 0.32, 1), transform 0.7s cubic-bezier(0.23, 1, 0.32, 1);
          }
          .glass {
            background: rgba(255, 255, 255, 0.5);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 182, 193, 0.18);
          }
          .font-dancing {
            font-family: 'Dancing Script', cursive;
          }
          .image-container {
            overflow: hidden;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.2);
            background: transparent;
            margin: 16px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .rounded-image {
            border-radius: 16px;
            width: 100%;
            height: 100%;
            max-width: 100%;
            max-height: 100%;
            aspect-ratio: 3/2;
            transition: transform 0.4s ease-out;
            will-change: transform;
            object-fit: cover;
            object-position: center;
            display: block;
            transform: scale(0.95);
          }
          .rounded-image.in-view {
            transform: scale(1.05);
          }
          @media (max-width: 768px) {
            .image-container {
              max-width: 350px;
              min-width: 200px;
              aspect-ratio: 3/2;
              margin: 8px auto;
            }
            .rounded-image {
              aspect-ratio: 3/2;
              max-width: 100%;
              max-height: 100%;
            }
          }
        `}</style>
      </section>
    </>
  );
};

export default OurStory;
