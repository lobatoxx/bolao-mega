import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { payment } from '../../../lib/mercadopago';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Recebe usuarioId e lista de nomes agora
  const { bolaoId, usuarioId, nomesCotas, quantidade } = req.body;

  try {
    const bolao = await prisma.bolao.findUnique({ where: { id: bolaoId } });
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    
    if (!bolao || !usuario) return res.status(404).json({ error: 'Dados inválidos' });

    const total = bolao.valorCota * quantidade;

    // Cria participante vinculado ao usuário
    const participante = await prisma.participante.create({
      data: {
        bolaoId,
        usuarioId,
        nomesCotas, // Array de Strings
        quantidade,
        valorTotal: total,
        status: 'pendente'
      }
    });

    const paymentData = await payment.create({
      body: {
        transaction_amount: total,
        description: `Bolão Mega - Concurso ${bolao.concurso}`,
        payment_method_id: 'pix',
        payer: {
          email: 'user_bolao@email.com',
          first_name: usuario.nome.split(' ')[0],
          last_name: usuario.nome.split(' ').slice(1).join(' ') || 'User'
        },
        notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/pagamento/webhook`,
        external_reference: participante.id,
      }
    });

    const ticket = paymentData.point_of_interaction?.transaction_data;

    return res.status(200).json({
      qr_code: ticket?.qr_code,
      qr_code_base64: ticket?.qr_code_base64,
      participanteId: participante.id 
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao processar' });
  }
}