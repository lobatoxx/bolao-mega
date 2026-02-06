import axios from 'axios';

// Envia mensagem simples (Notificações)
export async function enviarNotificacaoTelegram(mensagem: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: mensagem,
      parse_mode: 'HTML'
    });
  } catch (error) {
    console.error('Erro Telegram:', error);
  }
}

// Envia mensagem com BOTÕES para o Admin (Aprovação)
export async function solicitarAprovacaoTelegram(participanteId: string, nome: string, valor: string, cotas: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  const mensagem = `
🚨 <b>SOLICITAÇÃO DE PAGAMENTO EM DINHEIRO</b>

👤 <b>Nome:</b> ${nome}
💰 <b>Valor:</b> ${valor}
🎟 <b>Cotas:</b> ${cotas}

Alexandre, o pagamento foi entregue em mãos?
  `;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: mensagem,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ CONFIRMAR RECEBIMENTO', callback_data: `aprovar_${participanteId}` }
          ],
          [
            { text: '❌ CANCELAR / REJEITAR', callback_data: `rejeitar_${participanteId}` }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Erro ao pedir aprovação:', error);
  }
}