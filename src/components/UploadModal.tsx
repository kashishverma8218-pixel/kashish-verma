import React, { useState, useRef } from 'react';
import { X, Upload, Link as LinkIcon, Film, CheckCircle2, AlertCircle, Sliders } from 'lucide-react';
import { VideoItem } from '../types/video';
import { formatFileSize } from '../utils/formatTime';
import { UploadManager, UploadManagerUnifiedState } from './UploadManager';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVideo: (video: VideoItem) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onAddVideo }) => {
  const [activeMode, setActiveMode] = useState<'manager' | 'file' | 'url'>('manager');
  const [urlInput, setUrlInput] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file (.mp4, .webm, .ogg, .mov).');
      return;
    }
    setSelectedFile(file);
    if (!customTitle) {
      setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleManagerPublish = (managerState: UploadManagerUnifiedState) => {
    const fallbackPoster = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80';
    const newVideo: VideoItem = {
      id: `upload-${Date.now()}`,
      title: managerState.title.value.trim() || 'Vio Studio Production',
      description: `Uploaded via Vio Studio. Visibility: ${managerState.privacy.visibility}.`,
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      poster: fallbackPoster,
      channelId: 'channel-blender',
      author: 'Creator Studio',
      fileSize: managerState.progress.totalBytes,
      isLocal: false,
      visibility: managerState.privacy.visibility,
      notifySubscribers: managerState.privacy.notifyFollowers,
      tags: ['4K', 'Original', 'VioStreaming'],
      views: 1,
      likes: 0,
      dislikes: 0,
      publishedAt: 'Just now',
      duration: 596,
      category: 'Animation',
    };
    onAddVideo(newVideo);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fallbackPoster = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80';

    if (activeMode === 'file') {
      if (!selectedFile) {
        setError('Please select or drop a video file.');
        return;
      }
      const objectUrl = URL.createObjectURL(selectedFile);
      const newVideo: VideoItem = {
        id: `local-${Date.now()}`,
        title: customTitle.trim() || selectedFile.name,
        description: `Local file: ${selectedFile.name}`,
        url: objectUrl,
        poster: fallbackPoster,
        channelId: 'channel-blender',
        author: 'My Local Video',
        fileSize: formatFileSize(selectedFile.size),
        isLocal: true,
        tags: ['Local', 'User File'],
        views: 1,
        likes: 0,
        dislikes: 0,
        publishedAt: 'Just now',
        duration: 0,
        category: 'All',
      };
      onAddVideo(newVideo);
      onClose();
    } else if (activeMode === 'url') {
      if (!urlInput.trim()) {
        setError('Please enter a valid video stream or direct file URL.');
        return;
      }
      try {
        new URL(urlInput.trim());
      } catch {
        setError('Please enter a well-formed URL (e.g. https://.../video.mp4)');
        return;
      }

      const inferredTitle = customTitle.trim() || urlInput.split('/').pop()?.split('?')[0] || 'Custom Web Stream';
      const newVideo: VideoItem = {
        id: `url-${Date.now()}`,
        title: inferredTitle,
        description: `Stream loaded from ${urlInput}`,
        url: urlInput.trim(),
        poster: fallbackPoster,
        channelId: 'channel-blender',
        author: 'Web Stream',
        tags: ['Web Stream', 'Custom URL'],
        views: 1,
        likes: 0,
        dislikes: 0,
        publishedAt: 'Just now',
        duration: 0,
        category: 'All',
      };
      onAddVideo(newVideo);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-red-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Video Upload Studio</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="mt-4 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70">
          <button
            type="button"
            onClick={() => {
              setActiveMode('manager');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeMode === 'manager'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Upload Manager (useReducer)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode('file');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeMode === 'file'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode('url');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeMode === 'url'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Direct Video URL
          </button>
        </div>

        {activeMode === 'manager' ? (
          <div className="mt-5">
            <UploadManager
              initialTitle={customTitle}
              onPublishReady={handleManagerPublish}
              onClose={onClose}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-500 border border-rose-500/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {activeMode === 'file' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                    dragActive
                      ? 'border-red-500 bg-red-500/5'
                      : selectedFile
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600'
                  }`}
                >
                  {selectedFile ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-xs">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatFileSize(selectedFile.size)} · Click to change file
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500 mb-3">
                        <Upload className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Drop video file here, or <span className="text-red-500 underline">browse</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Supports MP4, WebM, MOV, OGG, MKV
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Video Stream or MP4 URL
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="url"
                    placeholder="https://commondatastorage.googleapis.com/.../video.mp4"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Title / Label <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. My Holiday Reel 2026"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-500 active:scale-95 transition-all"
              >
                Play Video
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
