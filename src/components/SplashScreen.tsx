import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
  minDurationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDurationMs = 1400,
}) => {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => {
        onFinish();
      }, 400); // 400ms fadeout transition
    }, minDurationMs);

    return () => clearTimeout(timer);
  }, [minDurationMs, onFinish]);

  return (
    <div
      onClick={() => {
        setFadingOut(true);
        setTimeout(onFinish, 200);
      }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F0F0F] transition-opacity duration-400 select-none cursor-pointer ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background subtle radial YouTube red ambient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[480px] h-[340px] sm:h-[480px] bg-[#FF0000]/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Main Logo Card */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="relative mb-5">
          <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-[4px] p-3 bg-[#212121] border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden">
            <img
              src="/assets/logo.png"
              alt="Vio Streaming Logo"
              className="w-full h-full object-contain filter drop-shadow-lg"
            />
          </div>
          {/* Subtle accent pulse */}
          <div className="absolute inset-0 rounded-[4px] border border-[#FF0000]/40 animate-ping opacity-25 pointer-events-none" />
        </div>

        {/* Brand Title */}
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-[-0.04em] text-[#F1F1F1] flex items-center gap-2.5 uppercase">
          <span className="text-[#FF0000]">VIO</span>
          <span className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] text-[#F1F1F1]/70 self-center">
            streaming
          </span>
        </h1>

        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#AAAAAA] max-w-xs">
          Discover, Stream & Share Worldwide
        </p>

        {/* Loading Progress Bar */}
        <div className="mt-8 w-44 h-[2px] bg-white/10 overflow-hidden">
          <div className="h-full bg-[#FF0000] animate-[progress_1.3s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-6 inset-x-0 text-center font-mono text-[10px] text-[#AAAAAA]/75 tracking-[0.18em] uppercase">
        <span>VIO STREAMING · GLOBAL VIDEO PLATFORM</span>
      </div>
    </div>
  );
};
