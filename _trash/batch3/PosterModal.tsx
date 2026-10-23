import React, { useRef } from 'react';
import { Download, X, Check, Sparkles, ShieldCheck, Share2 } from 'lucide-react';

interface PosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  command: string;
  prompt: string;
  advisorName?: string;
}

export const PosterModal: React.FC<PosterModalProps> = ({
  isOpen,
  onClose,
  command,
  prompt,
  advisorName = '张晨 (资深私人银行家)'
}) => {
  const [copied, setCopied] = React.useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const isChineseStyle = command === 'cn';
  const isPhotoStyle = command === 'ph';
  const is4K = command === 'p';
  const isUncensored = command === 'ss';

  const handleCopyToast = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-xs font-bold border border-amber-500/30">
              {command.toUpperCase()}
            </span>
            <span className="text-sm font-semibold text-slate-100">
              {isChineseStyle ? '国潮金墨金融展业海报' : isPhotoStyle ? '超写实商务摄影海报' : is4K ? '4K超清私享会主视觉' : isUncensored ? '开放式自由创意图像' : 'Flux.1 云端高质感海报'}
            </span>
            <span className="text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              云端API已就绪 (成本 0.02元)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Poster Canvas Preview */}
        <div className="p-6 overflow-y-auto flex justify-center bg-slate-950">
          <div
            ref={canvasRef}
            className={`w-[340px] rounded-xl overflow-hidden shadow-2xl border transition relative select-none ${
              isChineseStyle
                ? 'bg-gradient-to-b from-stone-950 via-amber-950/60 to-black border-amber-600/40 text-amber-100'
                : isPhotoStyle
                ? 'bg-gradient-to-b from-slate-900 via-slate-950 to-black border-slate-700 text-slate-100'
                : 'bg-gradient-to-b from-slate-950 via-indigo-950/50 to-black border-amber-500/30 text-amber-50'
            }`}
          >
            {/* Top Badge */}
            <div className="p-5 pb-3 flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400 animate-pulse" />
                <span className="text-[11px] tracking-widest uppercase font-semibold text-amber-400">
                  PRIVATE WEALTH 2026
                </span>
              </div>
              <span className="text-[10px] text-slate-400 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                VIP专属邀约
              </span>
            </div>

            {/* Visual Graphic Representation */}
            <div className="relative h-48 w-full overflow-hidden flex items-center justify-center p-4">
              {/* Background Art */}
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/30 via-slate-900 to-transparent" />
              
              {/* Decorative Geometric FinTech Shapes */}
              <div className="relative z-10 text-center flex flex-col items-center">
                <div className="w-20 h-20 rounded-full border-2 border-amber-400/40 flex items-center justify-center shadow-lg shadow-amber-500/10 mb-2 relative">
                  <div className="w-16 h-16 rounded-full border border-amber-500/30 border-dashed animate-spin" style={{ animationDuration: '24s' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-serif text-amber-400 font-bold">融</span>
                  </div>
                </div>
                <div className="text-xs text-amber-300 font-medium tracking-widest mt-1">
                  守正出奇 · 稳御风浪
                </div>
              </div>

              {/* Watermark Lines */}
              <div className="absolute bottom-2 left-4 right-4 flex justify-between text-[9px] text-slate-500 font-mono">
                <span>INDEX 3840.25 ▲ +1.28%</span>
                <span>VOL: 1.24T</span>
              </div>
            </div>

            {/* Poster Content */}
            <div className="p-5 pt-3">
              <h3 className="text-lg font-bold tracking-tight text-white mb-1">
                {isChineseStyle ? '岁序金章 · 东方家业传承私享会' : '全球大类资产配置与家族办公室峰会'}
              </h3>
              <p className="text-xs text-slate-300 mb-4 line-clamp-2 leading-relaxed">
                {prompt || '聚焦新常态下高净值家庭资产攻守之道，解构家族信托法律隔离与稳健固收策略。'}
              </p>

              {/* Info Box */}
              <div className="bg-black/50 rounded-lg p-3 border border-white/5 space-y-1.5 text-xs text-slate-300 mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">特邀主讲：</span>
                  <span className="text-amber-300 font-medium">{advisorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">私享席位：</span>
                  <span>仅限 15 席 (闭门品鉴)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">举办地点：</span>
                  <span>陆家嘴国际金融中心 VIP贵宾阁</span>
                </div>
              </div>

              {/* Footer / QR code placeholder */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-white p-0.5 rounded flex items-center justify-center">
                    <div className="w-8 h-8 bg-slate-900 rounded grid grid-cols-3 gap-0.5 p-1">
                      <div className="bg-white rounded-[1px]" />
                      <div className="bg-white rounded-[1px]" />
                      <div className="bg-white rounded-[1px]" />
                      <div className="bg-white rounded-[1px]" />
                      <div className="bg-amber-400 rounded-[1px]" />
                      <div className="bg-white rounded-[1px]" />
                      <div className="bg-white rounded-[1px]" />
                      <div className="bg-white rounded-[1px]" />
                      <div className="bg-white rounded-[1px]" />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    <div>扫码确认席位</div>
                    <div className="text-[9px] text-slate-500">1对1专属配置顾问</div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] text-slate-500 block">合规审查批号:</span>
                  <span className="text-[9px] font-mono text-slate-400">FIN-2026-A09</span>
                </div>
              </div>

              {/* Compliance Disclaimer */}
              <div className="mt-3 pt-2 text-[8px] text-slate-500 text-center border-t border-white/5 flex items-center justify-center gap-1">
                <ShieldCheck size={10} className="text-slate-600" />
                <span>市场有风险，投资须谨慎。本海报仅作为交流邀约使用。</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>分辨率: 1080×1920 (朋友圈最佳竖屏)</span>
            <span>•</span>
            <span className="text-amber-400">云端无水印</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyToast}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition border border-slate-700"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
              {copied ? '已复制海报链接' : '分享海报'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20"
            >
              <Download size={14} />
              下载超清海报 (PNG)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
