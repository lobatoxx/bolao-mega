import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // --- LISTAR (GET) ---
  if (req.method === 'GET') {
    const bolao = await prisma.bolao.findFirst({
      where: { ativo: true },
      orderBy: { dataCriacao: 'desc' },
      include: { 
        participantes: {
          include: { usuario: true }
        }
      }
    });
    return res.status(200).json(bolao);
  }

  // --- CRIAR (POST) ---
  if (req.method === 'POST') {
    const { concurso, premioEstimado, valorCota, dataSorteio, adminPassword } = req.body;

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Senha de Admin incorreta!' });
    }

    // Desativa anteriores
    await prisma.bolao.updateMany({ where: { ativo: true }, data: { ativo: false } });

    const novoBolao = await prisma.bolao.create({
      data: {
        concurso,
        premioEstimado: parseFloat(premioEstimado),
        valorCota: parseFloat(valorCota),
        dataSorteio: new Date(dataSorteio),
      }
    });

    return res.status(201).json(novoBolao);
  }

  // --- EDITAR (PUT) ---
  if (req.method === 'PUT') {
    const { id, concurso, premioEstimado, valorCota, dataSorteio, adminPassword } = req.body;

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Senha de Admin incorreta!' });
    }

    try {
      const bolaoAtualizado = await prisma.bolao.update({
        where: { id },
        data: {
          concurso,
          premioEstimado: parseFloat(premioEstimado),
          valorCota: parseFloat(valorCota),
          dataSorteio: new Date(dataSorteio),
        }
      });
      return res.status(200).json(bolaoAtualizado);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao atualizar bolão' });
    }
  }

  // --- EXCLUIR (DELETE) ---
  if (req.method === 'DELETE') {
    const { id, adminPassword } = req.body;

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Senha de Admin incorreta!' });
    }

    try {
      // 1. Primeiro deleta os participantes desse bolão (Limpeza)
      await prisma.participante.deleteMany({
        where: { bolaoId: id }
      });

      // 2. Depois deleta o bolão
      await prisma.bolao.delete({
        where: { id }
      });

      return res.status(200).json({ message: 'Bolão excluído com sucesso' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao excluir bolão' });
    }
  }

  return res.status(405).end();
}