import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { produce } from 'immer';
import { Chat } from '@google/genai';

import {
    AgentId,
    Message,
    Schedule,
    Session,
    ToastMessage,
    ToolStates,
    CoherenceVector,
    View,
    GuideState,
    ToolId,
    ActivityLogEntry,
    CoherenceQuest,
    CloudSyncStatus,
} from './types.ts';
import { generateAgentResponse, summarizeForProactiveEngagement, summarizeToolResultForEngagement } from './services/geminiService.ts';
import { createDoshaChat, startDoshaConversation, continueDoshaConversation } from './services/geminiDoshaService.ts';
import { createRoutineAlignerChat, startRoutineAlignerConversation, continueRoutineAlignerConversation } from './services/geminiRoutineAlignerService.ts';
import { generateCoherenceQuest } from './services/geminiQuestService.ts';
import { generateProgressSummary } from './services/geminiProgressService.ts';
import { orchestrate } from './hooks/usePicOrchestrator.ts';
import { AGENTS } from './constants.tsx';
import { getFriendlyErrorMessage } from './utils/errorUtils.ts';

// Helper to calculate UCS (Φ score) from the new PIC-aligned vector
export const calculateUcs = (vector: CoherenceVector): number => {
    const dimensions = ['proposito', 'mental', 'relacional', 'emocional', 'somatico', 'eticoAcao', 'recursos'] as const;
    
    const totalCoherence = dimensions.reduce((sum, dim) => sum + vector[dim].coerencia, 0);
    const totalDissonance = dimensions.reduce((sum, dim) => sum + vector[dim].dissonancia, 0);
    
    const avgCoherence = totalCoherence / dimensions.length;
    const avgDissonance = totalDissonance / dimensions.length;
    
    // Net Coherence is the difference between harmony and chaos
    const netCoherence = avgCoherence - avgDissonance;
    
    // PAC Alignment acts as a multiplier/accelerator for coherence growth
    const pacFactor = (vector.alinhamentoPAC / 100) * 0.2 + 0.9; // factor from 0.9 to 1.1
    
    const finalScore = (netCoherence * pacFactor + 100) / 2; // Normalize to a 0-100 scale
    
    return Math.round(Math.max(0, Math.min(100, finalScore)));
};

// Helper to get recommendation, focusing on the highest dissonance
const getPicRecommendation = (vector: CoherenceVector): { agentId: AgentId, dimensionName: string } => {
    type DimensionKey = keyof Omit<CoherenceVector, 'alinhamentoPAC'>;

    const dimensions: { key: DimensionKey, agent: AgentId, name: string }[] = [
        { key: 'proposito', agent: AgentId.SELF_KNOWLEDGE, name: 'Propósito' },
        { key: 'mental', agent: AgentId.SELF_KNOWLEDGE, name: 'Mental' },
        { key: 'relacional', agent: AgentId.COHERENCE, name: 'Relacional' },
        { key: 'emocional', agent: AgentId.COHERENCE, name: 'Emocional' },
        { key: 'somatico', agent: AgentId.HEALTH, name: 'Somático' },
        { key: 'eticoAcao', agent: AgentId.COHERENCE, name: 'Ético-Ação' },
        { key: 'recursos', agent: AgentId.EMOTIONAL_FINANCE, name: 'Recursos' },
    ];
    
    // Find the dimension with the highest dissonance, as it's the most urgent point of "informational tension"
    let highestDissonance = -1;
    let recommendation = { agentId: AgentId.COHERENCE, dimensionName: 'Geral' };

    dimensions.forEach(dim => {
        if (vector[dim.key].dissonancia > highestDissonance) {
            highestDissonance = vector[dim.key].dissonancia;
            recommendation = { agentId: dim.agent, dimensionName: dim.name };
        }
    });

    return recommendation;
};


// Centralized error handler to check for API key issues
const handleApiError = (error: any, defaultMessage: string, addToast: AppState['addToast']): string => {
    const friendlyMessage = getFriendlyErrorMessage(error, defaultMessage);
    // Don't toast for API key errors, as the modal will appear
    if (!friendlyMessage.includes("chave de API")) {
        addToast(friendlyMessage, 'error');
    }
    return friendlyMessage;
};


