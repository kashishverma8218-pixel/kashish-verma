import React, { useState } from 'react';
import { Sparkles, ArrowRight, X, Search, HelpCircle, Film, DollarSign, Wand2 } from 'lucide-react';

interface AskVioBarProps {
  onSearch: (query: string) => void;
  onOpenStudio?: () => void;
  onOpenReels?: () => void;
}

export const AskVioBar: React.FC<AskVioBarProps> = ({ onSearch, onOpenStudio, onOpenReels }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const QUICK_QUESTIONS = [
    { q: 'How does 30/70 revenue sharing work?', type: 'monetization' },
    { q: 'Show trending 4K Blender animations', type: 'search' },
    { q: 'How to use AI Video Studio editor?', type: 'studio' },
    { q: 'Explore Shorts Series playlists', type: 'reels' },
  ];

  const handleAsk = (textToAsk?: string) => {
    const q = (textToAsk || query).trim();
    if (!q) return;

    setIsAsking(true);
    setResponse(null);

    setTimeout(() => {
      setIsAsking(false);
      const lower = q.toLowerCase();
      if (lower.includes('revenue') || lower.includes('split') || lower.includes('30') || lower.includes('70')) {
        setResponse(
          'Vio streaming implements an official revenue split: 30% goes directly to the creator, and 70% goes to the platform owner. Check the "Monetization" tab in Creator Studio for real-time earnings!'
        );
      } else if (lower.includes('studio') || lower.includes('edit') || lower.includes('ai')) {
        setResponse(
          'Vio streaming AI Video Studio includes 40x40px quick-action tools for Auto-Cut, AI Subtitles, Cinematic LUT color grading, Voice Clarity, and 9:16 Shorts reformatting.'
        );
      } else if (lower.includes('short') || lower.includes('series') || lower.includes('reels')) {
        setResponse(
          'Vio streaming Shorts Series groups vertical reels into curated episodic playlists with 150x150px previews. Open the Reels tab to binge entire series!'
        );
      } else {
        setResponse(
          `Searching Vio streaming catalog for "${q}". Found matching 4K master films, creator tutorials, and high-definition reels.`
        );
        onSearch(q);
      }
    }, 400);
  };

  return (
    <>
      {/* Exact 300x50 pixels floating search / Q&A bar placed top center */}
      <div className="fixed top-2.5 left-1/2 -translate-x-1/2 z-40 hidden md:block">
        <div
          style={{ width: '300px', height: '50px' }}
          className="flex items-center px-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-purple-500/30 dark:border-purple-500/40 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 transition-all group"
        >
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 text-white shrink-0 mr-2 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          </div>

          <input
            type="text"
            placeholder="Ask Vio streaming AI or search..."
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAsk();
            }}
            className="w-full text-xs bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none truncate"
          />

          {query ? (
            <button
              onClick={() => handleAsk()}
              title="Submit AI Query"
              className="p-1 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shrink-0"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setIsOpen(!isOpen)}
              title="Quick Suggestions"
              className="text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 p-1 shrink-0"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Q&A Dropdown / Modal when opened */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-4 text-xs animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="font-bold text-slate-900 dark:text-white">Ask Vio streaming AI</span>
                <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-semibold px-2 py-0.5">
                  Floating Q&A
                </span>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setResponse(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Response Section */}
            {isAsking && (
              <div className="my-4 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-800/50 flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <Sparkles className="h-4 w-4 animate-spin text-purple-600 shrink-0" />
                <span>Vio streaming AI is analyzing the knowledge base...</span>
              </div>
            )}

            {response && (
              <div className="my-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-purple-500/20 text-slate-800 dark:text-slate-200 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400 mb-1 text-[11px]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Answer from Vio streaming AI:</span>
                </div>
                <p>{response}</p>
              </div>
            )}

            {/* Quick Questions */}
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Suggested Questions
              </p>
              <div className="space-y-1.5">
                {QUICK_QUESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(item.q);
                      handleAsk(item.q);
                    }}
                    className="flex w-full items-center justify-between p-2 rounded-xl text-left hover:bg-purple-50 dark:hover:bg-purple-950/30 text-slate-700 dark:text-slate-300 transition-colors group"
                  >
                    <span className="truncate pr-2">{item.q}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-purple-500 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Ask anything about video playback, revenue splits, or studio</span>
              <button
                onClick={() => {
                  if (query) onSearch(query);
                  setIsOpen(false);
                }}
                className="font-bold text-purple-600 dark:text-purple-400 hover:underline"
              >
                Search catalog
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
