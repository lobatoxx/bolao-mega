import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { enviarNotificacaoTelegram } from '../../../lib/telegram';

const prisma = new PrismaClient();
const formatMoeda = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // O Telegram manda updates via POST
  if (req.method !== 'POST') return res.status(200).end();

  const { callback_query } = req.body;

  // Se não for um clique em botão, ignora
  if (!callback_query) return res.status(200).json({ ok: true });

  const action = callback_query.data; // ex: "aprovar_uuid-do-participante"
  const chatId = callback_query.message.chat.id;
  const messageId = callback_query.message.message_id;
  const token = process.env.TELEGRAM_BOT_TOKEN;

  try {
    const [acao, idParticipante] = action.split('_');

    // --- LÓGICA DE APROVAÇÃO ---
    if (acao === 'aprovar') {
      
      // 1. Atualiza no banco para PAGO
      const participante = await prisma.participante.update({
        where: { id: idParticipante },
        data: { 
          status: 'pago', 
          dataPagamento: new Date() 
        },
        include: { usuario: true, bolao: true }
      });

      // 2. Edita a mensagem DO ADMIN (para sumir os botões e dar feedback)
      await axios.post(`https://api.telegram.org/bot${token}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text: `✅ <b>PAGAMENTO EM DINHEIRO CONFIRMADO!</b>\n\n👤 ${participante.usuario.nome}\n💰 ${formatMoeda(participante.valorTotal)}`,
        parse_mode: 'HTML'
      });

      // =================================================================================
      // 3. GERA A LISTA COMPLETA PARA O GRUPO (IGUAL AO MERCADO PAGO)
      // =================================================================================
      
      // A. Busca lista de TODOS que já pagaram neste bolão
      const listaPagos = await prisma.participante.findMany({
        where: { 
          bolaoId: participante.bolaoId,
          status: 'pago'
        },
        include: { usuario: true },
        orderBy: { dataPagamento: 'asc' }
      });

      // B. Calcula Totais
      const totalArrecadado = listaPagos.reduce((acc, p) => acc + p.valorTotal, 0);
      const totalCotas = listaPagos.reduce((acc, p) => acc + p.quantidade, 0);

      // C. Lógica de Agrupamento de Nomes (Map)
      const mapaDeCotas = new Map<string, number>();

      listaPagos.forEach((p) => {
        const nomes = Array.isArray(p.nomesCotas) ? p.nomesCotas : [p.usuario.nome];
        nomes.forEach((nome: string) => {
           const nomeLimpo = nome.trim();
           const qtdAtual = mapaDeCotas.get(nomeLimpo) || 0;
           mapaDeCotas.set(nomeLimpo, qtdAtual + 1);
        });
      });

      // D. Formata a Lista de Nomes
      let listaNomesFormatada = '';
      let contador = 1;

      mapaDeCotas.forEach((qtd, nome) => {
         const textoCota = qtd > 1 ? 'cotas' : 'cota';
         listaNomesFormatada += `${contador}. <b>${nome}</b> (${qtd} ${textoCota})\n`;
         contador++;
      });

      // E. Monta a Mensagem Oficial do Grupo
      const mensagemGrupo = `
✅ <b>PAGAMENTO EM DINHEIRO CONFIRMADO!</b>

👤 <b>Pagante:</b> ${participante.usuario.nome} (Via Admin)
💰 <b>Valor:</b> ${formatMoeda(participante.valorTotal)}
🎟 <b>Cotas:</b> ${participante.quantidade}

━━━━━━━━━━━━━━━━
📊 <b>RESUMO DO BOLÃO</b>
🏆 <b>Concurso:</b> ${participante.bolao.concurso}
💰 <b>Prêmio Estimado: ${formatMoeda(participante.bolao.premioEstimado)}</b>

👥 <b>Total Cotas Vendidas:</b> ${totalCotas}
💸 <b>Caixa Arrecadado: ${formatMoeda(totalArrecadado)}</b>
━━━━━━━━━━━━━━━━

📋 <b>LISTA DE JOGADORES (ACUMULADO):</b>
${listaNomesFormatada}
      `;

      // 4. Envia para o Grupo Oficial
      await enviarNotificacaoTelegram(mensagemGrupo);
    } 
    
    // --- LÓGICA DE REJEIÇÃO ---
    else if (acao === 'rejeitar') {
      // Deleta o registro pendente
      await prisma.participante.delete({ where: { id: idParticipante } });

      // Avisa o Admin que foi cancelado
      await axios.post(`https://api.telegram.org/bot${token}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text: `❌ <b>SOLICITAÇÃO RECUSADA.</b>\nA compra foi cancelada e removida do sistema.`,
        parse_mode: 'HTML'
      });
    }

    // Avisa o Telegram que o clique foi processado (para parar o "loading" no botão)
    await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      callback_query_id: callback_query.id,
      text: 'Processado!'
    });

  } catch (error) {
    console.error('Erro Webhook Telegram:', error);
  }

  return res.status(200).json({ ok: true });
}