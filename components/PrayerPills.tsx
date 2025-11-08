import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { generatePrayerPill } from '../services/geminiPrayerPillsService.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { useStore } from '../store.ts';
import { CoherenceVector, AgentId, Session } from '../types.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { X, Sparkles, Loader2 } from 'lucide-react';

interface PrayerPillsProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const getPrayerSuggestions = (vector: CoherenceVector): string[] => {
    const suggestions: { key: keyof Omit<CoherenceVector, 'alinhamentoPAC'>, value: number, themes: string[] }[] = [
        { key: 'proposito', value: vector.proposito.dissonancia, themes: ["Conexão espiritual", "Propósito"] },
        { key: 'emocional', value: vector.emocional.dissonancia, themes: ["Paz interior", "Aliviar ansiedade"] },
        { key: 'somatico', value: vector.somatico.dissonancia, themes: ["Cura e saúde", "Força"] },
        { key: 'recursos', value: vector.recursos.dissonancia, themes: ["Prosperidade", "Gratidão"] },
    ];
    const sortedStates = suggestions.sort((a, b) => b.value - a.value); // Sort by highest dissonance
    const finalSuggestions = new Set<string>();

    // Add themes from the two highest-dissonance dimensions for more relevant suggestions.
    sortedStates.slice(0, 2).forEach(state => {
        state.themes.forEach(theme => finalSuggestions.add(theme));
    });

    // Ensure we always have at least 4 suggestions.
    let i = 2;
    while (finalSuggestions.size < 4 && i < sortedStates.length) {
        sortedStates[i].themes.forEach(theme => finalSuggestions.add(theme));
        i++;
    }

    return Array.from(finalSuggestions).slice(0, 4);
};

