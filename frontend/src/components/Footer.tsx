import { ArrowRight, AudioWaveform } from "lucide-react";

const footerLinks = {
  Product: ["Features", "Pricing", "Integrations", "API", "Changelog"],
  "Use Cases": ["Sales", "Recruiting", "Customer Success", "Real Estate"],
  Resources: ["Documentation", "Blog", "Status", "Security"],
  Company: ["About", "Careers", "Contact", "Press"],
};

const Footer = () => (
  <footer id="contact" className="relative border-t border-black/[0.04] pt-8 pb-16 px-6">
    {/* CTA banner */}
    <div className="max-w-5xl mx-auto mb-16">
      <div className="relative overflow-hidden rounded-3xl p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-8"
        style={{
          background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 40%, #C026D3 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10">
          <h3 className="font-display text-2xl md:text-3xl text-white mb-2">Ready to automate your outreach?</h3>
          <p className="font-body text-sm text-white/70">Start your free 7-day trial. No credit card required.</p>
        </div>
        <a
          href="#pricing"
          className="relative z-10 font-body text-sm font-semibold bg-white text-foreground px-8 py-3.5 rounded-full hover:shadow-xl hover:shadow-black/10 transition-all duration-300 flex items-center gap-2 flex-shrink-0 group"
        >
          Get Started
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
        </a>
      </div>
    </div>

    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-12">
        {/* Logo + tagline */}
        <div className="md:col-span-2">
          <span className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#C026D3] flex items-center justify-center">
              <AudioWaveform className="w-4 h-4 text-white" strokeWidth={2.2} />
            </div>
            <span className="font-display text-lg text-foreground">
              voice<span className="gradient-text">ly</span>
            </span>
          </span>
          <p className="font-body text-sm text-muted-foreground font-light leading-relaxed mb-6">
            The AI calling assistant that books meetings, qualifies leads, and follows up — while you sleep.
          </p>
          <div className="flex gap-2">
            {["X", "Li", "Gh"].map((s) => (
              <div
                key={s}
                className="w-8 h-8 rounded-lg bg-foreground/[0.04] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08] transition-all duration-200 cursor-pointer"
              >
                <span className="font-body text-xs font-medium">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {Object.entries(footerLinks).map(([title, links]) => (
          <div key={title}>
            <h4 className="font-body text-xs uppercase tracking-ultra text-foreground mb-5 font-semibold">{title}</h4>
            <ul className="space-y-3">
              {links.map((link) => (
                <li key={link}>
                  <a href="#" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-14 pt-7 border-t border-black/[0.04] flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-body text-xs text-muted-foreground/60">&copy; 2026 Voicely. All rights reserved.</p>
        <div className="flex gap-6">
          {["Privacy", "Terms", "Cookies", "Security"].map((link) => (
            <a key={link} href="#" className="font-body text-xs text-muted-foreground/60 hover:text-foreground transition-colors duration-200">
              {link}
            </a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
