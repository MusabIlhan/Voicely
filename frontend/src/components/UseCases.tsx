import { motion } from "framer-motion";
import { Target, ScanFace, Handshake, Landmark } from "lucide-react";

const cases = [
  {
    icon: Target,
    title: "Sales Outreach",
    description: "Cold call hundreds of prospects daily. Qualify leads, handle objections, and book demos — while your team closes.",
    stat: "3x",
    statLabel: "more meetings booked",
  },
  {
    icon: ScanFace,
    title: "Recruiting",
    description: "Screen candidates with phone interviews, schedule follow-ups, and coordinate across hiring managers' calendars.",
    stat: "70%",
    statLabel: "faster time-to-hire",
  },
  {
    icon: Handshake,
    title: "Customer Success",
    description: "Proactive check-in calls, renewal reminders, and NPS surveys. Keep customers engaged without adding headcount.",
    stat: "45%",
    statLabel: "higher retention",
  },
  {
    icon: Landmark,
    title: "Real Estate",
    description: "Follow up with every inquiry, schedule viewings, and qualify buyers — 24/7, even after hours.",
    stat: "5x",
    statLabel: "more showings booked",
  },
];

const UseCases = () => (
  <section id="use-cases" className="relative py-32 px-6">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-20"
      >
        <p className="font-mono text-[11px] uppercase tracking-ultra text-brand mb-4 font-medium">Use Cases</p>
        <h2 className="font-display text-4xl md:text-5xl mb-5">
          Built for teams that{" "}
          <span className="gradient-text">move fast</span>
        </h2>
        <p className="font-body text-muted-foreground text-lg max-w-xl mx-auto font-light">
          From sales to recruiting to customer success — Voicely adapts to your workflow.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {cases.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-2xl p-7 border border-black/[0.04] flex gap-6 group cursor-pointer hover:border-purple-500/15 hover:shadow-xl hover:shadow-purple-500/[0.04] transition-all duration-300"
          >
            <div className="flex-shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center group-hover:from-violet-100 group-hover:to-fuchsia-100 transition-all duration-300">
                <c.icon className="w-5 h-5 text-brand" strokeWidth={1.8} />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-body font-bold text-[17px] text-foreground mb-2 tracking-tight">{c.title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">{c.description}</p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl gradient-text">{c.stat}</span>
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{c.statLabel}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default UseCases;
