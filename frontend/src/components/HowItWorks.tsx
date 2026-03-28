import { motion } from "framer-motion";
import { DatabaseZap, SlidersHorizontal, Orbit, Gauge } from "lucide-react";

const steps = [
  {
    icon: DatabaseZap,
    step: "01",
    title: "Connect & Import",
    description: "Sync your CRM or upload a CSV. Your contacts are ready in seconds.",
    color: "from-violet-500 to-violet-600",
  },
  {
    icon: SlidersHorizontal,
    step: "02",
    title: "Configure",
    description: "Set your script, choose an AI voice, and define available time slots.",
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    icon: Orbit,
    step: "03",
    title: "Launch",
    description: "Your AI agent starts calling, qualifying, and booking meetings on autopilot.",
    color: "from-fuchsia-500 to-fuchsia-400",
  },
  {
    icon: Gauge,
    step: "04",
    title: "Optimize",
    description: "Review analytics and let the AI learn from every interaction to improve.",
    color: "from-fuchsia-400 to-rose-400",
  },
];

const HowItWorks = () => (
  <section id="how-it-works" className="relative py-32 px-6 gradient-bg">
    <div className="max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-20"
      >
        <p className="font-mono text-[11px] uppercase tracking-ultra text-brand mb-4 font-medium">How It Works</p>
        <h2 className="font-display text-4xl md:text-5xl">
          Set up in <span className="gradient-text">2 minutes</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {steps.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-2xl p-7 border border-black/[0.04] text-center group hover:shadow-xl hover:shadow-purple-500/[0.04] hover:border-purple-500/10 transition-all duration-300 relative"
          >
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br ${item.color} text-white text-xs font-bold mb-5`}>
              {item.step}
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center mb-5 mx-auto group-hover:from-violet-100 group-hover:to-fuchsia-100 transition-all duration-300">
              <item.icon className="w-5 h-5 text-brand" strokeWidth={1.8} />
            </div>
            <h3 className="font-body font-bold text-[17px] text-foreground mb-2 tracking-tight">{item.title}</h3>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
