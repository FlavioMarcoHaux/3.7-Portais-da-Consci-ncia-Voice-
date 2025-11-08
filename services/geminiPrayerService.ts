import { GoogleGenAI } from "@google/genai";
import { Message, CoherenceVector } from '../types.ts';

const PRAYER_MODEL = 'gemini-2.5-pro';

const formatChatHistoryForPrompt = (chatHistory: Message[]): string => {
    if (!chatHistory || chatHistory.length === 0) return '';
    const recentHistory = chatHistory.slice(-6);
    const formatted = recentHistory.map(msg => `${msg.sender === 'user' ? 'Usuário' : 'Mentor'}: ${msg.text}`).join('\n');
    return `\n\n--- Histórico da Conversa Recente para Contexto ---\n${formatted}\n--- Fim do Histórico ---`;
}

const getPrayerGenerationPrompt = (userTheme: string, chatHistory?: Message[]): string => {
    const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';
    return `
Você é um Mestre em Oração Guiada, com treinamento, qualificação e certificado em Programação Neuro-Linguística (PNL) e Hipnose Ericksoniana através de Metáforas.
Você é um especialista em modelar a sabedoria e profundidade espiritual de Jesus Cristo, Rei Salomão e Rei Davi.
Você traz em seu íntimo os Salmos e Passagens Bíblicas, que você cita de forma natural e poderosa em suas orações guiadas.

Sua missão é criar uma oração guiada imersiva e transformadora. Utilize o máximo de tokens disponíveis para criar uma experiência longa, profunda, poderosa, acolhedora e transmutadora.

**Instruções Detalhadas:**

1.  **Tema Central:** A oração deve ser sobre: **"${userTheme}"**.

2.  **Jornada Sensorial (Estilo "Sinfonia do Despertar"):**
    *   **Início Imediato:** Comece a oração guiando o ouvinte a um estado de relaxamento profundo. Use metáforas sensoriais como "sinta o peso do seu corpo se render", "permita que cada músculo se solte", "inspire uma paz profunda". Crie uma atmosfera de entrega e receptividade antes de iniciar a oração principal.
    *   **Técnicas de Conexão:** Aprofunde o estado de conexão do ouvinte utilizando: quebra de padrão, aprofundamento de foco com linguagem sensorial (visual, auditivo, cinestésico), e alternância de percepção entre a realidade interna e externa.

3.  **Conteúdo e Citações:** Seja minucioso nas citações bíblicas. Integre-as de forma fluida. Ex: "Como o salmista Davi declarou no Salmo 23, 'O Senhor é o meu pastor; nada me faltará'... sinta essa provisão agora em sua vida."

4.  **Psicosfera:** Crie uma "psicosfera" (atmosfera psíquica) de fé e milagres. Use palavras que evoquem poder, transformação, cura e possibilidade.

5.  **Chamada para Ação (CTA):** Todas as orações devem conter CTAs poderosos que criem gatilhos emocionais e incentivem a interação no canal "Fé em 10 Minutos de Oração". Ex: "Se esta oração poderosa tocou seu coração, compartilhe sua experiência nos comentários do nosso vídeo no canal 'Fé em 10 Minutos de Oração' e inspire outras pessoas a embarcar nesta jornada sagrada."

6.  **SEO e Palavras-Chave:** Incorpore naturalmente palavras e frases de alto impacto, como: "oração poderosa", "cura interior", "milagre urgente", "transformação de vida", "fé inabalável", "conexão com Deus", "paz interior".

**Contexto Adicional da Conversa:**
${historyContext}

**Formato de Saída OBRIGATÓRIO:**
O resultado final deve ser **APENAS o texto da oração**. Deve ser um texto único, fluido e contínuo, **SEM TÍTULOS de seção** (como "Início", "Núcleo", etc.), marcadores, ou qualquer outra formatação de tópicos.

Gere a oração guiada agora.
    `;
};

export const generateGuidedPrayer = async (theme: string, chatHistory?: Message[]): Promise<string> => {
  try {
    // Instantiate client right before the call to use the latest key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = getPrayerGenerationPrompt(theme, chatHistory);

    const response = await ai.models.generateContent({
        model: PRAYER_MODEL,
        contents: prompt,
    });
    
    return response.text;
  } catch (error) {
      console.error(`Error generating guided prayer:`, error);
      throw error;
  }
};

const getPrayerRecommendationPrompt = (vector: CoherenceVector, chatHistory?: Message[]): string => {
    const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';
    const userStateContext = `
    O estado de coerência atual do usuário é (0-100, Coerência/Dissonância):
    - Propósito: ${vector.proposito.coerencia}/${vector.proposito.dissonancia}
    - Mental: ${vector.mental.coerencia}/${vector.mental.dissonancia}
    - Relacional: ${vector.relacional.coerencia}/${vector.relacional.dissonancia}
    - Emocional: ${vector.emocional.coerencia}/${vector.emocional.dissonancia} (Dissonância alta indica caos emocional)
    - Somático (Corpo): ${vector.somatico.coerencia}/${vector.somatico.dissonancia}
    - Ético-Ação: ${vector.eticoAcao.coerencia}/${vector.eticoAcao.dissonancia}
    - Recursos (Finanças/Energia): ${vector.recursos.coerencia}/${vector.recursos.dissonancia}
    `;

    return `
    Você é o Mentor de Coerência. Sua tarefa é analisar o estado do usuário e o histórico de conversa para recomendar um tema para uma oração guiada.

    **Contexto do Usuário:**
    ${userStateContext}
    ${historyContext}

    **Instruções:**
    1. Baseado no contexto, identifique a necessidade mais premente do usuário (a área com menor coerência ou maior dissonância).
    2. Crie um tema de oração curto, positivo e inspirador que aborde essa necessidade.
    3. O tema deve ser uma frase concisa.

    **Exemplos de temas:**
    - "paz para um coração ansioso"
    - "clareza para encontrar meu propósito"
    - "abertura de caminhos financeiros"
    - "fortalecimento da fé em tempos de incerteza"

    **Formato de Saída OBRIGATÓRIO:**
    Responda **APENAS** com o tema da oração, sem nenhuma outra palavra ou formatação.

    Recomendado o tema agora.
    `;
};

export const recommendPrayerTheme = async (vector: CoherenceVector, chatHistory?: Message[]): Promise<string> => {
  try {
    // Instantiate client right before the call to use the latest key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = getPrayerRecommendationPrompt(vector, chatHistory);

    const response = await ai.models.generateContent({
        model: PRAYER_MODEL,
        contents: prompt,
    });
    
    return response.text.trim();
  } catch (error) {
      console.error(`Error recommending prayer theme:`, error);
      throw error;
  }
};