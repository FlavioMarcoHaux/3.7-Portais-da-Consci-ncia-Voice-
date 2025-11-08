import React, { useState, useEffect, useMemo } from 'react';
import { X, Wallet, Plus, Sparkles, Loader2, Trash2, Zap, Coffee, Smile, CloudLightning, PartyPopper, CloudRain, Battery, AlertTriangle, Heart, Gift, Award } from 'lucide-react';
import { useStore } from '../store.ts';
import { Emotion, SpendingEntry, AgentId } from '../types.ts';
import { analyzeSpendingPatterns } from '../services/geminiFinancialService.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';

const emotionMap: Record<Emotion, { Icon: React.ElementType; color: string; colorHex: string; name: string; }> = {
  ansiedade: { Icon: Zap, color: 'yellow-400', colorHex: '#FBBF24', name: 'Ansiedade' },
  tedio: { Icon: Coffee, color: 'gray-400', colorHex: '#9CA3AF', name: 'Tédio' },
  felicidade: { Icon: Smile, color: 'green-400', colorHex: '#4ADE80', name: 'Felicidade' },
  estresse: { Icon: CloudLightning, color: 'red-400', colorHex: '#F87171', name: 'Estresse' },
  celebracao: { Icon: PartyPopper, color: 'pink-400', colorHex: '#F472B6', name: 'Celebração' },
  tristeza: { Icon: CloudRain, color: 'blue-400', colorHex: '#60A5FA', name: 'Tristeza' },
  cansaco: { Icon: Battery, color: 'gray-500', colorHex: '#6B7280', name: 'Cansaço' },
  culpa: { Icon: AlertTriangle, color: 'orange-400', colorHex: '#FB923C', name: 'Culpa' },
  gratidao: { Icon: Heart, color: 'rose-400', colorHex: '#FB7185', name: 'Gratidão' },
  generosidade: { Icon: Gift, color: 'teal-400', colorHex: '#2DD4BF', name: 'Generosidade' },
  conquista: { Icon: Award, color: 'amber-400', colorHex: '#FBBF24', name: 'Conquista' },
};


const AddExpenseModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (value: number, category: string, emotion: Emotion) => void;
}> = ({ isOpen, onClose, onSave }) => {
    const [value, setValue] = useState('');
    const [category, setCategory] = useState('');
    const [emotion, setEmotion] = useState<Emotion>('felicidade');

    if (!isOpen) return null;

    const handleSave = () => {
        const numValue = parseFloat(value);
        if (!numValue || numValue <= 0 || !category.trim()) return;
        onSave(numValue, category.trim(), emotion);
        // Reset form
        setValue('');
        setCategory('');
        setEmotion('felicidade');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="glass-pane rounded-2xl w-full max-w-lg m-4 flex flex-col animate-modal-fade-in border border-pink-500/30" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                    <h3 className="text-xl font-bold text-gray-100">Registrar Gasto Emocional</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </header>
                <main className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="value" className="block text-sm font-medium text-gray-400 mb-1">Valor (R$)</label>
                            <input type="number" id="value" value={value} onChange={(e) => setValue(e.target.value)} placeholder="50,00" className="w-full bg-gray-900/50 border border-gray-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-pink-500"/>
                        </div>
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-400 mb-1">Categoria</label>
                            <input type="text" id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Lanche, Presente" className="w-full bg-gray-900/50 border border-gray-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-pink-500"/>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Como você se sentiu?</label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {Object.entries(emotionMap).map(([key, { Icon, color, name }]) => (
                                <button
                                    key={key}
                                    onClick={() => setEmotion(key as Emotion)}
                                    className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 border-2 transition-all ${emotion === key ? `border-${color} bg-pink-900/40` : 'border-transparent hover:bg-gray-700/50'}`}
                                    title={name}
                                >
                                    <Icon className={`w-6 h-6 text-${color}`} />
                                    <span className="text-xs text-gray-300 truncate">{name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </main>
                 <footer className="flex justify-end gap-3 p-4 border-t border-gray-700/50">
                    <button onClick={onClose} className="text-gray-400 font-semibold py-2 px-4 rounded-md hover:bg-gray-700/50">Cancelar</button>
                    <button onClick={handleSave} className="bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-6 rounded-md">Salvar</button>
                </footer>
            </div>
        </div>
    );
};

const AnalysisModal: React.FC<{ analysis: string; onClose: () => void; isLoading: boolean }> = ({ analysis, onClose, isLoading }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <div className="glass-pane rounded-2xl w-full max-w-xl m-4 flex flex-col animate-modal-fade-in border border-pink-500/30" onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                 <h3 className="font-bold text-xl text-pink-300 flex items-center gap-2"><Sparkles size={20}/> Insight do Terapeuta</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </header>
             <main className="p-6">
                {isLoading ? (
                     <div className="flex flex-col items-center justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
                        <p className="text-gray-300 mt-4">Analisando seus padrões...</p>
                    </div>
                ) : (
                    <p className="text-pink-100 leading-relaxed text-lg">{analysis}</p>
                )}
            </main>
        </div>
    </div>
);

interface EmotionalSpendingMapProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const EmotionalSpendingMap: React.FC<EmotionalSpendingMapProps> = ({ onExit }) => {
    const { toolStates, setToolState, logActivity, lastAgentContext } = useStore();
    const mapState = toolStates.emotionalSpendingMap;
    const entries = mapState?.entries || [];
    const analysis = mapState?.analysis || null;
    const error = mapState?.error || null;
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
    const [positionedEntries, setPositionedEntries] = useState<Array<{ entry: SpendingEntry; pos: { top: string; left: string } }>>([]);

    const agentIdForContext = lastAgentContext ?? AgentId.EMOTIONAL_FINANCE;
    
    useEffect(() => {
        // Assign positions only to new entries to prevent existing ones from moving
        setPositionedEntries(prev => {
            const newPositioned = [...prev];
            const positionedIds = new Set(prev.map(p => p.entry.id));

            entries.forEach(entry => {
                if (!positionedIds.has(entry.id)) {
                    newPositioned.push({
                        entry,
                        pos: {
                            top: `${Math.random() * 80 + 10}%`,
                            left: `${Math.random() * 80 + 10}%`,
                        }
                    });
                }
            });
            // Filter out deleted entries
            const entryIds = new Set(entries.map(e => e.id));
            return newPositioned.filter(p => entryIds.has(p.entry.id));
        });
    }, [entries]);

    const handleAddEntry = (value: number, category: string, emotion: Emotion) => {
        const newEntry: SpendingEntry = { id: `spending-${Date.now()}`, timestamp: Date.now(), value, category, emotion };
        setToolState('emotionalSpendingMap', { ...mapState!, entries: [newEntry, ...entries], analysis: null, error: null });
        setIsModalOpen(false);
    };

    const handleDeleteEntry = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setToolState('emotionalSpendingMap', { ...mapState!, entries: entries.filter(entry => entry.id !== id), analysis: null });
    };

    const handleAnalyze = async () => {
        if (entries.length < 3) {
             setToolState('emotionalSpendingMap', { ...mapState!, error: "Adicione pelo menos 3 gastos para uma análise significativa." });
            return;
        }
        setIsLoading(true);
        setToolState('emotionalSpendingMap', { ...mapState!, analysis: null, error: null });
        try {
            const analysisResult = await analyzeSpendingPatterns(entries);
            setToolState('emotionalSpendingMap', { ...mapState!, analysis: analysisResult, error: null });
            logActivity({ type: 'tool_usage', agentId: agentIdForContext, data: { toolId: 'emotional_spending_map', result: { entries, analysis: analysisResult } } });
        } catch (err) {
            const errorMsg = getFriendlyErrorMessage(err, "Ocorreu um erro durante a análise.");
            setToolState('emotionalSpendingMap', { ...mapState!, analysis: null, error: errorMsg });
        } finally {
            setIsLoading(false);
        }
    };

    const clearAnalysis = () => {
         setToolState('emotionalSpendingMap', { ...mapState!, analysis: null });
    };

    const getStarSize = (value: number) => {
        // Logarithmic scale for better visual distribution
        return 30 + Math.log(value + 1) * 6;
    };
    
    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <Wallet className="w-8 h-8 text-pink-400" />
                    <h1 className="text-xl font-bold text-gray-200">Constelação de Gastos</h1>
                </div>
                <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
            </header>
            <main className="flex-1 overflow-hidden relative" data-guide-id="tool-emotional_spending_map">
                {/* Constellation Canvas */}
                <div className="absolute inset-0 bg-gray-900/30 overflow-hidden">
                    {positionedEntries.map(({ entry, pos }) => {
                        const { Icon, colorHex } = emotionMap[entry.emotion];
                        const size = getStarSize(entry.value);
                        const isHovered = hoveredEntryId === entry.id;

                        return (
                            <div
                                key={entry.id}
                                className="absolute rounded-full flex items-center justify-center transition-transform duration-300 cursor-pointer animate-star-fade-in star-glow"
                                style={{
                                    ...pos,
                                    width: `${size}px`,
                                    height: `${size}px`,
                                    backgroundColor: `rgba(${parseInt(colorHex.slice(1, 3), 16)}, ${parseInt(colorHex.slice(3, 5), 16)}, ${parseInt(colorHex.slice(5, 7), 16)}, 0.3)`,
                                    border: `2px solid ${colorHex}`,
                                    transform: `translate(-50%, -50%) scale(${isHovered ? 1.2 : 1})`,
                                    '--glow-color-strong': colorHex,
                                    '--glow-color-transparent': `rgba(${parseInt(colorHex.slice(1, 3), 16)}, ${parseInt(colorHex.slice(3, 5), 16)}, ${parseInt(colorHex.slice(5, 7), 16)}, 0.3)`,
                                } as React.CSSProperties}
                                onMouseEnter={() => setHoveredEntryId(entry.id)}
                                onMouseLeave={() => setHoveredEntryId(null)}
                            >
                                <Icon className="text-white" size={size * 0.4} />
                                {isHovered && (
                                    <div className="absolute bottom-full mb-2 w-max bg-gray-900 text-white text-xs rounded py-1 px-3 pointer-events-none">
                                        <p className="font-bold">{entry.category}</p>
                                        <p>R$ {entry.value.toFixed(2)}</p>
                                        <button onClick={(e) => handleDeleteEntry(e, entry.id)} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-0.5 pointer-events-auto"><X size={10} /></button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                {entries.length === 0 && !isModalOpen && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
                        <Wallet className="w-16 h-16 text-gray-600 mb-4" />
                        <h2 className="text-xl font-bold text-gray-400">Sua constelação está vazia.</h2>
                        <p className="text-gray-500">Clique no botão '+' para adicionar seu primeiro gasto emocional.</p>
                    </div>
                )}
                 <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                    <button onClick={handleAnalyze} disabled={isLoading || entries.length < 3} className="bg-transparent border-2 border-pink-500 hover:bg-pink-500/10 text-pink-400 disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed font-bold py-3 px-8 rounded-full text-lg flex items-center justify-center mx-auto">
                        <Sparkles className="mr-2" /> Analisar Padrões
                    </button>
                    {entries.length < 3 && <p className="text-xs text-gray-500 mt-2 text-center">Adicione mais {3 - entries.length} gasto(s) para analisar.</p>}
                     {error && <p className="text-center text-red-400 text-sm mt-2">{error}</p>}
                </div>

                <button onClick={() => setIsModalOpen(true)} className="absolute bottom-6 right-6 bg-pink-600 hover:bg-pink-700 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg transition-transform hover:scale-110">
                    <Plus size={32} />
                </button>
                
                <AddExpenseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleAddEntry} />
                {(analysis || isLoading) && <AnalysisModal analysis={analysis!} onClose={clearAnalysis} isLoading={isLoading} />}
            </main>
        </div>
    );
};

export default EmotionalSpendingMap;