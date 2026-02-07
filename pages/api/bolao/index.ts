import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  try {
    // GET: Pega o bolão mais recente
    if (method === 'GET') {
      const bolao = await prisma.bolao.findFirst({
        orderBy: { criadoEm: 'desc' },
        include: {
          participantes: {
            include: { usuario: true },
            orderBy: { dataPagamento: 'desc' }
          },
          apostas: true
        }
      });
      return res.status(200).json(bolao);
    }

    // POST: Cria novo bolão
    if (method === 'POST') {
      // AQUI ESTAVA O ERRO: Precisamos extrair 'tipoCotaUnica' do corpo da requisição
      const { concurso, dataSorteio, premioEstimado, valorCota, tipoCotaUnica, adminPassword } = req.body;

      if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Senha incorreta' });
      }

      // Desativa bolões anteriores
      await prisma.bolao.updateMany({ data: { aberto: false } });

      const novo = await prisma.bolao.create({
        data: {
          concurso,
          dataSorteio: new Date(dataSorteio),
          premioEstimado: Number(premioEstimado),
          valorCota: Number(valorCota),
          tipoCotaUnica: Boolean(tipoCotaUnica), // Agora a variável existe!
          aberto: true
        }
      });
      return res.status(201).json(novo);
    }

    // PUT: Atualiza/Fecha bolão
    if (method === 'PUT') {
      // AQUI TAMBÉM: Adicionei 'tipoCotaUnica' na leitura
      const { id, concurso, dataSorteio, premioEstimado, valorCota, tipoCotaUnica, aberto, adminPassword } = req.body;

      if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Senha incorreta' });
      }

      // --- TRAVA DE SEGURANÇA (PAGAMENTO EM DINHEIRO) ---
      if (aberto === false) {
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
      // ---------------------------------------------------

      const atualizado = await prisma.bolao.update({
        where: { id },
        data: {
          concurso,
          dataSorteio: new Date(dataSorteio),
          premioEstimado: Number(premioEstimado),
          valorCota: Number(valorCota),
          tipoCotaUnica: Boolean(tipoCotaUnica), // Atualiza o tipo
          aberto
        }
      });
      return res.status(200).json(atualizado);
    }

    // DELETE: Apaga bolão
    if (method === 'DELETE') {
      const { id, adminPassword } = req.body;
      if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Senha incorreta' });
      }
      await prisma.bolao.delete({ where: { id } });
      return res.status(200).json({ message: 'Bolão deletado' });
    }

    return res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']).status(405).end(`Method ${method} Not Allowed`);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}