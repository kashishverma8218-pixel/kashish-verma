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
    <div className={`flex items-center gap-2.5 select-none shrink-0 ${className}`}>
      {/* Official Vio Brand Logo Mark */}
      <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center overflow-hidden rounded-[4px] border border-[var(--ink-faint)] bg-[#141416] shadow-xs`}>
        <img
          src="/assets/logo.png"
          alt="Vio streaming"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain p-0.5 transition-transform group-hover:scale-105"
        />
      </div>

      {showWordmark && (
        <div className="flex items-center gap-2 leading-none whitespace-nowrap">
          <span className={`font-display font-extrabold ${textSizes[size]} tracking-[-0.03em] text-[var(--accent-ink)] uppercase`}>
            VIO
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink)]/75">
            streaming
          </span>
        </div>
      )}
    </div>
  );
};
