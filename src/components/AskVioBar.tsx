import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setResponse(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

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
      {/* Variation 2 Floating AI Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 hidden xl:block">
        <div className="flex items-center gap-3.5 px-5 py-3 bg-[#212121] text-white rounded-[8px] border border-[#FF0000] shadow-[0_20px_40px_rgba(0,0,0,0.5)] w-[400px] transition-all">
          <Sparkles className="h-4 w-4 text-[#FF0000] shrink-0" />

          <input
            type="text"
            placeholder="Ask Vio AI or search..."
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAsk();
            }}
            className="w-full text-[13px] bg-transparent text-white placeholder:text-white/50 focus:outline-none truncate"
          />

          {query ? (
            <button
              onClick={() => handleAsk()}
              title="Submit AI Query"
              className="p-1.5 rounded-[4px] bg-[#FF0000] text-white hover:bg-[#CC0000] transition-colors shrink-0"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setIsOpen(!isOpen)}
              title="Quick Suggestions"
              className="text-white/50 hover:text-white p-1 shrink-0"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Q&A Dropdown / Modal when opened */}
      {isOpen && (
        <div
          onClick={() => {
            setIsOpen(false);
            setResponse(null);
          }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] text-[var(--ink)] shadow-2xl p-4 text-xs animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-[var(--ink-faint)]">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-[#FF0000] text-white flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="font-bold text-[var(--ink)]">Ask Vio streaming AI</span>
                <span className="rounded-full bg-[#FF0000]/15 text-[#FF0000] text-[10px] font-semibold px-2 py-0.5">
                  Floating Q&A
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setResponse(null);
                }}
                aria-label="Close Ask Vio AI"
                className="p-1.5 rounded-full text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Response Section */}
            {isAsking && (
              <div className="my-4 p-3 rounded-xl bg-[var(--bg)] border border-[var(--ink-faint)] flex items-center gap-2 text-[var(--ink)]">
                <Sparkles className="h-4 w-4 animate-spin text-[#FF0000] shrink-0" />
                <span>Vio streaming AI is analyzing the knowledge base...</span>
              </div>
            )}

            {response && (
              <div className="my-3 p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--ink-faint)] text-[var(--ink)] leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-[#FF0000] mb-1 text-[11px]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Answer from Vio streaming AI:</span>
                </div>
                <p>{response}</p>
              </div>
            )}

            {/* Quick Questions */}
            <div className="mt-3">
              <p className="text-[11px] font-bold text-[var(--ink-medium)] uppercase tracking-wider mb-2">
                Suggested Questions
              </p>
              <div className="space-y-1.5">
                {QUICK_QUESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuery(item.q);
                      handleAsk(item.q);
                    }}
                    className="flex w-full items-center justify-between p-2 rounded-xl text-left hover:bg-[var(--card-hover)] text-[var(--ink)] transition-colors group cursor-pointer"
                  >
                    <span className="truncate pr-2">{item.q}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--ink-medium)] group-hover:text-[#FF0000] shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[var(--ink-faint)] flex items-center justify-between text-[11px] text-[var(--ink-medium)]">
              <span>Ask anything about video playback, revenue splits, or studio</span>
              <button
                type="button"
                onClick={() => {
                  if (query) onSearch(query);
                  setIsOpen(false);
                }}
                className="font-bold text-[#FF0000] hover:underline cursor-pointer"
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
