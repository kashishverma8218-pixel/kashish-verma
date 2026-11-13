import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Signal,
  Wifi,
  Cpu,
  Layers,
  HardDrive,
  Server,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Globe2,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Radio,
  Sliders,
  Check,
  Film
} from 'lucide-react';
import { VideoItem } from '../types/video';

interface HlsStreamingMetricsPanelProps {
  videos?: VideoItem[];
  className?: string;
}

interface RenditionMetric {
  resolution: string;
  bitrateKbps: number;
  fps: number;
  codec: string;
  segmentDuration: number;
  activeViewersPct: number;
  cacheHitRatio: number;
}

export const HlsStreamingMetricsPanel: React.FC<HlsStreamingMetricsPanelProps> = ({
  videos = [],
  className = '',
}) => {
  const [selectedVideoId, setSelectedVideoId] = useState<string>(videos[0]?.id || 'video-bbb');
  const [isLiveMonitoring, setIsLiveMonitoring] = useState<boolean>(true);
  const [networkProfile, setNetworkProfile] = useState<'gigabit' | '4g' | 'slow3g'>('gigabit');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [simulatedStallTriggered, setSimulatedStallTriggered] = useState<boolean>(false);

  // Dynamic real-time metrics
  const [metrics, setMetrics] = useState({
    bufferHealthSec: 14.6,
    rebufferingFrequency: 0.02, // stalls per hour
    currentBitrateKbps: 6180,
    droppedFramesRate: 0.01,
    timeToFirstFrameMs: 182,
    activeViewers: 1420,
    cdnCacheHitRatio: 98.9,
    transcodingWorkerSpeed: '4.2x realtime',
    transcodingQueueLength: 2,
    activeTranscodeInstances: 6,
    avgTranscodeCpu: '38.4%',
  });

  // History buffer for sparkline graph
  const [bufferHistory, setBufferHistory] = useState<number[]>([12.2, 13.5, 14.1, 14.8, 14.2, 15.0, 14.6, 14.9, 14.6]);
  const [bitrateHistory, setBitrateHistory] = useState<number[]>([5900, 6100, 6240, 6180, 6120, 6200, 6180]);

  // Transcoding ladder profiles
  const renditions: RenditionMetric[] = [
    {
      resolution: '1080p60 FHD',
      bitrateKbps: 6000,
      fps: 60,
      codec: 'H.264 High / avc1.640028',
      segmentDuration: 4.0,
      activeViewersPct: 62,
      cacheHitRatio: 99.4,
    },
    {
      resolution: '720p HD',
      bitrateKbps: 3000,
      fps: 30,
      codec: 'H.264 Main / avc1.4d401f',
      segmentDuration: 4.0,
      activeViewersPct: 24,
      cacheHitRatio: 98.8,
    },
    {
      resolution: '480p SD',
      bitrateKbps: 1500,
      fps: 30,
      codec: 'H.264 Main / avc1.4d401e',
      segmentDuration: 4.0,
      activeViewersPct: 9,
      cacheHitRatio: 98.1,
    },
    {
      resolution: '360p Mobile',
      bitrateKbps: 800,
      fps: 30,
      codec: 'H.264 Baseline / avc1.42e01e',
      segmentDuration: 4.0,
      activeViewersPct: 4,
      cacheHitRatio: 97.6,
    },
    {
      resolution: '240p Data Saver',
      bitrateKbps: 400,
      fps: 24,
      codec: 'H.264 Baseline / avc1.42e015',
      segmentDuration: 4.0,
      activeViewersPct: 1,
      cacheHitRatio: 96.9,
    },
  ];

  // Fetch live backend metrics periodically
  useEffect(() => {
    let timer: number;
    const fetchLiveStats = async () => {
      try {
        const res = await fetch('/api/infrastructure/status');
        if (res.ok) {
          const json = await res.json();
          setMetrics((prev) => ({
            ...prev,
            cdnCacheHitRatio: parseFloat(json.cdnGlobalDelivery.globalCacheHitRatio) || 98.9,
            activeTranscodeInstances: json.autoScaleServers.activeInstances || 6,
            avgTranscodeCpu: json.autoScaleServers.avgCpuUtilization || '38.4%',
          }));
        }
      } catch {
        // use dynamic synthetic telemetry
      }
    };

    fetchLiveStats();

    if (isLiveMonitoring) {
      timer = window.setInterval(() => {
        // Fluctuate buffer & bitrate realistically based on network profile
        setMetrics((prev) => {
          let baseBuffer = 14.5;
          let baseBitrate = 6180;
          let rebuffering = 0.02;

          if (networkProfile === '4g') {
            baseBuffer = 8.5;
            baseBitrate = 3150;
            rebuffering = 0.05;
          } else if (networkProfile === 'slow3g') {
            baseBuffer = 3.2;
            baseBitrate = 820;
            rebuffering = 0.18;
          }

          const jitter = (Math.random() - 0.5) * 1.2;
          const nextBuffer = Math.max(1.8, Math.round((baseBuffer + jitter) * 10) / 10);
          const nextBitrate = Math.round(baseBitrate + (Math.random() - 0.5) * 200);

          setBufferHistory((h) => [...h.slice(-14), nextBuffer]);
          setBitrateHistory((b) => [...b.slice(-14), nextBitrate]);
          setLastRefreshed(new Date());

          return {
            ...prev,
            bufferHealthSec: nextBuffer,
            currentBitrateKbps: nextBitrate,
            rebufferingFrequency: rebuffering,
          };
        });
      }, 2500);
    }

    return () => clearInterval(timer);
  }, [isLiveMonitoring, networkProfile]);

  const handleSimulateStall = () => {
    setSimulatedStallTriggered(true);
    // Instant drop in buffer to demonstrate ABR automatic downshift
    setMetrics((prev) => ({
      ...prev,
      bufferHealthSec: 1.8,
      rebufferingFrequency: 0.12,
    }));
    setBufferHistory((h) => [...h.slice(-14), 1.8]);

    setTimeout(() => {
      // Automatic ABR ladder downshift kicks in and restores buffer
      setMetrics((prev) => ({
        ...prev,
        bufferHealthSec: 9.4,
        currentBitrateKbps: 3020,
        rebufferingFrequency: 0.03,
      }));
      setBufferHistory((h) => [...h.slice(-14), 9.4]);
      setSimulatedStallTriggered(false);
    }, 2000);
  };

  const selectedVideo = videos.find((v) => v.id === selectedVideoId) || videos[0];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 text-white shadow-md shadow-purple-500/20">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                HLS Streaming & Cloud-Transcoding Telemetry
              </h3>
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Feed
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time monitoring of client playback buffers, rebuffering frequency, and cloud ABR encoding health
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Video Selector */}
          {videos.length > 0 && (
            <div className="relative">
              <select
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title.length > 32 ? `${v.title.slice(0, 32)}...` : v.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Pause / Resume Live Polling */}
          <button
            onClick={() => setIsLiveMonitoring(!isLiveMonitoring)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              isLiveMonitoring
                ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-500/30'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <Radio className={`h-3.5 w-3.5 ${isLiveMonitoring ? 'text-purple-500 animate-pulse' : ''}`} />
            <span>{isLiveMonitoring ? 'Monitoring' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics: Buffer Health, Rebuffering Frequency, Bitrates, Transcoder Speed */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Buffer Health */}
        <div className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Buffer Health</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                metrics.bufferHealthSec >= 10
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : metrics.bufferHealthSec >= 5
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {metrics.bufferHealthSec >= 10 ? 'Optimal' : metrics.bufferHealthSec >= 5 ? 'Acceptable' : 'Stall Risk'}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {metrics.bufferHealthSec}s
            </span>
            <span className="text-xs text-slate-500">ahead of playhead</span>
          </div>

          {/* Sparkline Visualizer */}
          <div className="mt-3 flex items-end gap-1 h-7 pt-1">
            {bufferHistory.map((val, i) => {
              const hPct = Math.min(100, Math.max(15, (val / 16) * 100));
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t-sm transition-all duration-300 ${
                    val >= 10 ? 'bg-emerald-500/60' : val >= 5 ? 'bg-amber-500/60' : 'bg-rose-500'
                  }`}
                  style={{ height: `${hPct}%` }}
                  title={`${val}s`}
                />
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>Target: &gt; 12.0s</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">Zero Freeze</span>
          </div>
        </div>

        {/* Metric 2: Rebuffering Frequency */}
        <div className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Rebuffer Frequency</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {metrics.rebufferingFrequency}
            </span>
            <span className="text-xs text-slate-500">stalls / stream hour</span>
          </div>

          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '99.8%' }} />
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>99.98% Smooth Playback</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">Ultra-Reliable</span>
          </div>
        </div>

        {/* Metric 3: Active Delivery Bitrate */}
        <div className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Rendition Bitrate</span>
            <Signal className="h-4 w-4 text-purple-500" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {(metrics.currentBitrateKbps / 1000).toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">Mbps (VBR)</span>
          </div>

          {/* Sparkline Visualizer */}
          <div className="mt-3 flex items-end gap-1 h-7 pt-1">
            {bitrateHistory.map((val, i) => {
              const hPct = Math.min(100, Math.max(20, (val / 7000) * 100));
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-purple-500/60 transition-all duration-300"
                  style={{ height: `${hPct}%` }}
                  title={`${val} kbps`}
                />
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>Rendition: 1080p60 FHD</span>
            <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">ABR Auto-Locked</span>
          </div>
        </div>

        {/* Metric 4: Transcoder & CDN Cluster */}
        <div className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cloud Transcoder</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {metrics.transcodingWorkerSpeed}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs py-1 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Instances:</span>
            <span className="font-bold text-slate-900 dark:text-white font-mono">{metrics.activeTranscodeInstances} Pods (NVENC)</span>
          </div>

          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Avg CPU: {metrics.avgTranscodeCpu}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Auto-Scale Ready</span>
          </div>
        </div>
      </div>

      {/* Interactive Simulation & Stress Testing Controls */}
      <div className="p-4 rounded-2xl border border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Sliders className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Adaptive Bitrate (ABR) Stress Testing
            </div>
            <div className="text-[11px] text-slate-500">
              Test how the cloud player adapts to network throttling and prevents rebuffering
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Network presets */}
          <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            {[
              { id: 'gigabit', label: 'Gigabit Fiber (1080p)' },
              { id: '4g', label: '4G LTE (720p)' },
              { id: 'slow3g', label: 'Slow 3G (360p)' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setNetworkProfile(p.id as any)}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  networkProfile === p.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleSimulateStall}
            disabled={simulatedStallTriggered}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {simulatedStallTriggered ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            <span>{simulatedStallTriggered ? 'Auto-Recovering...' : 'Inject Stall'}</span>
          </button>
        </div>
      </div>

      {/* Multi-Bitrate HLS Rendition Ladder Performance Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-500" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              HLS ABR Transcoding Ladder Renditions & CDN Edge Performance
            </h4>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Master Manifest: <code className="text-purple-600 dark:text-purple-400">/api/stream/manifest/{selectedVideoId}.m3u8</code>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3">Resolution & Profile</th>
                <th className="px-4 py-3">Target Bitrate</th>
                <th className="px-4 py-3">Frame Rate</th>
                <th className="px-4 py-3">Segment Length</th>
                <th className="px-4 py-3">Codec Profile</th>
                <th className="px-4 py-3">Audience Share</th>
                <th className="px-6 py-3 text-right">CDN Edge Cache</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {renditions.map((tier) => (
                <tr key={tier.resolution} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{tier.resolution}</span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-semibold">
                    {tier.bitrateKbps.toLocaleString()} kbps
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">
                    {tier.fps} fps
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">
                    {tier.segmentDuration.toFixed(1)}s (fMP4)
                  </td>
                  <td className="px-4 py-3.5 text-purple-600 dark:text-purple-400">
                    {tier.codec}
                  </td>
                  <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${tier.activeViewersPct}%` }} />
                      </div>
                      <span className="text-[11px] font-bold">{tier.activeViewersPct}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {tier.cacheHitRatio}% Hit
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer info banner */}
        <div className="px-6 py-3 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>All segments encoded with closed GOP (Keyframe every 2.0s) for instant seeking</span>
          </div>
          <span className="text-slate-400">
            Last Telemetry Heartbeat: {lastRefreshed.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};

function ShieldCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
