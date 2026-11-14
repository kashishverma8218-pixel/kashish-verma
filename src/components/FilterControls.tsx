import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Save,
  Layers,
  Palette,
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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6 shadow-2xl transition-colors text-[var(--ink)] flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--ink-faint)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF0000]/10 text-[#FF0000]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--ink)] flex items-center gap-2">
                Video Processing Pipeline
                <span className="rounded-full bg-[#FF0000]/15 text-[#FF0000] text-[10px] font-bold px-2 py-0.5">
                  GPU Accelerated
                </span>
              </h3>
              <p className="text-[11px] text-[var(--ink-medium)]">Custom multi-stage filter & color grading engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filter controls"
            className="rounded-xl p-1.5 text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pipeline Stage Tabs */}
        <div className="mt-4 flex items-center gap-1 p-1 bg-[var(--bg)] border border-[var(--ink-faint)] rounded-2xl text-xs font-bold shrink-0">
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
                type="button"
                onClick={() => setActiveStage(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
                  isSel
                    ? 'bg-[var(--ink)] text-[var(--bg)] font-extrabold shadow-xs'
                    : 'text-[var(--ink-medium)] hover:text-[var(--ink)]'
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
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className="flex flex-col items-start p-3 rounded-2xl border border-[var(--ink-faint)] bg-[var(--bg)] hover:border-[#FF0000]/60 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full gap-1">
                      <span className="font-bold text-xs text-[var(--ink)] group-hover:text-[#FF0000]">
                        {preset.name}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-[var(--ink-medium)] px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--ink-faint)]">
                        {preset.category}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--ink-medium)] line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Saved Custom User Profiles */}
              {Object.keys(savedProfiles).length > 0 && (
                <div className="pt-2 border-t border-[var(--ink-faint)]">
                  <span className="text-xs font-bold text-[var(--ink-medium)] block mb-2">
                    My Saved Custom Profiles:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(savedProfiles).map(([name, prof]) => (
                      <button
                        key={name}
                        type="button"
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
                        className="px-3 py-1.5 rounded-xl bg-[#FF0000]/10 text-[#FF0000] border border-[#FF0000]/30 text-xs font-bold hover:bg-[#FF0000]/20 transition-colors cursor-pointer"
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
                <div className="flex justify-between text-xs font-bold text-[var(--ink)] mb-1">
                  <span>Exposure / Brightness</span>
                  <span className="font-mono text-[#FF0000]">{filters.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="180"
                  value={filters.brightness}
                  onChange={(e) => updateParam('brightness', parseInt(e.target.value))}
                  className="w-full accent-[#FF0000] h-1.5 bg-[var(--ink-faint)] rounded-lg cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[var(--ink)] mb-1">
                  <span>Tone Contrast</span>
                  <span className="font-mono text-[#FF0000]">{filters.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={filters.contrast}
                  onChange={(e) => updateParam('contrast', parseInt(e.target.value))}
                  className="w-full accent-[#FF0000] h-1.5 bg-[var(--ink-faint)] rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 3: COLOR GRADE */}
          {activeStage === 'color' && (
            <div className="space-y-4">
              {/* Saturation */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[var(--ink)] mb-1">
                  <span>Color Vibrance / Saturation</span>
                  <span className="font-mono text-[#FF0000]">{filters.saturate}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="250"
                  value={filters.saturate}
                  onChange={(e) => updateParam('saturate', parseInt(e.target.value))}
                  className="w-full accent-[#FF0000] h-1.5 bg-[var(--ink-faint)] rounded-lg cursor-pointer"
                />
              </div>

              {/* Sepia / Warmth */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[var(--ink)] mb-1">
                  <span>Warm Amber Cast (Sepia)</span>
                  <span className="font-mono text-[#FF0000]">{filters.sepia}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.sepia}
                  onChange={(e) => updateParam('sepia', parseInt(e.target.value))}
                  className="w-full accent-[#FF0000] h-1.5 bg-[var(--ink-faint)] rounded-lg cursor-pointer"
                />
              </div>

              {/* Grayscale */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[var(--ink)] mb-1">
                  <span>Monochrome Desaturation</span>
                  <span className="font-mono text-[#FF0000]">{filters.grayscale}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.grayscale}
                  onChange={(e) => updateParam('grayscale', parseInt(e.target.value))}
                  className="w-full accent-[#FF0000] h-1.5 bg-[var(--ink-faint)] rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 4: OPTICS & FILM */}
          {activeStage === 'optics' && (
            <div className="space-y-4">
              {/* Blur */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[var(--ink)] mb-1">
                  <span>Soft Focus / Gaussian Blur</span>
                  <span className="font-mono text-[#FF0000]">{filters.blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={filters.blur}
                  onChange={(e) => updateParam('blur', parseInt(e.target.value))}
                  className="w-full accent-[#FF0000] h-1.5 bg-[var(--ink-faint)] rounded-lg cursor-pointer"
                />
              </div>

              {/* Invert */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[var(--ink)] mb-1">
                  <span>Negative Invert</span>
                  <span className="font-mono text-[#FF0000]">{filters.invert}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.invert}
                  onChange={(e) => updateParam('invert', parseInt(e.target.value))}
                  className="w-full accent-[#FF0000] h-1.5 bg-[var(--ink-faint)] rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer: Save Custom Profile & Reset */}
        <div className="mt-4 pt-3 border-t border-[var(--ink-faint)] space-y-3 shrink-0">
          {/* Save Profile Form */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Name custom filter pipeline..."
              value={customProfileName}
              onChange={(e) => setCustomProfileName(e.target.value)}
              className="flex-1 min-h-[38px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3 py-1.5 text-base sm:text-xs text-[var(--ink)] placeholder:text-[var(--ink-medium)] focus:border-[var(--ink)] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveCustomProfile}
              disabled={!customProfileName.trim()}
              className="min-h-[38px] flex items-center gap-1.5 rounded-xl bg-[#FF0000] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#CC0000] disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
            >
              {saveSuccess ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              <span>{saveSuccess ? 'Saved!' : 'Save Preset'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={onResetFilters}
              className="min-h-[36px] flex items-center gap-1.5 text-[var(--ink-medium)] hover:text-[var(--ink)] font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Pipeline</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] rounded-full bg-[var(--ink)] px-5 py-1.5 text-xs font-bold text-[var(--bg)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              Apply & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
