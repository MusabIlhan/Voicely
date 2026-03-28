import { motion } from "framer-motion";

const logos = [
  "Salesforce", "HubSpot", "Stripe", "Notion", "Slack",
  "Calendly", "Zoom", "Intercom",
];

const LogoBar = () => (
  <section className="relative py-14 px-6 border-y border-black/[0.04]">
    <div className="max-w-6xl mx-auto">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="font-body text-xs uppercase tracking-ultra text-muted-foreground/60 text-center mb-10 font-medium"
      >
        Trusted by 10,000+ sales teams worldwide
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="flex flex-wrap items-center justify-center gap-x-14 gap-y-6"
      >
        {logos.map((logo, i) => (
          <motion.span
            key={logo}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="font-display text-base text-foreground/20 hover:text-foreground/40 transition-colors duration-300 cursor-default select-none"
          >
            {logo}
          </motion.span>
        ))}
      </motion.div>
    </div>
  </section>
);

export default LogoBar;
