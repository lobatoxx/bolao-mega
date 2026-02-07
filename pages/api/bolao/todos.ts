import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const boloes = await prisma.bolao.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: {
          select: { participantes: true }
        }
      }
    });
    return res.status(200).json(boloes);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar lista' });
  }
}