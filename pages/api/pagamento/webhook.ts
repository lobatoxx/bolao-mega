import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { payment } from '../../../lib/mercadopago';
import { enviarNotificacaoTelegram } from '../../../lib/telegram';

const prisma = new PrismaClient();

// Função para formatar moeda (R$)
const formatMoeda = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { type, data } = req.body;

  try {
    if (type === 'payment') {
      const paymentData = await payment.get({ id: data.id });
      const status = paymentData.status;
      const externalReference = paymentData.external_reference; // ID do participante

      // Só processa se estiver APROVADO e tiver o ID do participante
      if (status === 'approved' && externalReference) {
        
        // 1. Atualiza o status para PAGO no banco e pega os dados atualizados
        const participanteAtualizado = await prisma.participante.update({
          where: { id: externalReference },
          data: { 
            status: 'pago',
            paymentId: data.id,
            dataPagamento: new Date()
          },
          include: { 
            usuario: true, // Para pegar o nome de quem pagou
            bolao: true    // Para pegar prêmio e concurso
          }
        });

        // 2. Busca a lista ATUALIZADA de todos que já pagaram nesse bolão
        const listaPagos = await prisma.participante.findMany({
          where: { 
            bolaoId: participanteAtualizado.bolaoId,
            status: 'pago'
          },
          include: { usuario: true },
          orderBy: { dataPagamento: 'asc' } // Ordem de chegada (quem pagou primeiro aparece em cima)
        });

        // 3. Cálculos Financeiros
        const totalArrecadado = listaPagos.reduce((acc, p) => acc + p.valorTotal, 0);
        const totalCotas = listaPagos.reduce((acc, p) => acc + p.quantidade, 0);
        
        // 4. Monta a lista de nomes (AGORA COM NOME COMPLETO)
        let listaNomesFormatada = '';
        listaPagos.forEach((p, index) => {
          // Antes era: p.usuario.nome.split(' ')[0]
          // Agora é: p.usuario.nome (Nome completo do cadastro)
          listaNomesFormatada += `${index + 1}. <b>${p.usuario.nome}</b> (${p.quantidade} cotas)\n`;
        });

        // 5. Monta a mensagem para o Telegram
        const mensagem = `
✅ <b>NOVO PAGAMENTO CONFIRMADO!</b>

👤 <b>Pagante:</b> ${participanteAtualizado.usuario.nome}
💰 <b>Valor:</b> ${formatMoeda(participanteAtualizado.valorTotal)}
🎟 <b>Cotas:</b> ${participanteAtualizado.quantidade}

━━━━━━━━━━━━━━━━
📊 <b>RESUMO DO BOLÃO</b>
🏆 <b>Concurso:</b> ${participanteAtualizado.bolao.concurso}
💰 <b>Prêmio Estimado: ${formatMoeda(participanteAtualizado.bolao.premioEstimado)}</b>

👥 <b>Participantes:</b> ${listaPagos.length}
🎟 <b>Total de Cotas:</b> ${totalCotas}
💸 <b>Caixa Arrecadado: ${formatMoeda(totalArrecadado)}</b>
━━━━━━━━━━━━━━━━

📋 <b>LISTA DE CONFIRMADOS:</b>
${listaNomesFormatada}
        `;

        // 6. Envia pro Telegram
        await enviarNotificacaoTelegram(mensagem);
      }
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Erro no webhook:', error);
    // Retorna 200 para o Mercado Pago não ficar reenviando em loop, mesmo se der erro no Telegram
    return res.status(200).json({ error: 'Erro interno processado' });
  }
}