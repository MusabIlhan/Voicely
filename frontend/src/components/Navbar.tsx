import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AudioWaveform } from "lucide-react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Use Cases", href: "#use-cases" },
  { label: "Pricing", href: "#pricing" },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 transition-all duration-500 ${
        scrolled ? "glass elevation-1" : ""
      }`}
    >
      <a href="#" className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#C026D3] flex items-center justify-center">
          <AudioWaveform className="w-4 h-4 text-white" strokeWidth={2.2} />
        </div>
        <span className="font-display text-lg text-foreground">
          voice<span className="gradient-text">ly</span>
        </span>
      </a>

      <div className="hidden md:flex items-center gap-10">
        {navLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="font-body text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium"
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <a
          href="#pricing"
          className="hidden sm:inline-flex font-body text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          Log in
        </a>
        <a
          href="#pricing"
          className="font-body text-[13px] font-semibold bg-gradient-to-r from-[#7C3AED] to-[#C026D3] text-white px-5 py-2.5 rounded-full hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300"
        >
          Get Started
        </a>
      </div>
    </motion.nav>
  );
};

export default Navbar;
