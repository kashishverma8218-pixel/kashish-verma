import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Play,
  Search,
  Check,
  Copy,
  Film,
  TrendingUp,
  DollarSign,
  Tag,
  Eye,
  Clock
} from 'lucide-react';
import { VideoItem, Channel } from '../types/video';

interface AIAssistantButtonProps {
  currentVideoTitle?: string;
  videos?: VideoItem[];
  channels?: Record<string, Channel>;
  onPlayVideo?: (video: VideoItem) => void;
  onSelectChannel?: (channelId: string) => void;
  onOpenSearch?: (query: string) => void;
  onNavigateStudio?: () => void;
}

interface Message {
  role: 'assistant' | 'user';
  content: string;
  actions?: string[];
  matchedVideos?: VideoItem[];
}

export const AIAssistantButton: React.FC<AIAssistantButtonProps> = ({
  currentVideoTitle,
  videos = [],
  channels = {},
  onPlayVideo,
  onSelectChannel,
  onOpenSearch,
  onNavigateStudio,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        '👋 Welcome to Vio AI! I can search our global 4K video catalog, find clips by topic or creator, play videos directly, generate viral metadata, and calculate your 30% creator earnings. How can I assist you?',
      actions: [
        'Search 4K Films',
        'Play Tears of Steel',
        'Explore Blender 3D',
        'Calculate 30% Split',
      ],
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || prompt).trim();
    if (!text) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');
    setLoading(true);

    setTimeout(() => {
      const lower = text.toLowerCase();
      let reply = '';
      let matchedVideos: VideoItem[] = [];

      // Check if this is a search or media query
      const isSearchOrMedia =
        lower.includes('search') ||
        lower.includes('find') ||
        lower.includes('play') ||
        lower.includes('watch') ||
        lower.includes('show') ||
        lower.includes('video') ||
        lower.includes('film') ||
        lower.includes('reel') ||
        lower.includes('blender') ||
        lower.includes('steel') ||
        lower.includes('bunny') ||
        lower.includes('sintel') ||
        lower.includes('scifi') ||
        lower.includes('sci-fi') ||
        lower.includes('cgi') ||
        lower.includes('4k') ||
        lower.includes('movie');

      if (isSearchOrMedia && videos.length > 0) {
        // Extract keywords from prompt
        const cleanQuery = lower
          .replace(/^(search|find|play|watch|show|give me|look for|any|videos? about|movies? about|clips? about)\s+/i, '')
          .trim();

        // Search in videos list
        matchedVideos = videos.filter((v) => {
          const title = v.title.toLowerCase();
          const desc = v.description.toLowerCase();
          const cat = v.category.toLowerCase();
          const tags = v.tags.map((t) => t.toLowerCase()).join(' ');
          const chName = (channels[v.channelId]?.name || '').toLowerCase();

          if (cleanQuery) {
            const queryWords = cleanQuery.split(/\s+/).filter((w) => w.length > 2);
            if (queryWords.length > 0) {
              return queryWords.some(
                (w) =>
                  title.includes(w) ||
                  desc.includes(w) ||
                  cat.includes(w) ||
                  tags.includes(w) ||
                  chName.includes(w)
              );
            }
          }

          return (
            title.includes('blender') ||
            title.includes('tears') ||
            title.includes('bunny') ||
            v.isTrending
          );
        });

        // Limit to top 3 relevant videos
        matchedVideos = matchedVideos.slice(0, 3);

        if (matchedVideos.length > 0) {
          reply = `Found ${matchedVideos.length} matching video${matchedVideos.length > 1 ? 's' : ''} on Vio streaming. Tap below to stream instantly:`;
        } else {
          reply = `I searched for "${cleanQuery || text}", but couldn't find an exact match in the current catalog. Here are trending high-definition picks instead:`;
          matchedVideos = videos.slice(0, 2);
        }
      } else if (lower.includes('title') || lower.includes('viral')) {
        reply = `Here are 3 high-CTR titles tailored for Vio streaming:\n1. 🚀 "The Secret Behind ${currentVideoTitle || 'Photorealistic 3D'}: Full Breakdown"\n2. 🔥 "Why Every 3D Animator Is Talking About This Technique"\n3. ⚡ "Creating Cinema-Grade CGI on a Budget (Step-by-Step)"`;
      } else if (lower.includes('tag')) {
        reply = `Top recommended tags for maximum reach:\n#Blender3D #CGI #VisualEffects #FilmMaking #OpenSource #4KUpscale #VioStreaming`;
      } else if (
        lower.includes('30%') ||
        lower.includes('split') ||
        lower.includes('revenue') ||
        lower.includes('monetization') ||
        lower.includes('earn')
      ) {
        reply = `Vio streaming operates on a transparent revenue model: 30% goes to you (the creator) and 70% to the platform. For example, on $1,000 in gross revenue, you earn $300 immediately. You can track this under Creator Studio > Monetization.`;
      } else if (lower.includes('reel') || lower.includes('short') || lower.includes('growth')) {
        reply = `Shorts Growth Tip: Keep the first 3 seconds visually dynamic, add auto-captions via Vio streaming Studio, and group your shorts into a Shorts Series playlist to increase binge-watching!`;
      } else {
        reply = `I analyzed your request about "${text}". Pro tip: Videos with custom thumbnails and 9:16 Shorts Series companion clips see a 42% lift in follower conversions on Vio streaming!`;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: reply,
          matchedVideos: matchedVideos.length > 0 ? matchedVideos : undefined,
          actions:
            matchedVideos.length > 0
              ? ['Generate Viral Titles', 'Calculate 30% Split', 'More Sci-Fi Films']
              : ['Search 4K Films', 'Extract Video Tags', 'Calculate 30% Split'],
        },
      ]);
      setLoading(false);
    }, 450);
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <>
      {/* 
        Exact dimensions: 48x48 pixels (w-12 h-12 = 48x48px)
        Placed bottom right with floating shadow
      */}
      <button
        onClick={() => setIsOpen(true)}
        title="Open Vio streaming AI Assistant"
        aria-label="Vio streaming AI Assistant"
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 w-12 h-12 rounded-full shadow-2xl shadow-purple-600/40 flex items-center justify-center bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white hover:scale-110 active:scale-95 transition-all cursor-pointer ring-2 ring-white/20 dark:ring-white/10 group"
      >
        <Sparkles className="h-5 w-5 animate-pulse group-hover:rotate-12 transition-transform" />
      </button>

      {/* Assistant Modal / Sliding Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end p-0 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full sm:w-[440px] max-h-[85vh] sm:max-h-[660px] rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-600/10 via-pink-600/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Vio streaming AI Assistant
                    <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 text-[10px] px-2 py-0.2 font-semibold">
                      Search & Pro
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">Media Discovery & Creator Intelligence</p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    m.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl p-3 leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/50'
                    }`}
                  >
                    <p>{m.content}</p>

                    {/* Matched Video Cards for Media Queries */}
                    {m.matchedVideos && m.matchedVideos.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {m.matchedVideos.map((vid) => {
                          const channel = channels[vid.channelId];
                          return (
                            <div
                              key={vid.id}
                              className="group/card flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xs hover:border-purple-500 transition-all"
                            >
                              <div className="relative w-20 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-950">
                                <img
                                  src={vid.poster}
                                  alt={vid.title}
                                  className="w-full h-full object-cover group-hover/card:scale-105 transition-transform"
                                />
                                <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[9px] font-bold text-white">
                                  {vid.duration}
                                </span>
                              </div>

                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-slate-900 dark:text-white truncate text-[11px] leading-tight">
                                  {vid.title}
                                </h4>
                                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                  {channel?.name || 'Vio Creator'} • {vid.views.toLocaleString()} views
                                </p>
                              </div>

                              <button
                                onClick={() => {
                                  if (onPlayVideo) {
                                    onPlayVideo(vid);
                                    setIsOpen(false);
                                  }
                                }}
                                title="Play now"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold shrink-0 transition-colors shadow-xs"
                              >
                                <Play className="h-3 w-3 fill-current" />
                                <span>Play</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {m.role === 'assistant' && (
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => handleCopy(m.content, idx)}
                          title="Copy response"
                          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-500" />
                              <span className="text-emerald-500 font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Suggested Action Chips */}
                  {m.actions && (
                    <div className="mt-2 flex flex-wrap gap-1.5 max-w-[92%]">
                      {m.actions.map((act, aIdx) => (
                        <button
                          key={aIdx}
                          onClick={() => handleSend(act)}
                          className="rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                        >
                          {act}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-slate-400 italic text-[11px] p-2">
                  <Sparkles className="h-3.5 w-3.5 animate-spin text-purple-500" />
                  <span>Vio AI is parsing media query...</span>
                </div>
              )}
            </div>

            {/* Input Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Search video clips, ask titles, tags, or revenue..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-purple-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!prompt.trim() || loading}
                  className="h-8 w-8 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-center disabled:opacity-50 hover:brightness-110 transition-all shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
