import React, { useState, useEffect, useCallback } from 'react';
import { analyzeDissonance } from '../services/geminiDissonanceService.ts';
import { DissonanceAnalysisResult, AgentId, Session } from '../types.ts';
import { X, HeartPulse, Loader2, Sparkles } from 'lucide-react';
import { useStore } from '../store.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';

interface DissonanceAnalyzerProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const DissonanceAnalyzer: React.FC<DissonanceAnalyzerProps> = ({ onExit }) => {
    const { chatHistories, lastAgentContext, setToolState, logActivity, currentSession } = useStore(state => ({
        chatHistories: state.chatHistories,
        lastAgentContext: state.lastAgentContext,
        setToolState: state.setToolState,
        logActivity: state.logActivity,
        currentSession: state.currentSession,
    }));
    const agentIdForContext = lastAgentContext ?? AgentId.COHERENCE;
    const chatHistory = chatHistories[agentIdForContext] || [];
    
    const [result, setResult] = useState<DissonanceAnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const analysisResult = await analyzeDissonance(chatHistory);
            setResult(analysisResult);
            // Save the successful result to the global store
            setToolState('dissonanceAnalysis', { result: analysisResult, error: null });
            logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext,
                data: {
                    toolId: 'dissonance_analyzer',
                    result: { result: analysisResult },
                },
            });
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, 'Ocorreu um erro desconhecido durante a análise.');
            setError(friendlyError);
            setToolState('dissonanceAnalysis', { result: null, error: friendlyError });
        } finally {
            setIsLoading(false);
        }
    }, [chatHistory, setToolState, logActivity, agentIdForContext]);
    
    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'dissonance_analyzer' }>;
        if (session?.autoStart && chatHistory.length > 1) {
            handleAnalyze();
        }
    }, [currentSession, handleAnalyze, chatHistory.length]);

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <HeartPulse className="w-8 h-8 text-indigo-400" />
                    <h1 className="text-xl font-bold text-gray-200">Analisador de Dissonância</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors" aria-label="Exit Dissonance Analyzer">
                        <X size={24} />
                    </button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center" data-guide-id="tool-dissonance_analyzer">
                {isLoading && (
                    <>
                        <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
                        <p className="text-gray-300 mt-4">Analisando sua conversa em busca de padrões...</p>
                    </>
                )}

                {error && (
                    <div className="text-red-400 p-4">
                        <h3 className="font-bold mb-2">Erro na Análise:</h3>
                        <p>{error}</p>
                        <button onClick={handleAnalyze} className="mt-4 bg-gray-600 text-white font-bold py-2 px-6 rounded-full">
                            Tentar Novamente
                        </button>
                    </div>
                )}
                
                {!isLoading && !result && !error && (
                    <div className="max-w-xl">
                        <p className="text-lg text-gray-400 mb-6">Sua conversa com o mentor pode revelar padrões de pensamento e crenças limitantes. Vamos analisá-la.</p>
                        <button onClick={handleAnalyze} disabled={chatHistory.length <= 1} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-full text-lg">Analisar Conversa</button>
                        {chatHistory.length <= 1 && <p className="text-xs text-gray-500 mt-2">Converse um pouco com seu mentor antes de analisar.</p>}
                    </div>
                )}

                {result && (
                    <div className="animate-fade-in w-full max-w-2xl space-y-6" data-readable-content>
                        <div className="glass-pane p-6 rounded-lg">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tema Emocional Central</h3>
                            <p className="text-xl text-gray-100 mt-2">{result.tema}</p>
                        </div>
                        <div className="glass-pane p-6 rounded-lg">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Padrão de Dissonância</h3>
                            <p className="text-xl text-gray-100 mt-2">{result.padrao}</p>
                        </div>
                        <div className="bg-indigo-900/50 border border-indigo-700 p-6 rounded-lg">
                            <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-2"><Sparkles size={16}/> Insight Terapêutico</h3>
                            <p className="text-lg text-indigo-200 mt-2">{result.insight}</p>
                        </div>
                         <div className="flex items-center justify-center gap-4 pt-4">
                            <button onClick={handleAnalyze} className="text-indigo-400 font-semibold">Analisar Novamente</button>
                            <button onClick={() => onExit(false, { toolId: 'dissonance_analyzer', result })} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-full">Concluir</button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DissonanceAnalyzer;
