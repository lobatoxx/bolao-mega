import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { payment } from '../../../lib/mercadopago';
import { enviarNotificacaoTelegram } from '../../../lib/telegram';

const prisma = new PrismaClient();
const formatMoeda = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.body; // ID do pagamento no Mercado Pago

  if (!id) return res.status(400).json({ error: 'ID ausente' });

  try {
    // 1. Consulta o Mercado Pago
    const pag = await payment.get({ id });
    
    // Se não está aprovado, retorna o status atual (pending, etc)
    if (pag.status !== 'approved') {
        return res.status(200).json({ status: pag.status });
    }

    // --- SE ESTÁ APROVADO ---
    
    // 2. Verifica no Banco se já demos baixa (para não duplicar telegram)
    const externalId = pag.external_reference;
    if (!externalId) return res.status(200).json({ status: 'approved' });

    const participante = await prisma.participante.findUnique({
        where: { id: externalId },
        include: { bolao: true, usuario: true }
    });

    // Se já estava pago no banco, só confirma pro frontend
    if (!participante || participante.status === 'pago') {
        return res.status(200).json({ status: 'approved' });
    }

    // 3. Atualiza o Banco de Dados
    const participanteAtualizado = await prisma.participante.update({
        where: { id: externalId },
        data: { 
          status: 'pago', 
          paymentId: id.toString(),
          dataPagamento: new Date()
        },
        include: { usuario: true, bolao: true }
    });

    // 4. ENVIA O TELEGRAM (Copiamos a lógica de lista aqui para garantir)
    try {
        // Gera lista atualizada
        const listaPagos = await prisma.participante.findMany({
            where: { bolaoId: participanteAtualizado.bolaoId, status: 'pago' },
            include: { usuario: true },
            orderBy: { dataPagamento: 'asc' }
        });

        const totalArrecadado = listaPagos.reduce((acc, p) => acc + p.valorTotal, 0);
        const totalCotas = listaPagos.reduce((acc, p) => acc + p.quantidade, 0);

        const mapaDeCotas = new Map<string, number>();
        listaPagos.forEach((p) => {
            const nomes = Array.isArray(p.nomesCotas) ? p.nomesCotas : [p.usuario.nome];
            nomes.forEach((nome: string) => {
               const nomeLimpo = nome.trim();
               mapaDeCotas.set(nomeLimpo, (mapaDeCotas.get(nomeLimpo) || 0) + 1);
            });
        });

        let listaNomesFormatada = '';
        let contador = 1;
        mapaDeCotas.forEach((qtd, nome) => {
             const textoCota = qtd > 1 ? 'cotas' : 'cota';
             listaNomesFormatada += `${contador}. <b>${nome}</b> (${qtd} ${textoCota})\n`;
             contador++;
        });

        const mensagem = `
💸 <b>PIX CONFIRMADO!</b>

👤 <b>Pagante:</b> ${participanteAtualizado.usuario.nome}
💰 <b>Valor:</b> ${formatMoeda(participanteAtualizado.valorTotal)}
🎟 <b>Cotas:</b> ${participanteAtualizado.quantidade}

━━━━━━━━━━━━━━━━
📊 <b>RESUMO DO BOLÃO</b>
🏆 <b>Concurso:</b> ${participanteAtualizado.bolao.concurso}
💰 <b>Prêmio: ${formatMoeda(participanteAtualizado.bolao.premioEstimado)}</b>

👥 <b>Cotas Vendidas:</b> ${totalCotas}
💸 <b>Caixa: ${formatMoeda(totalArrecadado)}</b>
━━━━━━━━━━━━━━━━

📋 <b>LISTA ATUALIZADA:</b>
${listaNomesFormatada}
        `;

        await enviarNotificacaoTelegram(mensagem);
    } catch (err) {
        console.error('Erro envio Telegram:', err);
    }

    return res.status(200).json({ status: 'approved' });

  } catch (error) {
    console.error('Erro verificar:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}