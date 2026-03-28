import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface SatelliteCardProps {
  icon: LucideIcon;
  label: string;
  className?: string;
  delay?: number;
}

const SatelliteCard = ({ icon: Icon, label, className = "", delay = 0 }: SatelliteCardProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.8, delay, ease: [0.4, 0, 0.2, 1] }}
    className={`absolute glass rounded-[20px] overflow-hidden cursor-pointer group ${className}`}
    style={{ animation: `float ${4 + delay}s ease-in-out infinite`, animationDelay: `${delay}s` }}
  >
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-3 p-4">
      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors duration-300">
        <Icon className="w-5 h-5 text-blue-brand" strokeWidth={1.5} />
      </div>
      <span className="font-body text-[10px] uppercase tracking-ultra text-blue-light">{label}</span>
    </div>
  </motion.div>
);

export default SatelliteCard;
