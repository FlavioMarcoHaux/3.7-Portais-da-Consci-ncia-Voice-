import React, { useState } from 'react';
import { useStore } from '../store.ts';
import { KeyRound, ExternalLink, Loader2 } from 'lucide-react';

const ApiKeySelector: React.FC = () => {
    const { apiKeySelectionCompleted } = useStore();
    const [isOpening, setIsOpening] = useState(false);

    const handleSelectKey = async () => {
        setIsOpening(true);
        try {
            await (window as any).aistudio.openSelectKey();
            // The guidelines mention a race condition, so we can assume success
            // after the dialog is closed by the user and reset our state.
            apiKeySelectionCompleted();
        } catch (error) {
            console.error("Error opening API key selection:", error);
            // Optionally, show an error to the user here.
        } finally {
            // Even if it fails, we might want to let the user try again later.
            setIsOpening(false);
            apiKeySelectionCompleted(); // Close the modal to allow retrying
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="glass-pane rounded-2xl w-full max-w-lg m-4 flex flex-col animate-fade-in border border-red-500/30 text-center p-8">
                <KeyRound className="w-16 h-16 mx-auto text-red-400 mb-4" />
                <h2 className="text-3xl font-bold text-gray-100 mb-4">Chave de API Necessária</h2>
                <p className="text-gray-300 mb-6">
                    O aplicativo encontrou um problema com a chave de API padrão, possivelmente devido a limites de faturamento ou uma chave inválida. Para continuar, por favor, selecione sua própria chave de API do Google AI Studio.
                </p>
                <div className="space-y-4">
                    <button
                        onClick={handleSelectKey}
                        disabled={isOpening}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 text-white font-bold py-3 px-8 rounded-full text-lg transition-colors flex items-center justify-center"
                    >
                        {isOpening ? (
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        ) : (
                            <KeyRound className="w-6 h-6 mr-2" />
                        )}
                        Selecionar Chave de API
                    </button>
                    <a
                        href="https://ai.google.dev/gemini-api/docs/billing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-400 hover:text-indigo-400 transition-colors flex items-center justify-center gap-1"
                    >
                        Saiba mais sobre o faturamento da API Gemini
                        <ExternalLink size={14} />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default ApiKeySelector;
