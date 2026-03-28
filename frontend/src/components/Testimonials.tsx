import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "Voicely booked 47 demos in our first week. Our SDR team now focuses entirely on closing instead of cold calling.",
    name: "Sarah Chen",
    role: "VP of Sales",
    company: "TechScale",
  },
  {
    quote: "We replaced 3 manual processes with one AI agent. It handles outreach, follow-ups, and scheduling — all autonomously.",
    name: "Marcus Rivera",
    role: "Head of Growth",
    company: "Launchpad",
  },
  {
    quote: "The voice quality is unreal. Prospects don't realize they're talking to AI until we tell them. Game changer for our pipeline.",
    name: "Emily Park",
    role: "CEO",
    company: "CloudReach",
  },
];

const Testimonials = () => (
  <section className="relative py-32 px-6">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-16"
      >
        <p className="font-mono text-[11px] uppercase tracking-ultra text-brand mb-4 font-medium">Testimonials</p>
        <h2 className="font-display text-4xl md:text-5xl">
          Loved by{" "}
          <span className="gradient-text">sales teams</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-2xl p-7 border border-black/[0.04] flex flex-col hover:shadow-xl hover:shadow-purple-500/[0.04] hover:border-purple-500/10 transition-all duration-300"
          >
            <div className="flex gap-0.5 mb-5">
              {[...Array(5)].map((_, j) => (
                <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="font-body text-foreground leading-relaxed mb-6 flex-1 text-[15px]">"{t.quote}"</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                <span className="font-body text-xs font-bold text-brand">{t.name.split(' ').map(n => n[0]).join('')}</span>
              </div>
              <div>
                <p className="font-body font-semibold text-foreground text-sm">{t.name}</p>
                <p className="font-body text-xs text-muted-foreground">{t.role}, {t.company}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Testimonials;
