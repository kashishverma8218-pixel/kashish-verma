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
      {/* User-submitted Vio Brand Logo Mark */}
      <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center overflow-hidden rounded-xl bg-slate-900/10 dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10 shadow-xs`}>
        <img
          src="/assets/logo.png"
          alt="Vio streaming"
          className="h-full w-full object-contain p-0.5 transition-transform group-hover:scale-105"
        />
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
