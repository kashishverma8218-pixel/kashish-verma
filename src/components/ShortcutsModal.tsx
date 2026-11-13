import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space / K', desc: 'Toggle Play / Pause' },
    { key: '← / →', desc: 'Seek 5 seconds backward / forward' },
    { key: 'J / L', desc: 'Seek 10 seconds backward / forward' },
    { key: '↑ / ↓', desc: 'Increase / decrease volume by 5%' },
    { key: 'M', desc: 'Mute / Unmute audio' },
    { key: 'C', desc: 'Toggle Subtitles / Captions' },
    { key: 'F', desc: 'Toggle Fullscreen mode' },
    { key: 'P', desc: 'Toggle Picture-in-Picture window' },
    { key: 'S', desc: 'Capture high-res frame snapshot (PNG)' },
    { key: 'B', desc: 'Add bookmark timestamp with note' },
    { key: '0 – 9', desc: 'Seek to 0% through 90% of duration' },
    { key: 'Double Click', desc: 'Double click video to fullscreen (or left/right to seek)' },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-colors dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
              <Keyboard className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Keyboard Shortcuts Cheat Sheet
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
          {shortcuts.map((sc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50"
            >
              <span className="text-xs text-slate-600 dark:text-slate-300 pr-2">
                {sc.desc}
              </span>
              <kbd className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-mono font-semibold text-slate-800 shadow-2xs shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
