import React, { useReducer, useEffect, useRef } from 'react';
import {
  Upload,
  Pause,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Lock,
  Globe,
  EyeOff,
  Bell,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  FileVideo,
  X
} from 'lucide-react';

export type VideoVisibility = 'public' | 'unlisted' | 'private';

export interface UploadProgressState {
  percentage: number;
  status: 'idle' | 'uploading' | 'paused' | 'processing' | 'completed' | 'error';
  speed: string;
  etaSeconds: number;
  bytesUploaded: string;
  totalBytes: string;
  errorMessage?: string;
}

export interface TitleState {
  value: string;
  error: string | null;
  maxLength: number;
}

export interface PrivacyState {
  visibility: VideoVisibility;
  notifyFollowers: boolean;
  allowComments: boolean;
  ageRestricted: boolean;
}

export interface UploadManagerUnifiedState {
  progress: UploadProgressState;
  title: TitleState;
  privacy: PrivacyState;
}

export type UploadManagerAction =
  | { type: 'SET_TITLE'; payload: string }
  | { type: 'AUTO_FORMAT_TITLE'; payload: string }
  | { type: 'SET_TITLE_ERROR'; payload: string | null }
  | { type: 'SET_VISIBILITY'; payload: VideoVisibility }
  | { type: 'TOGGLE_NOTIFY_FOLLOWERS' }
  | { type: 'TOGGLE_COMMENTS' }
  | { type: 'TOGGLE_AGE_RESTRICTED' }
  | { type: 'START_UPLOAD'; payload?: { totalBytes?: string; speed?: string } }
  | { type: 'UPDATE_PROGRESS'; payload: { percentage: number; bytesUploaded?: string; etaSeconds?: number; speed?: string } }
  | { type: 'PAUSE_UPLOAD' }
  | { type: 'RESUME_UPLOAD' }
  | { type: 'SET_PROCESSING' }
  | { type: 'COMPLETE_UPLOAD' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'RESET_ALL' };

export const initialUploadState: UploadManagerUnifiedState = {
  progress: {
    percentage: 0,
    status: 'idle',
    speed: '14.8 MB/s',
    etaSeconds: 8,
    bytesUploaded: '0 MB',
    totalBytes: '124.6 MB',
  },
  title: {
    value: '',
    error: null,
    maxLength: 100,
  },
  privacy: {
    visibility: 'public',
    notifyFollowers: true,
    allowComments: true,
    ageRestricted: false,
  },
};

export function cleanRawFilename(filename: string): string {
  if (!filename) return '';
  // Remove video extensions (.mp4, .mov, etc.)
  let cleaned = filename.replace(/\.(mp4|mov|webm|mkv|avi|flv)$/i, '');
  // Replace underscores, hyphens, and multiple spaces
  cleaned = cleaned.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Capitalize words
  return cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function uploadReducer(
  state: UploadManagerUnifiedState,
  action: UploadManagerAction
): UploadManagerUnifiedState {
  switch (action.type) {
    case 'SET_TITLE': {
      const val = action.payload;
      const exceeds = val.length > state.title.maxLength;
      return {
        ...state,
        title: {
          ...state.title,
          value: val,
          error: exceeds
            ? `Title cannot exceed ${state.title.maxLength} characters`
            : null,
        },
      };
    }

    case 'AUTO_FORMAT_TITLE': {
      const formatted = cleanRawFilename(action.payload);
      return {
        ...state,
        title: {
          ...state.title,
          value: formatted,
          error: null,
        },
      };
    }

    case 'SET_TITLE_ERROR':
      return {
        ...state,
        title: {
          ...state.title,
          error: action.payload,
        },
      };

    case 'SET_VISIBILITY':
      return {
        ...state,
        privacy: {
          ...state.privacy,
          visibility: action.payload,
        },
      };

    case 'TOGGLE_NOTIFY_FOLLOWERS':
      return {
        ...state,
        privacy: {
          ...state.privacy,
          notifyFollowers: !state.privacy.notifyFollowers,
        },
      };

    case 'TOGGLE_COMMENTS':
      return {
        ...state,
        privacy: {
          ...state.privacy,
          allowComments: !state.privacy.allowComments,
        },
      };

    case 'TOGGLE_AGE_RESTRICTED':
      return {
        ...state,
        privacy: {
          ...state.privacy,
          ageRestricted: !state.privacy.ageRestricted,
        },
      };

    case 'START_UPLOAD':
      return {
        ...state,
        progress: {
          ...state.progress,
          percentage: 1,
          status: 'uploading',
          totalBytes: action.payload?.totalBytes || state.progress.totalBytes,
          speed: action.payload?.speed || '14.8 MB/s',
          errorMessage: undefined,
        },
      };

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        progress: {
          ...state.progress,
          percentage: Math.min(100, action.payload.percentage),
          bytesUploaded: action.payload.bytesUploaded || state.progress.bytesUploaded,
          etaSeconds: action.payload.etaSeconds ?? state.progress.etaSeconds,
          speed: action.payload.speed || state.progress.speed,
        },
      };

    case 'PAUSE_UPLOAD':
      return {
        ...state,
        progress: {
          ...state.progress,
          status: 'paused',
        },
      };

    case 'RESUME_UPLOAD':
      return {
        ...state,
        progress: {
          ...state.progress,
          status: 'uploading',
        },
      };

    case 'SET_PROCESSING':
      return {
        ...state,
        progress: {
          ...state.progress,
          percentage: 100,
          status: 'processing',
        },
      };

    case 'COMPLETE_UPLOAD':
      return {
        ...state,
        progress: {
          ...state.progress,
          percentage: 100,
          status: 'completed',
        },
      };

    case 'SET_ERROR':
      return {
        ...state,
        progress: {
          ...state.progress,
          status: 'error',
          errorMessage: action.payload,
        },
      };

    case 'RESET_ALL':
      return initialUploadState;

    default:
      return state;
  }
}

