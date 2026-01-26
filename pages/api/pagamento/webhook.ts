import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { payment } from '../../../lib/mercadopago';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { type, data } = req.body;

  try {
    if (type === 'payment') {
      const paymentId = data.id;
      
      // Consulta o status atual do pagamento no MP
      const paymentData = await payment.get({ id: paymentId });
      
      const status = paymentData.status;
      const externalReference = paymentData.external_reference; // Nosso ID de participante

      if (status === 'approved' && externalReference) {
        // Atualiza o banco
        await prisma.participante.update({
          where: { id: externalReference },
          data: {
            status: 'pago',
            paymentId: String(paymentId),
            dataPagamento: new Date()
          }
        });
        console.log(`Pagamento aprovado para participante: ${externalReference}`);
      }
    }
    
    // MP espera um 200 OK rápido
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Erro no webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}