import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action, adminPassword } = req.body;

  // SEGURANÇA BÁSICA
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Acesso negado' });
  }

  try {
    // --- CATÁLOGO ---
    if (action === 'salvar_catalogo') {
      const { nome, numeros } = req.body;
      const jogo = await prisma.catalogoJogos.create({
        data: { nome, numeros }
      });
      return res.status(200).json(jogo);
    }

    if (action === 'listar_catalogo') {
      const jogos = await prisma.catalogoJogos.findMany({ orderBy: { criadoEm: 'desc' } });
      return res.status(200).json(jogos);
    }

    if (action === 'excluir_catalogo') {
       const { id } = req.body;
       await prisma.catalogoJogos.delete({ where: { id } });
       return res.status(200).json({ message: 'Deletado' });
    }

    // --- APOSTAS DO BOLÃO (VÍNCULO) ---
    if (action === 'vincular_jogos') {
      const { bolaoId, jogosIds } = req.body; 
      
      const jogosDoCatalogo = await prisma.catalogoJogos.findMany({
        where: { id: { in: jogosIds } }
      });

      // Cria as apostas reais no bolão
      await prisma.apostaRealizada.createMany({
        data: jogosDoCatalogo.map(j => ({
          bolaoId,
          numeros: j.numeros,
          origem: `Catálogo: ${j.nome}`
        }))
      });

      return res.status(200).json({ message: `${jogosDoCatalogo.length} jogos vinculados!` });
    }

    // NOVA: LISTAR O QUE TÁ VALENDO
    if (action === 'listar_apostas') {
      const { bolaoId } = req.body;
      const apostas = await prisma.apostaRealizada.findMany({
        where: { bolaoId },
        orderBy: { id: 'desc' }
      });
      return res.status(200).json(apostas);
    }

    // NOVA: EXCLUIR APOSTA DO BOLÃO
    if (action === 'excluir_aposta') {
      const { id } = req.body;
      await prisma.apostaRealizada.delete({ where: { id } });
      return res.status(200).json({ message: 'Aposta removida do bolão' });
    }

    // --- CONFERIDOR ---
    if (action === 'conferir') {
      const { bolaoId, numerosSorteados } = req.body; 

      const apostas = await prisma.apostaRealizada.findMany({
        where: { bolaoId }
      });

      const resultados = apostas.map(aposta => {
        const acertos = aposta.numeros.filter(n => numerosSorteados.includes(n));
        return {
          id: aposta.id,
          origem: aposta.origem,
          numeros: aposta.numeros,
          acertosQtd: acertos.length,
          acertosNumeros: acertos,
          premio: acertos.length === 6 ? 'SENA 🏆' : acertos.length === 5 ? 'QUINA 🥈' : acertos.length === 4 ? 'QUADRA 🥉' : '-'
        };
      });

      const vitorias = resultados.filter(r => r.acertosQtd >= 4).sort((a,b) => b.acertosQtd - a.acertosQtd);
      
      return res.status(200).json({ totalJogos: apostas.length, vitorias, detalhes: resultados });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
}