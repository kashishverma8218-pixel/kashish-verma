/**
 * Subtitle Parsing & Processing Utilities for Vio Streaming
 * Supports SubRip (.srt) and WebVTT (.vtt) parsing, timing sync, and cue formatting.
 */

export interface SubtitleCue {
  id: string | number;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  cues: SubtitleCue[];
  isCustom?: boolean;
  filename?: string;
}

/**
 * Parses timestamp string (e.g., "00:01:23,456" or "01:23.456") to seconds
 */
export function parseTimestamp(timeStr: string): number {
  if (!timeStr) return 0;
  
  // Clean whitespace and metadata (like WebVTT position tags)
  const clean = timeStr.trim().split(/\s+/)[0];
  const parts = clean.split(':');
  
  if (parts.length === 3) {
    // HH:MM:SS,mmm or HH:MM:SS.mmm
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const secParts = parts[2].replace(',', '.');
    const seconds = parseFloat(secParts) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    // MM:SS,mmm or MM:SS.mmm
    const minutes = parseInt(parts[0], 10) || 0;
    const secParts = parts[1].replace(',', '.');
    const seconds = parseFloat(secParts) || 0;
    return minutes * 60 + seconds;
  }
  
  return parseFloat(clean.replace(',', '.')) || 0;
}

/**
 * Strips basic HTML formatting tags from subtitle text
 */
export function cleanSubtitleText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, '') // remove HTML tags like <b>, <i>, <font>
    .replace(/\{[^}]+\}/g, '') // remove SSA/ASS override tags like {\an8}
    .trim();
}

/**
 * Parses standard SubRip (.srt) text content into SubtitleCue items
 */
export function parseSRT(content: string): SubtitleCue[] {
  if (!content || !content.trim()) return [];

  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  const timeRegex = /((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3})/;

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIndex = -1;
    let match: RegExpMatchArray | null = null;

    // Search for the timestamp arrow line
    for (let j = 0; j < lines.length; j++) {
      match = lines[j].match(timeRegex);
      if (match) {
        timeLineIndex = j;
        break;
      }
    }

    if (timeLineIndex !== -1 && match) {
      const startTime = parseTimestamp(match[1]);
      const endTime = parseTimestamp(match[2]);
      const textLines = lines.slice(timeLineIndex + 1);
      const rawText = textLines.join('\n');
      const text = cleanSubtitleText(rawText);

      if (text && endTime > startTime) {
        const id = lines[0] && !isNaN(Number(lines[0].trim())) ? lines[0].trim() : `cue-${i + 1}`;
        cues.push({
          id,
          startTime,
          endTime,
          text,
        });
      }
    }
  }

  return cues;
}

/**
 * Parses WebVTT (.vtt) text content into SubtitleCue items
 */
export function parseVTT(content: string): SubtitleCue[] {
  if (!content || !content.trim()) return [];

  const normalized = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^WEBVTT[^\n]*\n/, ''); // Strip WebVTT header

  return parseSRT(normalized);
}

/**
 * Universal parser for .srt or .vtt strings
 */
export function parseSubtitleFile(content: string, filename = ''): SubtitleCue[] {
  const isVTT = filename.toLowerCase().endsWith('.vtt') || content.trim().startsWith('WEBVTT');
  return isVTT ? parseVTT(content) : parseSRT(content);
}

/**
 * Formats seconds to SRT timestamp (HH:MM:SS,mmm)
 */
