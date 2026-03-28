import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const integrations = [
  { name: "Salesforce", abbr: "SF" },
  { name: "HubSpot", abbr: "HS" },
  { name: "Pipedrive", abbr: "PD" },
  { name: "Google Cal", abbr: "GC" },
  { name: "Outlook", abbr: "OL" },
  { name: "Calendly", abbr: "CL" },
  { name: "Zoom", abbr: "ZM" },
  { name: "Meet", abbr: "GM" },
  { name: "Slack", abbr: "SL" },
  { name: "Zapier", abbr: "ZP" },
  { name: "Twilio", abbr: "TW" },
  { name: "RingCentral", abbr: "RC" },
];

const Integrations = () => (
  <section className="relative py-32 px-6 gradient-bg">
    <div className="max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-16"
      >
        <p className="font-mono text-[11px] uppercase tracking-ultra text-brand mb-4 font-medium">Integrations</p>
        <h2 className="font-display text-4xl md:text-5xl mb-5">
          Works with your{" "}
          <span className="gradient-text">existing stack</span>
        </h2>
        <p className="font-body text-muted-foreground text-lg max-w-xl mx-auto font-light">
          200+ native integrations. Connect your CRM, calendar, and phone system in one click.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3"
      >
        {integrations.map((int, i) => (
          <motion.div
            key={int.name}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.03 }}
            className="bg-white rounded-2xl p-5 border border-black/[0.04] flex flex-col items-center justify-center gap-2.5 cursor-pointer group hover:border-purple-500/15 hover:shadow-lg hover:shadow-purple-500/[0.04] transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center group-hover:from-violet-100 group-hover:to-fuchsia-100 transition-all duration-300">
              <span className="font-mono text-[11px] font-bold text-brand">{int.abbr}</span>
            </div>
            <span className="font-body text-xs text-foreground font-medium text-center">{int.name}</span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-center mt-10"
      >
        <a href="#" className="inline-flex items-center gap-1.5 font-body text-sm text-brand hover:underline transition-all duration-200 font-medium group">
          View all 200+ integrations
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
        </a>
      </motion.div>
    </div>
  </section>
);

export default Integrations;
