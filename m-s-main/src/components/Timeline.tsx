import { motion } from "framer-motion";

const milestones = [
  { year: "2019", event: "First Met 💬" },
  { year: "2020", event: "First Trip ✈️" },
  { year: "2022", event: "Proposal 💍" },
  { year: "2025", event: "Wedding Day 💒" },
];

export default function Timeline() {
  return (
    <div className="flex flex-col md:flex-row items-center justify-center space-y-8 md:space-y-0 md:space-x-12 py-8">
      {milestones.map((item, idx) => (
        <motion.div
          key={idx}
          className="flex flex-col items-center relative"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: idx * 0.2 }}
          viewport={{ once: true }}
        >
          <div className="bg-pink-200 p-4 rounded-full shadow-lg text-lg font-semibold border-4 border-pink-400">
            {item.year}
          </div>
          <div className="mt-3 text-center text-base font-medium text-gray-700">
            {item.event}
          </div>
          {/* Connector line */}
          {idx < milestones.length - 1 && (
            <div className="hidden md:block absolute top-1/2 right-[-3rem] w-24 h-1 bg-pink-300 z-0" />
          )}
          {idx < milestones.length - 1 && (
            <div className="md:hidden w-1 h-16 bg-pink-300 mt-3" />
          )}
        </motion.div>
      ))}
    </div>
  );
}
