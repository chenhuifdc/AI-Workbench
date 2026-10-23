import React, { useState } from 'react';
import { X, Play, RefreshCw, UserCheck, Film, Video, ShieldAlert, Sparkles, Check } from 'lucide-react';

interface FaceSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  command: string;
  prompt: string;
  seatName?: string;
}

export const FaceSwapModal: React.FC<FaceSwapModalProps> = ({
  isOpen,
  onClose,
  command,
  prompt,
  seatName = '张晨 (私行总监)'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(100);

  if (!isOpen) return null;

  const isVideo = ['sp', 'spp', 'sc', 'scc'].includes(command);
  const isVideoGeneration = ['sc', 'scc'].includes(command);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-mono text-xs font-bold border border-indigo-500/30">
              {command.toUpperCase()}
            </span>
            <span className="text-sm font-semibold text-slate-100">
              {isVideoGeneration
                ? '快手可灵 / Luma 云端金融展业视频'
                : isVideo
                ? 'InsightFace / FaceFusion 5~10秒业务拜访换脸视频'
                : '顾问商务形象融合 (静态工牌照换脸)'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Box */}
        <div className="p-6 bg-slate-950 space-y-4">
          {/* Dual Face / Video Simulator Screen */}
          <div className="relative aspect-video rounded-xl bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
            {/* Background Studio Graphic */}
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-black" />
            
            {/* Simulated Presenter Avatar */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative">
                <div className="w-28 h-28 rounded-full border-2 border-indigo-400/50 bg-gradient-to-t from-slate-800 to-slate-700 flex items-center justify-center shadow-xl overflow-hidden">
                  <UserCheck size={52} className="text-indigo-300" />
                  
                  {/* Face Swap Mesh Simulation */}
                  <div className="absolute inset-0 border border-indigo-400/30 border-dashed rounded-full animate-spin" style={{ animationDuration: '18s' }} />
                </div>
                
                {/* Active indicator */}
                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                  <Check size={11} className="text-black font-bold" />
                </div>
              </div>

              <div className="mt-3 text-center">
                <div className="text-sm font-semibold text-slate-100 flex items-center justify-center gap-1.5">
                  <span>{seatName}</span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                    面部特征向量已对齐
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {prompt ? prompt.slice(0, 36) : '“2026宏观财富峰会主讲人：专属形象与问候视频”'}
                </div>
              </div>
            </div>

            {/* Video Controls Overlay */}
            {isVideo && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-black/60 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/10 text-xs">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center gap-1.5 text-indigo-300 hover:text-white transition"
                >
                  <Play size={14} className={isPlaying ? 'text-emerald-400' : ''} />
                  <span>{isPlaying ? '播放中 (00:06 / 00:08)' : '预览8秒合成视频'}</span>
                </button>
                <span className="text-[10px] text-slate-400 font-mono">1080P · 60fps</span>
              </div>
            )}
          </div>

          {/* Details / Specs table */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">云端GPU服务商</span>
              <span className="font-medium text-slate-200">
                {isVideoGeneration ? '快手可灵 (Kling AI) 算力集群' : 'Fal.ai / Replicate FaceFusion'}
              </span>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">成本与耗时</span>
              <span className="font-medium text-amber-400">
                {isVideo ? '约 0.12~0.18 元 / 8.5s' : '约 0.03 元 / 1.8s'}
              </span>
            </div>
          </div>

          {/* Explanation note */}
          <div className="p-3 bg-amber-950/20 rounded-lg border border-amber-500/20 text-xs text-amber-300/90 flex gap-2">
            <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">纯CPU服务器协同机制：</span>
              由于您的中央服务器为8核纯CPU（无独显），跑8秒视频若在本地直接运行会导致CPU 100%死机30分钟；系统通过按量计费云端API秒级完成，本地CPU零负担！
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/20"
          >
            完成并导出媒体素材
          </button>
        </div>
      </div>
    </div>
  );
};
