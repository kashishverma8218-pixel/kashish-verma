import React, { useState } from 'react';
import {
  X,
  Sliders,
  RotateCcw,
  Sparkles,
  Save,
  Layers,
  Palette,
  Eye,
  Film,
  Check,
  Sun,
  Flame
} from 'lucide-react';
import { VideoFilters } from '../types/video';
import {
  PIPELINE_PRESETS,
  DEFAULT_PIPELINE,
  VideoFilterPipelineConfig,
  savePipelineProfile,
  loadPipelineProfiles,
} from '../utils/videoFilterPipeline';

interface FilterControlsProps {
  isOpen: boolean;
  onClose: () => void;
  filters: VideoFilters;
  onChangeFilters: (newFilters: VideoFilters) => void;
  onResetFilters: () => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  onResetFilters,
}) => {
  const [activeStage, setActiveStage] = useState<'presets' | 'tonality' | 'color' | 'optics'>('presets');
  const [customProfileName, setCustomProfileName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<Record<string, VideoFilterPipelineConfig>>(() =>
    loadPipelineProfiles()
  );

  if (!isOpen) return null;

  const updateParam = (key: keyof VideoFilters, value: number) => {
    onChangeFilters({
      ...filters,
      [key]: value,
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = PIPELINE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onChangeFilters({
      brightness: preset.config.brightness ?? 100,
      contrast: preset.config.contrast ?? 100,
      saturate: preset.config.saturation ?? 100,
      grayscale: preset.config.grayscale ?? 0,
      sepia: preset.config.sepia ?? 0,
      blur: preset.config.blur ?? 0,
      invert: preset.config.invert ?? 0,
    });
  };

  const handleSaveCustomProfile = () => {
    if (!customProfileName.trim()) return;
    const config: VideoFilterPipelineConfig = {
      ...DEFAULT_PIPELINE,
      brightness: filters.brightness,
      contrast: filters.contrast,
      saturation: filters.saturate,
      grayscale: filters.grayscale,
      sepia: filters.sepia,
      blur: filters.blur,
      invert: filters.invert,
    };
    savePipelineProfile(customProfileName.trim(), config);
    setSavedProfiles(loadPipelineProfiles());
    setCustomProfileName('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-colors dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Video Processing Pipeline
                <span className="rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5">
                  GPU Accelerated
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Custom multi-stage filter & color grading engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pipeline Stage Tabs */}
        <div className="mt-4 flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-bold shrink-0">
          {[
            { id: 'presets', label: 'LUT Presets', icon: Palette },
            { id: 'tonality', label: 'Tone & Light', icon: Sun },
            { id: 'color', label: 'Color Grade', icon: Flame },
            { id: 'optics', label: 'Optics & Film', icon: Film },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeStage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveStage(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl transition-all ${
                  isSel
                    ? 'bg-white text-purple-600 shadow-xs dark:bg-slate-900 dark:text-purple-400 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Stage Content */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
          {/* TAB 1: LUT PRESETS */}
          {activeStage === 'presets' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {PIPELINE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset.id)}
                    className="flex flex-col items-start p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-purple-500/60 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                        {preset.name}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-slate-400 px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700">
                        {preset.category}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Saved Custom User Profiles */}
              {Object.keys(savedProfiles).length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 block mb-2">
                    My Saved Custom Profiles:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(savedProfiles).map(([name, prof]) => (
                      <button
                        key={name}
                        onClick={() =>
                          onChangeFilters({
                            brightness: prof.brightness,
                            contrast: prof.contrast,
                            saturate: prof.saturation,
                            grayscale: prof.grayscale,
                            sepia: prof.sepia,
                            blur: prof.blur,
                            invert: prof.invert,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold hover:bg-purple-100 transition-colors"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TONALITY & LIGHT */}
          {activeStage === 'tonality' && (
            <div className="space-y-4">
              {/* Brightness */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Exposure / Brightness</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">{filters.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="180"
                  value={filters.brightness}
                  onChange={(e) => updateParam('brightness', parseInt(e.target.value))}
                  className="w-full accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Tone Contrast</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">{filters.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={filters.contrast}
                  onChange={(e) => updateParam('contrast', parseInt(e.target.value))}
                  className="w-full accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 3: COLOR GRADE */}
          {activeStage === 'color' && (
            <div className="space-y-4">
              {/* Saturation */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Color Vibrance / Saturation</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">{filters.saturate}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="250"
                  value={filters.saturate}
                  onChange={(e) => updateParam('saturate', parseInt(e.target.value))}
                  className="w-full accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Sepia / Warmth */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Warm Amber Cast (Sepia)</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">{filters.sepia}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.sepia}
                  onChange={(e) => updateParam('sepia', parseInt(e.target.value))}
                  className="w-full accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Grayscale */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Monochrome Desaturation</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">{filters.grayscale}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.grayscale}
                  onChange={(e) => updateParam('grayscale', parseInt(e.target.value))}
                  className="w-full accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 4: OPTICS & FILM */}
          {activeStage === 'optics' && (
            <div className="space-y-4">
              {/* Blur */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Soft Focus / Gaussian Blur</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">{filters.blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={filters.blur}
                  onChange={(e) => updateParam('blur', parseInt(e.target.value))}
                  className="w-full accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Invert */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Negative Invert</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">{filters.invert}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.invert}
                  onChange={(e) => updateParam('invert', parseInt(e.target.value))}
                  className="w-full accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer: Save Custom Profile & Reset */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 shrink-0">
          {/* Save Profile Form */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Name custom filter pipeline..."
              value={customProfileName}
              onChange={(e) => setCustomProfileName(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              onClick={handleSaveCustomProfile}
              disabled={!customProfileName.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {saveSuccess ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              <span>{saveSuccess ? 'Saved!' : 'Save Preset'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <button
              onClick={onResetFilters}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Pipeline</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 transition-colors"
            >
              Apply & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
