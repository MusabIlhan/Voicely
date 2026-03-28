const NeuralLines = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Violet orb - top right */}
      <div
        className="absolute -top-[20%] -right-[10%] w-[700px] h-[700px] rounded-full opacity-40"
        style={{
          background: "radial-gradient(circle, rgba(124,58,237,0.1) 0%, rgba(192,38,211,0.04) 50%, transparent 70%)",
        }}
      />

      {/* Fuchsia orb - bottom left */}
      <div
        className="absolute -bottom-[10%] -left-[10%] w-[500px] h-[500px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(192,38,211,0.08) 0%, rgba(225,29,128,0.03) 50%, transparent 70%)",
          animation: "breathing 6s ease-in-out infinite",
        }}
      />

      {/* Precision lines */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="line-h" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="30%" stopColor="rgba(124,58,237,0.05)" />
            <stop offset="70%" stopColor="rgba(192,38,211,0.05)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="line-v" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="30%" stopColor="rgba(124,58,237,0.03)" />
            <stop offset="70%" stopColor="rgba(192,38,211,0.03)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <line x1="0" y1="33%" x2="100%" y2="33%" stroke="url(#line-h)" strokeWidth="1" />
        <line x1="0" y1="66%" x2="100%" y2="66%" stroke="url(#line-h)" strokeWidth="1" />
        <line x1="33%" y1="0" x2="33%" y2="100%" stroke="url(#line-v)" strokeWidth="1" />
        <line x1="66%" y1="0" x2="66%" y2="100%" stroke="url(#line-v)" strokeWidth="1" />
      </svg>
    </div>
  );
};

export default NeuralLines;
