import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store.ts';
import { CoherenceVector, AgentId, Session } from '../types.ts';
import { generateGuidedPrayer, recommendPrayerTheme } from '../services/geminiPrayerService.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { X, Sparkles, BookOpen, Volume2, Loader2 } from 'lucide-react';

interface GuidedPrayerProps {
    onExit: (isManual: boolean, result?: any) => void;
}

type PrayerState = 'config' | 'generating' | 'display' | 'error';

const getPrayerSuggestions = (vector: CoherenceVector): string[] => {
    const suggestions: { key: keyof Omit<CoherenceVector, 'alinhamentoPAC'>, value: number, themes: string[] }[] = [
        { key: 'proposito', value: vector.proposito.dissonancia, themes: ["encontrar meu propósito", "fortalecer a fé"] },
        { key: 'emocional', value: vector.emocional.dissonancia, themes: ["paz para um coração ansioso", "cura emocional"] },
        { key: 'somatico', value: vector.somatico.dissonancia, themes: ["restauração da saúde", "força para o corpo"] },
        { key: 'recursos', value: vector.recursos.dissonancia, themes: ["abertura de caminhos financeiros", "sabedoria para prosperar"] },
    ];
    const sortedStates = suggestions.sort((a, b) => b.value - a.value);
    const finalSuggestions = new Set<string>();
    sortedStates.slice(0, 2).forEach(state => {
        state.themes.forEach(theme => finalSuggestions.add(theme));
    });
    return Array.from(finalSuggestions).slice(0, 4);
};


