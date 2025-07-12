import React from 'react';

const PreWeddingVideo = () => {
  return (
    <section id="prewedding-video" className="py-16 bg-gradient-to-b from-pink-50 to-rose-100 flex flex-col items-center">
      <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-8 bg-gradient-to-r from-pink-600 via-rose-500 to-red-500 bg-clip-text text-transparent text-center"></h2>
      <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden shadow-2xl border-4 border-pink-200">
        <video controls poster="/placeholder.svg" className="w-full h-full object-cover">
          <source src="/video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </section>
  );
};

export default PreWeddingVideo;
