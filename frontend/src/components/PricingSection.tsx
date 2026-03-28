import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    monthly: 0,
    annual: 0,
    description: "For individuals testing the waters",
    features: ["50 calls/month", "1 AI voice", "Google Calendar sync", "Call recordings", "Email notifications", "Community support"],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    monthly: 79,
    annual: 59,
    description: "For growing sales teams",
    features: ["2,000 calls/month", "5 custom AI voices", "All calendar integrations", "CRM sync (HubSpot, Salesforce)", "Automated follow-ups", "Conversation intelligence", "Priority support"],
    cta: "Start 7-Day Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    monthly: 299,
    annual: 249,
    description: "For teams that need scale",
    features: ["Unlimited calls", "Unlimited custom voices", "Dedicated phone numbers", "Custom AI training", "API access", "White-label option", "SSO & audit logs", "Dedicated account manager"],
    cta: "Talk to Sales",
    highlighted: false,
  },
];

const PricingSection = () => {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative py-32 px-6 gradient-bg">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <p className="font-mono text-[11px] uppercase tracking-ultra text-brand mb-4 font-medium">Pricing</p>
          <h2 className="font-display text-4xl md:text-5xl mb-4">
            Simple, transparent{" "}
            <span className="gradient-text">pricing</span>
          </h2>
          <p className="font-body text-muted-foreground text-lg max-w-xl mx-auto font-light mb-8">
            Start free. Scale as you grow. No hidden fees.
          </p>

          <div className="inline-flex items-center bg-white border border-black/[0.06] rounded-full p-1 elevation-1">
            <button
              onClick={() => setAnnual(false)}
              className={`font-body text-sm px-5 py-2 rounded-full transition-all duration-300 font-medium ${
                !annual ? "bg-gradient-to-r from-[#7C3AED] to-[#C026D3] text-white shadow-md shadow-purple-500/20" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`font-body text-sm px-5 py-2 rounded-full transition-all duration-300 font-medium ${
                annual ? "bg-gradient-to-r from-[#7C3AED] to-[#C026D3] text-white shadow-md shadow-purple-500/20" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual <span className="text-[10px] ml-1 opacity-70">-25%</span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`bg-white rounded-2xl p-7 border relative transition-all duration-300 ${
                plan.highlighted
                  ? "border-purple-500/20 shadow-xl shadow-purple-500/[0.06] scale-[1.02]"
                  : "border-black/[0.04] hover:border-purple-500/10 hover:shadow-lg hover:shadow-purple-500/[0.03]"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="font-mono text-[10px] uppercase tracking-ultra bg-gradient-to-r from-[#7C3AED] to-[#C026D3] text-white px-4 py-1.5 rounded-full font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="font-body font-bold text-lg text-foreground mb-1 tracking-tight">{plan.name}</h3>
              <p className="font-body text-xs text-muted-foreground mb-5">{plan.description}</p>
              <div className="mb-6">
                <span className="font-display text-5xl text-foreground">
                  ${annual ? plan.annual : plan.monthly}
                </span>
                <span className="font-body text-sm text-muted-foreground ml-1">/mo</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-brand" strokeWidth={3} />
                    </div>
                    <span className="font-body text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full font-body text-sm font-semibold py-3.5 rounded-full transition-all duration-300 ${
                  plan.highlighted
                    ? "bg-gradient-to-r from-[#7C3AED] to-[#C026D3] text-white hover:shadow-lg hover:shadow-purple-500/20"
                    : "bg-foreground/[0.04] text-foreground hover:bg-foreground/[0.08]"
                }`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
