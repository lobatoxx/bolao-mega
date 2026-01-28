// pages/api/test-telegram.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { enviarNotificacaoTelegram } from '../../lib/telegram';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await enviarNotificacaoTelegram("🔔 Teste de Notificação do Bolão!");
    res.status(200).json({ status: 'Mensagem enviada (verifique o app)' });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao enviar', detalhe: error });
  }
}