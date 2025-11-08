import React, { useEffect, useState } from 'react';
import { useStore } from '../store.ts';
import { Agent, AgentId } from '../types.ts';
import CoherenceGeometry from './CoherenceGeometry.tsx';
import { AGENTS } from '../constants.tsx';
import FontSizeSelector from './FontSizeSelector.tsx';
import { Compass, Flame, Loader2, ScanText } from 'lucide-react';

const AnimatedUcs: React.FC<{ value: number }> = ({ value }) => {
    const [currentValue, setCurrentValue] = useState(0);

    useEffect(() => {
        const duration = 1000;
        const start = currentValue;
        const end = value;
        const range = end - start;
        let startTime: number | null = null;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutProgress = 1 - Math.pow(1 - progress, 3);
            
            setCurrentValue(Math.round(start + range * easeOutProgress));

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [value, currentValue]); // Added currentValue to dependencies to handle external updates gracefully

    return <>{currentValue}</>;
};

const CoherenceQuestWidget: React.FC = () => {
    const { activeQuest, startSession, fetchCoherenceQuest, isLoadingQuest } = useStore();

    useEffect(() => {
        if (!activeQuest && !isLoadingQuest) {
            fetchCoherenceQuest();
        }
    }, [activeQuest, isLoadingQuest, fetchCoherenceQuest]);

    if (isLoadingQuest) {
        return (
            <div className="glass-pane rounded-2xl p-6 flex items-center justify-center gap-4">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-gray-400">Buscando sua próxima missão...</span>
            </div>
        );
    }
    
    if (!activeQuest) {
        return (
             <div className="glass-pane rounded-2xl p-6 text-center">
                <p className="text-gray-500">Nenhuma missão de coerência ativa no momento.</p>
            </div>
        )
    }

    return (
        <div 
            className="glass-pane rounded-2xl p-6 animate-fade-in cursor-pointer group hover:border-cyan-400/50"
            onClick={() => startSession({ type: activeQuest.targetTool })}
        >
             <h3 className="font-bold text-xl mb-2 text-cyan-400 flex items-center gap-2">
                <Compass />
                Missão de Coerência
             </h3>
             <h4 className="font-semibold text-lg">{activeQuest.title}</h4>
             <p className="text-sm text-gray-400 mt-1 transition-colors group-hover:text-gray-200">{activeQuest.description}</p>
        </div>
    );
};

const CoherenceInvestigationWidget: React.FC = () => {
    const { startSession } = useStore();

    return (
        <div 
            className="glass-pane rounded-2xl p-6 animate-fade-in cursor-pointer group hover:border-green-400/50"
            onClick={() => startSession({ type: 'wellness_visualizer' })}
        >
             <h3 className="font-bold text-xl mb-2 text-green-400 flex items-center gap-2">
                <ScanText />
                Investigação de Coerência
             </h3>
             <p className="text-sm text-gray-400 mt-1 transition-colors group-hover:text-gray-200">
                Analise seu estado para saber se você está pronto para "publicar" sua nova versão.
             </p>
        </div>
    );
};


const Dashboard: React.FC = () => {
    const { coherenceVector, ucs, recommendation, recommendationName, startSession, coherenceStreak } = useStore();
    const recommendedAgent = recommendation ? AGENTS[recommendation] : null;

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            <header className="mb-6">
                 <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-100">Hub de Coerência</h1>
                        <p className="text-lg md:text-xl text-gray-400 mt-2">Bem-vindo(a) ao seu espaço de alinhamento interior.</p>
                    </div>
                     {coherenceStreak > 0 && (
                        <div className="flex items-center gap-2 glass-pane py-2 px-4 rounded-full">
                            <Flame className="w-6 h-6 text-orange-400" />
                            <span className="font-bold text-xl text-gray-100">{coherenceStreak}</span>
                            <span className="text-sm text-gray-400">dias em sequência</span>
                        </div>
                    )}
                </div>
            </header>
            
            {/* Phi-Flow Bar */}
            <div className="w-full bg-gray-800 rounded-full h-2.5 mb-8">
                <div 
                    className="bg-indigo-600 h-2.5 rounded-full shadow-[0_0_10px_#818cf8]" 
                    style={{ width: `${ucs}%`, transition: 'width 1s ease-in-out' }}
                ></div>
            </div>

            <FontSizeSelector />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:items-start mt-8">
                <div data-guide-id="guide-step-0" className="lg:col-span-3 glass-pane rounded-2xl p-6 flex items-center justify-center">
                    <CoherenceGeometry vector={coherenceVector} />
                </div>

                <div className="lg:col-span-2 flex flex-col gap-8">
                    <div data-guide-id="guide-step-1" className="glass-pane rounded-2xl p-6 text-center">
                        <p className="text-gray-400 text-lg">Sua Coerência (Φ)</p>
                        <p className="text-6xl font-bold text-indigo-400 my-2">
                             <AnimatedUcs value={ucs} />
                        </p>
                        <p className="text-gray-500">Um reflexo de sua harmonia interior.</p>
                    </div>
                    
                    <CoherenceQuestWidget />

                    <CoherenceInvestigationWidget />

                    {recommendedAgent && (
                        <div className="glass-pane rounded-2xl p-6 animate-fade-in">
                             <h3 className="font-bold text-xl mb-4 text-indigo-400">Recomendação do Dia</h3>
                             <div 
                                className="flex items-center gap-4 cursor-pointer group"
                                onClick={() => startSession({ type: 'agent', id: recommendedAgent.id })}
                             >
                                 <recommendedAgent.icon className={`w-12 h-12 ${recommendedAgent.themeColor} transition-transform group-hover:scale-110`} />
                                 <div>
                                     <h4 className="font-semibold text-lg">{recommendedAgent.name}</h4>
                                     <p className="text-sm text-gray-400">Focar em {recommendationName} pode aumentar sua coerência.</p>
                                 </div>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;