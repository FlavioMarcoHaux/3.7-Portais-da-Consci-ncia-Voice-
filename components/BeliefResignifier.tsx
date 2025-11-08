import React, { useState, useEffect } from 'react';
import { X, MessageSquareHeart, Sparkles } from 'lucide-react';
import { AgentId, Session } from '../types.ts';
import { useStore } from '../store.ts';

interface BeliefResignifierProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const BeliefResignifier: React.FC<BeliefResignifierProps> = ({ onExit }) => {
    const { logActivity, lastAgentContext, currentSession } = useStore();
    const [belief, setBelief] = useState('');
    const [reframed, setReframed] = useState('');

    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'belief_resignifier' }>;
        if (session?.initialBelief) {
            setBelief(session.initialBelief);
        }
    }, [currentSession]);
    
    // Simple mock function. In a real scenario, this would call a Gemini service.
    const handleResignify = () => {
        if (!belief.trim()) return;
        const newReframed = `Em vez de "${belief}", considere a perspectiva: "Eu sou um canal para a abundância fluir. O dinheiro é energia que eu uso para criar valor para mim e para os outros. Minha prosperidade é ilimitada."`;
        setReframed(newReframed);
        
        const agentIdForContext = lastAgentContext ?? AgentId.EMOTIONAL_FINANCE;
        logActivity({
            type: 'tool_usage',
            agentId: agentIdForContext,
            data: {
                toolId: 'belief_resignifier',
                result: {
                    belief,
                    reframed: newReframed,
                },
            },
        });
    };

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <MessageSquareHeart className="w-8 h-8 text-pink-400" />
                    <h1 className="text-xl font-bold text-gray-200">Ressignificador de Crenças</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center text-center p-6" data-guide-id="tool-belief_resignifier">
                 <p className="text-lg text-gray-400 mb-6 max-w-2xl">
                    Escreva uma crença limitante que você tem sobre dinheiro. Vamos transformá-la em uma afirmação de poder.
                </p>
                <div className="w-full max-w-xl">
                    <input 
                        type="text"
                        value={belief}
                        onChange={(e) => setBelief(e.target.value)}
                        placeholder="Ex: 'Dinheiro é difícil de ganhar'"
                        className="w-full bg-gray-800/80 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-500/80 text-lg"
                    />
                    <button onClick={handleResignify} disabled={!belief.trim()} className="mt-4 w-full bg-pink-600 hover:bg-pink-700 disabled:bg-pink-800/50 text-white font-bold py-3 px-8 rounded-full text-lg flex items-center justify-center mx-auto">
                        <Sparkles className="mr-2" />
                        Ressignificar
                    </button>
                </div>
                {reframed && (
                    <div className="mt-10 p-6 bg-gray-800/50 rounded-lg max-w-2xl animate-fade-in" data-readable-content>
                        <p className="text-xl text-pink-300">{reframed}</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default BeliefResignifier;
