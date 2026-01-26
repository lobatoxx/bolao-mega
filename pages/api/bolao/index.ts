import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const bolao = await prisma.bolao.findFirst({
      where: { ativo: true },
      orderBy: { dataCriacao: 'desc' },
      include: { 
        participantes: {
          where: { status: 'pago' },
          include: { usuario: true } // Inclui dados do dono da cota
        }
      }
    });
    return res.status(200).json(bolao);
  }

  if (req.method === 'POST') {
    const { concurso, premioEstimado, valorCota, dataSorteio, adminPassword } = req.body;

    // VERIFICA SENHA ADMIN
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Senha de Admin incorreta!' });
    }

    await prisma.bolao.updateMany({ where: { ativo: true }, data: { ativo: false } });

    const novoBolao = await prisma.bolao.create({
      data: {
        concurso,
        premioEstimado: parseFloat(premioEstimado),
        valorCota: parseFloat(valorCota),
        dataSorteio: new Date(dataSorteio), // Salva a data corretamente
      }
    });

    return res.status(201).json(novoBolao);
  }
}