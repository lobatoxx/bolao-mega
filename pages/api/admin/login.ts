import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body;

  // Compara a senha enviada com a senha do arquivo .env
  if (password === process.env.ADMIN_PASSWORD) {
    return res.status(200).json({ ok: true });
  }
  
  return res.status(401).json({ error: 'Senha incorreta' });
}