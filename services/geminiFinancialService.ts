import { GoogleGenAI } from "@google/genai";
import { SpendingEntry } from '../types.ts';

const ANALYSIS_MODEL = 'gemini-2.5-flash';

export const analyzeSpendingPatterns = async (entries: SpendingEntry[]): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const dataString = JSON.stringify(entries.map(e => ({ valor: e.value, categoria: e.category, emocao: e.emotion })));

        const prompt = `Atuando como um Terapeuta Financeiro, analise estes dados de gastos e emoções: ${dataString}. 
        Identifique o principal padrão de 'gastos emocionais', explique a possível função psicológica desse comportamento e ofereça uma pergunta gentil para reflexão.
        
        Exemplo de Resposta:
        "Seu mapa revela um padrão interessante: a sensação de Tédio parece ser um forte gatilho para gastos em Lazer e Comida. É como se você estivesse usando o dinheiro para 'comprar' pequenas doses de entusiasmo. Isso é uma estratégia perfeitamente humana para buscar alegria. A pergunta que podemos explorar é: 'Que outra atividade, talvez sem custo, poderia trazer essa mesma sensação de novidade e prazer quando o tédio aparecer?'"

        Sua resposta deve ser fluida, empática e sem julgamentos. Responda em Português do Brasil.`;

        const response = await ai.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error analyzing spending patterns:", error);
        throw error;
    }
};
