import React from 'react';
import { Eye, Brain, Zap, Cpu, Check, Trash2 } from 'lucide-react';
import { ModelInfo, ModelProviderType } from '../types';

interface ModelItemRowProps {
  model: ModelInfo;
  isSelected?: boolean;
  onSelect: (model: ModelInfo) => void;
  onDelete?: (modelId: string) => void;
  compact?: boolean;
}

export const ModelItemRow: React.FC<ModelItemRowProps> = ({
  model,
  isSelected,
  onSelect,
  onDelete
}) => {
  const getProviderIconStyle = (prov: ModelProviderType) => {
    switch (prov) {
      case 'deepseek':
        return {
          bg: 'bg-blue-600/90 text-white',
          symbol: '🐋'
        };
      case 'openrouter':
        return {
          bg: 'bg-purple-600/90 text-white',
          symbol: '🔀'
        };
      case 'ollama':
        return {
          bg: 'bg-emerald-600/90 text-white',
          symbol: '🦙'
        };
      case 'openai':
        return {
          bg: 'bg-teal-600/90 text-white',
          symbol: '🤖'
        };
      case 'gemini':
      default:
        return {
          bg: 'bg-gradient-to-br from-amber-500 to-blue-600 text-white',
          symbol: '✨'
        };
    }
  };

  const pStyle = getProviderIconStyle(model.provider);

  return (
    <div
      onClick={() => onSelect(model)}
      className={`group relative flex items-start justify-between gap-2.5 p-2 rounded-lg border transition cursor-pointer select-none ${
        isSelected
          ? 'bg-blue-950/30 border-blue-500/60 shadow-sm'
          : 'bg-slate-950/50 border-slate-800/60 hover:bg-slate-900/80 hover:border-slate-700/70'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {/* Provider Brand Icon */}
        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${pStyle.bg}`}>
          {pStyle.symbol}
        </div>

        {/* Model Title, Badges, and Details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-xs font-medium tracking-tight truncate ${isSelected ? 'text-blue-300 font-semibold' : 'text-slate-100'}`}>
              {model.name}
            </span>

            {/* Feature Capability Badges */}
            <div className="flex flex-wrap items-center gap-1 shrink-0">
              {model.capabilities.map((cap) => {
                if (cap === 'VISION') {
                  return (
                    <span
                      key={cap}
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded border border-slate-800 bg-slate-900/90 text-[9px] font-mono text-slate-300"
                    >
                      <Eye size={9} className="text-cyan-400 shrink-0" />
                      <span>VISION</span>
                    </span>
                  );
                }
                if (cap === 'REASONING') {
                  return (
                    <span
                      key={cap}
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded border border-purple-800/50 bg-purple-950/30 text-[9px] font-mono text-purple-300"
                    >
                      <Brain size={9} className="text-purple-400 shrink-0" />
                      <span>REASONING</span>
                    </span>
                  );
                }
                if (cap === 'FAST') {
                  return (
                    <span
                      key={cap}
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded border border-amber-800/50 bg-amber-950/30 text-[9px] font-mono text-amber-300"
                    >
                      <Zap size={9} className="text-amber-400 shrink-0" />
                      <span>FAST</span>
                    </span>
                  );
                }
                if (cap === 'OFFLINE') {
                  return (
                    <span
                      key={cap}
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded border border-emerald-800/50 bg-emerald-950/30 text-[9px] font-mono text-emerald-300"
                    >
                      <Cpu size={9} className="text-emerald-400 shrink-0" />
                      <span>OFFLINE</span>
                    </span>
                  );
                }
                return (
                  <span
                    key={cap}
                    className="inline-flex items-center px-1 py-0.2 rounded border border-slate-800 bg-slate-900/90 text-[9px] font-mono text-slate-400"
                  >
                    {cap}
                  </span>
                );
              })}

              {/* Context Length */}
              {model.contextLength && (
                <span className="inline-flex items-center px-1 py-0.2 rounded border border-slate-800 bg-slate-900/90 text-[9px] font-mono text-slate-300">
                  {model.contextLength}
                </span>
              )}

              {/* Latest / Custom Badges */}
              {model.isLatest && (
                <span className="inline-flex items-center px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-mono font-semibold">
                  NEW
                </span>
              )}
              {model.isCustom && (
                <span className="inline-flex items-center px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[9px] font-mono">
                  自定义
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500 font-mono truncate">
              ID: {model.id}
            </span>
          </div>

          {/* Model Description: clean, subtle, minimalist typography */}
          {model.description && (
            <p className="text-[11px] text-slate-400 mt-1 leading-snug line-clamp-2">
              {model.description}
            </p>
          )}
        </div>
      </div>

      {/* Right Action / Selected status */}
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
        {isSelected ? (
          <div className="w-4 h-4 rounded-full bg-blue-500 text-slate-950 flex items-center justify-center font-bold">
            <Check size={10} />
          </div>
        ) : (
          <span className="text-[10px] text-slate-500 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition font-mono">
            选用
          </span>
        )}

        {model.isCustom && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(model.id);
            }}
            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
            title="删除自定义模型"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
};