interface UploadManagerProps {
  initialTitle?: string;
  onPublishReady?: (state: UploadManagerUnifiedState) => void;
  onClose?: () => void;
}

export const UploadManager: React.FC<UploadManagerProps> = ({
  initialTitle = '',
  onPublishReady,
  onClose,
}) => {
  const [state, dispatch] = useReducer(uploadReducer, {
    ...initialUploadState,
    title: {
      ...initialUploadState.title,
      value: initialTitle,
    },
  });

  const timerRef = useRef<number | null>(null);

  // Auto upload simulation on mount if idle
  const handleSimulateUpload = () => {
    dispatch({ type: 'START_UPLOAD' });
    let p = 0;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = window.setInterval(() => {
      p += 10;
      if (p >= 100) {
        clearInterval(timerRef.current!);
        dispatch({ type: 'SET_PROCESSING' });
        setTimeout(() => {
          dispatch({ type: 'COMPLETE_UPLOAD' });
        }, 1200);
      } else {
        const bytes = `${((p / 100) * 124.6).toFixed(1)} MB`;
        const eta = Math.max(1, Math.round((100 - p) / 12));
        dispatch({
          type: 'UPDATE_PROGRESS',
          payload: { percentage: p, bytesUploaded: bytes, etaSeconds: eta },
        });
      }
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_TITLE', payload: e.target.value });
  };

  const handleQuickFormatTitle = () => {
    if (state.title.value) {
      dispatch({ type: 'AUTO_FORMAT_TITLE', payload: state.title.value });
    }
  };

  return (
    <div className="w-full space-y-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
      {/* 1. SECTION: Video Upload Progress Bar */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileVideo className="h-5 w-5 text-red-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Upload Progress & Transcoding
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {state.progress.status === 'idle' && (
              <button
                type="button"
                onClick={handleSimulateUpload}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Simulate Upload</span>
              </button>
            )}

            {state.progress.status === 'uploading' && (
              <button
                type="button"
                onClick={() => {
                  if (timerRef.current) clearInterval(timerRef.current);
                  dispatch({ type: 'PAUSE_UPLOAD' });
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Pause className="h-3.5 w-3.5" />
                <span>Pause</span>
              </button>
            )}

            {state.progress.status === 'paused' && (
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'RESUME_UPLOAD' });
                  let p = state.progress.percentage;
                  timerRef.current = window.setInterval(() => {
                    p += 10;
                    if (p >= 100) {
                      clearInterval(timerRef.current!);
                      dispatch({ type: 'SET_PROCESSING' });
                      setTimeout(() => dispatch({ type: 'COMPLETE_UPLOAD' }), 1000);
                    } else {
                      dispatch({
                        type: 'UPDATE_PROGRESS',
                        payload: {
                          percentage: p,
                          bytesUploaded: `${((p / 100) * 124.6).toFixed(1)} MB`,
                          etaSeconds: Math.max(1, Math.round((100 - p) / 12)),
                        },
                      });
                    }
                  }, 400);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Resume</span>
              </button>
            )}

            {(state.progress.status === 'completed' || state.progress.status === 'error') && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'RESET_ALL' })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Reset Upload"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="relative w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden ring-1 ring-slate-200/50 dark:ring-slate-700/50">
          <div
            className={`h-full transition-all duration-300 ease-out rounded-full ${
              state.progress.status === 'completed'
                ? 'bg-emerald-500'
                : state.progress.status === 'error'
                ? 'bg-rose-500'
                : state.progress.status === 'processing'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse'
                : 'bg-gradient-to-r from-red-600 to-rose-500'
            }`}
            style={{ width: `${state.progress.percentage}%` }}
          />
        </div>

        {/* Metrics Row */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {state.progress.percentage}%
            </span>
            <span>·</span>
            <span>
              {state.progress.status === 'completed'
                ? 'Upload & 4K Encoding Complete'
                : state.progress.status === 'processing'
                ? 'Processing HD / 4K multi-resolution stream...'
                : state.progress.status === 'paused'
                ? 'Upload Paused'
                : state.progress.status === 'uploading'
                ? `${state.progress.bytesUploaded} of ${state.progress.totalBytes}`
                : 'Waiting to upload'}
            </span>
          </div>

          {state.progress.status === 'uploading' && (
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span>{state.progress.speed}</span>
              <span>·</span>
              <span>ETA {state.progress.etaSeconds}s</span>
            </div>
          )}

          {state.progress.status === 'completed' && (
            <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
              <CheckCircle2 className="h-4 w-4" />
              Ready to Publish
            </span>
          )}
        </div>
      </section>

      {/* 2. SECTION: Title Input */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span>Video Title</span>
            <span className="text-red-500">*</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickFormatTitle}
              title="Clean filename into proper Title Case"
              className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" />
              Auto-format Title
            </button>
            <span className="text-[11px] text-slate-400 font-mono">
              {state.title.value.length}/{state.title.maxLength}
            </span>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="e.g. Sintel 4K Trailer: The Dragon Quest"
            value={state.title.value}
            onChange={handleTitleChange}
            maxLength={state.title.maxLength}
            className={`w-full rounded-2xl border bg-slate-50 dark:bg-slate-800/80 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${
              state.title.error
                ? 'border-rose-500 focus:border-rose-600'
                : 'border-slate-200 dark:border-slate-700 focus:border-red-500'
            }`}
          />
          {state.title.value && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_TITLE', payload: '' })}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {state.title.error && (
          <p className="flex items-center gap-1 text-xs text-rose-500 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            {state.title.error}
          </p>
        )}
      </section>

      {/* 3. SECTION: Privacy Toggles & Visibility */}
      <section className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div>
          <label className="text-xs font-bold text-slate-900 dark:text-white block">
            Visibility & Privacy
          </label>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Choose who can discover and watch this video across Vio streaming
          </p>
        </div>

        {/* Visibility Radio Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Public */}
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_VISIBILITY', payload: 'public' })}
            className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
              state.privacy.visibility === 'public'
                ? 'border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-600 dark:text-red-400 ring-1 ring-red-500'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
          >
            <Globe className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Public</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Everyone can watch and search
              </div>
            </div>
          </button>

          {/* Unlisted */}
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_VISIBILITY', payload: 'unlisted' })}
            className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
              state.privacy.visibility === 'unlisted'
                ? 'border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-600 dark:text-red-400 ring-1 ring-red-500'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
          >
            <EyeOff className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Unlisted</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Only people with link can view
              </div>
            </div>
          </button>

          {/* Private */}
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_VISIBILITY', payload: 'private' })}
            className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
              state.privacy.visibility === 'private'
                ? 'border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-600 dark:text-red-400 ring-1 ring-red-500'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
          >
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Private</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Only you can view this video
              </div>
            </div>
          </button>
        </div>

        {/* Detailed Toggles */}
        <div className="space-y-3 pt-2">
          {/* Notify Followers Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-slate-500" />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Notify Followers
                </div>
                <div className="text-[10px] text-slate-400">
                  Send instant notification & feed update to creators following you
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_NOTIFY_FOLLOWERS' })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                state.privacy.notifyFollowers ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ml-0.5 ${
                  state.privacy.notifyFollowers ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Allow Comments Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-slate-500" />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Allow Viewer Comments & Discussion
                </div>
                <div className="text-[10px] text-slate-400">
                  Let audience reply and discuss under this video
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_COMMENTS' })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                state.privacy.allowComments ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ml-0.5 ${
                  state.privacy.allowComments ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Age Restriction Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Age Restriction (18+)
                </div>
                <div className="text-[10px] text-slate-400">
                  Require age verification to stream this video
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_AGE_RESTRICTED' })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                state.privacy.ageRestricted ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ml-0.5 ${
                  state.privacy.ageRestricted ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Action Footer */}
      {onPublishReady && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={!state.title.value.trim() || state.progress.status === 'uploading'}
            onClick={() => onPublishReady(state)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Publish Video</span>
          </button>
        </div>
      )}
    </div>
  );
};
