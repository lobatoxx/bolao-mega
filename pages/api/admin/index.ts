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
    // 1. SALVAR NO CATÁLOGO
    if (action === 'salvar_catalogo') {
      const { nome, numeros } = req.body; // numeros deve ser array [1,2,3...]
      const jogo = await prisma.catalogoJogos.create({
        data: { nome, numeros }
      });
      return res.status(200).json(jogo);
    }

    // 2. LISTAR CATÁLOGO
    if (action === 'listar_catalogo') {
      const jogos = await prisma.catalogoJogos.findMany({ orderBy: { criadoEm: 'desc' } });
      return res.status(200).json(jogos);
    }

    // 3. VINCULAR JOGOS AO BOLÃO ATUAL
    if (action === 'vincular_jogos') {
      const { bolaoId, jogosIds } = req.body; // Array de IDs do catalogo
      
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

    // 4. CONFERIDOR (A MÁGICA)
    if (action === 'conferir') {
      const { bolaoId, numerosSorteados } = req.body; // array [1,2,3,4,5,6]

      // Busca todas as apostas desse bolão
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

      // Filtra só quem ganhou algo (quadra ou mais)
      const vitorias = resultados.filter(r => r.acertosQtd >= 4).sort((a,b) => b.acertosQtd - a.acertosQtd);
      
      return res.status(200).json({ totalJogos: apostas.length, vitorias, detalhes: resultados });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
}