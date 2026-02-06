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

    await prisma.bolao.updateMany({ where: { ativo: true }, data: { ativo: false } });

    const novoBolao = await prisma.bolao.create({
      data: {
        concurso,
        premioEstimado: parseFloat(premioEstimado),
        valorCota: parseFloat(valorCota),
        dataSorteio: new Date(dataSorteio),
        aberto: true // Nasce aberto
      }
    });

    return res.status(201).json(novoBolao);
  }

  // --- EDITAR / ENCERRAR (PUT) ---
  if (req.method === 'PUT') {
    // Agora aceita o campo "aberto" também
    const { id, concurso, premioEstimado, valorCota, dataSorteio, aberto, adminPassword } = req.body;

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Senha de Admin incorreta!' });
    }

// TRAVA DE SEGURANÇA (NOVO)
      if (aberto === false) { // Se estiver tentando fechar
         const pendencias = await prisma.participante.count({
           where: { 
             bolaoId: id, 
             status: 'pendente',
             metodo: 'DINHEIRO'
           }
         });
         
         if (pendencias > 0) {
           return res.status(400).json({ error: `Existem ${pendencias} pagamentos em dinheiro aguardando sua aprovação no Telegram! Resolva antes de fechar.` });
         }
      }

    try {
      const bolaoAtualizado = await prisma.bolao.update({
        where: { id },
        data: {
          concurso,
          premioEstimado: parseFloat(premioEstimado),
          valorCota: parseFloat(valorCota),
          dataSorteio: new Date(dataSorteio),
          aberto: aberto // Atualiza o status
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
      await prisma.participante.deleteMany({ where: { bolaoId: id } });
      await prisma.bolao.delete({ where: { id } });
      return res.status(200).json({ message: 'Bolão excluído com sucesso' });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao excluir bolão' });
    }
  }

  return res.status(405).end();
}