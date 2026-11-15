import { useEffect } from 'react';

export interface VideoKeyboardShortcutsOptions {
  togglePlay: () => void;
  seekRelative: (seconds: number) => void;
  toggleFullscreen: () => void;
  toggleMute?: () => void;
  handleVolumeChange?: (newVolume: number) => void;
  currentVolume?: number;
  takeSnapshot?: () => void;
  handleAddBookmark?: () => void;
  toggleSubtitles?: () => void;
  toggleTheater?: () => void;
  toggleMiniplayer?: () => void;
  togglePiP?: () => void;
  onOpenShortcuts?: () => void;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
  toggleChapters?: () => void;
  duration?: number;
  onSeekPercent?: (pct: number) => void;
  enabled?: boolean;
}

/**
 * Custom hook to handle comprehensive keyboard shortcuts for video player controls:
 * - Spacebar or 'k': Play / Pause
 * - 'f': Toggle Fullscreen
 * - 't': Toggle Theater Mode
 * - 'i': Toggle Miniplayer
 * - 'p': Toggle Picture-in-Picture
 * - ArrowLeft / ArrowRight: Seek backward / forward 5s
 * - 'j' / 'l': Seek backward / forward 10s
 * - ArrowUp / ArrowDown: Volume up / down 5%
 * - 'm': Mute / Unmute
 * - 'c': Toggle Subtitles / Captions
 * - 's': Capture snapshot / screenshot
 * - 'b': Add timestamp bookmark
 * - '[' / ']': Previous / Next chapter
 * - '?': Open keyboard shortcuts sheet
 * - Number keys 0-9: Jump to 0% - 90%
 */
export function useVideoKeyboardShortcuts({
  togglePlay,
  seekRelative,
  toggleFullscreen,
  toggleMute,
  handleVolumeChange,
  currentVolume = 1,
  takeSnapshot,
  handleAddBookmark,
  toggleSubtitles,
  toggleTheater,
  toggleMiniplayer,
  togglePiP,
  onOpenShortcuts,
  onNextChapter,
  onPrevChapter,
  toggleChapters,
  duration,
  onSeekPercent,
  enabled = true,
}: VideoKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '?' && onOpenShortcuts) {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;

        case 'arrowleft':
          e.preventDefault();
          seekRelative(-5);
          break;

        case 'arrowright':
          e.preventDefault();
          seekRelative(5);
          break;

        case 'j':
          e.preventDefault();
          seekRelative(-10);
          break;

        case 'l':
          e.preventDefault();
          seekRelative(10);
          break;

        case 'arrowup':
          if (handleVolumeChange) {
            e.preventDefault();
            handleVolumeChange(Math.min(1, currentVolume + 0.05));
          }
          break;

        case 'arrowdown':
          if (handleVolumeChange) {
            e.preventDefault();
            handleVolumeChange(Math.max(0, currentVolume - 0.05));
          }
          break;

        case 'm':
          if (toggleMute) {
            e.preventDefault();
            toggleMute();
          }
          break;

        case 'c':
          if (toggleSubtitles) {
            e.preventDefault();
            toggleSubtitles();
          }
          break;

        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;

        case 't':
          if (toggleTheater) {
            e.preventDefault();
            toggleTheater();
          }
          break;

        case 'i':
          if (toggleMiniplayer) {
            e.preventDefault();
            toggleMiniplayer();
          }
          break;

        case 'p':
          if (togglePiP) {
            e.preventDefault();
            togglePiP();
          }
          break;

        case 's':
          if (takeSnapshot) {
            e.preventDefault();
            takeSnapshot();
          }
          break;

        case 'b':
          if (handleAddBookmark) {
            e.preventDefault();
            handleAddBookmark();
          }
          break;

        case '[':
          if (onPrevChapter) {
            e.preventDefault();
            onPrevChapter();
          }
          break;

        case ']':
          if (onNextChapter) {
            e.preventDefault();
            onNextChapter();
          }
          break;

        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': {
          if (onSeekPercent) {
            e.preventDefault();
            const pct = parseInt(e.key, 10) / 10;
            onSeekPercent(pct);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    togglePlay,
    seekRelative,
    toggleFullscreen,
    toggleMute,
    handleVolumeChange,
    currentVolume,
    takeSnapshot,
    handleAddBookmark,
    toggleSubtitles,
    toggleTheater,
    toggleMiniplayer,
    togglePiP,
    onOpenShortcuts,
    onNextChapter,
    onPrevChapter,
    toggleChapters,
    duration,
    onSeekPercent,
  ]);
}
