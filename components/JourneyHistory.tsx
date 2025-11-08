import React, { useState, useMemo, useEffect } from 'react';
import { useStore, calculateUcs } from '../store.ts';
import { ActivityLogEntry, AgentId } from '../types.ts';
import { AGENTS, toolMetadata } from '../constants.tsx';
import { X, BookMarked, TrendingUp, Sparkles, Loader2, Activity } from 'lucide-react';
import JourneyDetailModal from './JourneyDetailModal.tsx';

const EvolutionChart: React.FC<{ data: { timestamp: number; ucs: number }[] }> = ({ data }) => {
    const [hoveredPoint, setHoveredPoint] = useState<{ x: number, y: number, ucs: number, date: string } | null>(null);

    const width = 800;
    const height = 400;
    const padding = { top: 20, right: 30, bottom: 50, left: 50 };

    const chartData = useMemo(() => {
        if (data.length < 2) return { path: '', points: [] };

        const timestamps = data.map(d => d.timestamp);
        const ucsValues = data.map(d => d.ucs);

        const minTimestamp = Math.min(...timestamps);
        const maxTimestamp = Math.max(...timestamps);
        const maxUcs = 100;
        const minUcs = 0;

        const getX = (timestamp: number) => padding.left + ((timestamp - minTimestamp) / (maxTimestamp - minTimestamp)) * (width - padding.left - padding.right);
        const getY = (ucs: number) => height - padding.bottom - ((ucs - minUcs) / (maxUcs - minUcs)) * (height - padding.top - padding.bottom);

        const points = data.map(d => ({ x: getX(d.timestamp), y: getY(d.ucs), ucs: d.ucs, timestamp: d.timestamp }));
        
        const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x} ${p.y}`).join(' ');

        return { path, points };
    }, [data]);

    if (data.length < 2) {
        return (
            <div className="flex items-center justify-center h-[400px] text-gray-500">
                <Activity className="w-8 h-8 mr-2" />
                <span>Dados insuficientes para exibir o gráfico. Continue sua jornada!</span>
            </div>
        );
    }
    
    const { path, points } = chartData;

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                {/* Gradient */}
                <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>

                {/* Grid Lines */}
                {[0, 25, 50, 75, 100].map(val => {
                    const y = height - padding.bottom - (val / 100) * (height - padding.top - padding.bottom);
                    return (
                        <g key={val}>
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.1)" />
                            <text x={padding.left - 10} y={y} dy="0.3em" textAnchor="end" fill="#6b7280" fontSize="12">{val}</text>
                        </g>
                    )
                })}

                {/* Path */}
                <path d={path} fill="none" stroke="url(#lineGradient)" strokeWidth="3" filter="url(#glow)" />
                
                {/* Data Points and Hover Area */}
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="10"
                        fill="transparent"
                        onMouseEnter={() => setHoveredPoint({ ...p, date: new Date(p.timestamp).toLocaleDateString('pt-BR') })}
                        onMouseLeave={() => setHoveredPoint(null)}
                    />
                ))}
                 {points.map((p, i) => <circle key={`dot-${i}`} cx={p.x} cy={p.y} r="3" fill="white" />)}

            </svg>

            {hoveredPoint && (
                <div
                    className="absolute p-2 text-xs text-white bg-gray-900 border border-indigo-500 rounded-md pointer-events-none"
                    style={{ left: hoveredPoint.x, top: hoveredPoint.y - 40, transform: 'translateX(-50%)' }}
                >
                    <div>Φ: {hoveredPoint.ucs}</div>
                    <div>{hoveredPoint.date}</div>
                </div>
            )}
        </div>
    );
};


interface JourneyHistoryProps {
    onExit: (isManual: boolean) => void;
}

const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const JourneyHistory: React.FC<JourneyHistoryProps> = ({ onExit }) => {
    const { activityLog, evolutionSummary, isLoadingEvolution, fetchEvolutionSummary } = useStore();
    const [selectedEntry, setSelectedEntry] = useState<ActivityLogEntry | null>(null);
    const [period, setPeriod] = useState<'7d' | '30d'>('30d');
    
    useEffect(() => {
        fetchEvolutionSummary(period);
    }, [period, fetchEvolutionSummary]);

    const chartData = useMemo(() => {
        const now = new Date();
        const periodInDays = period === '7d' ? 7 : 30;
        const startDate = new Date(now.setDate(now.getDate() - periodInDays));

        return activityLog
            .filter(entry => entry.timestamp >= startDate.getTime())
            .map(entry => ({
                timestamp: entry.timestamp,
                ucs: calculateUcs(entry.vectorSnapshot),
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [activityLog, period]);
    
    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <BookMarked className="w-8 h-8 text-cyan-400" />
                    <h1 className="text-xl font-bold text-gray-200">Minha Jornada</h1>
                </div>
                <button
                    onClick={() => onExit(true)}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Exit Journey History"
                >
                    <X size={24} />
                </button>
            </header>
            <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                
                {/* Evolution Summary */}
                <div className="glass-pane rounded-2xl p-6">
                     <h3 className="font-bold text-xl mb-4 text-purple-400 flex items-center gap-2"><Sparkles size={20} /> Resumo do Arquiteto</h3>
                     {isLoadingEvolution ? (
                         <div className="flex items-center gap-3 text-gray-400">
                             <Loader2 className="animate-spin w-5 h-5" />
                             <span>Analisando sua jornada...</span>
                         </div>
                     ) : (
                        <p className="text-gray-300 whitespace-pre-wrap">{evolutionSummary || "Nenhum resumo disponível."}</p>
                     )}
                </div>

                {/* Evolution Chart */}
                <div className="glass-pane rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-xl text-indigo-400 flex items-center gap-2"><TrendingUp/> Histórico de Coerência (Φ)</h3>
                         <div className="flex items-center gap-2 bg-gray-900/50 p-1 rounded-full">
                            {(['7d', '30d'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                                        period === p ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700/50'
                                    }`}
                                >
                                    {p === '7d' ? '7 Dias' : '30 Dias'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <EvolutionChart data={chartData} />
                </div>


                {/* Detailed Log */}
                <div>
                     <h3 className="font-bold text-xl mb-4 text-cyan-400 text-center">Registro Detalhado de Atividades</h3>
                    {activityLog.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-10">
                            <p className="text-lg text-gray-400">Seu histórico está vazio.</p>
                            <p className="text-gray-500">Comece a interagir com os mentores e ferramentas para construir sua jornada.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activityLog.map(entry => {
                                const agent = AGENTS[entry.agentId];
                                const title = entry.type === 'chat_session' 
                                    ? `Conversa com ${agent.name}`
                                    : `Ferramenta: ${toolMetadata[entry.data.toolId]?.title || 'Desconhecida'}`;
                                const Icon = entry.type === 'chat_session' 
                                    ? agent.icon 
                                    : toolMetadata[entry.data.toolId]?.icon || agent.icon;

                                return (
                                    <button
                                        key={entry.id}
                                        onClick={() => setSelectedEntry(entry)}
                                        className="w-full text-left bg-gray-800/70 p-4 rounded-lg flex items-center gap-4 cursor-pointer hover:bg-gray-700/90 transition-colors animate-fade-in"
                                    >
                                        <div className={`p-2 rounded-full`} style={{ backgroundColor: `${agent.themeColor.replace('text-', 'bg-').replace('-400', '-900/50')}`}}>
                                             <Icon className={`w-8 h-8 ${agent.themeColor} flex-shrink-0`} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-100">{title}</p>
                                            <p className="text-sm text-gray-400">{formatDate(entry.timestamp)}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {selectedEntry && (
                <JourneyDetailModal 
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                />
            )}
        </div>
    );
};

export default JourneyHistory;
