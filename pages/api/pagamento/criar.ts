import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { gerarPix } from '../../../lib/mercadopago';
import { solicitarAprovacaoTelegram } from '../../../lib/telegram';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { bolaoId, usuarioId, nomesCotas, quantidade, metodo } = req.body; // Recebe 'metodo'

  try {
    const bolao = await prisma.bolao.findUnique({ where: { id: bolaoId } });
    if (!bolao) return res.status(404).json({ error: 'Bolão não encontrado' });

    const valorTotal = bolao.valorCota * quantidade;

    // Cria o registro no banco (Pendente)
    const participante = await prisma.participante.create({
      data: {
        bolaoId,
        usuarioId,
        nomesCotas,
        quantidade,
        valorTotal,
        status: 'pendente',
        metodo: metodo || 'PIX' // Se não vier nada, assume PIX
      },
      include: { usuario: true }
    });

    // --- SE FOR DINHEIRO ---
    if (metodo === 'DINHEIRO') {
      // Manda mensagem pro Alexandre aprovar
      await solicitarAprovacaoTelegram(
        participante.id, 
        participante.usuario.nome, 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal),
        quantidade
      );
      
      return res.status(200).json({ 
        tipo: 'DINHEIRO',
        message: 'Aguardando aprovação do admin'
      });
    }

    // --- SE FOR PIX (Fluxo Antigo) ---
    const pixData = await gerarPix(valorTotal, `Bolao-${bolao.concurso}`, participante.usuario.email, participante.id);
    
    return res.status(200).json({
      tipo: 'PIX',
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
      ticket_url: pixData.ticket_url
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar pagamento' });
  }
}