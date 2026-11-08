/**
 * Video Processing Pipeline for Custom Filters
 * Provides multi-stage GPU-accelerated video filtering (color grading, tone curve, optical FX, and LUT profiles).
 */

export interface VideoFilterPipelineConfig {
  id?: string;
  name?: string;
  // Stage 1: Calibration & Exposure
  brightness: number; // 0 - 200 (100 = normal)
  exposure: number;   // -50 to +50 (0 = neutral)
  // Stage 2: Color Grading & Tonality
  contrast: number;   // 0 - 200 (100 = normal)
  saturation: number; // 0 - 200 (100 = normal)
  hueRotate: number;  // 0 - 360 deg
  // Stage 3: Style & Temperature
  sepia: number;      // 0 - 100
  grayscale: number;  // 0 - 100
  warmth: number;     // -50 (cool/teal) to +50 (warm/amber)
  // Stage 4: Optics & Film Simulation
  blur: number;       // 0 - 10 px
  invert: number;     // 0 - 100
  vignette: number;   // 0 - 100%
  filmGrain: boolean; // overlay effect
}

export const DEFAULT_PIPELINE: VideoFilterPipelineConfig = {
  brightness: 100,
  exposure: 0,
  contrast: 100,
  saturation: 100,
  hueRotate: 0,
  sepia: 0,
  grayscale: 0,
  warmth: 0,
  blur: 0,
  invert: 0,
  vignette: 0,
  filmGrain: false,
};

export interface PipelinePreset {
  id: string;
  name: string;
  category: 'Cinematic' | 'Retro' | 'Creative' | 'Utility';
  description: string;
  config: Partial<VideoFilterPipelineConfig>;
}

export const PIPELINE_PRESETS: PipelinePreset[] = [
  {
    id: 'original',
    name: 'Master Source',
    category: 'Utility',
    description: 'Direct passthrough without color alterations',
    config: { ...DEFAULT_PIPELINE },
  },
  {
    id: 'teal-orange',
    name: 'Teal & Orange Hollywood',
    category: 'Cinematic',
    description: 'Blockbuster contrast with warm skin tones and deep cyan shadows',
    config: {
      brightness: 104,
      contrast: 125,
      saturation: 135,
      warmth: 18,
      hueRotate: 350,
      vignette: 25,
      filmGrain: false,
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon 2099',
    category: 'Creative',
    description: 'High contrast electric violet and cyan with punchy dynamic range',
    config: {
      brightness: 108,
      contrast: 140,
      saturation: 160,
      hueRotate: 290,
      warmth: -20,
      vignette: 30,
      filmGrain: false,
    },
  },
  {
    id: 'kodak-portra',
    name: 'Kodak Portra 400',
    category: 'Retro',
    description: 'Timeless analog film warmth with gentle highlight rolloff',
    config: {
      brightness: 102,
      contrast: 98,
      saturation: 110,
      sepia: 18,
      warmth: 15,
      vignette: 15,
      filmGrain: true,
    },
  },
  {
    id: 'noir-monochrome',
    name: 'Cinematic Noir 35mm',
    category: 'Retro',
    description: 'Deep obsidian shadows with crisp midtone separation',
    config: {
      brightness: 98,
      contrast: 145,
      saturation: 0,
      grayscale: 100,
      sepia: 5,
      vignette: 40,
      filmGrain: true,
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour Sunset',
    category: 'Cinematic',
    description: 'Rich amber sunlight with soft contrast and dreamy warmth',
    config: {
      brightness: 106,
      contrast: 105,
      saturation: 125,
      sepia: 22,
      warmth: 35,
      vignette: 20,
      filmGrain: false,
    },
  },
  {
    id: 'vivid-hdr',
    name: '4K Vivid HDR Booster',
    category: 'Utility',
    description: 'Enhanced color clarity, micro-contrast, and dynamic punch',
    config: {
      brightness: 105,
      contrast: 120,
      saturation: 135,
      hueRotate: 0,
      vignette: 0,
      filmGrain: false,
    },
  },
];

/**
 * Compiles a pipeline configuration into a CSS filter string for hardware-accelerated rendering.
 */
export function compilePipelineToCSS(config: VideoFilterPipelineConfig): string {
  const effectiveBrightness = Math.max(0, config.brightness + (config.exposure || 0));
  const filters: string[] = [
    `brightness(${effectiveBrightness}%)`,
    `contrast(${config.contrast}%)`,
    `saturate(${config.saturation}%)`,
  ];

  if (config.hueRotate && config.hueRotate !== 0) {
    filters.push(`hue-rotate(${config.hueRotate}deg)`);
  }
  if (config.sepia > 0) {
    filters.push(`sepia(${config.sepia}%)`);
  }
  if (config.grayscale > 0) {
    filters.push(`grayscale(${config.grayscale}%)`);
  }
  if (config.invert > 0) {
    filters.push(`invert(${config.invert}%)`);
  }
  if (config.blur > 0) {
    filters.push(`blur(${config.blur}px)`);
  }

  return filters.join(' ');
}

/**
 * Saves a custom pipeline profile to localStorage.
 */
export function savePipelineProfile(name: string, config: VideoFilterPipelineConfig): void {
  try {
    const raw = localStorage.getItem('vio_custom_pipeline_profiles');
    const profiles: Record<string, VideoFilterPipelineConfig> = raw ? JSON.parse(raw) : {};
    profiles[name] = { ...config, name, id: `custom-${Date.now()}` };
    localStorage.setItem('vio_custom_pipeline_profiles', JSON.stringify(profiles));
  } catch (err) {
    console.warn('Could not save custom pipeline profile:', err);
  }
}

/**
 * Loads saved custom pipeline profiles.
 */
export function loadPipelineProfiles(): Record<string, VideoFilterPipelineConfig> {
  try {
    const raw = localStorage.getItem('vio_custom_pipeline_profiles');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