export function formatSRTTimestamp(seconds: number): string {
  const s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);

  const pad = (n: number, z = 2) => n.toString().padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`;
}

/**
 * Converts cues back to valid WebVTT string (for native browser track or blob URL)
 */
export function cuesToWebVTT(cues: SubtitleCue[]): string {
  let vtt = 'WEBVTT\n\n';
  cues.forEach((cue, index) => {
    const start = formatSRTTimestamp(cue.startTime).replace(',', '.');
    const end = formatSRTTimestamp(cue.endTime).replace(',', '.');
    vtt += `${index + 1}\n${start} --> ${end}\n${cue.text}\n\n`;
  });
  return vtt;
}

/**
 * Pre-packaged Sample Subtitles for Vio Streaming videos
 */
export const PRESET_SUBTITLE_TRACKS: Record<string, SubtitleTrack[]> = {
  'video-bbb': [
    {
      id: 'bbb-en',
      label: 'English [CC]',
      language: 'en',
      cues: [
        { id: 1, startTime: 1.0, endTime: 4.5, text: '[Playful woodwind melodies introduce a bright forest morning]' },
        { id: 2, startTime: 5.0, endTime: 9.0, text: 'Big Buck emerges from his burrow, enjoying the morning sunlight.' },
        { id: 3, startTime: 10.0, endTime: 14.5, text: '[Gentle birds chirping as butterfly flutters past]' },
        { id: 4, startTime: 15.0, endTime: 19.8, text: 'Buck stops to admire an apple blossom tree.' },
        { id: 5, startTime: 21.0, endTime: 26.5, text: '[Low mischievous giggling from the dense treetops above]' },
        { id: 6, startTime: 27.0, endTime: 33.0, text: 'Frank the flying squirrel, Rinky, and Gimera prepare their ambush.' },
        { id: 7, startTime: 34.0, endTime: 39.5, text: 'Frank: "Watch this acorn strike right on target!"' },
        { id: 8, startTime: 41.0, endTime: 46.0, text: '[Acorn strikes ground right beside Big Buck]' },
        { id: 9, startTime: 47.0, endTime: 53.0, text: 'Big Buck turns, perplexed by the unprovoked harassment.' },
        { id: 10, startTime: 54.0, endTime: 60.0, text: 'Buck examines his ruined apple with quiet sadness.' },
        { id: 11, startTime: 61.0, endTime: 67.5, text: 'Buck: "That is quite enough. Time to engineer a clever retaliation."' },
        { id: 12, startTime: 69.0, endTime: 75.0, text: '[Dynamic orchestral strings swell with determined purpose]' },
        { id: 13, startTime: 76.0, endTime: 84.0, text: 'Buck draws detailed schematic blueprints in the sandy loam.' },
        { id: 14, startTime: 86.0, endTime: 92.5, text: '[Sound of tree branches bending into spring-loaded traps]' },
        { id: 15, startTime: 94.0, endTime: 102.0, text: 'Frank dives toward Buck—unaware of the tripwire directly ahead!' },
      ],
    },
    {
      id: 'bbb-es',
      label: 'Español (Latinoamérica)',
      language: 'es',
      cues: [
        { id: 1, startTime: 1.0, endTime: 4.5, text: '[Suena música alegre de viento madera en un bosque soleado]' },
        { id: 2, startTime: 5.0, endTime: 9.0, text: 'Big Buck sale de su madriguera, disfrutando de la mañana soleada.' },
        { id: 3, startTime: 10.0, endTime: 14.5, text: '[Trinos de pájaros y aleteo de mariposas]' },
        { id: 4, startTime: 15.0, endTime: 19.8, text: 'Buck se detiene a contemplar los manzanos en flor.' },
        { id: 5, startTime: 21.0, endTime: 26.5, text: '[Risas traviesas provenientes de lo alto de los árboles]' },
        { id: 6, startTime: 27.0, endTime: 33.0, text: 'Frank y sus secuaces preparan una lluvia de bellotas.' },
        { id: 7, startTime: 34.0, endTime: 39.5, text: 'Frank: "¡Miren esto, directo al objetivo!"' },
        { id: 8, startTime: 61.0, endTime: 67.5, text: 'Buck: "Ya fue suficiente. Es hora de una lección inolvidable."' },
      ],
    },
    {
      id: 'bbb-fr',
      label: 'Français (France)',
      language: 'fr',
      cues: [
        { id: 1, startTime: 1.0, endTime: 4.5, text: '[Mélodie champêtre joyeuse dans une clairière baignée de soleil]' },
        { id: 2, startTime: 5.0, endTime: 9.0, text: 'Big Buck sort de son terrier et profite de la lumière matinale.' },
        { id: 3, startTime: 15.0, endTime: 19.8, text: 'Buck admire les fleurs de pommier printanières.' },
        { id: 4, startTime: 21.0, endTime: 26.5, text: '[Petits ricanements moqueurs dans la canopée]' },
        { id: 5, startTime: 61.0, endTime: 67.5, text: 'Buck: "Trop c\'est trop. Il est temps de préparer la riposte."' },
      ],
    },
    {
      id: 'bbb-hi',
      label: 'हिन्दी (Hindi)',
      language: 'hi',
      cues: [
        { id: 1, startTime: 1.0, endTime: 4.5, text: '[सुहानी सुबह में बांसुरी की मधुर धुन गूंजती है]' },
        { id: 2, startTime: 5.0, endTime: 9.0, text: 'बड़ा बक बनी अपने बिल से बाहर निकलकर धूप का आनंद लेता है।' },
        { id: 3, startTime: 15.0, endTime: 19.8, text: 'बक एक सेब के पेड़ के पास रुकता है।' },
        { id: 4, startTime: 21.0, endTime: 26.5, text: '[पेड़ की शाखाओं से नटखट खिलखिलाहट की आवाज]' },
        { id: 5, startTime: 61.0, endTime: 67.5, text: 'बक: "बस बहुत हुआ! अब इन्हें एक मजेदार सबक सिखाने का समय है।"' },
      ],
    },
  ],

  'video-tears-of-steel': [
    {
      id: 'tos-en',
      label: 'English [CC]',
      language: 'en',
      cues: [
        { id: 1, startTime: 1.0, endTime: 6.0, text: '[Ominous synthesizer drone over devastated futuristic Amsterdam]' },
        { id: 2, startTime: 7.0, endTime: 12.0, text: 'Commander: "All sensors report perimeter breaches along canal bridges."' },
        { id: 3, startTime: 13.0, endTime: 18.0, text: 'Scientist: "The temporal re-simulation is primed. We have only one window."' },
        { id: 4, startTime: 19.0, endTime: 24.5, text: 'Thom: "Celia, you must listen to me before the robotic sentinels arrive."' },
        { id: 5, startTime: 25.0, endTime: 31.0, text: 'Celia: "Thom, you traded humanity for cybernetic ambition 40 years ago."' },
        { id: 6, startTime: 32.0, endTime: 38.0, text: '[Hydraulic servos whir as the giant quadruped robot towers above church spire]' },
        { id: 7, startTime: 40.0, endTime: 46.5, text: 'Tech Officer: "Main capacitor charging! 80%... 90%... Hold positions!"' },
      ],
    },
    {
      id: 'tos-es',
      label: 'Español (Latinoamérica)',
      language: 'es',
      cues: [
        { id: 1, startTime: 1.0, endTime: 6.0, text: '[Sintetizador tenso sobre una Ámsterdam futurista en ruinas]' },
        { id: 2, startTime: 7.0, endTime: 12.0, text: 'Comandante: "Todos los sensores reportan intrusión en los puentes."' },
        { id: 3, startTime: 19.0, endTime: 24.5, text: 'Thom: "Celia, debes escucharme antes de que los centinelas ataquen."' },
      ],
    },
  ],

  'video-sintel': [
    {
      id: 'sintel-en',
      label: 'English [CC]',
      language: 'en',
      cues: [
        { id: 1, startTime: 1.0, endTime: 5.5, text: '[Wind howling across desolate, snowy mountain passes]' },
        { id: 2, startTime: 6.0, endTime: 11.5, text: 'Sintel: "I have walked through winter and fire to find you, Scales."' },
        { id: 3, startTime: 12.0, endTime: 18.0, text: '[Flashback: A wounded baby dragon squeaks weakly in an alley]' },
        { id: 4, startTime: 19.0, endTime: 25.0, text: 'Sintel smiles gently, bandaging the creature\'s fractured wing.' },
        { id: 5, startTime: 26.0, endTime: 33.0, text: '[Distant monstrous roar echoes deep within the stone cavern]' },
        { id: 6, startTime: 35.0, endTime: 42.0, text: 'Sintel unsheathes her curved twin daggers with grim resolve.' },
      ],
    },
  ],
};

/**
 * Returns available presets for a video ID, or a sensible universal fallback
 */
export function getPresetSubtitleTracks(videoId: string): SubtitleTrack[] {
  if (PRESET_SUBTITLE_TRACKS[videoId]) {
    return PRESET_SUBTITLE_TRACKS[videoId];
  }

  // Universal fallback for any video
  return [
    {
      id: `default-${videoId}-en`,
      label: 'English [CC]',
      language: 'en',
      cues: [
        { id: 1, startTime: 1.0, endTime: 5.5, text: '[Vio High-Definition Cinema Master Audio Stream]' },
        { id: 2, startTime: 6.0, endTime: 11.0, text: 'Narrator: "Streaming in 4K resolution on Vio streaming platform."' },
        { id: 3, startTime: 12.0, endTime: 17.5, text: 'Experience spatial audio acoustics and color-graded HDR detail.' },
        { id: 4, startTime: 18.5, endTime: 25.0, text: '[Rich background orchestral composition plays with crystal fidelity]' },
        { id: 5, startTime: 30.0, endTime: 36.0, text: 'Tip: You can load your own custom .srt or .vtt subtitle file anytime!' },
      ],
    },
    {
      id: `default-${videoId}-es`,
      label: 'Español',
      language: 'es',
      cues: [
        { id: 1, startTime: 1.0, endTime: 5.5, text: '[Transmisión de audio cinematográfico de alta definición en Vio]' },
        { id: 2, startTime: 6.0, endTime: 11.0, text: 'Narrador: "Reproduciendo en calidad 4K en Vio streaming."' },
        { id: 3, startTime: 12.0, endTime: 17.5, text: 'Experimente acústica espacial y detalles HDR con gradación de color.' },
        { id: 4, startTime: 30.0, endTime: 36.0, text: 'Consejo: ¡Puedes cargar tu propio archivo de subtítulos .srt o .vtt en cualquier momento!' },
      ],
    },
    {
      id: `default-${videoId}-hi`,
      label: 'हिन्दी (Hindi)',
      language: 'hi',
      cues: [
        { id: 1, startTime: 1.0, endTime: 5.5, text: '[वायो स्ट्रीमिंग पर उच्च-परिभाषा सिनेमाई ऑडियो]' },
        { id: 2, startTime: 6.0, endTime: 11.0, text: 'वायो स्ट्रीमिंग प्लेटफॉर्म पर 4K रिज़ॉल्यूशन में आनंद लें।' },
        { id: 3, startTime: 30.0, endTime: 36.0, text: 'सुझाव: आप किसी भी समय अपनी कस्टम .srt या .vtt सबटाइटल फाइल लोड कर सकते हैं!' },
      ],
    },
  ];
}