const PrayerPills: React.FC<PrayerPillsProps> = ({ onExit }) => {
    const { coherenceVector, chatHistories, lastAgentContext, logActivity, currentSession } = useStore(state => ({
        coherenceVector: state.coherenceVector,
        chatHistories: state.chatHistories,
        lastAgentContext: state.lastAgentContext,
        logActivity: state.logActivity,
        currentSession: state.currentSession,
    }));
    
    const isVoiceOrigin = currentSession?.origin === 'voice';
    const agentIdForContext = isVoiceOrigin ? null : lastAgentContext ?? AgentId.COHERENCE;
    const chatHistory = agentIdForContext ? (chatHistories[agentIdForContext] || []) : [];

    const [theme, setTheme] = useState('');
    const [pill, setPill] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioData, setAudioData] = useState<{ url: string; error: string | null }>({ url: '', error: null });
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    
    const wasAutoStarted = useRef(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const suggestions = useMemo(() => getPrayerSuggestions(coherenceVector), [coherenceVector]);

    const handleGenerate = useCallback(async (inputTheme: string) => {
        if (!inputTheme.trim()) return;
        setTheme(inputTheme);
        setIsLoading(true);
        setError(null);
        setPill('');
        setAudioData({ url: '', error: null });
        window.scrollTo(0, 0);
        try {
            const result = await generatePrayerPill(inputTheme, chatHistory);
            setPill(result);
            logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext ?? AgentId.GUIDE,
                data: {
                    toolId: 'prayer_pills',
                    result: { theme: inputTheme, pill: result },
                },
            });
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, "Falha ao gerar a pílula de oração.");
            setError(friendlyError);
        } finally {
            setIsLoading(false);
        }
    }, [chatHistory, agentIdForContext, logActivity]);

    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'prayer_pills' }>;
        if (session?.autoStart && session.initialTheme) {
            wasAutoStarted.current = true;
            setTheme(session.initialTheme); 
            handleGenerate(session.initialTheme);
        } else if (session?.initialTheme) {
            setTheme(session.initialTheme);
        }
    }, [currentSession, handleGenerate]);
    
    const handleGenerateAudio = useCallback(async () => {
        if (!pill) return;
        setIsGeneratingAudio(true);
        setAudioData({ url: '', error: null });
        try {
            const result = await generateSpeech(pill, 'Kore');
            if (result) {
                const pcmBytes = decode(result.data);
                const wavBlob = encodeWAV(pcmBytes, 24000, 1, 16);
                const wavUrl = URL.createObjectURL(wavBlob);
                setAudioData({ url: wavUrl, error: null });
            } else {
                throw new Error("A geração de áudio não retornou dados.");
            }
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, "Falha ao gerar áudio.");
            setAudioData({ url: '', error: friendlyError });
        } finally {
            setIsGeneratingAudio(false);
        }
    }, [pill]);

    useEffect(() => {
        if (pill && wasAutoStarted.current) {
            handleGenerateAudio();
        }
    }, [pill, handleGenerateAudio]);
    
    useEffect(() => {
        return () => {
            if (audioData.url.startsWith('blob:')) {
                URL.revokeObjectURL(audioData.url);
            }
        };
    }, [audioData.url]);

    const handleGenerateRandom = () => {
        const randomTheme = "um tema universal de fé e esperança, escolhido para mim neste momento";
        setTheme('');
        handleGenerate(randomTheme);
    };

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <h1 className="text-xl font-bold text-gray-200">Pílulas de Oração</h1>
                <div className="flex items-center gap-4">
                    <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors" aria-label="Exit Prayer Pills"><X size={24} /></button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-2 sm:p-6 no-scrollbar" data-guide-id="tool-prayer_pills">
                 <div className="max-w-3xl mx-auto text-center">
                    <p className="text-gray-400 mt-2">Receba uma dose rápida de inspiração. Deixe a oração escolher um tema universal para você, ou defina sua própria intenção.</p>
                    <div className="my-6"><button onClick={handleGenerateRandom} disabled={isLoading} className="w-full max-w-sm mx-auto bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800/50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg">Dose Rápida</button></div>
                    <div className="flex items-center my-6"><div className="flex-grow border-t border-gray-600"></div><span className="flex-shrink mx-4 text-gray-500">ou</span><div className="flex-grow border-t border-gray-600"></div></div>
                    <div className="space-y-4">
                        <label htmlFor="theme-input" className="block text-gray-300">Defina sua intenção:</label>
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <input id="theme-input" type="text" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="ex: 'força' ou 'gratidão'" className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/80 text-base" disabled={isLoading} />
                            <button onClick={() => handleGenerate(theme)} disabled={isLoading || !theme.trim()} className="w-full sm:w-auto bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex-shrink-0">Gerar Pílula</button>
                        </div>
                    </div>
                    <div className="my-6">
                        <h3 className="text-sm text-gray-400 mb-3">Ou comece com uma sugestão:</h3>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {suggestions.map(suggestion => (<button key={suggestion} onClick={() => handleGenerate(suggestion)} disabled={isLoading} className="px-4 py-2 bg-gray-700/80 border border-gray-600/90 text-gray-300 rounded-full text-sm hover:bg-gray-600/80 hover:border-cyan-500/50 transition-colors disabled:opacity-50"><Sparkles className="inline w-4 h-4 mr-2 text-cyan-500/80" />{suggestion}</button>))}
                        </div>
                    </div>
                    {error && <p className="text-red-400 mt-4">{error}</p>}
                </div>

                {isLoading && (<div className="text-center my-8"><div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-cyan-500 mx-auto"></div><p className="text-gray-400 mt-4">Gerando sua pílula...</p></div>)}

                {pill && !isLoading && (
                    <div className="animate-fade-in mt-10 max-w-3xl mx-auto border-t border-gray-700 pt-8">
                        <h2 className="text-2xl font-bold text-center mb-6 text-gray-200">Sua Pílula de Oração</h2>
                        <div className="bg-gray-800/50 p-4 rounded-lg" data-readable-content><p className="whitespace-pre-wrap text-gray-200 leading-relaxed text-center text-xl">{pill}</p></div>
                         <div className="mt-6 space-y-4 p-6 glass-pane rounded-lg">
                            <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="w-full max-w-xs mx-auto bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800/50 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center">
                                {isGeneratingAudio && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Gerar Áudio
                            </button>
                            {audioData.error && <p className="text-red-400 text-center mt-2">{audioData.error}</p>}
                            {audioData.url && <audio 
                                ref={audioRef} 
                                controls 
                                autoPlay={wasAutoStarted.current} 
                                src={audioData.url} 
                                className="w-full mt-4" 
                                onPlay={() => { wasAutoStarted.current = false; setIsAudioPlaying(true); }} 
                                onPause={() => setIsAudioPlaying(false)}
                                onEnded={() => {
                                    setIsAudioPlaying(false);
                                    setTimeout(() => {
                                        onExit(false, { toolId: 'prayer_pills', result: { theme, pill } });
                                    }, 500);
                                }} />}
                        </div>
                         <div className="text-center mt-8">
                            <button 
                                onClick={() => onExit(false, { toolId: 'prayer_pills', result: { theme, pill } })} 
                                className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-full"
                            >
                                Concluir
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PrayerPills;