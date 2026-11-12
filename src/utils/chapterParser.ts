import { VideoChapter } from '../types/video';

/**
 * Converts a time string (e.g. "01:23", "1:05:30", "0:45") into total seconds.
 */
export function parseTimestampToSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  const cleaned = timeStr.trim().replace(/[\[\]\(\)]/g, '');
  const parts = cleaned.split(':').map((p) => parseInt(p, 10));

  if (parts.some((p) => isNaN(p) || p < 0)) return null;

  if (parts.length === 2) {
    // MM:SS
    const [minutes, seconds] = parts;
    if (seconds >= 60) return null;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    // HH:MM:SS
    const [hours, minutes, seconds] = parts;
    if (minutes >= 60 || seconds >= 60) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

/**
 * Formats seconds into clean MM:SS or HH:MM:SS string.
 */
export function formatSecondsToTimestamp(seconds: number): string {
  const sec = Math.max(0, Math.floor(seconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formats a duration in seconds into human-readable e.g. "2m 15s" or "45s".
 */
export function formatChapterDuration(seconds: number): string {
  const sec = Math.max(0, Math.round(seconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${s}s`;
}

/**
 * Robust regex matching lines with timestamps.
 * Supports:
 * - 00:00 Intro
 * - 01:23 - The Journey
 * - [02:45] Shading & Lighting
 * - (04:15) Character Rigging
 * - 1:12:40 Epic Conclusion
 * - 1. 00:00 Overview
 * - • 01:45 Demo
 */
const TIMESTAMP_LINE_REGEX = /(?:^|\n)\s*(?:[-•*]|\d+\.)?\s*(?:\[|\()?(\d{1,2}:(?:\d{2}:)?\d{2})(?:\]|\))?\s*[-–—:|]?\s*(.+?)(?=\r?\n|$)/gi;

/**
 * Extracts and constructs sorted video chapters from a video description text.
 */
export function parseChaptersFromDescription(description: string = '', totalDuration: number = 0): VideoChapter[] {
  if (!description || typeof description !== 'string') return [];

  const rawMatches: { startTime: number; title: string; timestampStr: string }[] = [];
  const lines = description.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match timestamp anywhere near the beginning of the line
    const match = trimmed.match(/(?:^|\s)(?:\[|\()?((?:\d{1,2}:)?[0-5]?\d:[0-5]\d)(?:\]|\))?(?:\s*[-–—:|]\s*|\s+)(.*)$/i);
    if (match) {
      const timeStr = match[1];
      let title = match[2]?.trim() || '';

      // Strip trailing brackets or clean punctuation
      title = title.replace(/^[-–—:|]+/, '').trim();
      if (!title) {
        title = `Chapter at ${timeStr}`;
      }

      const seconds = parseTimestampToSeconds(timeStr);
      if (seconds !== null) {
        rawMatches.push({
          startTime: seconds,
          title,
          timestampStr: formatSecondsToTimestamp(seconds),
        });
      }
    }
  }

  if (rawMatches.length === 0) {
    // Secondary fallback: global regex across full text
    let m: RegExpExecArray | null;
    TIMESTAMP_LINE_REGEX.lastIndex = 0;
    while ((m = TIMESTAMP_LINE_REGEX.exec(description)) !== null) {
      const timeStr = m[1];
      let title = m[2]?.trim() || '';
      title = title.replace(/^[-–—:|]+/, '').trim();
      const seconds = parseTimestampToSeconds(timeStr);
      if (seconds !== null) {
        rawMatches.push({
          startTime: seconds,
          title: title || `Chapter at ${timeStr}`,
          timestampStr: formatSecondsToTimestamp(seconds),
        });
      }
    }
  }

  if (rawMatches.length === 0) return [];

  // Deduplicate and sort by startTime
  rawMatches.sort((a, b) => a.startTime - b.startTime);

  const seenTimes = new Set<number>();
  const uniqueMatches = rawMatches.filter((item) => {
    if (seenTimes.has(item.startTime)) return false;
    seenTimes.add(item.startTime);
    return true;
  });

  // Minimum 2 chapters required to qualify as a valid chapter set (matching YouTube standards)
  if (uniqueMatches.length < 2) return [];

  // Compute start and end times for each chapter
  const effectiveTotalDuration = Math.max(
    totalDuration,
    uniqueMatches[uniqueMatches.length - 1].startTime + 60
  );

  return uniqueMatches.map((item, idx) => {
    const nextItem = uniqueMatches[idx + 1];
    const endTime = nextItem ? nextItem.startTime : effectiveTotalDuration;

    return {
      id: `chapter-${idx + 1}-${item.startTime}`,
      title: item.title,
      startTime: item.startTime,
      endTime: Math.max(item.startTime + 1, endTime),
      timestamp: item.timestampStr,
    };
  });
}

/**
 * Returns the currently playing chapter based on the video's currentTime.
 */
export function getCurrentChapter(chapters: VideoChapter[], currentTime: number): VideoChapter | null {
  if (!chapters || chapters.length === 0) return null;
  const time = Math.max(0, currentTime);

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (time >= ch.startTime && time < ch.endTime) {
      return ch;
    }
  }

  // If past last chapter start
  if (time >= chapters[chapters.length - 1].startTime) {
    return chapters[chapters.length - 1];
  }

  return chapters[0];
}

/**
 * Returns the next chapter in the sequence.
 */
export function getNextChapter(chapters: VideoChapter[], currentTime: number): VideoChapter | null {
  if (!chapters || chapters.length === 0) return null;
  const current = getCurrentChapter(chapters, currentTime);
  if (!current) return chapters[0];

  const idx = chapters.findIndex((c) => c.id === current.id);
  if (idx !== -1 && idx < chapters.length - 1) {
    return chapters[idx + 1];
  }
  return null;
}

/**
 * Returns the previous chapter in the sequence.
 * If user is more than 3 seconds into the current chapter, returns current chapter (rewind).
 */
export function getPrevChapter(chapters: VideoChapter[], currentTime: number): VideoChapter | null {
  if (!chapters || chapters.length === 0) return null;
  const current = getCurrentChapter(chapters, currentTime);
  if (!current) return chapters[0];

  const idx = chapters.findIndex((c) => c.id === current.id);
  // If more than 3s into current chapter, jump to start of current
  if (currentTime - current.startTime > 3) {
    return current;
  }
  if (idx > 0) {
    return chapters[idx - 1];
  }
  return current;
}

/**
 * Provides a clean template for creators to insert timestamps into descriptions.
 */
export function insertChapterTemplate(existingDescription: string = ''): string {
  const template = `\n\nChapters:\n00:00 Introduction\n01:15 Getting Started\n03:30 Deep Dive & Techniques\n06:45 Key Takeaways\n08:20 Conclusion & Outro`;
  return existingDescription.trim() ? `${existingDescription.trim()}${template}` : template.trim();
}
