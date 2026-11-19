import React from 'react';

interface VioLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

export const VioLogo: React.FC<VioLogoProps> = ({
  className = '',
  size = 'md',
  showWordmark = false,
}) => {
  const iconSizes = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9 sm:h-10 sm:w-10',
    lg: 'h-12 w-12 sm:h-14 sm:w-14',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl sm:text-3xl',
  };

  return (
    <div className={`flex items-center gap-2 select-none shrink-0 ${className}`}>
      {/* Official Vio Brand Logo Mark (unboxed clean logo) */}
      <img
        src="/assets/logo.png"
        alt="Vio"
        referrerPolicy="no-referrer"
        className={`${iconSizes[size]} shrink-0 object-contain transition-transform group-hover:scale-105`}
      />

      {showWordmark && (
        <div className="flex items-center gap-1.5 sm:gap-2 leading-none whitespace-nowrap">
          <span className={`font-display font-extrabold ${textSizes[size]} tracking-[-0.03em] text-[#CC0000] dark:text-[#FF4E45] uppercase`}>
            VIO
          </span>
          <span className="hidden min-[360px]:inline font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-[var(--ink)]/80">
            streaming
          </span>
        </div>
      )}
    </div>
  );
};
