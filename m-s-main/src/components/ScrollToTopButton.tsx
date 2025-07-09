import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ScrollToTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 200);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollUp = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3 }}
          onClick={scrollUp}
          className="fixed bottom-8 right-8 z-50 bg-pink-500 hover:bg-pink-600 text-white p-3 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
          aria-label="Scroll to top"
        >
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
