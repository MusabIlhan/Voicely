import { motion } from "framer-motion";
import LiveNotification from "./LiveNotification";
import NeuralLines from "./NeuralLines";
import { ArrowRight, Star } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6">
      <div className="absolute inset-0 bg-grid" />
      <NeuralLines />

      <div className="relative z-10 text-center max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          <LiveNotification />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 inline-flex items-center gap-2.5"
        >
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <span className="font-body text-xs text-muted-foreground font-medium">Rated 4.9/5 by 2,000+ teams</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="font-display leading-[1.05] mb-6"
          style={{ fontSize: "clamp(2.8rem, 7vw, 5rem)" }}
        >
          Get 10 hours back
          <br />
          every week.
          <br />
          <span className="gradient-text">Your AI makes the calls.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="font-body text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10 font-light leading-relaxed"
        >
          Voicely autonomously calls prospects, qualifies leads, books meetings
          on your calendar, and follows up — so you can focus on closing.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6"
        >
          <a
            href="#pricing"
            className="font-body text-sm font-semibold bg-gradient-to-r from-[#7C3AED] to-[#C026D3] text-white px-8 py-3.5 rounded-full hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300 flex items-center gap-2 group"
          >
            Start Free Trial
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
          </a>
          <a
            href="#how-it-works"
            className="font-body text-sm font-semibold text-foreground bg-white border border-black/[0.08] px-8 py-3.5 rounded-full hover:border-black/[0.15] hover:shadow-lg hover:shadow-black/[0.04] transition-all duration-300"
          >
            Watch Demo
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="font-body text-xs text-muted-foreground/70 font-medium"
        >
          Free 7-day trial &middot; No credit card required &middot; Setup in 2 minutes
        </motion.p>
      </div>
    </section>
  );
};

export default HeroSection;
