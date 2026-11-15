import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
  minDurationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDurationMs = 750,
}) => {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => {
        onFinish();
      }, 300);
    }, minDurationMs);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFadingOut(true);
        setTimeout(onFinish, 150);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [minDurationMs, onFinish]);

  return (
    <div
      onClick={() => {
        setFadingOut(true);
        setTimeout(onFinish, 180);
      }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F0F0F] transition-opacity duration-300 select-none cursor-pointer ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background subtle radial YouTube red ambient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[440px] h-[320px] sm:h-[440px] bg-[#FF0000]/10 rounded-full blur-3xl" />
      </div>

      {/* Main Logo Card */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 animate-in fade-in zoom-in-95 duration-400">
        <div className="relative mb-5">
          <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-3xl p-3 bg-[#181818] border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden">
            <img
              src="/assets/logo.png"
              alt="Vio Streaming Logo"
              className="w-full h-full object-contain filter drop-shadow-lg"
            />
          </div>
        </div>

        {/* Brand Title */}
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-[-0.04em] text-[#F1F1F1] flex items-center gap-2.5 uppercase">
          <span className="text-[#FF0000]">VIO</span>
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-[#F1F1F1]/75 self-center">
            streaming
          </span>
        </h1>

        <p className="mt-2 text-xs text-[#AAAAAA] max-w-xs">
          Discover, Stream & Share Worldwide
        </p>

        {/* Loading Progress Bar */}
        <div className="mt-7 w-40 h-0.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-[#FF0000] animate-[progress_1s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-6 inset-x-0 text-center text-[11px] text-[#AAAAAA]/70 tracking-widest uppercase">
        <span>Vio streaming · Click anywhere to enter</span>
      </div>
    </div>
  );
};
