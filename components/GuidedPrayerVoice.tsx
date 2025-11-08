import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Schedule } from '../types.ts';
import { generateGuidedPrayer } from '../services/geminiPrayerService.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { X, Pause, Play, Loader2 } from 'lucide-react';

interface GuidedPrayerVoiceProps {
    schedule: Schedule;
    onExit: (isManual: boolean) => void;
}

type PrayerState = 'generating_script' | 'generating_audio' | 'playing' | 'paused' | 'finished' | 'error';

const GuidedPrayerVoice: React.FC<GuidedPrayerVoiceProps> = ({ schedule, onExit }) => {
    const [state, setState] = useState<PrayerState>('generating_script');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement>(null);

    const startPrayer = useCallback(async () => {
        try {
            // Generate script
            setState('generating_script');
            const prayerPrompt = "uma oração de voz para paz e conexão espiritual.";
            const prayerText = await generateGuidedPrayer(prayerPrompt);

            // Generate audio
            setState('generating_audio');
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
                 setAudioUrl(URL.createObjectURL(wavBlob));
                 setState('playing');
            } else {
                throw new Error("A geração de áudio não retornou dados válidos.");
            }
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, "Falha ao criar a experiência de oração.");
            setError(friendlyError);
            setState('error');
        }
    }, []);
    
    useEffect(() => {
        startPrayer();
        return () => {
            if (audioUrl && audioUrl.startsWith('blob:')) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [startPrayer]);

    useEffect(() => {
        const audioEl = audioRef.current;
        if (state === 'playing' && audioEl) {
            audioEl.play().catch(console.error);
        } else if (state === 'paused' && audioEl) {
            audioEl.pause();
        }
    }, [state, audioUrl]);


    const handlePlayPause = () => {
        if (state === 'playing') {
            setState('paused');
        } else if (state === 'paused') {
            setState('playing');
        }
    };
    
    const renderContent = () => {
        let statusText = "";
        let showLoader = false;
        switch(state) {
            case 'generating_script':
                statusText = "Criando sua oração guiada...";
                showLoader = true;
                break;
            case 'generating_audio':
                statusText = "Gerando a narração da sua oração...";
                showLoader = true;
                break;
            case 'playing':
                statusText = "Sua oração começou. Relaxe e receba.";
                break;
            case 'paused':
                statusText = "Oração pausada.";
                break;
            case 'finished':
                statusText = "Oração concluída. Que a paz esteja com você.";
                break;
             case 'error':
                return (
                    <div className="h-full w-full flex flex-col items-center justify-center text-center">
                        <h2 className="text-2xl text-red-400 mb-4">Ocorreu um Erro</h2>
                        <p className="text-gray-300 mb-6">{error}</p>
                        <button onClick={() => onExit(true)} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-full">Voltar</button>
                    </div>
                );
        }
        
        return (
            <>
                <main className="flex-1 flex flex-col items-center justify-center text-center">
                    {showLoader && <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />}
                    <p className="text-2xl text-gray-200 h-24 max-w-3xl animate-fade-in">{statusText}</p>
                </main>
                <footer className="w-full max-w-3xl mx-auto p-4">
                     {audioUrl && (
                        <audio
                            ref={audioRef}
                            src={audioUrl}
                            onEnded={() => setState('finished')}
                            hidden
                        />
                    )}
                    <div className="flex items-center justify-center gap-8">
                        {(state === 'playing' || state === 'paused') && (
                             <button onClick={handlePlayPause} className="bg-white/20 text-white w-16 h-16 rounded-full flex items-center justify-center">
                                 {state === 'playing' ? <Pause size={32} /> : <Play size={32} className="ml-1"/>}
                             </button>
                        )}
                        {state === 'finished' && (
                             <button onClick={() => onExit(false)} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-full">
                                 Finalizar Sessão
                             </button>
                        )}
                    </div>
                </footer>
            </>
        )
    };
    
    return (
         <div className="relative h-full w-full flex flex-col p-6">
             <div className="absolute inset-0 bg-black/60 -z-10" />
             <header className="flex items-center justify-end">
                 <button onClick={() => onExit(true)} className="bg-gray-700/50 hover:bg-gray-600/50 text-white p-2 rounded-full transition-colors"><X size={24} /></button>
             </header>
             {renderContent()}
         </div>
    );
};

export default GuidedPrayerVoice;