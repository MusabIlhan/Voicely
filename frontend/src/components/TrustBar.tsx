import { motion } from "framer-motion";
import { ShieldCheck, KeyRound, Fingerprint } from "lucide-react";

const badges = [
  { icon: ShieldCheck, label: "SOC 2 Type II", desc: "Certified" },
  { icon: KeyRound, label: "GDPR", desc: "Compliant" },
  { icon: Fingerprint, label: "HIPAA", desc: "Compliant" },
];

const TrustBar = () => (
  <section className="relative py-16 px-6 border-t border-black/[0.04]">
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-16"
      >
        {badges.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center">
              <b.icon className="w-5 h-5 text-brand" strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-body text-sm font-semibold text-foreground tracking-tight">{b.label}</p>
              <p className="font-body text-xs text-muted-foreground">{b.desc}</p>
            </div>
          </div>
        ))}
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="font-body text-xs text-muted-foreground/60 text-center mt-8"
      >
        All calls are encrypted end-to-end. Your data never leaves your control.
      </motion.p>
    </div>
  </section>
);

export default TrustBar;
