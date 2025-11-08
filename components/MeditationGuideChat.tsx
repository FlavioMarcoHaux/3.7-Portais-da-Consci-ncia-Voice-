import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useStore } from '../store.ts';
import { CoherenceVector } from '../types.ts';

interface MeditationGuideChatProps {
    onCreate: (prompt: string, duration: number) => void;
    onExit: () => void;
    initialPrompt?: string;
    isSummarizing?: boolean;
}

const getMeditationSuggestions = (vector: CoherenceVector): string[] => {
    const suggestions: { key: keyof Omit<CoherenceVector, 'alinhamentoPAC'>, value: number, themes: string[] }[] = [
        { key: 'proposito', value: vector.proposito.dissonancia, themes: ["Conexão com meu propósito", "Clareza de direção"] },
        { key: 'mental', value: vector.mental.dissonancia, themes: ["Acalmar a mente", "Foco e presença"] },
        { key: 'relacional', value: vector.relacional.dissonancia, themes: ["Harmonia nos relacionamentos", "Compaixão e empatia"] },
        { key: 'emocional', value: vector.emocional.dissonancia, themes: ["Paz interior e serenidade", "Liberar ansiedade", "Amor-próprio"] },
        { key: 'somatico', value: vector.somatico.dissonancia, themes: ["Relaxamento corporal profundo", "Vitalidade e energia"] },
        { key: 'eticoAcao', value: vector.eticoAcao.dissonancia, themes: ["Integridade e alinhamento", "Agir com consciência"] },
        { key: 'recursos', value: vector.recursos.dissonancia, themes: ["Mentalidade de abundância", "Confiança e segurança"] },
    ];

    const sortedStates = suggestions.sort((a, b) => b.value - a.value); // Sort descending by dissonance
    const finalSuggestions = new Set<string>();

    // Add themes from the two highest-dissonance dimensions
    sortedStates.slice(0, 2).forEach(state => {
        state.themes.forEach(theme => finalSuggestions.add(theme));
    });

    // Ensure we always have at least 4 suggestions, pulling from the next lowest if needed
    let i = 2;
    while (finalSuggestions.size < 4 && i < sortedStates.length) {
        sortedStates[i].themes.forEach(theme => finalSuggestions.add(theme));
        i++;
    }

    return Array.from(finalSuggestions).slice(0, 4);
};


const MeditationGuideChat: React.FC<MeditationGuideChatProps> = ({ onCreate, onExit, initialPrompt = '', isSummarizing = false }) => {
    const { coherenceVector } = useStore();
    const [prompt, setPrompt] = useState(initialPrompt);
    const [duration, setDuration] = useState(5);

    useEffect(() => {
        setPrompt(initialPrompt);
    }, [initialPrompt]);

    const suggestions = useMemo(() => getMeditationSuggestions(coherenceVector), [coherenceVector]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim()) {
            onCreate(prompt.trim(), duration);
        }
    };
    
    const handleSuggestionClick = (suggestion: string) => {
        setPrompt(suggestion);
        onCreate(suggestion, duration);
    }

    return (
        <div className="h-full w-full flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <h1 className="text-xl font-bold text-indigo-400">Criar Meditação</h1>
                <div className="flex items-center gap-4">
                    <button onClick={onExit} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>
            </header>
            <main className="flex-1 flex flex-col items-center p-6 pt-12 text-center">
                <div className="max-w-xl w-full">
                    <p className="text-lg text-gray-300 mb-8">
                        Qual é a sua intenção para a meditação de hoje?
                    </p>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={isSummarizing ? "Analisando sua conversa para sugerir uma intenção..." : "Ex: 'Aliviar a ansiedade e encontrar a paz interior'"}
                            className="w-full bg-gray-800/80 border border-gray-600 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/80 text-lg"
                            rows={3}
                            disabled={isSummarizing}
                            data-guide-id="meditation-prompt"
                        />
                        <div data-guide-id="meditation-duration">
                            <label htmlFor="duration" className="block text-gray-300 mb-2">Duração: {duration} minutos</label>
                            <input
                                type="range" id="duration" min="1" max="15" value={duration}
                                onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>
                        <button
                            type="submit" disabled={!prompt.trim() || isSummarizing}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-full transition-colors text-lg"
                            data-guide-id="meditation-generate-button"
                        >
                            Gerar Meditação
                        </button>
                    </form>
                    <div className="my-6">
                        <h3 className="text-sm text-gray-400 mb-3">Ou comece com uma sugestão para seu momento:</h3>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {suggestions.map(suggestion => (
                                <button
                                    key={suggestion}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="px-4 py-2 bg-gray-700/80 border border-gray-600/90 text-gray-300 rounded-full text-sm hover:bg-gray-600/80 hover:border-indigo-500/50 transition-colors disabled:opacity-50"
                                    disabled={isSummarizing}
                                >
                                    <Sparkles className="inline w-4 h-4 mr-2 text-indigo-500/80" />
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MeditationGuideChat;