// Custom storage wrapper to handle QuotaExceededError
const safeLocalStorage: StateStorage = {
    getItem: (name) => {
        try {
            return localStorage.getItem(name);
        } catch (error) {
            console.error("Failed to read from localStorage:", error);
            return null;
        }
    },
    setItem: (name, value) => {
        try {
            localStorage.setItem(name, value);
        } catch (error) {
            if (error instanceof DOMException && (error.code === 22 || error.code === 1014 || error.name === 'QuotaExceededError')) {
                console.warn("LocalStorage quota exceeded. Attempting to clear old data to make space.");
                try {
                    const currentStateString = localStorage.getItem(name);
                    if (currentStateString) {
                        const currentState = JSON.parse(currentStateString);
                        let stateModified = false;
                        
                        const pruneArray = (arr: any[]) => {
                            if (arr && arr.length > 10) {
                                const originalLength = arr.length;
                                const numberToRemove = Math.ceil(originalLength * 0.2); // Remove oldest 20%
                                arr.splice(originalLength - numberToRemove); // Oldest items are at the end
                                stateModified = true;
                            }
                        };
                        
                        // Prune activityLog (oldest items are at the end due to unshift)
                        pruneArray(currentState.state?.activityLog);
                        
                        // Prune journal history (oldest items are at the end due to unshift)
                        pruneArray(currentState.state?.toolStates?.therapeuticJournal?.history);
                        
                        // Prune verbal frequency history
                        pruneArray(currentState.state?.toolStates?.verbalFrequencyAnalysis?.history);
                        
                        if (stateModified) {
                            console.log("Pruning complete. Retrying to save state.");
                            const prunedState = JSON.stringify(currentState);
                            localStorage.setItem(name, prunedState); // Save the pruned state first
                            localStorage.setItem(name, value); // Retry saving the new state
                        }
                    }
                } catch (cleanupError) {
                    console.error("Failed to cleanup localStorage and retry saving:", cleanupError);
                }
            } else {
                console.error("Failed to write to localStorage:", error);
            }
        }
    },
    removeItem: (name) => {
        try {
            localStorage.removeItem(name);
        } catch (error) {
            console.error("Failed to remove from localStorage:", error);
        }
    },
};

type FontSize = 'small' | 'normal' | 'large';

interface AppState {
    coherenceVector: CoherenceVector;
    ucs: number;
    recommendation: AgentId | null;
    recommendationName: string;
    activeView: View;
    currentSession: (Session & { mode?: 'voice' | 'text', origin?: 'voice' | 'manual' }) | null;
    lastAgentContext: AgentId | null;
    chatHistories: Record<AgentId, Message[]>;
    isLoadingMessage: boolean;
    toolStates: ToolStates;
    toasts: ToastMessage[];
    doshaChat: Chat | null;
    routineAlignerChat: Chat | null;
    schedules: Schedule[];
    guideState: GuideState;
    completedTours: string[];
    fontSize: FontSize;
    activityLog: ActivityLogEntry[];
    isVoiceNavOpen: boolean;
    isListeningModeActive: boolean;
    reconnectionAgentId: AgentId | null;
    proactiveNavContext: string | null | 'loading';
    pendingSession: Session | null;
    cloudSyncStatus: CloudSyncStatus;
    isApiKeyRequired: boolean;

    // Gamification State
    coherencePoints: number;
    coherenceStreak: number;
    lastActivityTimestamp: number | null;
    activeQuest: CoherenceQuest | null;
    completedQuests: CoherenceQuest[];
    isLoadingQuest: boolean;
    
    // Evolution State
    evolutionSummary: string | null;
    isLoadingEvolution: boolean;

    // Actions
    setView: (view: View) => void;
    startSession: (session: Session, origin?: 'voice' | 'manual') => void;
    setPendingSession: (session: Session | null) => void;
    endSession: (isManualExit: boolean, toolResult?: { toolId: ToolId, result: any }) => Promise<void>;
    switchAgent: (agentId: AgentId) => void;
    switchAgentMode: (mode: 'voice' | 'text') => void;
    resetAgentMode: () => void;
    addMessagesToHistory: (agentId: AgentId, messages: Message[]) => void;
    addInitialMessage: (agentId: AgentId) => void;
    handleSendMessage: (agentId: AgentId, text: string, vector: CoherenceVector, toolStates: ToolStates) => Promise<void>;
    handleDoshaSendMessage: (text: string) => Promise<void>;
    initDoshaChat: () => Promise<void>;
    handleRoutineAlignerSendMessage: (text: string) => Promise<void>;
    initRoutineAlignerChat: () => Promise<void>;
    setToolState: <T extends keyof ToolStates>(toolId: T, state: ToolStates[T]) => void;
    setJournalEntry: (entry: string) => void;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    removeToast: (id: string) => void;
    addSchedule: (schedule: Omit<Schedule, 'id' | 'status'>) => void;
    handleScheduleCompletion: (scheduleId: string) => void;
    setCoherenceVector: (newVector: CoherenceVector) => void;
    goBackToAgentRoom: () => void;
    startGuide: (tourId: string, context?: any) => void;
    prevGuideStep: () => void;
    nextGuideStep: () => void;
    endGuide: () => void;
    setFontSize: (size: FontSize) => void;
    logActivity: (entryData: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'vectorSnapshot'>) => void;
    openVoiceNav: () => void;
    closeVoiceNav: () => void;
    toggleListeningMode: () => void;
    handleConnectionDrop: (agentId: AgentId, droppedTranscript: Message[]) => void;
    fetchCoherenceQuest: () => Promise<void>;
    fetchEvolutionSummary: (period: '7d' | '30d') => Promise<void>;
    syncToCloud: () => void;
    requireApiKeySelection: () => void;
    apiKeySelectionCompleted: () => void;
}

