import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import axios from 'axios';
import { Copy, RefreshCw, CheckCircle, Users, QrCode, Trophy, Calendar, LogOut, Ticket, PlusCircle, ArrowLeft, Banknote } from 'lucide-react';

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
  
  // NOVOS ESTADOS PARA PAGAMENTO MANUAL
  const [metodoPagamento, setMetodoPagamento] = useState<'PIX' | 'DINHEIRO'>('PIX');
  const [esperandoAprovacao, setEsperandoAprovacao] = useState(false);

  // ESTADO PARA ALTERNAR ENTRE "VER COMPROVANTES" E "COMPRAR MAIS"
  const [modoCompra, setModoCompra] = useState(false);

  // ESTADO PARA MONITORAR O TOTAL DE COMPRAS (Para fechar o QR Code/Aviso automaticamente)
  const [totalComprasAnterior, setTotalComprasAnterior] = useState(0);

  // --- CÁLCULOS E FILTROS ---
  // 1. Minhas Compras confirmadas
  const minhasCompras = bolao?.participantes?.filter((p: any) => p.usuarioId === user?.id && p.status === 'pago') || [];
  
  // 2. Total de cotas que eu tenho
  const totalMinhasCotas = minhasCompras.reduce((acc: number, p: any) => acc + p.quantidade, 0);
  
  // 3. Lista geral de quem pagou
  const participantesConfirmados = bolao?.participantes?.filter((p: any) => p.status === 'pago') || [];


  // --- EFEITOS (USEEFFECT) ---

  // 1. Monitora se caiu um pagamento novo (Seja PIX ou Aprovação do Admin)
  useEffect(() => {
    // Se o número de compras aumentou em relação ao que tínhamos salvo
    if (minhasCompras.length > totalComprasAnterior) {
      // Se estava na tela de PIX
      if (pixData) {
        setPixData(null);     
        setModoCompra(false); 
        alert("🎉 Pagamento via PIX Confirmado! Boa sorte!");
      }
      // Se estava na tela de "Aguardando Aprovação" (Dinheiro)
      if (esperandoAprovacao) {
        setEsperandoAprovacao(false);
        setModoCompra(false);
        alert("🎉 Pagamento em Dinheiro CONFIRMADO pelo Admin! Você está no jogo.");
      }
      
      // Atualiza o contador
      setTotalComprasAnterior(minhasCompras.length);
    }
  }, [minhasCompras.length, pixData, esperandoAprovacao, totalComprasAnterior]);

  // 2. Ajusta inputs de nomes conforme quantidade
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

  // --- FUNÇÃO PAGAMENTO (ATUALIZADA) ---
  const handleComprar = async () => {
    if (nomesCotas.some(n => n.trim() === '')) return alert('Preencha o nome de todas as cotas.');
    setLoadingPay(true);
    try {
      const res = await axios.post('/api/pagamento/criar', {
        bolaoId: bolao.id,
        usuarioId: user.id,
        nomesCotas: nomesCotas,
        quantidade: cotasQtd,
        metodo: metodoPagamento // Envia se é PIX ou DINHEIRO
      });

      if (res.data.tipo === 'DINHEIRO') {
        // Se for dinheiro, mostra tela de espera
        setEsperandoAprovacao(true);
      } else {
        // Se for PIX, mostra o QR Code
        setPixData({ code: res.data.qr_code, img: res.data.qr_code_base64 });
      }

    } catch (err) { alert('Erro ao processar compra.'); } 
    finally { setLoadingPay(false); }
  };


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

            {/* ÁREA DE COMPRA OU COMPROVANTE */}
            {minhasCompras.length > 0 && !modoCompra ? (
               // --- MODO: VISUALIZAR MEUS COMPROVANTES (Carteira) ---
               <div className="space-y-4 animate-fadeIn">
                 
                 {/* Resumo */}
                 <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/50 p-6 rounded-2xl text-center space-y-2">
                   <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto text-black shadow-lg">
                     <Ticket size={24} />
                   </div>
                   <h3 className="text-xl font-bold text-yellow-400">Você está no jogo!</h3>
                   <p className="text-gray-300">Você garantiu um total de <strong className="text-white">{totalMinhasCotas} cotas</strong>.</p>
                   
                   {/* SÓ MOSTRA O BOTÃO SE O BOLÃO ESTIVER ABERTO */}
                   {bolao.aberto ? (
                     <button onClick={() => setModoCompra(true)} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold w-full shadow-lg flex items-center justify-center gap-2 transition">
                       <PlusCircle size={20}/> Comprar Mais Cotas
                     </button>
                   ) : (
                     // AVISO SE ESTIVER FECHADO DENTRO DA CARTEIRA
                     <div className="mt-4 p-2 bg-red-900/30 rounded text-red-300 text-sm border border-red-900/50 font-bold">
                        🚫 Apostas encerradas para este concurso.
                     </div>
                   )}
                 </div>

                 {/* Lista de Recibos */}
                 <h4 className="text-sm text-gray-400 ml-1 font-bold uppercase">Seus Recibos ({minhasCompras.length})</h4>
                 <div className="space-y-3">
                   {minhasCompras.map((compra: any, idx: number) => (
                     <div key={compra.id} className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                       <div className="flex justify-between items-start mb-2">
                         <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">#{idx + 1} - {compra.id.split('-')[0]}</span>
                         <span className="text-emerald-400 font-bold text-sm">{formatMoeda(compra.valorTotal)}</span>
                       </div>
                       <div className="text-sm text-gray-300">
                         <p><strong>{compra.quantidade} cota(s):</strong></p>
                         <div className="flex flex-wrap gap-1 mt-1">
                           {compra.nomesCotas.map((n: string, i:number) => (
                             <span key={i} className="text-xs bg-gray-800 px-2 py-1 rounded border border-gray-700">{n}</span>
                           ))}
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
            ) : (
              // --- MODO: COMPRAR (Formulário ou Avisos) ---
              !bolao.aberto ? (
                // TELA DE ENCERRADO
                <div className="bg-red-900/20 border border-red-900/50 p-8 rounded-2xl text-center shadow-xl animate-fadeIn">
                  <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto text-red-200 mb-4">
                    <LogOut size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-red-400 mb-2">Apostas Encerradas</h3>
                  <p className="text-gray-400">O admin já fechou este bolão.</p>
                  
                  {minhasCompras.length > 0 && (
                    <button onClick={() => setModoCompra(false)} className="mt-6 text-sm underline text-gray-400 hover:text-white">
                      Ver meus comprovantes
                    </button>
                  )}
                </div>
              ) : (
                // TELA DE COMPRA (ABERTA)
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl animate-fadeIn">
                   
                   {/* Botão de Voltar se já tiver compras */}
                   {minhasCompras.length > 0 && !pixData && !esperandoAprovacao && (
                     <button onClick={() => setModoCompra(false)} className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
                       <ArrowLeft size={16}/> Voltar para meus recibos
                     </button>
                   )}

                   {/* --- ESTADO 1: ESPERANDO APROVAÇÃO (DINHEIRO) --- */}
                   {esperandoAprovacao ? (
                     <div className="bg-yellow-500/10 border border-yellow-500/50 p-8 rounded-2xl text-center shadow-xl animate-pulse">
                        <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto text-black mb-4 font-bold text-2xl">$</div>
                        <h3 className="text-2xl font-bold text-yellow-400 mb-2">Aguardando Confirmação</h3>
                        <p className="text-gray-300 mb-4">Entregue o valor ao <strong>Sr. Alexandre Fernandes</strong>.</p>
                        <p className="text-xs text-gray-500">Assim que ele confirmar no sistema, sua tela atualizará automaticamente.</p>
                        <button onClick={() => setEsperandoAprovacao(false)} className="mt-6 text-sm underline text-gray-400 hover:text-white">Cancelar visualização</button>
                     </div>

                   ) : pixData ? (
                     // --- ESTADO 2: PAGAMENTO PIX ---
                     <div className="text-center space-y-4">
                       <h3 className="text-white font-bold">Escaneie para Pagar</h3>
                       <div className="bg-white p-2 rounded-xl inline-block">
                          <img src={`data:image/png;base64,${pixData.img}`} className="w-48 h-48" />
                       </div>
                       <p className="text-xs text-gray-400 max-w-xs mx-auto">Após o pagamento, o sistema identificará automaticamente em alguns segundos.</p>
                       <button onClick={() => {navigator.clipboard.writeText(pixData.code); alert('Copiado!')}} className="w-full bg-blue-600 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2">
                         <Copy size={16}/> Copiar Código PIX
                       </button>
                       <button onClick={() => setPixData(null)} className="text-gray-500 text-xs underline">Voltar / Cancelar</button>
                     </div>

                   ) : (
                     // --- ESTADO 3: FORMULÁRIO DE COMPRA ---
                     <div className="space-y-4">
                       
                       {/* SELETOR DE MÉTODO DE PAGAMENTO */}
                       <div className="grid grid-cols-2 gap-2 bg-gray-800 p-1 rounded-lg mb-4">
                          <button onClick={() => setMetodoPagamento('PIX')} className={`py-2 rounded-md font-bold text-xs md:text-sm transition flex items-center justify-center gap-2 ${metodoPagamento === 'PIX' ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                            <QrCode size={16}/> PIX (Automático)
                          </button>
                          <button onClick={() => setMetodoPagamento('DINHEIRO')} className={`py-2 rounded-md font-bold text-xs md:text-sm transition flex items-center justify-center gap-2 ${metodoPagamento === 'DINHEIRO' ? 'bg-yellow-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                            <Banknote size={16}/> DINHEIRO (Manual)
                          </button>
                       </div>

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
                       
                       <button onClick={handleComprar} disabled={loadingPay} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 ${metodoPagamento === 'PIX' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50' : 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/50'}`}>
                          {loadingPay ? <RefreshCw className="animate-spin"/> : metodoPagamento === 'PIX' ? <><QrCode/> Gerar PIX Agora</> : <><CheckCircle/> Solicitar em Dinheiro</>}
                       </button>
                     </div>
                   )}
                </div>
              )
            )}

            {/* LISTA DE PARTICIPANTES (PÚBLICA) */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
               <div className="p-4 bg-gray-800/50 flex justify-between items-center">
                 <h3 className="font-bold flex items-center gap-2"><Users size={18} className="text-emerald-500"/> Galera Confirmada</h3>
                 <span className="bg-emerald-900/50 text-emerald-400 text-xs px-2 py-1 rounded-full border border-emerald-500/20">
                   {participantesConfirmados.length} Pagamentos
                 </span>
               </div>
               <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
                 {participantesConfirmados.map((p: any) => (
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