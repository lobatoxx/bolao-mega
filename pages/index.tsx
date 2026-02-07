import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import axios from 'axios';
import { Copy, RefreshCw, CheckCircle, Users, QrCode, Trophy, Calendar, LogOut, Ticket, PlusCircle, ArrowLeft, Banknote, UserPlus, Trash2 } from 'lucide-react';

// FORMATADORES
const formatMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
const formatDate = (data: string | null) => data ? new Date(data).toLocaleDateString('pt-BR') : 'Pendente';

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function Home() {
  // ESTADOS GLOBAIS
  const [user, setUser] = useState<any>(null);
  const { data: bolao } = useSWR('/api/bolao', fetcher, { refreshInterval: 5000 });

  // LOGIN & REGISTER
  const [cpfAuth, setCpfAuth] = useState('');
  const [nomeAuth, setNomeAuth] = useState('');
  const [telAuth, setTelAuth] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // PAGAMENTO GERAL
  const [loadingPay, setLoadingPay] = useState(false);
  const [pixData, setPixData] = useState<{code: string, img: string} | null>(null);
  const [metodoPagamento, setMetodoPagamento] = useState<'PIX' | 'DINHEIRO'>('PIX');
  const [esperandoAprovacao, setEsperandoAprovacao] = useState(false);
  const [modoCompra, setModoCompra] = useState(false);
  const [totalComprasAnterior, setTotalComprasAnterior] = useState(0);

  // --- ESTADOS ESPECÍFICOS DO MODO MULTI VS ÚNICO ---
  // MULTI:
  const [cotasQtd, setCotasQtd] = useState(1);
  const [nomesCotas, setNomesCotas] = useState<string[]>(['']);
  
  // ÚNICO:
  const [incluirMinhaCota, setIncluirMinhaCota] = useState(true);
  const [amigosParaAdicionar, setAmigosParaAdicionar] = useState<string[]>([]);
  const [nomeAmigoTemp, setNomeAmigoTemp] = useState('');

  // --- CÁLCULOS ---
  const minhasCompras = bolao?.participantes?.filter((p: any) => p.usuarioId === user?.id && p.status === 'pago') || [];
  const totalMinhasCotas = minhasCompras.reduce((acc: number, p: any) => acc + p.quantidade, 0);
  const participantesConfirmados = bolao?.participantes?.filter((p: any) => p.status === 'pago') || [];
  
  // Verifica se o usuário JÁ comprou uma cota COM O NOME DELE neste bolão
  const jaTenhoMinhaCota = minhasCompras.some((p: any) => p.nomesCotas.includes(user?.nome));

  // --- EFEITOS ---
  useEffect(() => {
    if (minhasCompras.length > totalComprasAnterior) {
      if (pixData) { setPixData(null); setModoCompra(false); alert("🎉 Pagamento via PIX Confirmado!"); }
      if (esperandoAprovacao) { setEsperandoAprovacao(false); setModoCompra(false); alert("🎉 Pagamento em Dinheiro CONFIRMADO!"); }
      setTotalComprasAnterior(minhasCompras.length);
    }
  }, [minhasCompras.length, pixData, esperandoAprovacao]);

  // Efeito para sincronizar nomes no modo MULTI
  useEffect(() => {
    if (bolao && !bolao.tipoCotaUnica) {
        const novosNomes = [...nomesCotas];
        if (cotasQtd > novosNomes.length) {
          for (let i = novosNomes.length; i < cotasQtd; i++) novosNomes.push(user ? user.nome : '');
        } else {
          novosNomes.length = cotasQtd;
        }
        setNomesCotas(novosNomes);
    }
  }, [cotasQtd, user, bolao]);

  // Atualiza estado inicial do checkbox "Minha Cota" no modo ÚNICO
  useEffect(() => {
      if(jaTenhoMinhaCota) setIncluirMinhaCota(false);
      else setIncluirMinhaCota(true);
  }, [jaTenhoMinhaCota]);


  // --- FUNÇÕES DE AUTH ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await axios.post('/api/auth', { action: 'login', cpf: cpfAuth });
      setUser(res.data);
      setNomesCotas([res.data.nome]); 
    } catch (err) { if(confirm('CPF não encontrado. Deseja cadastrar?')) setIsRegistering(true); } 
    finally { setAuthLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await axios.post('/api/auth', { action: 'register', nome: nomeAuth, cpf: cpfAuth, telefone: telAuth });
      setUser(res.data);
      setIsRegistering(false);
    } catch (err) { alert('Erro ao cadastrar.'); } 
    finally { setAuthLoading(false); }
  };

  // --- FUNÇÕES DE COMPRA ---
  const adicionarAmigoLista = () => {
    if(!nomeAmigoTemp.trim().includes(' ') || nomeAmigoTemp.trim().split(' ').length < 2) {
        return alert('Digite o Nome Completo do amigo (Mínimo 2 palavras).');
    }
    setAmigosParaAdicionar([...amigosParaAdicionar, nomeAmigoTemp.trim()]);
    setNomeAmigoTemp('');
  };

  const removerAmigoLista = (index: number) => {
    const novaLista = [...amigosParaAdicionar];
    novaLista.splice(index, 1);
    setAmigosParaAdicionar(novaLista);
  };

  const handleComprar = async () => {
    setLoadingPay(true);
    try {
      let listaFinalNomes: string[] = [];
      let quantidadeFinal = 0;

      if (bolao.tipoCotaUnica) {
        // MODO ÚNICO
        if (incluirMinhaCota && !jaTenhoMinhaCota) listaFinalNomes.push(user.nome);
        listaFinalNomes = [...listaFinalNomes, ...amigosParaAdicionar];
        quantidadeFinal = listaFinalNomes.length;

        if (quantidadeFinal === 0) throw new Error("Selecione pelo menos uma cota.");
      } else {
        // MODO MULTI
        if (nomesCotas.some(n => n.trim() === '')) throw new Error('Preencha o nome de todas as cotas.');
        listaFinalNomes = nomesCotas;
        quantidadeFinal = cotasQtd;
      }

      const res = await axios.post('/api/pagamento/criar', {
        bolaoId: bolao.id,
        usuarioId: user.id,
        nomesCotas: listaFinalNomes,
        quantidade: quantidadeFinal,
        metodo: metodoPagamento
      });

      if (res.data.tipo === 'DINHEIRO') setEsperandoAprovacao(true);
      else setPixData({ code: res.data.qr_code, img: res.data.qr_code_base64 });
      
      // Limpa formulários
      setAmigosParaAdicionar([]);
      setNomeAmigoTemp('');

    } catch (err: any) { alert(err.message || 'Erro ao processar compra.'); } 
    finally { setLoadingPay(false); }
  };

  // --- RENDER LOGIN ---
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

  // --- RENDER APP ---
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-20 selection:bg-emerald-500/30">
      <Head><title>Bolão da Firma</title></Head>

      <header className="bg-emerald-900/30 backdrop-blur-md border-b border-white/5 sticky top-0 z-20">
        <div className="max-w-lg mx-auto p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center font-bold text-gray-900">$</div>
            <div>
              <h1 className="font-bold text-sm leading-tight">Olá, {user.nome.split(' ')[0]}</h1>
              <span className="text-xs text-emerald-400">Boa sorte hoje! 🍀</span>
            </div>
          </div>
          <button onClick={() => {setUser(null); setCpfAuth('');}} className="p-2 bg-gray-800 rounded-full hover:bg-red-900/50 transition"><LogOut size={16} /></button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {bolao ? (
          <>
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-900 rounded-3xl p-6 shadow-2xl shadow-emerald-900/50 text-center border border-emerald-500/30 group">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Trophy size={120} /></div>
              <span className="inline-block bg-black/30 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-emerald-100 mb-2 border border-white/10">Concurso {bolao.concurso}</span>
              <div className="py-2">
                <p className="text-emerald-100 text-sm font-medium tracking-wide uppercase opacity-80">Prêmio Estimado</p>
                <h2 className="text-4xl md:text-5xl font-bold text-white drop-shadow-md tracking-tight">{formatMoeda(bolao.premioEstimado)}</h2>
              </div>
              <div className="flex justify-center items-center gap-2 mt-2 text-sm text-emerald-200 bg-emerald-950/30 py-2 rounded-lg mx-4">
                <Calendar size={16} /><span>Sorteio: {formatDate(bolao.dataSorteio)}</span>
              </div>
            </div>

            {minhasCompras.length > 0 && !modoCompra ? (
               <div className="space-y-4 animate-fadeIn">
                 <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/50 p-6 rounded-2xl text-center space-y-2">
                   <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto text-black shadow-lg"><Ticket size={24} /></div>
                   <h3 className="text-xl font-bold text-yellow-400">Você está no jogo!</h3>
                   <p className="text-gray-300">Total de <strong className="text-white">{totalMinhasCotas} cotas</strong> garantidas.</p>
                   {bolao.aberto ? (
                     <button onClick={() => setModoCompra(true)} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold w-full shadow-lg flex items-center justify-center gap-2 transition">
                       <PlusCircle size={20}/> Comprar Mais / Amigos
                     </button>
                   ) : (
                     <div className="mt-4 p-2 bg-red-900/30 rounded text-red-300 text-sm border border-red-900/50 font-bold">🚫 Apostas encerradas.</div>
                   )}
                 </div>
                 <h4 className="text-sm text-gray-400 ml-1 font-bold uppercase">Seus Recibos ({minhasCompras.length})</h4>
                 <div className="space-y-3">
                   {minhasCompras.map((compra: any, idx: number) => (
                     <div key={compra.id} className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                       <div className="flex justify-between items-start mb-2">
                         <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">#{idx + 1} - {compra.id.split('-')[0]}</span>
                         <span className="text-emerald-400 font-bold text-sm">{formatMoeda(compra.valorTotal)}</span>
                       </div>
                       <div className="text-sm text-gray-300">
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
              !bolao.aberto ? (
                <div className="bg-red-900/20 border border-red-900/50 p-8 rounded-2xl text-center shadow-xl animate-fadeIn">
                  <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto text-red-200 mb-4"><LogOut size={32} /></div>
                  <h3 className="text-2xl font-bold text-red-400 mb-2">Apostas Encerradas</h3>
                  <p className="text-gray-400">O admin já fechou este bolão.</p>
                  {minhasCompras.length > 0 && (
                    <button onClick={() => setModoCompra(false)} className="mt-6 text-sm underline text-gray-400 hover:text-white">Ver meus comprovantes</button>
                  )}
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl animate-fadeIn">
                   {minhasCompras.length > 0 && !pixData && !esperandoAprovacao && (
                     <button onClick={() => setModoCompra(false)} className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"><ArrowLeft size={16}/> Voltar para meus recibos</button>
                   )}

                   {esperandoAprovacao ? (
                     <div className="bg-yellow-500/10 border border-yellow-500/50 p-8 rounded-2xl text-center shadow-xl animate-pulse">
                        <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto text-black mb-4 font-bold text-2xl">$</div>
                        <h3 className="text-2xl font-bold text-yellow-400 mb-2">Aguardando Confirmação</h3>
                        <p className="text-gray-300 mb-4">Entregue o valor ao <strong>Admin</strong>.</p>
                        <button onClick={() => setEsperandoAprovacao(false)} className="mt-6 text-sm underline text-gray-400 hover:text-white">Cancelar</button>
                     </div>
                   ) : pixData ? (
                     <div className="text-center space-y-4">
                       <h3 className="text-white font-bold">Escaneie para Pagar</h3>
                       <div className="bg-white p-2 rounded-xl inline-block"><img src={`data:image/png;base64,${pixData.img}`} className="w-48 h-48" /></div>
                       <p className="text-xs text-gray-400 max-w-xs mx-auto">O sistema identificará automaticamente.</p>
                       <button onClick={() => {navigator.clipboard.writeText(pixData.code); alert('Copiado!')}} className="w-full bg-blue-600 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2"><Copy size={16}/> Copiar Código PIX</button>
                       <button onClick={() => setPixData(null)} className="text-gray-500 text-xs underline">Voltar / Cancelar</button>
                     </div>
                   ) : (
                     <div className="space-y-4">
                       {/* SELETOR DE MÉTODO */}
                       <div className="grid grid-cols-2 gap-2 bg-gray-800 p-1 rounded-lg mb-4">
                          <button onClick={() => setMetodoPagamento('PIX')} className={`py-2 rounded-md font-bold text-xs md:text-sm transition flex items-center justify-center gap-2 ${metodoPagamento === 'PIX' ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}><QrCode size={16}/> PIX (Auto)</button>
                          <button onClick={() => setMetodoPagamento('DINHEIRO')} className={`py-2 rounded-md font-bold text-xs md:text-sm transition flex items-center justify-center gap-2 ${metodoPagamento === 'DINHEIRO' ? 'bg-yellow-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}><Banknote size={16}/> DINHEIRO (Manual)</button>
                       </div>

                       {/* ======================= MODO COTA ÚNICA ======================= */}
                       {bolao.tipoCotaUnica ? (
                         <div className="space-y-4">
                           <div className="bg-blue-900/30 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-200 mb-4">
                             ℹ️ <strong>Modo Cota Única:</strong> Você só pode ter uma cota para você. Use a opção abaixo para comprar para amigos (nome completo obrigatório).
                           </div>

                           {/* 1. Minha Cota */}
                           <div className={`p-4 rounded-xl border flex items-center justify-between ${jaTenhoMinhaCota ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-gray-800 border-gray-700'}`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${incluirMinhaCota || jaTenhoMinhaCota ? 'bg-emerald-500 border-emerald-500' : 'border-gray-500'}`}>
                                   {(incluirMinhaCota || jaTenhoMinhaCota) && <CheckCircle size={14} className="text-black"/>}
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{user.nome} (Você)</p>
                                  {jaTenhoMinhaCota && <span className="text-xs text-emerald-400">✅ Já garantida!</span>}
                                </div>
                              </div>
                              {!jaTenhoMinhaCota && (
                                <button onClick={() => setIncluirMinhaCota(!incluirMinhaCota)} className="text-xs underline text-gray-400">
                                  {incluirMinhaCota ? 'Remover' : 'Incluir'}
                                </button>
                              )}
                           </div>

                           {/* 2. Amigos Adicionados */}
                           {amigosParaAdicionar.map((amigo, idx) => (
                             <div key={idx} className="p-3 bg-gray-800 rounded-xl flex justify-between items-center animate-fadeIn border border-gray-700">
                               <div className="flex items-center gap-3">
                                 <UserPlus size={16} className="text-blue-400"/>
                                 <span className="text-sm font-bold">{amigo}</span>
                               </div>
                               <button onClick={() => removerAmigoLista(idx)} className="text-red-400 hover:bg-red-900/20 p-2 rounded"><Trash2 size={14}/></button>
                             </div>
                           ))}

                           {/* 3. Input Novo Amigo */}
                           <div className="flex gap-2">
                              <input type="text" placeholder="Nome Completo do Amigo" className="flex-1 bg-gray-800 border border-gray-600 rounded p-2 text-sm" value={nomeAmigoTemp} onChange={e => setNomeAmigoTemp(e.target.value)} />
                              <button onClick={adicionarAmigoLista} className="bg-gray-700 hover:bg-gray-600 px-4 rounded text-white font-bold text-xs">ADD</button>
                           </div>

                           <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                             <span className="text-gray-400">Total: {(incluirMinhaCota && !jaTenhoMinhaCota ? 1 : 0) + amigosParaAdicionar.length} cotas</span>
                             <span className="text-2xl font-bold text-emerald-400">{formatMoeda(bolao.valorCota * ((incluirMinhaCota && !jaTenhoMinhaCota ? 1 : 0) + amigosParaAdicionar.length))}</span>
                           </div>
                         </div>
                       ) : (
                         /* ======================= MODO MULTI COTAS (ANTIGO) ======================= */
                         <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-gray-800 pb-4">
                              <div><p className="text-gray-400 text-sm">Valor Cota</p><p className="text-2xl font-bold text-white">{formatMoeda(bolao.valorCota)}</p></div>
                              <div className="text-right">
                                <label className="text-xs text-gray-400 block mb-1">Quantidade</label>
                                <input type="number" min="1" max="10" className="w-16 bg-gray-800 text-center border border-gray-600 rounded p-1 text-white font-bold" value={cotasQtd} onChange={e => setCotasQtd(Number(e.target.value))} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-gray-400">Nomes:</p>
                              {nomesCotas.map((nome, index) => (
                                <input key={index} type="text" placeholder={`Nome Cota ${index + 1}`} className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-sm focus:border-emerald-500 outline-none" value={nome} onChange={e => { const n = [...nomesCotas]; n[index] = e.target.value; setNomesCotas(n); }} />
                              ))}
                            </div>
                            <div className="flex justify-between items-center pt-2">
                              <span className="text-gray-400">Total:</span><span className="text-2xl font-bold text-emerald-400">{formatMoeda(bolao.valorCota * cotasQtd)}</span>
                            </div>
                         </div>
                       )}
                       
                       <button onClick={handleComprar} disabled={loadingPay} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 ${metodoPagamento === 'PIX' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50' : 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/50'}`}>
                          {loadingPay ? <RefreshCw className="animate-spin"/> : metodoPagamento === 'PIX' ? <><QrCode/> Pagar PIX</> : <><CheckCircle/> Solicitar Dinheiro</>}
                       </button>
                     </div>
                   )}
                </div>
              )
            )}

            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
               <div className="p-4 bg-gray-800/50 flex justify-between items-center">
                 <h3 className="font-bold flex items-center gap-2"><Users size={18} className="text-emerald-500"/> Galera Confirmada</h3>
                 <span className="bg-emerald-900/50 text-emerald-400 text-xs px-2 py-1 rounded-full border border-emerald-500/20">{participantesConfirmados.length} Pagamentos</span>
               </div>
               <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
                 {participantesConfirmados.map((p: any) => (
                   <div key={p.id} className="p-4 flex justify-between items-center hover:bg-white/5 transition">
                     <div className="flex items-center gap-3">
                       <div className="bg-emerald-500/10 p-2 rounded-full"><CheckCircle size={16} className="text-emerald-500" /></div>
                       <div><p className="font-bold text-sm text-gray-200">{p.usuario.nome}</p><p className="text-xs text-gray-500">{p.nomesCotas.join(', ')}</p></div>
                     </div>
                     <div className="text-right"><span className="block font-bold text-emerald-400 text-sm">{p.quantidade} cota(s)</span></div>
                   </div>
                 ))}
                 {participantesConfirmados.length === 0 && <p className="text-center p-6 text-gray-600 text-sm">Seja o primeiro!</p>}
               </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 opacity-50"><Trophy size={64} className="mx-auto mb-4 text-gray-600"/><p>Aguardando novo bolão...</p></div>
        )}
      </main>
    </div>
  );
}