import axios from 'axios';

export async function enviarNotificacaoTelegram(mensagem: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('Telegram não configurado no .env');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: mensagem,
      parse_mode: 'HTML' // Permite usar negrito, etc
    });
  } catch (error) {
    console.error('Erro ao enviar Telegram:', error);
  }
}