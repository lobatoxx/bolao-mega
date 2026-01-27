import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import axios from 'axios';
import { Copy, RefreshCw, CheckCircle, Users, QrCode, Trophy, Calendar, LogOut, Ticket } from 'lucide-react';

// FORMATADORES
const formatMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
const formatDate = (data: string | null) => data ? new Date(data).toLocaleDateString('pt-BR') : 'Pendente';

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function Home() {
  // ESTADOS GLOBAIS
  const [user, setUser] = useState<any>(null);
  const { data: bolao } = useSWR('/api/bolao', fetcher, { refreshInterval: 5000 });

  // LOGIN & REGISTER STATES
  const [cpfAuth, setCpfAuth] = useState('');
  const [nomeAuth, setNomeAuth] = useState('');
  const [telAuth, setTelAuth] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // COMPRA STATES
  const [cotasQtd, setCotasQtd] = useState(1);
  const [nomesCotas, setNomesCotas] = useState<string[]>(['']);
  const [loadingPay, setLoadingPay] = useState(false);
  const [pixData, setPixData] = useState<{code: string, img: string} | null>(null);

  // Efeito para ajustar inputs de nomes conforme quantidade
  useEffect(() => {
    const novosNomes = [...nomesCotas];
    if (cotasQtd > novosNomes.length) {
      for (let i = novosNomes.length; i < cotasQtd; i++) novosNomes.push(user ? user.nome : '');
    } else {
      novosNomes.length = cotasQtd;
    }
    setNomesCotas(novosNomes);
  }, [cotasQtd, user]);

  // --- FUNÇÕES DE AUTH ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await axios.post('/api/auth', { action: 'login', cpf: cpfAuth });
      setUser(res.data);
      setNomesCotas([res.data.nome]); 
    } catch (err) {
      if(confirm('CPF não encontrado. Deseja cadastrar?')) setIsRegistering(true);
    } finally { setAuthLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await axios.post('/api/auth', { action: 'register', nome: nomeAuth, cpf: cpfAuth, telefone: telAuth });
      setUser(res.data);
      setIsRegistering(false);
    } catch (err) { alert('Erro ao cadastrar. Verifique os dados.'); } 
    finally { setAuthLoading(false); }
  };

  // --- FUNÇÃO PAGAMENTO ---
  const handleComprar = async () => {
    if (nomesCotas.some(n => n.trim() === '')) return alert('Preencha o nome de todas as cotas.');
    setLoadingPay(true);
    try {
      const res = await axios.post('/api/pagamento/criar', {
        bolaoId: bolao.id,
        usuarioId: user.id,
        nomesCotas: nomesCotas,
        quantidade: cotasQtd
      });
      setPixData({ code: res.data.qr_code, img: res.data.qr_code_base64 });
    } catch (err) { alert('Erro ao gerar PIX'); } 
    finally { setLoadingPay(false); }
  };

  const meuComprovante = bolao?.participantes?.find((p: any) => p.usuarioId === user?.id && p.status === 'pago');

  const participantesConfirmados = bolao?.participantes?.filter((p: any) => p.status === 'pago') || [];

  // --- RENDER ---
  
  // 1. TELA DE LOGIN / REGISTRO
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl w-full max-w-sm text-white shadow-2xl">
          <div className="text-center mb-6">
            <Trophy className="w-12 h-12 mx-auto text-yellow-400 mb-2" />
            <h1 className="text-2xl font-bold">Acesso ao Bolão</h1>
            <p className="text-gray-300 text-sm">Entre para concorrer aos milhões</p>
          </div>
          {!isRegistering ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 ml-1">CPF (apenas números)</label>
                <input required type="text" value={cpfAuth} onChange={e => setCpfAuth(e.target.value)} 
                  className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-3 focus:border-emerald-500 outline-none transition" placeholder="000.000.000-00"/>
              </div>
              <button disabled={authLoading} className="w-full bg-emerald-500 hover:bg-emerald-400 py-3 rounded-lg font-bold transition shadow-lg shadow-emerald-900/50">
                {authLoading ? 'Buscando...' : 'Entrar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4 animate-fadeIn">
              <input required type="text" placeholder="Nome Completo" value={nomeAuth} onChange={e => setNomeAuth(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-3 outline-none" />
              <input required type="text" placeholder="CPF" value={cpfAuth} onChange={e => setCpfAuth(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-3 outline-none" />
              <input required type="text" placeholder="WhatsApp" value={telAuth} onChange={e => setTelAuth(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-3 outline-none" />
              <button disabled={authLoading} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold transition">
                {authLoading ? 'Salvando...' : 'Cadastrar e Entrar'}
              </button>
              <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-sm text-gray-400 hover:text-white">Voltar para Login</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 2. TELA PRINCIPAL (APP)
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-20 selection:bg-emerald-500/30">
      <Head><title>Bolão da Firma</title></Head>

      {/* HEADER */}
      <header className="bg-emerald-900/30 backdrop-blur-md border-b border-white/5 sticky top-0 z-20">
        <div className="max-w-lg mx-auto p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center font-bold text-gray-900">$</div>
            <div>
              <h1 className="font-bold text-sm leading-tight">Olá, {user.nome.split(' ')[0]}</h1>
              <span className="text-xs text-emerald-400">Boa sorte hoje! 🍀</span>
            </div>
          </div>
          <button onClick={() => {setUser(null); setCpfAuth('');}} className="p-2 bg-gray-800 rounded-full hover:bg-red-900/50 transition">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        
        {bolao ? (
          <>
            {/* CARD DO PRÊMIO */}
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-900 rounded-3xl p-6 shadow-2xl shadow-emerald-900/50 text-center border border-emerald-500/30 group">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Trophy size={120} /></div>
              
              <span className="inline-block bg-black/30 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-emerald-100 mb-2 border border-white/10">
                Concurso {bolao.concurso}
              </span>
              
              <div className="py-2">
                <p className="text-emerald-100 text-sm font-medium tracking-wide uppercase opacity-80">Prêmio Estimado</p>
                <h2 className="text-4xl md:text-5xl font-bold text-white drop-shadow-md tracking-tight">
                  {formatMoeda(bolao.premioEstimado)}
                </h2>
              </div>

              <div className="flex justify-center items-center gap-2 mt-2 text-sm text-emerald-200 bg-emerald-950/30 py-2 rounded-lg mx-4">
                <Calendar size={16} />
                <span>Sorteio: {formatDate(bolao.dataSorteio)}</span>
              </div>
            </div>

            {/* SE JÁ PAGOU: COMPROVANTE */}
            {meuComprovante ? (
               <div className="bg-yellow-500/10 border border-yellow-500/50 p-6 rounded-2xl text-center space-y-4 animate-fadeIn">
                 <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto text-black shadow-lg shadow-yellow-500/20">
                   <Ticket size={32} />
                 </div>
                 <div>
                   <h3 className="text-xl font-bold text-yellow-400">Pagamento Confirmado!</h3>
                   <p className="text-sm text-gray-300">Você já está participando.</p>
                 </div>
                 <div className="bg-black/40 p-4 rounded-xl text-left text-sm space-y-2 font-mono">
                   <p><span className="text-gray-500">Autenticação:</span> <span className="text-yellow-100 break-all">{meuComprovante.id}</span></p>
                   <p><span className="text-gray-500">Cotas:</span> <span className="text-white">{meuComprovante.quantidade}</span></p>
                   <div className="border-t border-white/10 pt-2 mt-2">
                     <span className="text-gray-500 block mb-1">Nomes nos jogos:</span>
                     {meuComprovante.nomesCotas.map((n: string, i:number) => (
                       <span key={i} className="inline-block bg-yellow-900/40 text-yellow-200 px-2 py-1 rounded mr-2 mb-1 text-xs border border-yellow-700/50">{n}</span>
                     ))}
                   </div>
                 </div>
               </div>
            ) : (
              /* SE NÃO PAGOU: COMPRA */
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                 {pixData ? (
                   <div className="text-center space-y-4">
                     <h3 className="text-white font-bold">Escaneie para Pagar</h3>
                     <div className="bg-white p-2 rounded-xl inline-block">
                        <img src={`data:image/png;base64,${pixData.img}`} className="w-48 h-48" />
                     </div>
                     <p className="text-xs text-gray-400 max-w-xs mx-auto">Após o pagamento, o sistema identificará automaticamente em alguns segundos.</p>
                     <button onClick={() => {navigator.clipboard.writeText(pixData.code); alert('Copiado!')}} className="w-full bg-blue-600 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2">
                       <Copy size={16}/> Copiar Código PIX
                     </button>
                     <button onClick={() => setPixData(null)} className="text-gray-500 text-xs underline">Voltar</button>
                   </div>
                 ) : (
                   <div className="space-y-4">
                     <div className="flex justify-between items-end border-b border-gray-800 pb-4">
                       <div>
                         <p className="text-gray-400 text-sm">Valor por Cota</p>
                         <p className="text-2xl font-bold text-white">{formatMoeda(bolao.valorCota)}</p>
                       </div>
                       <div className="text-right">
                         <label className="text-xs text-gray-400 block mb-1">Quantidade</label>
                         <input type="number" min="1" max="10" className="w-16 bg-gray-800 text-center border border-gray-600 rounded p-1 text-white font-bold" value={cotasQtd} onChange={e => setCotasQtd(Number(e.target.value))} />
                       </div>
                     </div>
                     
                     <div className="space-y-2">
                       <p className="text-xs text-gray-400">Nome para cada cota:</p>
                       {nomesCotas.map((nome, index) => (
                         <input key={index} type="text" placeholder={`Nome da Cota ${index + 1}`} 
                           className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-sm focus:border-emerald-500 outline-none"
                           value={nome}
                           onChange={e => {
                             const novos = [...nomesCotas];
                             novos[index] = e.target.value;
                             setNomesCotas(novos);
                           }}
                         />
                       ))}
                     </div>

                     <div className="flex justify-between items-center pt-2">
                       <span className="text-gray-400">Total a Pagar:</span>
                       <span className="text-2xl font-bold text-emerald-400">{formatMoeda(bolao.valorCota * cotasQtd)}</span>
                     </div>
                     
                     <button onClick={handleComprar} disabled={loadingPay} className="w-full bg-emerald-600 hover:bg-emerald-500 py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/50 transition transform active:scale-95 flex items-center justify-center gap-2">
                        {loadingPay ? <RefreshCw className="animate-spin"/> : <><QrCode/> Gerar PIX Agora</>}
                     </button>
                   </div>
                 )}
              </div>
            )}

            {/* LISTA DE PARTICIPANTES */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
               <div className="p-4 bg-gray-800/50 flex justify-between items-center">
                 <h3 className="font-bold flex items-center gap-2"><Users size={18} className="text-emerald-500"/> Galera Confirmada</h3>
                 <span className="bg-emerald-900/50 text-emerald-400 text-xs px-2 py-1 rounded-full border border-emerald-500/20">
                   {participantesConfirmados.length} Pagos  {/* <-- USANDO A VARIÁVEL FILTRADA */}
                 </span>
               </div>
               
               <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
                 {participantesConfirmados.map((p: any) => (  // <-- USANDO A VARIÁVEL FILTRADA
                   <div key={p.id} className="p-4 flex justify-between items-center hover:bg-white/5 transition">
                     <div className="flex items-center gap-3">
                       <div className="bg-emerald-500/10 p-2 rounded-full">
                         <CheckCircle size={16} className="text-emerald-500" />
                       </div>
                       <div>
                         <p className="font-bold text-sm text-gray-200">{p.usuario.nome}</p>
                         <p className="text-xs text-gray-500 flex gap-1">
                           {p.nomesCotas.join(', ')}
                         </p>
                       </div>
                     </div>
                     <div className="text-right">
                        <span className="block font-bold text-emerald-400 text-sm">{p.quantidade} cota(s)</span>
                        <span className="text-xs text-gray-600">{formatDate(p.dataPagamento)}</span>
                     </div>
                   </div>
                 ))}
                 
                 {participantesConfirmados.length === 0 && (
                   <p className="text-center p-6 text-gray-600 text-sm">Ninguém pagou ainda. Seja o primeiro!</p>
                 )}
               </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 opacity-50">
            <Trophy size={64} className="mx-auto mb-4 text-gray-600"/>
            <p>Aguardando novo bolão...</p>
          </div>
        )}
      </main>
    </div>
  );
}