import React, { useState, useEffect } from 'react';
import { HeartHandshake, X, Loader2, Sparkles } from 'lucide-react';
import { useStore } from '../store.ts';
import { AgentId, PicAnalysisResult } from '../types.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { analyzeStateWithPIC } from '../services/geminiPicAnalysisService.ts';

const WellnessVisualizer: React.FC<{ onExit: (isManual: boolean, result?: any) => void; }> = ({ onExit }) => {
    const { setCoherenceVector, addToast, logActivity, lastAgentContext } = useStore();
    
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<PicAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (!text.trim()) {
            setError("Por favor, descreva seu estado atual para que a análise possa ser feita.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const analysisResult = await analyzeStateWithPIC(text);
            setResult(analysisResult);
            setCoherenceVector(analysisResult.vector);

            const agentIdForContext = lastAgentContext ?? AgentId.HEALTH;
            logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext,
                data: {
                    toolId: 'wellness_visualizer',
                    result: analysisResult,
                },
            });
            addToast('Seu Vetor de Coerência foi atualizado com sucesso!', 'success');

        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, 'Ocorreu um erro durante a análise PIC.');
            setError(friendlyError);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleReset = () => {
        setText('');
        setResult(null);
        setError(null);
        setIsLoading(false);
    };
    
    const DimensionDisplay: React.FC<{ label: string; coerencia: number; dissonancia: number }> = ({ label, coerencia, dissonancia }) => (
        <div className="bg-gray-900/50 p-3 rounded-lg">
            <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-gray-300">{label}</span>
            </div>
            <div className="flex gap-2 text-xs">
                 <div className="flex-1 text-center bg-indigo-900/50 p-2 rounded">
                    <span className="font-bold text-indigo-300 text-lg">{coerencia}</span>
                    <span className="block text-indigo-400/70">Coerência</span>
                </div>
                <div className="flex-1 text-center bg-pink-900/50 p-2 rounded">
                    <span className="font-bold text-pink-300 text-lg">{dissonancia}</span>
                     <span className="block text-pink-400/70">Dissonância</span>
                </div>
            </div>
        </div>
    );


    return (
        <div className="h-full w-full flex flex-col p-1 glass-pane rounded-2xl animate-fade-in">
             <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <HeartHandshake className="w-8 h-8 text-green-400" />
                    <h1 className="text-xl font-bold text-gray-200">Analisador PIC de Coerência</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto no-scrollbar" data-guide-id="tool-wellness_visualizer">
                {isLoading && (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-12 h-12 animate-spin text-green-400" />
                        <p className="mt-4 text-gray-300">Analisando seu estado através do PIC...</p>
                    </div>
                )}
                
                {error && !isLoading && (
                    <div className="text-red-400">
                        <p className="font-bold mb-2">Erro na Análise</p>
                        <p>{error}</p>
                        <button onClick={handleAnalyze} className="mt-4 bg-gray-600 text-white font-bold py-2 px-4 rounded-full">Tentar Novamente</button>
                    </div>
                )}
                
                {!isLoading && !result && (
                     <div className="w-full max-w-2xl">
                        <p className="text-lg text-gray-400 mb-6">Descreva seu estado atual. Fale sobre seus pensamentos, sentimentos, corpo, desafios e vitórias. Quanto mais detalhes, mais precisa será a análise do seu Vetor de Coerência.</p>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Ex: 'Hoje me sinto com bastante energia física, mas minha mente está ansiosa com um projeto do trabalho. Isso está afetando minhas interações e meu propósito parece distante...'"
                            className="w-full h-48 bg-gray-800/80 border border-gray-600 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-green-500/80 text-lg"
                        />
                        <button onClick={handleAnalyze} className="mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full text-lg">
                            Analisar meu Estado
                        </button>
                    </div>
                )}

                {!isLoading && result && (
                    <div className="w-full max-w-3xl animate-fade-in space-y-6" data-readable-content>
                        <div className="bg-gray-800/50 p-6 rounded-xl">
                             <h3 className="font-bold text-xl mb-3 text-purple-400 flex items-center justify-center gap-2"><Sparkles size={20} /> Resumo da Análise PIC</h3>
                             <p className="text-gray-300 whitespace-pre-wrap">{result.summary}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DimensionDisplay label="Propósito" {...result.vector.proposito} />
                            <DimensionDisplay label="Mental" {...result.vector.mental} />
                            <DimensionDisplay label="Relacional" {...result.vector.relacional} />
                            <DimensionDisplay label="Emocional" {...result.vector.emocional} />
                            <DimensionDisplay label="Somático" {...result.vector.somatico} />
                            <DimensionDisplay label="Ação Ética" {...result.vector.eticoAcao} />
                             <DimensionDisplay label="Recursos" {...result.vector.recursos} />
                             <div className="bg-gray-900/50 p-3 rounded-lg text-center flex flex-col justify-center">
                                <span className="font-semibold text-gray-300">Alinhamento PAC</span>
                                <span className="font-bold text-yellow-400 text-3xl">{result.vector.alinhamentoPAC}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-4">
                            <button onClick={handleReset} className="text-green-400 font-semibold py-3 px-6">Nova Análise</button>
                            <button onClick={() => onExit(false, { toolId: 'wellness_visualizer', result })} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full">Concluir</button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default WellnessVisualizer;
