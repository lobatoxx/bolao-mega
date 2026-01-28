import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { payment } from '../../../lib/mercadopago';
import { enviarNotificacaoTelegram } from '../../../lib/telegram'; // Importa nosso enviador

const prisma = new PrismaClient();

// Função para formatar moeda
const formatMoeda = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { type, data } = req.body;

  try {
    if (type === 'payment') {
      const paymentData = await payment.get({ id: data.id });
      const status = paymentData.status;
      const externalReference = paymentData.external_reference; // ID do participante

      if (status === 'approved' && externalReference) {
        
        // 1. Atualiza o status para PAGO
        const participanteAtualizado = await prisma.participante.update({
          where: { id: externalReference },
          data: { 
            status: 'pago',
            paymentId: data.id,
            dataPagamento: new Date()
          },
          include: { 
            usuario: true, // Pega o nome de quem pagou
            bolao: true    // Pega dados do bolão
          }
        });

        // 2. Busca a lista ATUALIZADA de todos que já pagaram nesse bolão
        const listaPagos = await prisma.participante.findMany({
          where: { 
            bolaoId: participanteAtualizado.bolaoId,
            status: 'pago'
          },
          include: { usuario: true },
          orderBy: { dataPagamento: 'asc' } // Ordem de chegada
        });

        // 3. Monta a mensagem bonitona pro Telegram
        const totalArrecadado = listaPagos.reduce((acc, p) => acc + p.valorTotal, 0);
        const totalCotas = listaPagos.reduce((acc, p) => acc + p.quantidade, 0);
        
        // Cria a lista de nomes
        let listaNomesFormatada = '';
        listaPagos.forEach((p, index) => {
          listaNomesFormatada += `${index + 1}. <b>${p.usuario.nome.split(' ')[0]}</b> (${p.quantidade} cotas)\n`;
        });

        const mensagem = `
✅ <b>PAGAMENTO CONFIRMADO!</b>

👤 <b>Quem:</b> ${participanteAtualizado.usuario.nome}
💰 <b>Valor:</b> ${formatMoeda(participanteAtualizado.valorTotal)}
🎟 <b>Cotas:</b> ${participanteAtualizado.quantidade}

━━━━━━━━━━━━━━━━
📊 <b>RESUMO DO BOLÃO</b>
🏆 Concurso: ${participanteAtualizado.bolao.concurso}
👥 Total Pagantes: ${listaPagos.length}
🎟 Total Cotas: ${totalCotas}
💸 <b>Caixa Atual: ${formatMoeda(totalArrecadado)}</b>
━━━━━━━━━━━━━━━━

📋 <b>LISTA ATUALIZADA:</b>
${listaNomesFormatada}
        `;

        // 4. Envia pro Telegram
        await enviarNotificacaoTelegram(mensagem);
      }
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Erro no webhook:', error);
    // Retorna 200 mesmo com erro interno para o Mercado Pago não ficar tentando reenviar infinitamente
    return res.status(200).json({ error: 'Erro interno, mas recebido' });
  }
}