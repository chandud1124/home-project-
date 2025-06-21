import React from 'react';
import { Heart } from 'lucide-react';

const OurStory = () => {
  const stories = [
    {
      title: "The Arrangement",
      description: "In the presence of tradition and the wisdom of our families, a match was made thoughtfully, respectfully, and with love from those who know us best.<br/>What began as an arrangement between two families became the beginning of a meaningful journey of mutual understanding, shared values, and a bond that continues to grow each day.",
      image: "/gallery/01.jpeg"
    },
    {
      title: "First Meeting",
      description: "There were butterflies, shy smiles, and a little nervousness in the air.<br/>But as we talked gently, naturally time seemed to pause. That first meeting, arranged lovingly by our families, held a quiet spark.<br/>It wasn’t love at first sight, but it was a beginning filled with warmth and hope.",
      image: "/gallery/02.jpeg"
    },
    {
      title: "Growing Together",
      description: "Over time, through endless conversations, shared dreams, and growing understanding, something wonderful happened.<br/>What started with formal greetings turned into laughter, trust, and a bond that felt like home. We found not just love but friendship, respect, and a true partner in each other.",
      image: "/gallery/03.jpeg"
    },
    {
      title: "Finally, Here We Are",
      description: "Now, hand in hand, we stand at the beginning of a new chapter ready to walk through life together. As our families come together in harmony and joy, this moment marks the start of a beautiful forever.",
      image: "/gallery/04.jpg"
    }
  ];

  return (
    <section id="story" className="py-20 px-4 bg-gradient-to-br from-blue-100 via-pink-100 to-blue-200 relative overflow-hidden">
      {/* Floating hearts animation */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <Heart 
            key={i}
            size={Math.random() * 15 + 8}
            className={`absolute text-rose-200/30 animate-bounce`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="font-great-vibes text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-pink-500 to-blue-700 mb-2 hover:scale-105 transition-transform duration-300 inline-block border-b-4 border-transparent" style={{ lineHeight: 1.3, paddingBottom: '0.2em', overflow: 'visible', borderImage: 'linear-gradient(to right, #ec4899, #3b82f6, #ec4899) 1', borderBottomWidth: '4px', borderImageSlice: 1, fontFamily: 'Great Vibes, cursive' }}>
            From Strangers to Soulmates
          </h2>
          <div style={{ height: '1rem' }}></div>
          <p className="text-xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-pink-500 to-blue-700 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: 'Playfair Display, serif' }}>
            Guided by family, nurtured by tradition, and sealed with eternal love
          </p>
          <p className="text-lg text-pink-600 font-medium italic mt-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            " A match made by them, a love made by us "
          </p>
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-1/2 transform -translate-x-px h-full w-0.5 bg-gray-300 dark:bg-gray-500 opacity-80"></div>

          {stories.map((story, index) => (
            <div
              key={index}
              data-aos="fade-up"
              data-aos-delay={index * 120}
              data-aos-duration="600"
              className={`timeline-item relative flex items-center mb-16 \
                ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} flex-col`}
            >
              {/* Content */}
              <div className="w-full md:w-7/12 md:pr-2 md:pl-2 pl-0 text-left md:text-right">
                <div className="bg-gradient-to-br from-blue-50 via-pink-50 to-blue-100 rounded-lg p-6 shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-105 border border-blue-100">
                  <h3 className="font-serif text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-pink-500 to-blue-700 mb-3 hover:text-blue-700 transition-colors duration-300 text-left">
                    {story.title}
                  </h3>
                  <p className="text-blue-700 leading-relaxed mb-4 text-left md:text-justify break-words md:break-normal"
                    dangerouslySetInnerHTML={{ __html: story.description }}
                  />
                  <img 
                    src={story.image} 
                    alt={story.title}
                    className="w-full h-72 md:h-96 object-contain rounded-lg shadow-md hover:shadow-xl transition-all duration-500 hover:scale-105 bg-white"
                  />
                </div>
              </div>
              {/* Spacer for other side */}
              <div className="hidden md:block w-5/12"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OurStory;
