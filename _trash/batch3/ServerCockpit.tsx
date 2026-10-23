import React, { useState, useEffect } from 'react';
import { 
  Server, Cpu, HardDrive, Users, Activity, Zap, Shield, 
  ArrowUpRight, RefreshCw, Layers, Clock, AlertCircle, CheckCircle2,
  TrendingUp, DollarSign, Database
} from 'lucide-react';
import { INITIAL_SEATS } from '../data/seats';
import { ClientSeat, ServerHardwareState } from '../types';

interface ServerCockpitProps {
  currentSeat: ClientSeat;
  onSeatSelect: (seat: ClientSeat) => void;
}

export const ServerCockpit: React.FC<ServerCockpitProps> = ({
  currentSeat,
  onSeatSelect
}) => {
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [seats, setSeats] = useState<ClientSeat[]>(INITIAL_SEATS);

  // Hardware telemetry simulator
  const [hardware, setHardware] = useState<ServerHardwareState>({
    cpuUsage: 24,
    coreLoads: [28, 22, 35, 19, 24, 18, 31, 15],
    ramTotalGb: 32,
    ramUsedGb: 11.0,
    ramBreakdown: {
      ollamaModel: 4.7,
      chromaDb: 1.2,
      apiGateway: 0.3,
      osAndCache: 4.8,
      free: 21.0
    },
    activeConcurrency: 4,
    queueLength: 0,
    bgeSearchLatencyMs: 18,
    tokensPerSecond: 26.4
  });

  // Minor telemetry jitter for realistic live feel
  useEffect(() => {
    const timer = setInterval(() => {
      setHardware(prev => {
        const jitter = (Math.random() - 0.5) * 4;
        const newCpu = Math.max(12, Math.min(68, Number((prev.cpuUsage + jitter).toFixed(1))));
        const newCores = prev.coreLoads.map(load => 
          Math.max(8, Math.min(85, Math.round(load + (Math.random() - 0.5) * 6)))
        );
        return {
          ...prev,
          cpuUsage: newCpu,
          coreLoads: newCores,
          tokensPerSecond: Number((24 + Math.random() * 4).toFixed(1))
        };
      });
    }, 2800);

    return () => clearInterval(timer);
  }, []);

  const filteredSeats = seats.filter(s => {
    if (departmentFilter !== 'all' && s.department !== departmentFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  const totalCalls = seats.reduce((acc, s) => acc + s.totalCalls, 0);
  const activeCount = seats.filter(s => s.status === 'active' || s.status === 'generating').length;

  return (
    <div className="p-6 space-y-6 text-slate-100 max-w-7xl mx-auto">
      {/* Cockpit Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Server size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>中央服务器中枢管控平台</span>
                <span className="px-2 py-0.5 rounded text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/40 font-mono">
                  8核纯CPU / 32G内存
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                1台主机做中央服务器 + 30台客户端免安装运行 + 高算力媒体走按量计费云端 API
              </p>
            </div>
          </div>
        </div>

        {/* Global Stats Counter */}
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-slate-950 rounded-xl border border-slate-800 text-center min-w-[110px]">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">在线业务席位</span>
            <span className="text-lg font-bold text-amber-400">{activeCount} / 30 席</span>
          </div>

          <div className="px-4 py-2 bg-slate-950 rounded-xl border border-slate-800 text-center min-w-[110px]">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">今日服务总调用</span>
            <span className="text-lg font-bold text-slate-100 font-mono">{totalCalls.toLocaleString()} 次</span>
          </div>

          <div className="px-4 py-2 bg-slate-950 rounded-xl border border-slate-800 text-center min-w-[110px]">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">向量检索耗时</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">0.018s (BGE)</span>
          </div>
        </div>
      </div>

      {/* Hardware Telemetry Section: 8-Core CPU & 32G RAM */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. 8-Core CPU Monitor */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={18} className="text-amber-400" />
              <span className="text-sm font-semibold text-slate-200">纯CPU 8核计算负载</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {hardware.cpuUsage}% 总体负载
            </span>
          </div>

          {/* Core loads grid */}
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              {hardware.coreLoads.map((load, idx) => (
                <div key={idx} className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 block font-mono">Core {idx}</span>
                  <span className="text-xs font-mono font-bold text-slate-200">{load}%</span>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        load > 60 ? 'bg-rose-500' : load > 35 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${load}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              • 采用信号量限制最大计算并发数为 6~8，各业务员问答任务均匀分配给各核心，彻底杜绝 CPU 100% 假死。
            </p>
          </div>
        </div>

        {/* 2. 32GB RAM Allocation */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive size={18} className="text-emerald-400" />
              <span className="text-sm font-semibold text-slate-200">32GB 内存分配明细</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              已用 {hardware.ramUsedGb}G / 余量 {hardware.ramBreakdown.free}G
            </span>
          </div>

          {/* Stacked Bar */}
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
              <div style={{ width: `${(4.7 / 32) * 100}%` }} className="bg-amber-500" title="Qwen2.5:7b (4.7 GB)" />
              <div style={{ width: `${(1.2 / 32) * 100}%` }} className="bg-cyan-500" title="ChromaDB (1.2 GB)" />
              <div style={{ width: `${(0.3 / 32) * 100}%` }} className="bg-purple-500" title="FastAPI 网关 (0.3 GB)" />
              <div style={{ width: `${(4.8 / 32) * 100}%` }} className="bg-slate-600" title="Windows系统与缓存 (4.8 GB)" />
              <div style={{ width: `${(21.0 / 32) * 100}%` }} className="bg-emerald-950/80" title="充足空闲内存 (21.0 GB)" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
                <span>Ollama Qwen: 4.7 GB</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500"></span>
                <span>ChromaDB 向量: 1.2 GB</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span>
                <span>FastAPI 网关: 0.3 GB</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                <span>可用余量: 21.0 GB</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              • 32G 内存拥有极高冗余，足以支持 30 位员工同时高频检索知识库与问答。
            </p>
          </div>
        </div>

        {/* 3. Local vs Cloud Routing */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-cyan-400" />
              <span className="text-sm font-semibold text-slate-200">本地与云端智能分流</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">低成本优化</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-emerald-400 block">本地 CPU 任务 (92% 流量)</span>
                <span className="text-[11px] text-slate-400">问答、精聊、投顾、合规、话术、翻译</span>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-950/60 px-2 py-1 rounded">
                0元 免费
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-indigo-400 block">云端 API 任务 (8% 流量)</span>
                <span className="text-[11px] text-slate-400">文生图(Flux.1)、换脸、展业视频、联网</span>
              </div>
              <span className="font-mono text-xs font-bold text-amber-300 bg-amber-950/60 px-2 py-1 rounded">
                按量计费
              </span>
            </div>

            <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
              <span>今日累计云端花费:</span>
              <span className="font-mono font-bold text-amber-400 text-sm">¥ 3.82 元</span>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Seat Real-time Cluster Management */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Users size={16} className="text-amber-400" />
              <span>30 位业务员客户端实时连接看板</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              点击任一席位卡片，可直接在侧边栏中切换并接管该席位进行测试
            </p>
          </div>

          {/* Department & Status Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-slate-950 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              <option value="all">全部部门 ({seats.length})</option>
              <option value="私人银行部">私人银行部</option>
              <option value="财富管理部">财富管理部</option>
              <option value="投资顾问部">投资顾问部</option>
              <option value="合规风控部">合规风控部</option>
              <option value="量化对冲部">量化对冲部</option>
              <option value="国际金融部">国际金融部</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              <option value="all">全部状态</option>
              <option value="active">在线活跃</option>
              <option value="generating">执行生成中</option>
              <option value="idle">待命</option>
            </select>
          </div>
        </div>

        {/* 30 Seats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
          {filteredSeats.map((seat) => {
            const isSelected = currentSeat.seatId === seat.seatId;
            return (
              <div
                key={seat.seatId}
                onClick={() => onSeatSelect(seat)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition relative group ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/80 shadow-md shadow-amber-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                {/* Header info */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono font-bold text-slate-100">{seat.seatId}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      seat.status === 'generating'
                        ? 'bg-amber-400 animate-ping'
                        : seat.status === 'active'
                        ? 'bg-emerald-400'
                        : 'bg-slate-600'
                    }`}
                  />
                </div>

                {/* Name & Dept */}
                <div className="font-medium text-slate-200 truncate">{seat.name}</div>
                <div className="text-[10px] text-slate-500 truncate mb-2">{seat.department}</div>

                {/* Stats */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>令: [{seat.currentCommand || 'we'}]</span>
                  <span>{seat.totalCalls}次</span>
                </div>

                {isSelected && (
                  <div className="absolute top-1 right-1 text-[9px] bg-amber-500 text-slate-950 font-bold px-1 rounded">
                    当前
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
