import { motion } from "framer-motion";
import { AudioLines, CalendarClock, BrainCircuit, Activity, Radar, Languages } from "lucide-react";

const features = [
  {
    icon: AudioLines,
    title: "Autonomous Calling",
    description: "AI voice agent makes outbound calls, handles objections, and sounds indistinguishable from a human SDR.",
  },
  {
    icon: CalendarClock,
    title: "Smart Scheduling",
    description: "Books meetings on your calendar, handles rescheduling, sends confirmations and reminders — all automatic.",
  },
  {
    icon: BrainCircuit,
    title: "Agentic Follow-ups",
    description: "Proactively follows up with leads via calls, SMS, and email based on conversation context and buying signals.",
  },
  {
    icon: Activity,
    title: "Conversation Intelligence",
    description: "Real-time dashboards with call outcomes, conversion rates, sentiment analysis, and performance metrics.",
  },
  {
    icon: Radar,
    title: "Live Transcription",
    description: "Every call recorded, transcribed with 99% accuracy, and fully searchable. Never miss a detail.",
  },
  {
    icon: Languages,
    title: "30+ Languages",
    description: "Native-level fluency in 30+ languages. Auto-detects and switches mid-conversation seamlessly.",
  },
];

const FeaturesGrid = () => (
  <section id="features" className="relative py-32 px-6">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-20"
      >
        <p className="font-mono text-[11px] uppercase tracking-ultra text-brand mb-4 font-medium">Capabilities</p>
        <h2 className="font-display text-4xl md:text-5xl mb-5">
          Everything your team{" "}
          <span className="gradient-text">needs</span>
        </h2>
        <p className="font-body text-muted-foreground text-lg max-w-xl mx-auto font-light">
          One AI agent that handles the entire outreach pipeline — from first call to booked meeting.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-2xl p-7 border border-black/[0.04] group cursor-pointer hover:border-purple-500/15 hover:shadow-xl hover:shadow-purple-500/[0.04] transition-all duration-300"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center mb-5 group-hover:from-violet-100 group-hover:to-fuchsia-100 transition-all duration-300">
              <feature.icon className="w-5 h-5 text-brand" strokeWidth={1.8} />
            </div>
            <h3 className="font-body font-bold text-[17px] text-foreground mb-2 tracking-tight">{feature.title}</h3>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesGrid;
