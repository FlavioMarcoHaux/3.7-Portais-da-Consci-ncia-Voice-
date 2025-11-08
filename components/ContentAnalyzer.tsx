import React, { useState, useCallback, useEffect, useRef } from 'react';
import { analyzeContentWithPIC } from '../services/geminiContentService.ts';
import { useStore } from '../store.ts';
import { Message, AgentId, Session } from '../types.ts';
import { readFileAsBase64 } from '../utils/fileUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { useWebSpeech } from '../hooks/useWebSpeech.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';
import { X, ScanText, Loader2, UploadCloud, FileText, Send, Trash2, Volume2, Bot, Download, RefreshCw, Camera, Mic } from 'lucide-react';

interface ContentAnalyzerProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const ContentAnalyzer: React.FC<ContentAnalyzerProps> = ({ onExit }) => {
    const { 
        chatHistories, 
        lastAgentContext, 
        logActivity, 
        currentSession, 
        openVoiceNav,
        addToast,
    } = useStore();
    
    const [text, setText] = useState('');
    const [baseText, setBaseText] = useState('');
    const [file, setFile] = useState<{ data: string; mimeType: string; name: string; } | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    
    const {
        transcript,
        isListening,
        startListening,
        stopListening,
        error: speechError,
    } = useWebSpeech();

    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'content_analyzer' }>;
        if (session?.initialText) {
            setText(session.initialText);
        }
    }, [currentSession]);
    
    useEffect(() => {
        if (isListening) {
            setText(baseText + (baseText ? ' ' : '') + transcript);
        }
    }, [transcript, isListening, baseText]);
    
    const handleFileChange = async (selectedFile: File) => {
        if (!selectedFile) return;
        try {
            const { data, mimeType } = await readFileAsBase64(selectedFile);
            setFile({ data, mimeType, name: selectedFile.name });
            setError(null);
        } catch (err) {
            setError("Não foi possível carregar o arquivo. Tente novamente.");
        }
    };

    const handleAnalyze = useCallback(async () => {
        if (!text.trim() && !file) {
            setError("Por favor, forneça um texto ou um arquivo para análise.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const agentIdForContext = lastAgentContext ?? AgentId.SELF_KNOWLEDGE;
            const relevantChatHistory = chatHistories[agentIdForContext] || [];
            const analysisResult = await analyzeContentWithPIC({ text, file: file || undefined }, relevantChatHistory);
            setResult(analysisResult);
            logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext,
                data: {
                    toolId: 'content_analyzer',
                    result: { text, file, result: analysisResult },
                },
            });
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, 'Ocorreu um erro desconhecido durante a análise.');
            setError(friendlyError);
        } finally {
            setIsLoading(false);
        }
    }, [text, file, chatHistories, lastAgentContext, logActivity]);

    const handleGenerateAudio = useCallback(async () => {
        if (!result) return;
        setIsGeneratingAudio(true);
        setAudioUrl(null);
        try {
            const audioResult = await generateSpeech(result, 'Zephyr');
            if (audioResult) {
                const pcmBytes = decode(audioResult.data);
                const wavBlob = encodeWAV(pcmBytes, 24000, 1, 16);
                const url = URL.createObjectURL(wavBlob);
                setAudioUrl(url);
            } else {
                throw new Error("A geração de áudio não retornou dados.");
            }
        } catch (err) {
            addToast(getFriendlyErrorMessage(err, "Falha ao gerar o áudio."), 'error');
        } finally {
            setIsGeneratingAudio(false);
        }
    }, [result, addToast]);
    
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const handleReset = () => {
        setText('');
        setFile(null);
        setResult(null);
        setError(null);
        setIsLoading(false);
        setIsGeneratingAudio(false);
        setAudioUrl(null);
    };
    
    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            setBaseText(text);
            startListening();
        }
    };

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <ScanText className="w-8 h-8 text-indigo-400" />
                    <h1 className="text-xl font-bold text-gray-200">Analisador Consciente</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onExit(true)}
                        className="text-gray-400 hover:text-white transition-colors"
                        aria-label="Exit Content Analyzer"
                    >
                        <X size={24} />
                    </button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 no-scrollbar relative">
                {!result ? (
                    <div className="flex flex-col h-full" data-guide-id="tool-content_analyzer">
                        <p className="text-center text-gray-400 mb-4">
                            Insira um texto ou envie uma imagem para analisá-lo sob a ótica do Princípio da Informação Consciente.
                        </p>
                         <div className="relative">
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder={isListening ? "Ouvindo..." : "Cole o texto aqui ou use o microfone para ditar..."}
                                className="w-full bg-gray-800/80 border border-gray-600 rounded-xl p-4 pr-12 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/80 min-h-[120px]"
                            />
                             <button
                                type="button"
                                onClick={toggleListening}
                                className={`absolute right-3 top-3 p-2 rounded-full transition-colors ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:text-white'}`}
                                aria-label={isListening ? 'Parar de ouvir' : 'Começar a ouvir'}
                            >
                                <Mic size={20} />
                            </button>
                        </div>
                        {speechError && <p className="text-center text-red-400 text-xs mt-2">{speechError}</p>}

                        {!file ? (
                            <div
                                className="mt-4 flex flex-col items-center justify-center flex-grow border-2 border-dashed border-gray-600 rounded-lg p-6"
                            >
                                <UploadCloud className="w-12 h-12 text-gray-500 mb-6" />
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <label
                                        htmlFor="file-upload"
                                        className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                                    >
                                        <FileText size={18} className="mr-2" />
                                        Carregar Arquivo
                                        <input
                                            id="file-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                                        />
                                    </label>
                                    <label
                                        htmlFor="camera-upload"
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                                    >
                                        <Camera size={18} className="mr-2" />
                                        Usar Câmera
                                        <input
                                            id="camera-upload"
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                                        />
                                    </label>
                                </div>
                                <span className="text-xs text-gray-500 mt-6">Ou arraste e solte um arquivo</span>
                            </div>
                        ) : (
                            <div className="mt-4 flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FileText className="w-6 h-6 text-indigo-400" />
                                    <span className="text-sm text-gray-300">{file.name}</span>
                                </div>
                                <button onClick={() => setFile(null)} className="text-gray-500 hover:text-red-400">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                        
                        {error && <p className="text-center text-red-400 text-sm mt-4">{error}</p>}

                        <button
                            onClick={handleAnalyze}
                            disabled={(!text.trim() && !file) || isLoading}
                            className="mt-6 w-full max-w-sm mx-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-full transition-colors text-lg flex items-center justify-center"
                        >
                            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send size={20} className="mr-2" />}
                            Analisar
                        </button>
                    </div>
                ) : (
                    <div className="animate-fade-in" data-readable-content>
                        <h2 className="text-2xl font-bold text-center mb-4 text-indigo-300">Análise Consciente</h2>
                        <div className="bg-gray-900/50 p-6 rounded-lg max-h-[65vh] md:max-h-[55vh] overflow-y-auto">
                            <p className="whitespace-pre-wrap text-gray-200 leading-relaxed">{result}</p>
                        </div>
                    </div>
                )}
            </main>
             {result && !isLoading && (
                <footer className="p-4 border-t border-gray-700/50">
                    <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                        
                        {/* Audio Controls */}
                        <div className="flex flex-col items-center gap-2">
                            <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-semibold py-2 px-4 rounded-full transition-colors flex items-center justify-center">
                                {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Volume2 className="w-5 h-5 mr-2" />}
                                Ouvir Análise
                            </button>
                             {audioUrl && <audio src={audioUrl} controls autoPlay className="max-w-xs w-full" />}
                        </div>

                        <div className="w-px h-8 bg-gray-600 hidden md:block"></div>

                        {/* Tool Actions */}
                        <div className="flex items-center gap-3">
                             <button onClick={handleReset} className="text-indigo-400 font-semibold py-2 px-4 flex items-center gap-2">
                                <RefreshCw size={18} /> Analisar Outro
                            </button>
                             <button onClick={() => onExit(false, { toolId: 'content_analyzer', result })} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-full flex items-center gap-2">
                                Concluir
                            </button>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
};

export default ContentAnalyzer;
