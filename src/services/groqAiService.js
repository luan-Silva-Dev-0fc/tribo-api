const { Groq } = require('groq-sdk');
const groupModel = require('../models/groupModel');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const groq = new Groq({ apiKey: GROQ_API_KEY });

async function generateGroupTrends(groupId) {
  try {

    const messages = await groupModel.getGroupChat(groupId, 50);

    if (!messages || messages.length < 5) {

      return [];
    }

    messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const chatLog = messages.map((m) => `[ID: ${m.id}] ${m.username}: ${m.content || '(Mídia enviada)'}`).join('\n');

    const systemPrompt = `Você é um analisador de conversas de grupos.
Seu objetivo é ler o histórico de mensagens de um chat e identificar os principais "Trend Topics" (assuntos mais quentes ou debatidos no momento).
Para cada assunto, você deve identificar o ID exato da mensagem onde esse assunto começou ou foi mais representativo.
Responda EXCLUSIVAMENTE com um array JSON válido.
Exemplo de resposta:
[
  {
    "topic_name": "Nome curto do Assunto (Ex: Novo Filme do Homem Aranha)",
    "summary": "Resumo em 1 frase sobre o que falaram.",
    "target_message_id": "ID_DA_MENSAGEM_AQUI"
  }
]
`;

    const userPrompt = `Analise este log de chat e extraia de 1 a 3 Trend Topics:\n\n${chatLog}`;

    const completion = await groq.chat.completions.create({
      model: "qwen/qwen3.6-27b",
      messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }],

      temperature: 0.6
    });

    const responseContent = completion.choices[0]?.message?.content || "";

    const cleanedContent = responseContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    let parsedTrends = [];

    try {
      const obj = JSON.parse(cleanedContent);
      if (Array.isArray(obj)) {
        parsedTrends = obj;
      } else if (obj.trends && Array.isArray(obj.trends)) {
        parsedTrends = obj.trends;
      } else {
        const jsonMatch = cleanedContent.match(/\[.*\]/s);
        if (jsonMatch) {
          parsedTrends = JSON.parse(jsonMatch[0]);
        }
      }
    } catch (e) {
      console.error("Erro ao parsear JSON da IA:", e, "Content:", responseContent);

      try {
        const jsonMatch = cleanedContent.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          parsedTrends = JSON.parse(jsonMatch[0]);
        }
      } catch (innerErr) {
        return [];
      }
    }

    if (parsedTrends.length > 0) {
      const saved = await groupModel.saveGroupTrends(groupId, parsedTrends);
      return saved;
    }

    return [];
  } catch (error) {
    console.error("Erro no generateGroupTrends (Groq AI):", error);
    throw error;
  }
}

module.exports = {
  generateGroupTrends
};