import React from 'react';

interface VioLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

export const VioLogo: React.FC<VioLogoProps> = ({
  className = '',
  size = 'md',
  showWordmark = true,
}) => {
  const iconSizes = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8 sm:h-9 sm:w-9',
    lg: 'h-10 w-10 sm:h-12 sm:w-12',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl sm:text-3xl',
  };

  return (
    <div className={`flex items-center gap-2 select-none shrink-0 ${className}`}>
      {/* Precision Vector Vio Brand Mark (Purple-to-Orange Gradient Play Panther) */}
      <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center`}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full drop-shadow-sm transition-transform group-hover:scale-105"
        >
          <defs>
            <linearGradient id="vioGradientMain" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <linearGradient id="vioGradientInner" x1="20" y1="30" x2="80" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>

          {/* Smooth Play Outline Arrow */}
          <path
            d="M26 16C21.5 13.5 16 16.7 16 21.8V78.2C16 83.3 21.5 86.5 26 84L82 55.8C86.5 53.3 86.5 46.7 82 44.2L26 16Z"
            fill="url(#vioGradientMain)"
          />

          {/* Panther / Fast Dynamic Silhouette Interior Cutout */}
          <path
            d="M32 30C32 30 38 25 48 30C58 35 62 44 68 47C72 49 76 49 76 49C76 49 71 53 65 53C58 53 53 48 46 45C39 42 35 44 32 47V30Z"
            fill="#ffffff"
            fillOpacity="0.9"
          />

          {/* Sleek Forward Eye */}
          <circle cx="58" cy="42" r="2.5" fill="#f97316" />

          {/* Lower Dynamic Flow Cut */}
          <path
            d="M32 58C36 55 42 56 46 60C50 64 56 64 62 61L74 54L32 75V58Z"
            fill="#ffffff"
            fillOpacity="0.4"
          />
        </svg>
      </div>

      {showWordmark && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center tracking-tight">
            <span
              className={`font-black ${textSizes[size]} bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 bg-clip-text text-transparent`}
              style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
            >
              Vio
            </span>
            <span className="ml-1 text-[11px] sm:text-[13px] font-bold tracking-tight text-slate-800 dark:text-slate-100 lowercase">
              streaming
            </span>
            <span className="ml-1.5 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-red-500/10 text-red-500 dark:bg-red-950/60 dark:text-red-400">
              Live
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
