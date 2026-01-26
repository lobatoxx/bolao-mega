import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { action, nome, cpf, telefone } = req.body;

    // LOGIN
    if (action === 'login') {
      const user = await prisma.usuario.findUnique({ where: { cpf } });
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
      return res.status(200).json(user);
    }

    // REGISTRO
    if (action === 'register') {
      try {
        const user = await prisma.usuario.create({
          data: { nome, cpf, telefone }
        });
        return res.status(201).json(user);
      } catch (error) {
        return res.status(400).json({ error: 'CPF já cadastrado' });
      }
    }
  }
  return res.status(405).end();
}