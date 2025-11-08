import React from 'react';

/**
 * Enum for unique agent identifiers.
 */
export enum AgentId {
  COHERENCE = 'coherence',
  SELF_KNOWLEDGE = 'self_knowledge',
  HEALTH = 'health',
  EMOTIONAL_FINANCE = 'emotional_finance',
  INVESTMENTS = 'investments',
  GUIDE = 'guide',
}

/**
 * Represents the IDs for the available tools.
 */
export type ToolId = 
  | 'meditation' 
  | 'content_analyzer' 
  | 'guided_prayer' 
  | 'prayer_pills' 
  | 'dissonance_analyzer'
  | 'therapeutic_journal'
  | 'quantum_simulator'
  | 'phi_frontier_radar'
  | 'dosh_diagnosis'
  | 'wellness_visualizer'
  | 'belief_resignifier'
  | 'emotional_spending_map'
  | 'risk_calculator'
  | 'archetype_journey'
  | 'verbal_frequency_analysis'
  | 'routine_aligner'
  | 'scheduled_session';

/**
 * Represents the structure of an AI agent's persona.
 */
export interface Agent {
  id: AgentId;
  name: string;
  description: string;
  persona?: string;
  themeColor: string;
  icon: React.ElementType;
  tools?: ToolId[];
  initialMessage?: string;
}

/**
 * Represents a state within a dimension, measuring coherence and dissonance.
 */
interface DimensionState {
  coerencia: number;  // Harmony, flow, high-Φ states (0-100)
  dissonancia: number; // Conflict, chaos, low-Φ states (0-100)
}

/**
 * Defines the user's state across 7 dimensions of coherence based on the PIC.
 * This new structure provides a deeper, dualistic view of each life area.
 */
export interface CoherenceVector {
  alinhamentoPAC: number; // Principle of Conscious Action alignment (0-100)
  proposito: DimensionState;    // Purpose / Teleological Alignment
  mental: DimensionState;       // Mental Clarity / Focus
  relacional: DimensionState;   // Relational / Social Coherence
  emocional: DimensionState;    // Emotional Balance
  somatico: DimensionState;     // Somatic / Physical Vitality
  eticoAcao: DimensionState;    // Ethical Action / Integrity
  recursos: DimensionState;     // Resources / Energy, Time, Finance Mgt
}

/**
 * Represents the structured result from the PIC Analysis Engine.
 */
export interface PicAnalysisResult {
    vector: CoherenceVector;
    summary: string;
}


/**
 * Represents a single message in a chat conversation.
 */
export interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: number;
  file?: {
    url: string;
    name: string;
    type: 'image' | 'other';
  };
}

/**
 * Represents a single spoken part of a guided meditation script.
 */
export interface MeditationScriptPart {
  text: string;
  duration: number;
}

/**
 * Represents a complete guided meditation, including its title and script.
 */
export interface Meditation {
  id: string;
  title: string;
  script: MeditationScriptPart[];
}

// Represents the main view the user is currently seeing.
export type View = 'dashboard' | 'agents' | 'tools' | 'quests';


// A discriminated union to handle different full-screen "sessions" the user can enter.
export type Session =
  | { type: 'agent'; id: AgentId; autoStart?: boolean; isReconnection?: boolean; }
  | { type: 'meditation', initialPrompt?: string, autoStart?: boolean }
  | { type: 'content_analyzer', initialText?: string }
  | { type: 'guided_prayer', initialTheme?: string, autoStart?: boolean }
  | { type: 'prayer_pills', initialTheme?: string, autoStart?: boolean }
  | { type: 'dissonance_analyzer', autoStart?: boolean }
  | { type: 'therapeutic_journal', initialEntry?: string }
  | { type: 'quantum_simulator' }
  | { type: 'phi_frontier_radar', autoStart?: boolean }
  | { type: 'dosh_diagnosis' }
  | { type: 'wellness_visualizer' }
  | { type: 'belief_resignifier', initialBelief?: string }
  | { type: 'emotional_spending_map' }
  | { type: 'risk_calculator', initialScenario?: string, autoStart?: boolean }
  | { type: 'archetype_journey' }
  | { type: 'verbal_frequency_analysis' }
  | { type: 'routine_aligner' }
  | { type: 'scheduled_session' }
  | { type: 'scheduled_session_handler', schedule: Schedule }
  | { type: 'guided_meditation_voice', schedule: Schedule }
  | { type: 'guided_prayer_voice', schedule: Schedule }
  | { type: 'prayer_pills_voice', schedule: Schedule }
  | { type: 'journey_history' }
  | { type: 'help_center' };


