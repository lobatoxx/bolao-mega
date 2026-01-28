import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { payment } from '../../../lib/mercadopago';
import { enviarNotificacaoTelegram } from '../../../lib/telegram';

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
      const externalReference = paymentData.external_reference; 

      if (status === 'approved' && externalReference) {
        
        // 1. Atualiza status para PAGO
        const participanteAtualizado = await prisma.participante.update({
          where: { id: externalReference },
          data: { 
            status: 'pago',
            paymentId: data.id,
            dataPagamento: new Date()
          },
          include: { usuario: true, bolao: true }
        });

        // 2. Busca lista de TODOS que já pagaram neste bolão
        const listaPagos = await prisma.participante.findMany({
          where: { 
            bolaoId: participanteAtualizado.bolaoId,
            status: 'pago'
          },
          include: { usuario: true },
          orderBy: { dataPagamento: 'asc' }
        });

        // 3. Totais Gerais
        const totalArrecadado = listaPagos.reduce((acc, p) => acc + p.valorTotal, 0);
        const totalCotas = listaPagos.reduce((acc, p) => acc + p.quantidade, 0);
        
        // ==========================================================
        // 4. LÓGICA DE AGRUPAMENTO (SOMA AS COTAS POR NOME)
        // ==========================================================
        const mapaDeCotas = new Map<string, number>();

        listaPagos.forEach((p) => {
          // Garante que é um array para evitar erros
          const nomes = Array.isArray(p.nomesCotas) ? p.nomesCotas : [p.usuario.nome];
          
          nomes.forEach((nome: string) => {
             const nomeLimpo = nome.trim(); // Remove espaços extras
             
             // Se o nome já existe no mapa, soma +1, senão começa com 1
             const qtdAtual = mapaDeCotas.get(nomeLimpo) || 0;
             mapaDeCotas.set(nomeLimpo, qtdAtual + 1);
          });
        });

        // Gera a string formatada a partir do Mapa Agrupado
        let listaNomesFormatada = '';
        let contador = 1;

        mapaDeCotas.forEach((qtd, nome) => {
           // Ex: 1. João Silva (3 cotas)
           const textoCota = qtd > 1 ? 'cotas' : 'cota';
           listaNomesFormatada += `${contador}. <b>${nome}</b> (${qtd} ${textoCota})\n`;
           contador++;
        });
        // ==========================================================


        // 5. Mensagem Telegram
        const mensagem = `
✅ <b>NOVO PAGAMENTO CONFIRMADO!</b>

👤 <b>Pagante:</b> ${participanteAtualizado.usuario.nome}
💰 <b>Valor:</b> ${formatMoeda(participanteAtualizado.valorTotal)}
🎟 <b>Cotas Compradas Agora:</b> ${participanteAtualizado.quantidade}

━━━━━━━━━━━━━━━━
📊 <b>RESUMO DO BOLÃO</b>
🏆 <b>Concurso:</b> ${participanteAtualizado.bolao.concurso}
💰 <b>Prêmio Estimado: ${formatMoeda(participanteAtualizado.bolao.premioEstimado)}</b>

👥 <b>Total Cotas Vendidas:</b> ${totalCotas}
💸 <b>Caixa Arrecadado: ${formatMoeda(totalArrecadado)}</b>
━━━━━━━━━━━━━━━━

📋 <b>LISTA DE JOGADORES (ACUMULADO):</b>
${listaNomesFormatada}
        `;

        await enviarNotificacaoTelegram(mensagem);
      }
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Erro no webhook:', error);
    return res.status(200).json({ error: 'Erro interno processado' });
  }
}