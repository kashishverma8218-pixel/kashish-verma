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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-400 select-none cursor-pointer ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background ambient gradient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[480px] h-[340px] sm:h-[480px] bg-gradient-to-tr from-purple-600/25 via-pink-600/20 to-orange-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Main Logo Card */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="relative mb-5">
          <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-3xl p-2 bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl flex items-center justify-center overflow-hidden ring-1 ring-white/20">
            <img
              src="/assets/logo.png"
              alt="Vio Streaming Logo"
              className="w-full h-full object-contain filter drop-shadow-lg"
            />
          </div>
          {/* Subtle glowing ring pulse */}
          <div className="absolute inset-0 rounded-3xl border border-orange-500/40 animate-ping opacity-25 pointer-events-none" />
        </div>

        {/* Brand Title */}
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <span>Vio</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500 text-lg sm:text-xl font-bold lowercase tracking-tight self-end pb-0.5">
            streaming
          </span>
        </h1>

        <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-400 max-w-xs">
          Discover, Stream & Share Worldwide
        </p>

        {/* Loading Progress Bar */}
        <div className="mt-8 w-44 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full animate-[progress_1.3s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-6 inset-x-0 text-center text-[11px] text-slate-500 tracking-wider">
        <span>VIO STREAMING • GLOBAL VIDEO PLATFORM</span>
      </div>
    </div>
  );
};