/**
 * Represents the structured result from the Dissonance Analyzer AI.
 */
export interface DissonanceAnalysisResult {
    tema: string;
    padrao: string;
    insight: string;
}

/**
 * Represents the structured feedback from the Therapeutic Journal AI.
 */
export interface JournalFeedback {
  observacao: string;
  dissonancia: string;
  acao: string;
}

/**
 * Represents a single saved entry in the Therapeutic Journal, with its feedback.
 */
export interface JournalEntry {
  id: string;
  entry: string;
  feedback: JournalFeedback;
  timestamp: number;
}


/**
 * Represents the structured result from the Archetype Journey AI.
 */
export interface ArchetypeAnalysisResult {
    lente: string;
    dissonancia: string;
    passo: string;
}

/**
 * Represents the structured result from the Verbal Frequency Analysis AI.
 */
export interface VerbalFrequencyAnalysisResult {
    frequencia_detectada: string;
    coerencia_score: number;
    insight_imediato: string;
    acao_pac_recomendada: string;
    mensagem_guia: string;
}

/**
 * Represents a single saved entry in the Verbal Frequency Analysis history.
 */
export interface VerbalFrequencyEntry extends VerbalFrequencyAnalysisResult {
  id: string;
  timestamp: number;
}


/**
 * Represents a single toast notification message.
 */
export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

/**
 * Represents the emotions a user can associate with a spending entry.
 */
export type Emotion = 
  | 'ansiedade' 
  | 'tedio' 
  | 'felicidade' 
  | 'estresse' 
  | 'celebracao' 
  | 'tristeza' 
  | 'cansaco' 
  | 'culpa'
  | 'gratidao'
  | 'generosidade'
  | 'conquista';

/**
 * Represents a single entry in the Emotional Spending Map.
 */
export interface SpendingEntry {
  id: string;
  timestamp: number;
  value: number;
  category: string;
  emotion: Emotion;
}


/**
 * Defines the structure for storing the state of various tools.
 */
export type ToolStates = {
    therapeuticJournal?: { 
        currentEntry: string; 
        currentFeedback: JournalFeedback | null; 
        history: JournalEntry[];
        error: string | null 
    };
    dissonanceAnalysis?: { result: DissonanceAnalysisResult | null; error: string | null };
    doshaDiagnosis?: { messages: Message[]; isFinished: boolean; error: string | null; };
    routineAligner?: { messages: Message[]; isFinished: boolean; error: string | null; };
    doshaResult?: 'Vata' | 'Pitta' | 'Kapha' | null;
    verbalFrequencyAnalysis?: { history: VerbalFrequencyEntry[] };
    emotionalSpendingMap?: {
        entries: SpendingEntry[];
        analysis: string | null;
        error: string | null;
    };
};

/**
 * Represents a single scheduled session.
 */
export interface Schedule {
  id: string;
  activity: 'meditation' | 'guided_prayer' | 'prayer_pills';
  time: number; // For recurring events, this is the timestamp of the NEXT occurrence.
  status: 'scheduled' | 'completed' | 'missed';
  recurrence: 'none' | 'daily' | 'weekly' | 'custom';
  recurrenceDays?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

/**
 * Represents the state of the interactive guide.
 */
export interface GuideState {
    isActive: boolean;
    step: number;
    tourId: string | null;
    context: any;
}

/**
 * Represents a single entry in the user's activity log/history.
 */
export type ActivityLogEntry = {
    id: string;
    timestamp: number;
    agentId: AgentId;
    vectorSnapshot: CoherenceVector; // Snapshot of the vector AFTER the activity
} & (
    | {
        type: 'chat_session';
        data: {
            messages: Message[];
        };
    }
    | {
        type: 'tool_usage';
        data: {
            toolId: ToolId;
            result: any; // The specific result data from the tool
        };
    }
);

/**
 * Represents a dynamically generated Coherence Quest.
 */
export interface CoherenceQuest {
  id: string;
  title: string;
  description: string;
  targetTool: ToolId;
  targetDimension: keyof Omit<CoherenceVector, 'alinhamentoPAC'>;
  isCompleted: boolean;
  completionTimestamp?: number;
}

/**
 * Represents the cloud synchronization status.
 */
export type CloudSyncStatus = 'synced' | 'syncing' | 'error' | 'disabled';