const GuidedPrayer: React.FC<GuidedPrayerProps> = ({ onExit }) => {
    const { coherenceVector, chatHistories, lastAgentContext, logActivity, currentSession } = useStore();
    
    const isVoiceOrigin = currentSession?.origin === 'voice';
    const agentIdForContext = isVoiceOrigin ? null : lastAgentContext ?? AgentId.COHERENCE;
    const chatHistory = agentIdForContext ? (chatHistories[agentIdForContext] || []) : [];

    const [state, setState] = useState<PrayerState>('config');
    const [theme, setTheme] = useState('');
    const [prayerText, setPrayerText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isAutoSuggesting, setIsAutoSuggesting] = useState(false);

    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioData, setAudioData] = useState<{ url: string; error: string | null }>({ url: '', error: null });
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const wasAutoStarted = useRef(false);

    const suggestions = useMemo(() => getPrayerSuggestions(coherenceVector), [coherenceVector]);

    const handleGenerate = useCallback(async (inputTheme: string) => {
        setState('generating');
        setError(null);
        setPrayerText('');
        try {
            const result = await generateGuidedPrayer(inputTheme, chatHistory);
            setPrayerText(result);
            setState('display');
            logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext ?? AgentId.GUIDE,
                data: {
                    toolId: 'guided_prayer',
                    result: { theme: inputTheme, prayerText: result },
                },
            });
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, "Falha ao gerar a oração.");
            setError(friendlyError);
            setState('error');
        }
    }, [chatHistory, agentIdForContext, logActivity]);

    const handleGenerateAudio = useCallback(async () => {
        if (!prayerText) return;
        setIsGeneratingAudio(true);
        setAudioData({ url: '', error: null });
        try {
            const paragraphs = prayerText.split(/\n+/).filter(p => p.trim().length > 0);
            const audioResults = await Promise.all(paragraphs.map(p => generateSpeech(p, 'Kore')));

            const pcmByteArrays = audioResults.map(result => result?.data ? decode(result.data) : new Uint8Array(0));
            const totalLength = pcmByteArrays.reduce((acc, arr) => acc + arr.length, 0);
            const combinedPcm = new Uint8Array(totalLength);
            let offset = 0;
            pcmByteArrays.forEach(arr => {
                combinedPcm.set(arr, offset);
                offset += arr.length;
            });

            if (combinedPcm.length > 0) {
                const wavBlob = encodeWAV(combinedPcm, 24000, 1, 16);
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
    }, [prayerText]);

    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'guided_prayer' }>;
        
        const recommendAndFetch = async () => {
            if (session?.autoStart && session.initialTheme) {
                wasAutoStarted.current = true;
                setTheme(session.initialTheme);
                handleGenerate(session.initialTheme);
                return;
            }

            if (session?.initialTheme) {
                setTheme(session.initialTheme);
                setIsAutoSuggesting(false);
                return;
            }

            if (chatHistory && chatHistory.length > 1) {
                setIsAutoSuggesting(true);
                try {
                    const recommended = await recommendPrayerTheme(coherenceVector, chatHistory);
                    setTheme(recommended);
                } catch (err) {
                    console.error("Failed to recommend theme:", err);
                    setTheme(''); // Fallback
                } finally {
                    setIsAutoSuggesting(false);
                }
            }
        };
        recommendAndFetch();
    }, [currentSession, coherenceVector, chatHistory, handleGenerate]);

    useEffect(() => {
        // Chaining effect for auto audio generation
        if (prayerText && wasAutoStarted.current) {
            handleGenerateAudio();
        }
    }, [prayerText, handleGenerateAudio]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed, audioData.url]);

    const handleReset = () => {
        setState('config');
        setTheme('');
        setPrayerText('');
        setError(null);
        setAudioData({ url: '', error: null });
    };

    const renderContent = () => {
        switch (state) {
            case 'config':
                return (
                     <div className="max-w-xl w-full">
                        <p className="text-lg text-gray-300 mb-8">Qual tema você gostaria de trazer para sua oração hoje?</p>
                        <textarea value={theme} onChange={(e) => setTheme(e.target.value)} placeholder={isAutoSuggesting ? "Analisando sua conversa para sugerir um tema..." : "Ex: 'paz para um coração ansioso'"} className="w-full bg-gray-800/80 border border-gray-600 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500/80 text-lg" rows={3} disabled={isAutoSuggesting} />
                        <button onClick={() => handleGenerate(theme)} disabled={!theme.trim() || isAutoSuggesting} className="mt-4 w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800/50 disabled:cursor-not-allowed text-black font-bold py-3 px-8 rounded-full transition-colors text-lg">Gerar Oração</button>
                        <div className="my-6">
                            <h3 className="text-sm text-gray-400 mb-3">Ou comece com uma sugestão para seu momento:</h3>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                {suggestions.map(suggestion => (<button key={suggestion} onClick={() => setTheme(suggestion)} className="px-4 py-2 bg-gray-700/80 border border-gray-600/90 text-gray-300 rounded-full text-sm hover:bg-gray-600/80 hover:border-yellow-500/50 transition-colors disabled:opacity-50" disabled={isAutoSuggesting}><Sparkles className="inline w-4 h-4 mr-2 text-yellow-500/80" />{suggestion}</button>))}
                            </div>
                        </div>
                     </div>
                );
            case 'generating':
                return <div className="flex flex-col items-center"><Loader2 className="w-12 h-12 animate-spin text-yellow-400" /><p className="mt-4 text-gray-300">Criando sua oração...</p></div>;
            case 'error':
                 return (
                    <div className="text-center">
                        <h2 className="text-2xl text-red-400 mb-4">Ocorreu um Erro</h2>
                        <p className="text-gray-300 mb-6">{error}</p>
                        <button onClick={handleReset} className="bg-yellow-600 text-black font-bold py-2 px-6 rounded-full">Tentar Novamente</button>
                    </div>
                );
            case 'display':
                return (
                    <div className="animate-fade-in w-full max-w-4xl mx-auto text-center">
                        <h2 className="text-2xl font-bold text-center mb-6 text-yellow-300">Intenção: "{theme}"</h2>
                        <div className="space-y-4">
                            <div className="bg-gray-900/50 p-6 rounded-lg max-h-[65vh] overflow-y-auto" data-readable-content>
                                <p className="whitespace-pre-wrap text-gray-200 leading-relaxed text-lg">{prayerText}</p>
                            </div>
                            <div className="p-4 bg-gray-800/60 rounded-lg text-center">
                                <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800/50 text-black font-bold py-2 px-4 rounded-lg flex items-center justify-center"><Volume2 className="mr-2" />{isGeneratingAudio ? <Loader2 className="animate-spin" /> : 'Ouvir a Oração'}</button>
                                {audioData.error && <p className="text-red-400 text-xs mt-2">{audioData.error}</p>}
                                {audioData.url && (
                                    <>
                                        <audio 
                                            ref={audioRef} 
                                            controls 
                                            autoPlay={wasAutoStarted.current} 
                                            src={audioData.url} 
                                            className="w-full mt-4" 
                                            onPlay={() => { wasAutoStarted.current = false; setIsAudioPlaying(true); }} 
                                            onPause={() => setIsAudioPlaying(false)}
                                            onEnded={() => { 
                                                setIsAudioPlaying(false);
                                                onExit(false, { toolId: 'guided_prayer', result: { theme, prayerText } });
                                            }} 
                                        />
                                        <div className="flex items-center justify-center gap-2 mt-2">
                                            {[0.75, 1, 1.25, 1.5].map(speed => (
                                                <button
                                                    key={speed}
                                                    onClick={() => setPlaybackSpeed(speed)}
                                                    className={`px-3 py-1 text-xs rounded-full transition-colors ${playbackSpeed === speed ? 'bg-yellow-500 text-black font-bold' : 'bg-gray-700 text-gray-300'}`}
                                                >
                                                    {speed}x
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="text-center mt-6 flex items-center justify-center gap-4">
                            <button onClick={handleReset} className="text-yellow-400 font-semibold">Gerar Nova Oração</button>
                            <button 
                                onClick={() => onExit(false, { toolId: 'guided_prayer', result: { theme, prayerText } })} 
                                className="bg-yellow-600 text-black font-bold py-2 px-6 rounded-full"
                            >
                                Concluir Sessão
                            </button>
                        </div>
                    </div>
                );
        }
    }

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3"><BookOpen className="w-8 h-8 text-yellow-300" /><h1 className="text-xl font-bold text-gray-200">Oração Guiada</h1></div>
                <div className="flex items-center gap-4">
                    <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 no-scrollbar flex items-center justify-center" data-guide-id="tool-guided_prayer">
                {renderContent()}
            </main>
        </div>
    );
};

export default GuidedPrayer;