const initialVector: CoherenceVector = {
  alinhamentoPAC: 70,
  proposito: { coerencia: 60, dissonancia: 30 },
  mental: { coerencia: 75, dissonancia: 40 },
  relacional: { coerencia: 65, dissonancia: 35 },
  emocional: { coerencia: 50, dissonancia: 50 },
  somatico: { coerencia: 70, dissonancia: 20 },
  eticoAcao: { coerencia: 80, dissonancia: 10 },
  recursos: { coerencia: 55, dissonancia: 60 },
};

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            // State
            coherenceVector: initialVector,
            ucs: calculateUcs(initialVector),
            recommendation: getPicRecommendation(initialVector).agentId,
            recommendationName: getPicRecommendation(initialVector).dimensionName,
            activeView: 'dashboard',
            currentSession: null,
            lastAgentContext: null,
            chatHistories: {
                [AgentId.COHERENCE]: [],
                [AgentId.SELF_KNOWLEDGE]: [],
                [AgentId.HEALTH]: [],
                [AgentId.EMOTIONAL_FINANCE]: [],
                [AgentId.INVESTMENTS]: [],
                [AgentId.GUIDE]: [],
            },
            isLoadingMessage: false,
            toolStates: {
                therapeuticJournal: { currentEntry: '', currentFeedback: null, history: [], error: null },
                dissonanceAnalysis: { result: null, error: null },
                doshaDiagnosis: { messages: [], isFinished: false, error: null },
                routineAligner: { messages: [], isFinished: false, error: null },
                doshaResult: null,
                verbalFrequencyAnalysis: { history: [] },
                emotionalSpendingMap: { entries: [], analysis: null, error: null },
            },
            toasts: [],
            doshaChat: null,
            routineAlignerChat: null,
            schedules: [],
            guideState: { isActive: false, step: 0, tourId: null, context: {} },
            completedTours: [],
            fontSize: 'normal',
            activityLog: [],
            isVoiceNavOpen: false,
            isListeningModeActive: false,
            reconnectionAgentId: null,
            proactiveNavContext: null,
            pendingSession: null,
            cloudSyncStatus: 'synced',
            isApiKeyRequired: false,

            // Gamification State
            coherencePoints: 0,
            coherenceStreak: 0,
            lastActivityTimestamp: null,
            activeQuest: null,
            completedQuests: [],
            isLoadingQuest: false,
            // Evolution State
            evolutionSummary: null,
            isLoadingEvolution: false,

            // Actions
            setFontSize: (size) => set({ fontSize: size }),

            setView: (view) => set({ activeView: view }),

            startSession: (session, origin = 'manual') => {
                set({ reconnectionAgentId: null, proactiveNavContext: null });

                if (session.type === 'dosh_diagnosis') get().initDoshaChat();
                if (session.type === 'routine_aligner') get().initRoutineAlignerChat();

                if (session.type === 'agent') {
                    // If autoStart is true (from voice nav), default to voice mode.
                    // Otherwise, let the user choose via the mode selector.
                    const initialMode = session.autoStart ? 'voice' : undefined;

                    set({
                        currentSession: { ...session, mode: initialMode, origin },
                        lastAgentContext: session.id,
                    });
                    get().addInitialMessage(session.id);
                } else {
                    set({ currentSession: { ...session, origin } });
                }
            },

            setPendingSession: (session) => set({ pendingSession: session }),
            
            endSession: async (isManualExit: boolean, toolResult?: { toolId: ToolId, result: any }) => {
                const session = get().currentSession;
                if (!session) return;
            
                // If the session was started by voice and is not a text chat, it should return to the voice navigator.
                // This creates a consistent, conversational "hands-free" flow.
                const shouldOpenVoiceNav = session.origin === 'voice' && !(session.type === 'agent' && session.mode === 'text');
            
                if (shouldOpenVoiceNav) {
                    set({ currentSession: null, isVoiceNavOpen: true, proactiveNavContext: "loading" });
            
                    try {
                        let proactiveContext: string;
                        if (session.type !== 'agent' && toolResult) {
                            proactiveContext = await summarizeToolResultForEngagement(toolResult.toolId, toolResult.result);
                        } else if (session.type === 'agent' && session.mode === 'voice' && isManualExit) {
                            const agentId = session.id;
                            const history = get().chatHistories[agentId];
                            proactiveContext = (history && history.length > 0)
                                ? await summarizeForProactiveEngagement(history)
                                : "O que você gostaria de fazer agora?";
                        } else {
                            proactiveContext = "Sessão encerrada. O que você gostaria de fazer a seguir?";
                        }
            
                        if (get().isVoiceNavOpen) {
                            set({ proactiveNavContext: proactiveContext });
                        }
                    } catch (e) {
                        console.error("Failed to generate proactive context:", e);
                        if (get().isVoiceNavOpen) {
                            set({ proactiveNavContext: null });
                        }
                    }
                    return;
                }
            
                // This is the "manual" path for text chats or manually opened tools.
                if (session.type === 'agent') {
                    const agentId = session.id;
                    const history = get().chatHistories[agentId];
                    if (history && history.length > 1) {
                         get().logActivity({
                            type: 'chat_session',
                            agentId: agentId,
                            data: { messages: [...history] }
                        });
                    }
                }
            
                set({ currentSession: null, reconnectionAgentId: null, proactiveNavContext: null });
            },
            
            switchAgent: (agentId) => {
                const previousSession = get().currentSession;
                const wasVoiceMode = previousSession?.type === 'agent' && previousSession.mode === 'voice';
            
                if (previousSession && previousSession.type === 'agent') {
                    const prevAgentId = previousSession.id;
                    const history = get().chatHistories[prevAgentId];
                    if (history && history.length > 1) {
                        get().logActivity({
                            type: 'chat_session',
                            agentId: prevAgentId,
                            data: { messages: [...history] }
                        });
                    }
                }
            
                set({
                    currentSession: { type: 'agent', id: agentId, mode: wasVoiceMode ? 'voice' : undefined, autoStart: wasVoiceMode, origin: wasVoiceMode ? 'voice' : 'manual' },
                    lastAgentContext: agentId,
                    reconnectionAgentId: null,
                    proactiveNavContext: null,
                });
            
                get().addInitialMessage(agentId);
            },
            
            switchAgentMode: (mode) => set(produce((draft: AppState) => {
                if (draft.currentSession?.type === 'agent') {
                    draft.currentSession.mode = mode;
                }
            })),

            resetAgentMode: () => set(produce((draft: AppState) => {
                if (draft.currentSession?.type === 'agent') {
                    draft.currentSession.mode = undefined;
                }
            })),

            addMessagesToHistory: (agentId, messages) => set(produce((draft: AppState) => {
                if (!draft.chatHistories[agentId]) draft.chatHistories[agentId] = [];
                draft.chatHistories[agentId].push(...messages);
            })),

            addInitialMessage: (agentId) => {
                set(produce((draft: AppState) => {
                    const agent = AGENTS[agentId];
                    if (agent?.initialMessage && draft.chatHistories[agentId]?.length === 0) {
                        const initialMessage: Message = {
                            id: `agent-initial-${agentId}`,
                            sender: 'agent',
                            text: agent.initialMessage,
                            timestamp: Date.now()
                        };
                        draft.chatHistories[agentId].push(initialMessage);
                    }
                }));
            },

            handleSendMessage: async (agentId, text, vector, toolStates) => {
                const userMessage: Message = { id: `user-${Date.now()}`, sender: 'user', text, timestamp: Date.now() };
                
                set(produce((draft: AppState) => {
                    if (!draft.chatHistories[agentId]) draft.chatHistories[agentId] = [];
                    draft.chatHistories[agentId].push(userMessage);
                    draft.isLoadingMessage = true;
                }));

                try {
                    const history = get().chatHistories[agentId];
                    const activityLog = get().activityLog;
                    let agentResponseText = await generateAgentResponse(agentId, history, vector, toolStates, activityLog);
                    
                    const actionRegex = /\[AÇÃO:([^:]+):([^\]]+)\]/;
                    const match = agentResponseText.match(actionRegex);

                    if (match) {
                        const toolId = match[1].trim() as ToolId;
                        const payloadRaw = match[2].trim();
                        const autoStart = /auto:true/i.test(payloadRaw);

                        if (autoStart) {
                            const cleanPayload = payloadRaw.replace(/,?\s*auto:true/i, '').trim();
                            let sessionConfig: Session;
                            switch (toolId) {
                                case 'meditation':
                                    sessionConfig = { type: 'meditation', initialPrompt: cleanPayload || '', autoStart: true };
                                    break;
                                default:
                                    sessionConfig = { type: toolId as any, autoStart: true }; 
                            }
                            get().startSession(sessionConfig);
                            agentResponseText = agentResponseText.replace(actionRegex, '').trim();
                        }
                    }
                    
                    const agentMessage: Message = { id: `agent-${Date.now()}`, sender: 'agent', text: agentResponseText, timestamp: Date.now() };
                    
                    set(produce((draft: AppState) => {
                        draft.chatHistories[agentId].push(agentMessage);
                    }));

                } catch (error) {
                    const defaultMessage = `Desculpe, não consegui processar sua mensagem com ${AGENTS[agentId].name}.`;
                    const errorText = handleApiError(error, defaultMessage, get().addToast);
                    
                    const errorMessage: Message = { id: `agent-error-${Date.now()}`, sender: 'agent', text: errorText, timestamp: Date.now() };
                    set(produce((draft: AppState) => {
                        draft.chatHistories[agentId].push(errorMessage);
                    }));
                } finally {
                    set({ isLoadingMessage: false });
                }
            },

            initDoshaChat: async () => {
                set(produce((draft: AppState) => {
                    draft.isLoadingMessage = true;
                    draft.toolStates.doshaDiagnosis = { messages: [], isFinished: false, error: null };
                }));
                try {
                    const chat = createDoshaChat();
                    const firstMessage = await startDoshaConversation(chat);
                    set(produce((draft: AppState) => {
                        draft.doshaChat = chat as any;
                        if(draft.toolStates.doshaDiagnosis) {
                            draft.toolStates.doshaDiagnosis.messages.push({
                                id: `agent-${Date.now()}`, sender: 'agent', text: firstMessage, timestamp: Date.now()
                            });
                        }
                    }));
                } catch (error) {
                    const errorMsg = handleApiError(error, "Não foi possível iniciar o diagnóstico. Tente novamente.", get().addToast);
                    set(produce((draft: AppState) => {
                         if(draft.toolStates.doshaDiagnosis) draft.toolStates.doshaDiagnosis.error = errorMsg;
                    }));
                } finally {
                    set({ isLoadingMessage: false });
                }
            },
            
            handleDoshaSendMessage: async (text) => {
                const chat = get().doshaChat;
                if (!chat) return;

                const userMessage: Message = { id: `user-${Date.now()}`, sender: 'user', text, timestamp: Date.now() };

                set(produce((draft: AppState) => {
                    if(draft.toolStates.doshaDiagnosis) {
                        draft.toolStates.doshaDiagnosis.messages.push(userMessage);
                        draft.isLoadingMessage = true;
                        draft.toolStates.doshaDiagnosis.error = null;
                    }
                }));

                try {
                    const responseText = await continueDoshaConversation(chat, text);
                    const isFinished = responseText.includes("Dissonância Dominante");
                    const agentMessage: Message = { id: `agent-${Date.now()}`, sender: 'agent', text: responseText, timestamp: Date.now() };
                    
                    set(produce((draft: AppState) => {
                        const doshaDiagnosisState = draft.toolStates.doshaDiagnosis;
                        if(doshaDiagnosisState) {
                           doshaDiagnosisState.messages.push(agentMessage);
                           doshaDiagnosisState.isFinished = isFinished;
                           if (isFinished) {
                               const doshaMatch = responseText.match(/Dissonância Dominante \(Desequilíbrio\):\s*(\w+)/i);
                               if (doshaMatch && doshaMatch[1]) {
                                   const dosha = doshaMatch[1] as 'Vata' | 'Pitta' | 'Kapha';
                                   draft.toolStates.doshaResult = dosha;
                                   get().addToast(`Diagnóstico concluído: Desequilíbrio de ${dosha} detectado.`, 'info');
                               }
                               get().logActivity({
                                   type: 'tool_usage',
                                   agentId: AgentId.HEALTH,
                                   data: {
                                       toolId: 'dosh_diagnosis',
                                       result: { messages: [...doshaDiagnosisState.messages] }
                                   }
                               });
                           }
                        }
                    }));
                } catch (error) {
                     const errorMsg = handleApiError(error, "Ocorreu um erro ao processar sua resposta. Tente novamente.", get().addToast);
                     set(produce((draft: AppState) => {
                        if(draft.toolStates.doshaDiagnosis) draft.toolStates.doshaDiagnosis.error = errorMsg;
                    }));
                } finally {
                     set({ isLoadingMessage: false });
                }
            },

            initRoutineAlignerChat: async () => {
                set(produce((draft: AppState) => {
                    draft.isLoadingMessage = true;
                    draft.toolStates.routineAligner = { messages: [], isFinished: false, error: null };
                }));
                try {
                    const chat = createRoutineAlignerChat();
                    const doshaResult = get().toolStates.doshaResult;
                    const firstMessage = await startRoutineAlignerConversation(chat, doshaResult);
                    set(produce((draft: AppState) => {
                        draft.routineAlignerChat = chat as any;
                        if(draft.toolStates.routineAligner) {
                            draft.toolStates.routineAligner.messages.push({
                                id: `agent-${Date.now()}`, sender: 'agent', text: firstMessage, timestamp: Date.now()
                            });
                        }
                    }));
                } catch (error) {
                    const errorMsg = handleApiError(error, "Não foi possível iniciar o alinhador. Tente novamente.", get().addToast);
                    set(produce((draft: AppState) => {
                         if(draft.toolStates.routineAligner) draft.toolStates.routineAligner.error = errorMsg;
                    }));
                } finally {
                    set({ isLoadingMessage: false });
                }
            },
            
            handleRoutineAlignerSendMessage: async (text) => {
                const chat = get().routineAlignerChat;
                if (!chat) return;

                const userMessage: Message = { id: `user-${Date.now()}`, sender: 'user', text, timestamp: Date.now() };

                set(produce((draft: AppState) => {
                    if(draft.toolStates.routineAligner) {
                        draft.toolStates.routineAligner.messages.push(userMessage);
                        draft.isLoadingMessage = true;
                        draft.toolStates.routineAligner.error = null;
                    }
                }));

                try {
                    const responseText = await continueRoutineAlignerConversation(chat, text);
                    const isFinished = responseText.includes("esta rotina é um algoritmo, não uma prisão");
                    const agentMessage: Message = { id: `agent-${Date.now()}`, sender: 'agent', text: responseText, timestamp: Date.now() };
                    
                    set(produce((draft: AppState) => {
                        if(draft.toolStates.routineAligner) {
                           draft.toolStates.routineAligner.messages.push(agentMessage);
                           draft.toolStates.routineAligner.isFinished = isFinished;
                            if (isFinished) {
                                get().logActivity({
                                    type: 'tool_usage',
                                    agentId: AgentId.HEALTH,
                                    data: {
                                        toolId: 'routine_aligner',
                                        result: { messages: [...draft.toolStates.routineAligner.messages] }
                                    }
                                });
                            }
                        }
                    }));
                } catch (error) {
                     const errorMsg = handleApiError(error, "Ocorreu um erro ao processar sua resposta. Tente novamente.", get().addToast);
                     set(produce((draft: AppState) => {
                        if(draft.toolStates.routineAligner) draft.toolStates.routineAligner.error = errorMsg;
                    }));
                } finally {
                     set({ isLoadingMessage: false });
                }
            },
            
            setToolState: (toolId, state) => {
                set(produce((draft: AppState) => {
                    draft.toolStates[toolId] = state as any;
                }));
            },

            setJournalEntry: (entry) => {
                set(produce((draft: AppState) => {
                    if (draft.toolStates.therapeuticJournal) {
                        draft.toolStates.therapeuticJournal.currentEntry = entry;
                    }
                }));
            },

            addToast: (message: string, type: 'success' | 'error' | 'info' = 'info') => {
                const id = `toast-${Date.now()}`;
                const newToast: ToastMessage = { id, message, type };
                set(state => ({ toasts: [...state.toasts, newToast] }));
            },

            removeToast: (id) => {
                set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
            },

            addSchedule: (schedule) => {
                const newSchedule: Schedule = {
                    ...schedule,
                    id: `schedule-${Date.now()}`,
                    status: 'scheduled',
                };
                set(produce((draft: AppState) => {
                    draft.schedules.push(newSchedule);
                }));
                const agentIdForContext = get().lastAgentContext ?? AgentId.SELF_KNOWLEDGE;
                get().logActivity({
                    type: 'tool_usage',
                    agentId: agentIdForContext,
                    data: {
                        toolId: 'scheduled_session',
                        result: { schedule: newSchedule },
                    },
                });
                get().addToast(`Sessão agendada com sucesso!`, 'success');
            },
            
            handleScheduleCompletion: (scheduleId: string) => {
                set(produce((draft: AppState) => {
                    const schedule = draft.schedules.find(s => s.id === scheduleId);
                    if (!schedule) return;

                    if (schedule.recurrence === 'none') {
                        schedule.status = 'completed';
                        return;
                    }

                    const currentTime = new Date(schedule.time);
                    let nextTime = new Date(schedule.time);

                    if (schedule.recurrence === 'daily') {
                        nextTime.setDate(currentTime.getDate() + 1);
                    } else if (schedule.recurrence === 'weekly') {
                        nextTime.setDate(currentTime.getDate() + 7);
                    } else if (schedule.recurrence === 'custom' && schedule.recurrenceDays && schedule.recurrenceDays.length > 0) {
                        const sortedDays = [...schedule.recurrenceDays].sort((a, b) => a - b);
                        const currentDay = currentTime.getDay(); // 0 = Sunday
                        
                        let nextDay = sortedDays.find(d => d > currentDay);
                        let daysToAdd;
                        if (nextDay !== undefined) {
                            daysToAdd = nextDay - currentDay;
                        } else {
                            nextDay = sortedDays[0];
                            daysToAdd = (7 - currentDay) + nextDay;
                        }
                        nextTime.setDate(currentTime.getDate() + daysToAdd);
                    }

                    while (nextTime.getTime() <= Date.now()) {
                        if (schedule.recurrence === 'daily') {
                            nextTime.setDate(nextTime.getDate() + 1);
                        } else if (schedule.recurrence === 'weekly') {
                            nextTime.setDate(nextTime.getDate() + 7);
                        } else {
                            break;
                        }
                    }
                    
                    schedule.time = nextTime.getTime();
                }));
            },
            
            setCoherenceVector: (newVector) => {
                set(produce((draft: AppState) => {
                    draft.coherenceVector = newVector;
                    // After updating, recalculate dependent state
                    draft.ucs = calculateUcs(draft.coherenceVector);
                    const newRecommendation = getPicRecommendation(draft.coherenceVector);
                    draft.recommendation = newRecommendation.agentId;
                    draft.recommendationName = newRecommendation.dimensionName;
                }));
            },

            goBackToAgentRoom: () => {
                const lastAgentId = get().lastAgentContext;
                if (lastAgentId) {
                    get().startSession({ type: 'agent', id: lastAgentId });
                }
            },

            startGuide: (tourId, context = {}) => {
                // Prevent starting a new tour if one is already active
                if (get().guideState.isActive) return;
                set({ guideState: { isActive: true, step: 0, tourId, context } });
            },

            prevGuideStep: () => {
                set(state => ({
                    guideState: { ...state.guideState, step: Math.max(0, state.guideState.step - 1) }
                }));
            },

            nextGuideStep: () => {
                set(state => ({
                    guideState: { ...state.guideState, step: state.guideState.step + 1 }
                }));
            },

            endGuide: () => {
                const { tourId, context } = get().guideState;
            
                set(produce((draft: AppState) => {
                    // Deactivate guide and mark as complete in one atomic update
                    draft.guideState = { isActive: false, step: 0, tourId: null, context: {} };
                    
                    if (tourId) {
                        let uniqueTourId = tourId;
                        if (tourId === 'mentor' && context?.agent?.id) {
                            uniqueTourId = `mentor_${context.agent.id}`;
                        } else if (tourId === 'live_conversation') {
                            uniqueTourId = 'live_conversation';
                        } else if (tourId.startsWith('tool_')) {
                            uniqueTourId = tourId;
                        }
                        
                        if (!draft.completedTours.includes(uniqueTourId)) {
                            draft.completedTours.push(uniqueTourId);
                        }
                    }
                }));
            
                // Perform side-effects after state update
                if (tourId === 'main') {
                    get().setView('dashboard');
                    get().openVoiceNav();
                }
            },
            
            logActivity: (entryData) => {
                const now = Date.now();
                set(produce((draft: AppState) => {
                    const { newVector, pointsGained } = orchestrate(
                        { ...entryData, id: '', timestamp: 0, vectorSnapshot: {} as CoherenceVector }, // temp object for orchestrate
                        draft.coherenceVector
                    );

                    const newEntry: ActivityLogEntry = {
                        ...entryData,
                        id: `activity-${now}`,
                        timestamp: now,
                        vectorSnapshot: newVector, // Save the resulting vector
                    };
                    
                    draft.activityLog.unshift(newEntry);
                    if (draft.activityLog.length > 100) draft.activityLog.length = 100; // Store more for charts

                    draft.coherenceVector = newVector;
                    draft.coherencePoints += pointsGained;

                    draft.ucs = calculateUcs(newVector);
                    const newRecommendation = getPicRecommendation(newVector);
                    draft.recommendation = newRecommendation.agentId;
                    draft.recommendationName = newRecommendation.dimensionName;

                    if (draft.activeQuest && !draft.activeQuest.isCompleted && draft.activeQuest.targetTool === entryData.data.toolId) {
                        draft.activeQuest.isCompleted = true;
                        draft.activeQuest.completionTimestamp = now;
                        get().addToast(`Missão de Coerência Concluída: ${draft.activeQuest.title}!`, 'success');
                        draft.completedQuests.unshift(draft.activeQuest);
                        draft.activeQuest = null; 
                    }
                    
                    const lastDate = draft.lastActivityTimestamp ? new Date(draft.lastActivityTimestamp) : null;
                    const today = new Date(now);
                    if (!lastDate || lastDate.toDateString() !== today.toDateString()) {
                        if (lastDate && (today.getTime() - lastDate.getTime()) < (2 * 24 * 60 * 60 * 1000)) {
                            draft.coherenceStreak += 1;
                        } else {
                            draft.coherenceStreak = 1;
                        }
                    }
                    draft.lastActivityTimestamp = now;
                }));
                get().syncToCloud();
            },
            
            openVoiceNav: () => set({ isVoiceNavOpen: true }),
            
            closeVoiceNav: () => set({ isVoiceNavOpen: false, reconnectionAgentId: null, proactiveNavContext: null }),

            toggleListeningMode: () => set(state => ({ isListeningModeActive: !state.isListeningModeActive })),

            handleConnectionDrop: (agentId, droppedTranscript) => {
                set(produce((draft: AppState) => {
                    draft.chatHistories[agentId] = droppedTranscript;
                }));

                set({ 
                    reconnectionAgentId: agentId, 
                    currentSession: null,
                });
                get().addToast(`A conexão com ${AGENTS[agentId].name} caiu.`, 'error');
                get().openVoiceNav();
            },
            
            fetchCoherenceQuest: async () => {
                if (get().isLoadingQuest || get().activeQuest) return;

                set({ isLoadingQuest: true });
                try {
                    const vector = get().coherenceVector;
                    const quest = await generateCoherenceQuest(vector);
                    set({ activeQuest: quest, isLoadingQuest: false });
                } catch (error) {
                    console.error("Failed to fetch coherence quest:", error);
                    set({ isLoadingQuest: false });
                }
            },
            
            fetchEvolutionSummary: async (period) => {
                if (get().isLoadingEvolution) return;
                set({ isLoadingEvolution: true, evolutionSummary: null });
                try {
                    const allActivities = get().activityLog;
                    const summary = await generateProgressSummary(allActivities, period);
                    set({ evolutionSummary: summary, isLoadingEvolution: false });
                } catch(error) {
                    console.error("Failed to fetch evolution summary:", error);
                    const errorMsg = handleApiError(error, "Não foi possível gerar o resumo da sua evolução.", get().addToast);
                    set({ evolutionSummary: `Erro: ${errorMsg}`, isLoadingEvolution: false });
                }
            },

            syncToCloud: () => {
                // Prevent concurrent syncs
                if (get().cloudSyncStatus === 'syncing') return;

                set({ cloudSyncStatus: 'syncing' });

                // Simulate network delay
                setTimeout(() => {
                    // Simulate random success/failure
                    const success = Math.random() > 0.15; // 85% success rate
                    if (success) {
                        set({ cloudSyncStatus: 'synced' });
                        get().addToast('Sincronizado com a nuvem.', 'success');
                    } else {
                        set({ cloudSyncStatus: 'error' });
                        get().addToast('Falha na sincronização com a nuvem.', 'error');
                    }
                }, 2000);
            },
            
            requireApiKeySelection: () => set({ isApiKeyRequired: true }),
            
            apiKeySelectionCompleted: () => set({ isApiKeyRequired: false }),

        }), {
            name: 'portals-of-consciousness-storage',
            storage: createJSONStorage(() => safeLocalStorage),
            partialize: (state) => ({
                coherenceVector: state.coherenceVector,
                chatHistories: state.chatHistories,
                toolStates: state.toolStates,
                schedules: state.schedules,
                completedTours: state.completedTours,
                fontSize: state.fontSize,
                activityLog: state.activityLog,
                isListeningModeActive: state.isListeningModeActive,
                coherencePoints: state.coherencePoints,
                coherenceStreak: state.coherenceStreak,
                lastActivityTimestamp: state.lastActivityTimestamp,
                activeQuest: state.activeQuest,
                completedQuests: state.completedQuests,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.ucs = calculateUcs(state.coherenceVector);
                    const recommendation = getPicRecommendation(state.coherenceVector);
                    state.recommendation = recommendation.agentId;
                    state.recommendationName = recommendation.dimensionName;
                    
                    state.currentSession = null;
                    state.isLoadingMessage = false;
                    state.isVoiceNavOpen = false;
                    state.pendingSession = null;
                    state.isLoadingQuest = false;
                    state.evolutionSummary = null;
                    state.isLoadingEvolution = false;
                    state.cloudSyncStatus = 'synced'; // Always start as synced
                    state.isApiKeyRequired = false; // Never rehydrate this state
                }
            }
        })
);