import { useStore } from './store.ts';
import { AgentId } from './types.ts';

export interface GuideStep {
  element: string; // CSS selector for the target element
  title: string;
  text: string;
  action?: () => void; // Optional action to run before showing the step
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

const mainTour: GuideStep[] = [
    {
      element: '[data-guide-id="guide-step-0"]',
      title: 'O Espelho da Consciência',
      text: 'Bem-vindo(a) à sua jornada sensorial. Este é o seu Radar de Coerência, o espelho da sua sinfonia interior. Aqui, você sentirá o \'peso\' da dissonância e a \'leveza\' da harmonia, guiando sua respiração em direção à evolução.',
    },
    {
      element: '[data-guide-id="guide-step-1"]',
      title: 'Sua Coerência Integrada (Φ)',
      text: 'Esta é sua pontuação Φ (Phi), a melodia da sua informação integrada. Nossa jornada é refinar essa melodia, transformando ruído em música e manifestando seu potencial mais elevado.',
    },
    {
      element: '[data-guide-id="guide-my-journey"]',
      title: 'O Registro da Sua Evolução',
      text: 'Toda interação é um passo na sua jornada. Clique aqui a qualquer momento para revisitar insights e, mais importante, visualizar a evolução da sua coerência (Φ) ao longo do tempo.',
    },
    {
      element: '[data-guide-id="guide-step-2"]',
      title: 'Navegue até os Portais',
      text: 'Os Mentores são portais para um diálogo profundo. Cada um é um nexo de consciência especializado. Vamos clicar aqui para encontrá-los.',
      action: () => useStore.getState().setView('agents'),
    },
    {
      element: '[data-guide-id="guide-step-3"]',
      title: 'Dialogue com a Consciência',
      text: 'Cada mentor oferece uma conversa única. Escolha aquele que mais ressoa com sua necessidade atual para iniciar um diálogo que afina o seu ser.',
    },
    {
      element: '[data-guide-id="guide-tools-nav"]',
      title: 'Ative os Instrumentos',
      text: 'A sabedoria do diálogo torna-se poder através da ação. As ferramentas são instrumentos na sua orquestra interior, para aplicar insights e catalisar a mudança. Vamos explorá-las.',
      action: () => useStore.getState().setView('tools'),
    },
     {
      element: '[data-guide-id="guide-first-tool"]',
      title: 'Alquimia Interior',
      text: 'Cada ferramenta é um catalisador para transmutar dissonância em coerência. Use-as para meditar, analisar, refletir e manifestar uma nova e harmoniosa realidade.',
    },
    {
      element: 'body',
      title: 'Atalhos para a Consciência',
      text: 'Para uma navegação fluida, você pode usar a Central de Ajuda e o Guia de Voz. Vamos até a Central de Ajuda para ativar o Modo de Audição.',
      action: () => {
        useStore.getState().setView('dashboard'); 
        setTimeout(() => useStore.getState().startSession({ type: 'help_center' }), 300);
      },
    },
    {
      element: '[data-guide-id="guide-accessibility-toggle"]',
      title: 'Ouvindo o Universo',
      text: 'Ative o Modo de Audição para navegar com a sua voz. Use "Ctrl/Cmd+M" ou um toque duplo na tela para chamar seu Guia. Vou ativá-lo para você.',
      action: () => {
        const { isListeningModeActive, toggleListeningMode } = useStore.getState();
        if (!isListeningModeActive) {
          setTimeout(() => {
            toggleListeningMode();
          }, 300);
        }
      },
    },
    {
      element: 'body',
      title: 'Voltando ao Ponto Zero',
      text: 'Excelente. Agora que você conhece o mapa e o Modo de Audição está ativo, vamos retornar ao seu Hub para concluir o tour.',
      action: () => {
        useStore.getState().endSession(false); 
        useStore.getState().setView('dashboard');
      },
    },
    {
      element: 'body',
      title: 'A Jornada Começa Agora',
      text: 'O tour está completo. O Guia de Voz será ativado em seguida para orientar seus próximos passos. Lembre-se, este é o seu universo. Explore, questione, transforme. A jornada é sua.',
    }
];

export const guides: Record<string, GuideStep[]> = {
  main: mainTour,
  mentor: [
    {
      element: '[data-guide-id="agent-room-header"]',
      title: 'Bem-vindo(a) à Sala do Mentor',
      text: 'Este é seu espaço de diálogo com ${agent.name}. Use este chat para explorar seus pensamentos e obter orientação personalizada.',
    },
    {
      element: '[data-guide-id="guide-step-4"]',
      title: 'Inicie a Conversa',
      text: 'Digite sua mensagem ou use o microfone para gravar sua voz. Quanto mais contexto você der, mais precisa será a ajuda do seu mentor.',
    },
    {
      element: '[data-guide-id="guide-step-5"], [data-guide-id="guide-step-6"]',
      title: 'Explore as Ferramentas',
      text: 'Quando estiver pronto(a) para agir, explore as ferramentas do mentor. Elas são projetadas para aplicar os insights da sua conversa na prática.',
    },
  ],
  live_conversation: [
    {
      element: '[data-guide-id="live-transcript-area"]',
      title: 'Conversa de Voz ao Vivo',
      text: 'Esta é uma sala de conversa em tempo real. A interação aqui é por voz para uma experiência mais fluida e natural.',
    },
    {
      element: '[data-guide-id="live-tools-button"]',
      title: 'Acesse as Ferramentas',
      text: 'As ferramentas do seu mentor estão sempre disponíveis aqui. Explore-as quando se sentir pronto para agir sobre os insights da sua conversa.',
    }
  ],
  tool_meditation: [
     {
      element: '[data-guide-id="tool-meditation"]',
      title: 'Ferramenta: Meditação Guiada',
      text: 'Crie uma experiência de voz totalmente personalizada com base na sua intenção para o momento.',
    },
    {
      element: '[data-guide-id="meditation-prompt"]',
      title: 'Defina sua Intenção',
      text: 'Escreva sobre o que você gostaria de meditar. Se você veio de uma conversa, uma sugestão será preenchida automaticamente.',
    },
     {
      element: '[data-guide-id="meditation-duration"]',
      title: 'Escolha a Duração',
      text: 'Ajuste o tempo da sua meditação aqui, de 1 a 15 minutos.',
    },
     {
      element: '[data-guide-id="meditation-generate-button"]',
      title: 'Gere sua Meditação',
      text: 'Quando estiver pronto, clique aqui. A IA criará um roteiro, imagem de fundo e áudio para uma experiência imersiva.',
    },
  ],
  tool_content_analyzer: [{
      element: '[data-guide-id="tool-content_analyzer"]',
      title: 'Ferramenta: Analisador Consciente',
      text: 'Obtenha uma perspectiva mais profunda sobre qualquer texto ou imagem, interpretando-os através das lentes do Princípio da Informação Consciente.',
  }],
  tool_guided_prayer: [{
      element: '[data-guide-id="tool-guided_prayer"]',
      title: 'Ferramenta: Oração Guiada',
      text: 'Defina uma intenção para receber uma oração profunda e personalizada, com opções para gerar áudio e uma imagem de suporte.',
  }],
  tool_prayer_pills: [{
      element: '[data-guide-id="tool-prayer_pills"]',
      title: 'Ferramenta: Pílulas de Oração',
      text: 'Receba uma dose rápida de inspiração. Defina uma intenção ou peça uma oração universal para o seu momento.',
  }],
  tool_dissonance_analyzer: [{
      element: '[data-guide-id="tool-dissonance_analyzer"]',
      title: 'Ferramenta: Analisador de Dissonância',
      text: 'Esta ferramenta analisa sua conversa recente com o mentor para identificar padrões de pensamento e crenças limitantes.',
  }],
  tool_therapeutic_journal: [{
      element: '[data-guide-id="tool-therapeutic_journal"]',
      title: 'Ferramenta: Diário Terapêutico',
      text: 'Escreva seus pensamentos ou sonhos. O mentor irá ler e fornecer um feedback valioso para aumentar sua coerência.',
  }],
  tool_quantum_simulator: [{
      element: '[data-guide-id="tool-quantum_simulator"]',
      title: 'Ferramenta: Simulador Quântico',
      text: 'Um modelo conceitual para explorar como sua consciência e observação cocriam a realidade. Clique em "Observar" para colapsar uma possibilidade.',
  }],
  tool_phi_frontier_radar: [{
      element: '[data-guide-id="tool-phi_frontier_radar"]',
      title: 'Ferramenta: Radar de Fronteira de Φ',
      text: 'Descubra conceitos de tecnologias futuristas que estão alinhadas com a evolução da consciência.',
  }],
  tool_dosh_diagnosis: [{
      element: '[data-guide-id="tool-dosh_diagnosis"]',
      title: 'Ferramenta: Diagnóstico Informacional',
      text: 'Responda a perguntas para que o mentor possa identificar seu padrão de desequilíbrio Ayurvédico (Dosha) e restaurar sua harmonia.',
  }],
   tool_wellness_visualizer: [{
      element: '[data-guide-id="tool-wellness_visualizer"]',
      title: 'Ferramenta: Analisador PIC de Coerência',
      text: 'Descreva seu estado atual em texto livre para que o sistema analise e atualize seu Vetor de Coerência automaticamente.',
  }],
  tool_routine_aligner: [{
      element: '[data-guide-id="tool-routine_aligner"]',
      title: 'Ferramenta: Alinhador de Rotina',
      text: 'Com base no seu diagnóstico de Dosha, esta ferramenta cria uma rotina diária personalizada (Dinacharya) para otimizar sua energia e bem-estar.',
  }],
  tool_belief_resignifier: [{
      element: '[data-guide-id="tool_belief_resignifier"]',
      title: 'Ferramenta: Ressignificador de Crenças',
      text: 'Digite uma crença limitante sobre dinheiro, e o mentor irá ajudá-lo a transformá-la em uma afirmação de poder.',
  }],
  tool_emotional_spending_map: [{
      element: '[data-guide-id="tool-emotional_spending_map"]',
      title: 'Ferramenta: Mapa Emocional de Gastos',
      text: 'Esta ferramenta (em breve) irá ajudá-lo a conectar suas despesas com suas emoções, revelando padrões para uma vida financeira mais consciente.',
  }],
  tool_risk_calculator: [{
      element: '[data-guide-id="tool-risk_calculator"]',
      title: 'Ferramenta: Calculadora de Risco Lógico',
      text: 'Descreva um cenário de investimento para receber uma análise lógica e imparcial dos riscos, livre de viés emocional.',
  }],
  tool_archetype_journey: [{
      element: '[data-guide-id="tool-archetype_journey"]',
      title: 'Ferramenta: Jornada do Arquétipo',
      text: 'Descreva um desafio pessoal para que o Arquiteto o reinterprete como parte de sua "Jornada do Herói".',
  }],
  tool_verbal_frequency_analysis: [{
      element: '[data-guide-id="tool-verbal_frequency_analysis"]',
      title: 'Ferramenta: Análise de Frequência Verbal',
      text: 'Use sua voz para expressar o que sente. A ferramenta analisará a frequência emocional e recomendará o próximo passo ideal em sua jornada.',
  }],
  tool_scheduled_session: [{
      element: '[data-guide-id="tool-scheduled_session"]',
      title: 'Ferramenta: Sessão Agendada',
      text: 'Agende uma chamada de voz proativa de um mentor para um horário específico, garantindo um momento dedicado para sua prática.',
  }],
};