import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const milestones = [
  { year: "2019", event: "First Met 💬" },
  { year: "2020", event: "First Trip ✈️" },
  { year: "2022", event: "Proposal 💍" },
  { year: "2025", event: "Wedding Day 💒" },
];

export default function LoveStorySlider() {
  const [current, setCurrent] = useState(0);

  const next = () => setCurrent((c) => (c + 1) % milestones.length);
  const prev = () => setCurrent((c) => (c - 1 + milestones.length) % milestones.length);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center py-8">
      <div className="flex items-center justify-between w-full mb-4">
        <button onClick={prev} className="p-2 text-2xl" aria-label="Previous">⬅️</button>
        <div className="flex-1 text-center font-bold text-pink-600 text-lg">Our Love Story</div>
        <button onClick={next} className="p-2 text-2xl" aria-label="Next">➡️</button>
      </div>
      <div className="relative w-full h-40 flex items-center justify-center">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.5 }}
            className="absolute w-full flex flex-col items-center"
          >
            <div className="bg-pink-100 p-6 rounded-full shadow-lg text-3xl mb-4 border-4 border-pink-300">
              {milestones[current].event.match(/([\p{Emoji}\u200d]+)/gu)?.pop()}
            </div>
            <div className="text-xl font-semibold text-gray-800">{milestones[current].event.replace(/([\p{Emoji}\u200d]+)/gu, "")}</div>
            <div className="text-pink-500 mt-2 font-medium">{milestones[current].year}</div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex space-x-2 mt-6">
        {milestones.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-3 h-3 rounded-full ${idx === current ? "bg-pink-500" : "bg-pink-200"}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
