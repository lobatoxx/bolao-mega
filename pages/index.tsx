import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import axios from 'axios';
import { Copy, RefreshCw, CheckCircle, Users, QrCode, Trophy, Calendar, LogOut, Ticket, PlusCircle, ArrowLeft, Banknote, UserPlus, Trash2, ChevronRight, X } from 'lucide-react';

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

  // FLUXO DE COMPRA
  const [modoCompra, setModoCompra] = useState(false); // Abre a tela de compra
  const [etapaCompra, setEtapaCompra] = useState(0); // 0: Escolha de Cotas, 1: Pagamento
  
  // PAGAMENTO
  const [loadingPay, setLoadingPay] = useState(false);
  const [pixData, setPixData] = useState<{code: string, img: string} | null>(null);
  const [metodoPagamento, setMetodoPagamento] = useState<'PIX' | 'DINHEIRO'>('PIX');
  const [esperandoAprovacao, setEsperandoAprovacao] = useState(false);
  const [totalComprasAnterior, setTotalComprasAnterior] = useState(0);

  // DADOS DO FORMULÁRIO
  const [cotasQtd, setCotasQtd] = useState(1);
  const [nomesCotas, setNomesCotas] = useState<string[]>(['']);
  
  // MODOS COTA ÚNICA
  const [incluirMinhaCota, setIncluirMinhaCota] = useState(true);
  const [amigosParaAdicionar, setAmigosParaAdicionar] = useState<string[]>([]);
  const [mostrandoInputAmigo, setMostrandoInputAmigo] = useState(false); // Controla visibilidade do input
  const [nomeAmigoTemp, setNomeAmigoTemp] = useState('');

  // --- CÁLCULOS ---
  const minhasCompras = bolao?.participantes?.filter((p: any) => p.usuarioId === user?.id && p.status === 'pago') || [];
  const totalMinhasCotas = minhasCompras.reduce((acc: number, p: any) => acc + p.quantidade, 0);
  const participantesConfirmados = bolao?.participantes?.filter((p: any) => p.status === 'pago') || [];
  const jaTenhoMinhaCota = minhasCompras.some((p: any) => p.nomesCotas.includes(user?.nome));

  // --- EFEITOS ---
  useEffect(() => {
    if (minhasCompras.length > totalComprasAnterior) {
      if (pixData) { setPixData(null); setModoCompra(false); alert("🎉 Pagamento via PIX Confirmado!"); }
      if (esperandoAprovacao) { setEsperandoAprovacao(false); setModoCompra(false); alert("🎉 Pagamento em Dinheiro CONFIRMADO!"); }
      setTotalComprasAnterior(minhasCompras.length);
      // Reseta fluxo
      setEtapaCompra(0);
      setAmigosParaAdicionar([]);
    }
  }, [minhasCompras.length, pixData, esperandoAprovacao]);

  // Sincroniza nomes Multi
  useEffect(() => {
    if (bolao && !bolao.tipoCotaUnica) {
        const novosNomes = [...nomesCotas];
        if (cotasQtd > novosNomes.length) {
          for (let i = novosNomes.length; i < cotasQtd; i++) novosNomes.push(user ? user.nome : '');
        } else { novosNomes.length = cotasQtd; }
        setNomesCotas(novosNomes);
    }
  }, [cotasQtd, user, bolao]);

  // Inicializa checkbox Cota Única
  useEffect(() => {
      if(jaTenhoMinhaCota) setIncluirMinhaCota(false);
      else setIncluirMinhaCota(true);
  }, [jaTenhoMinhaCota, modoCompra]);


  // --- FUNÇÕES ---
  const adicionarAmigoLista = () => {
    if(!nomeAmigoTemp.trim().includes(' ') || nomeAmigoTemp.trim().split(' ').length < 2) {
        return alert('Digite o Nome Completo do amigo (Mínimo 2 palavras).');
    }
    setAmigosParaAdicionar([...amigosParaAdicionar, nomeAmigoTemp.trim()]);
    setNomeAmigoTemp('');
    setMostrandoInputAmigo(false); // Fecha o input após adicionar
  };

  const calcularTotalCotas = () => {
    if (bolao?.tipoCotaUnica) {
      return (incluirMinhaCota && !jaTenhoMinhaCota ? 1 : 0) + amigosParaAdicionar.length;
    }
    return cotasQtd;
  };

  const handleComprar = async () => {
    setLoadingPay(true);
    try {
      let listaFinalNomes: string[] = [];
      let quantidadeFinal = 0;

      if (bolao.tipoCotaUnica) {
        if (incluirMinhaCota && !jaTenhoMinhaCota) listaFinalNomes.push(user.nome);
        listaFinalNomes = [...listaFinalNomes, ...amigosParaAdicionar];
        quantidadeFinal = listaFinalNomes.length;
      } else {
        if (nomesCotas.some(n => n.trim() === '')) throw new Error('Preencha todos os nomes.');
        listaFinalNomes = nomesCotas;
        quantidadeFinal = cotasQtd;
      }

      if (quantidadeFinal === 0) throw new Error("Selecione pelo menos uma cota.");

      const res = await axios.post('/api/pagamento/criar', {
        bolaoId: bolao.id,
        usuarioId: user.id,
        nomesCotas: listaFinalNomes,
        quantidade: quantidadeFinal,
        metodo: metodoPagamento
      });

      if (res.data.tipo === 'DINHEIRO') setEsperandoAprovacao(true);
      else setPixData({ code: res.data.qr_code, img: res.data.qr_code_base64 });

    } catch (err: any) { alert(err.message || 'Erro ao processar compra.'); } 
    finally { setLoadingPay(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true);
    try {
      const res = await axios.post('/api/auth', { action: 'login', cpf: cpfAuth });
      setUser(res.data); setNomesCotas([res.data.nome]); 
    } catch (err) { if(confirm('CPF não encontrado. Cadastrar?')) setIsRegistering(true); } 
    finally { setAuthLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true);
    try {
      const res = await axios.post('/api/auth', { action: 'register', nome: nomeAuth, cpf: cpfAuth, telefone: telAuth });
      setUser(res.data); setIsRegistering(false);
    } catch (err) { alert('Erro ao cadastrar.'); } 
    finally { setAuthLoading(false); }
  };


  // --- RENDER ---
  if (!user) {
    // TELA DE LOGIN (MANTIDA IGUAL)
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
              <input required type="text" value={cpfAuth} onChange={e => setCpfAuth(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-3 outline-none" placeholder="CPF (apenas números)"/>
              <button disabled={authLoading} className="w-full bg-emerald-500 hover:bg-emerald-400 py-3 rounded-lg font-bold shadow-lg">{authLoading ? '...' : 'Entrar'}</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4 animate-fadeIn">
              <input required type="text" placeholder="Nome" value={nomeAuth} onChange={e => setNomeAuth(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-3 outline-none" />
              <input required type="text" placeholder="CPF" value={cpfAuth} onChange={e => setCpfAuth(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-3 outline-none" />
              <input required type="text" placeholder="WhatsApp" value={telAuth} onChange={e => setTelAuth(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-3 outline-none" />
              <button disabled={authLoading} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold">{authLoading ? '...' : 'Cadastrar'}</button>
              <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-sm text-gray-400">Voltar</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-20 selection:bg-emerald-500/30">
      <Head><title>Bolão da Firma</title></Head>

      <header className="bg-emerald-900/30 backdrop-blur-md border-b border-white/5 sticky top-0 z-20">
        <div className="max-w-lg mx-auto p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center font-bold text-gray-900">$</div>
            <div><h1 className="font-bold text-sm leading-tight">Olá, {user.nome.split(' ')[0]}</h1><span className="text-xs text-emerald-400">Boa sorte! 🍀</span></div>
          </div>
          <button onClick={() => {setUser(null); setCpfAuth('');}} className="p-2 bg-gray-800 rounded-full hover:bg-red-900/50 transition"><LogOut size={16} /></button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {bolao ? (
          <>
            {/* CARD PRÊMIO */}
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-900 rounded-3xl p-6 shadow-2xl text-center border border-emerald-500/30">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Trophy size={120} /></div>
              <span className="inline-block bg-black/30 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-emerald-100 mb-2 border border-white/10">Concurso {bolao.concurso}</span>
              <div className="py-2"><p className="text-emerald-100 text-sm font-medium uppercase opacity-80">Prêmio Estimado</p><h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">{formatMoeda(bolao.premioEstimado)}</h2></div>
              <div className="flex justify-center items-center gap-2 mt-2 text-sm text-emerald-200 bg-emerald-950/30 py-2 rounded-lg mx-4"><Calendar size={16} /><span>Sorteio: {formatDate(bolao.dataSorteio)}</span></div>
            </div>

            {/* AREA PRINCIPAL: CARTEIRA OU COMPRA */}
            {minhasCompras.length > 0 && !modoCompra ? (
               <div className="space-y-4 animate-fadeIn">
                 <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/50 p-6 rounded-2xl text-center space-y-2">
                   <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto text-black shadow-lg"><Ticket size={24} /></div>
                   <h3 className="text-xl font-bold text-yellow-400">Você está no jogo!</h3>
                   <p className="text-gray-300">Total de <strong className="text-white">{totalMinhasCotas} cotas</strong> garantidas.</p>
                   {bolao.aberto ? (
                     <button onClick={() => { setModoCompra(true); setEtapaCompra(0); }} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold w-full shadow-lg flex items-center justify-center gap-2 transition"><PlusCircle size={20}/> Comprar Mais / Amigos</button>
                   ) : (
                     <div className="mt-4 p-2 bg-red-900/30 rounded text-red-300 text-sm border border-red-900/50 font-bold">🚫 Apostas encerradas.</div>
                   )}
                 </div>
                 <div className="space-y-3">
                   {minhasCompras.map((compra: any, idx: number) => (
                     <div key={compra.id} className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                       <div className="flex justify-between items-start mb-2"><span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">#{idx + 1} - {compra.id.split('-')[0]}</span><span className="text-emerald-400 font-bold text-sm">{formatMoeda(compra.valorTotal)}</span></div>
                       <div className="text-sm text-gray-300"><p className="text-xs text-gray-500 mb-1">Participantes:</p><div className="flex flex-wrap gap-1">{compra.nomesCotas.map((n: string, i:number) => (<span key={i} className="text-xs bg-gray-800 px-2 py-1 rounded border border-gray-700">{n}</span>))}</div></div>
                     </div>
                   ))}
                 </div>
               </div>
            ) : (
              !bolao.aberto ? (
                <div className="bg-red-900/20 border border-red-900/50 p-8 rounded-2xl text-center shadow-xl animate-fadeIn">
                  <h3 className="text-2xl font-bold text-red-400 mb-2">Apostas Encerradas</h3>
                  {minhasCompras.length > 0 && <button onClick={() => setModoCompra(false)} className="mt-6 text-sm underline text-gray-400">Ver meus comprovantes</button>}
                </div>
              ) : (
                /* ==================================================================================== */
                /* ÁREA DE COMPRA (WIZARD / CASCATA) */
                /* ==================================================================================== */
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl animate-fadeIn">
                   
                   {/* CABEÇALHO DO WIZARD */}
                   <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                     {minhasCompras.length > 0 && !pixData && !esperandoAprovacao && etapaCompra === 0 && (
                        <button onClick={() => setModoCompra(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                     )}
                     {etapaCompra === 1 && !pixData && !esperandoAprovacao && (
                        <button onClick={() => setEtapaCompra(0)} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm"><ArrowLeft size={16}/> Voltar</button>
                     )}
                     <h3 className="font-bold text-white text-lg">
                       {pixData || esperandoAprovacao ? 'Finalizar Pagamento' : etapaCompra === 0 ? '1. Definir Cotas' : '2. Pagamento'}
                     </h3>
                     <div className="w-6"></div> {/* Espaçador */}
                   </div>

                   {/* TELAS DE STATUS DE PAGAMENTO (PIX ou DINHEIRO) */}
                   {esperandoAprovacao ? (
                     <div className="bg-yellow-500/10 border border-yellow-500/50 p-8 rounded-2xl text-center shadow-xl animate-pulse">
                        <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto text-black mb-4 font-bold text-2xl">$</div>
                        <h3 className="text-2xl font-bold text-yellow-400 mb-2">Aguardando Confirmação</h3>
                        <p className="text-gray-300 mb-4">Entregue o valor ao <strong>Admin</strong>.</p>
                        <button onClick={() => setEsperandoAprovacao(false)} className="mt-6 text-sm underline text-gray-400 hover:text-white">Cancelar</button>
                     </div>
                   ) : pixData ? (
                     <div className="text-center space-y-4">
                       <div className="bg-white p-2 rounded-xl inline-block"><img src={`data:image/png;base64,${pixData.img}`} className="w-48 h-48" /></div>
                       <button onClick={() => {navigator.clipboard.writeText(pixData.code); alert('Copiado!')}} className="w-full bg-blue-600 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2"><Copy size={16}/> Copiar Código PIX</button>
                       <button onClick={() => setPixData(null)} className="text-gray-500 text-xs underline">Voltar</button>
                     </div>
                   ) : (
                     /* FORMULÁRIOS DE COMPRA */
                     <>
                       {/* ETAPA 1: ESCOLHA DE COTAS */}
                       {etapaCompra === 0 && (
                         <div className="space-y-6 animate-fadeIn">
                           
                           {/* MODO COTA ÚNICA - SELEÇÃO */}
                           {bolao.tipoCotaUnica ? (
                             <div className="space-y-3">
                               {/* Minha Cota */}
                               <div className={`p-4 rounded-xl border flex items-center justify-between transition ${jaTenhoMinhaCota ? 'bg-emerald-900/10 border-emerald-500/30 opacity-70' : incluirMinhaCota ? 'bg-emerald-900/20 border-emerald-500' : 'bg-gray-800 border-gray-700'}`}>
                                  <div className="flex items-center gap-3">
                                    <div onClick={() => !jaTenhoMinhaCota && setIncluirMinhaCota(!incluirMinhaCota)} className={`w-6 h-6 rounded-full border cursor-pointer flex items-center justify-center transition ${incluirMinhaCota || jaTenhoMinhaCota ? 'bg-emerald-500 border-emerald-500' : 'border-gray-500'}`}>
                                       {(incluirMinhaCota || jaTenhoMinhaCota) && <CheckCircle size={16} className="text-black"/>}
                                    </div>
                                    <div>
                                      <p className="font-bold">{user.nome} (Você)</p>
                                      {jaTenhoMinhaCota && <span className="text-xs text-emerald-400">✅ Já garantida!</span>}
                                    </div>
                                  </div>
                               </div>

                               {/* Lista de Amigos */}
                               {amigosParaAdicionar.map((amigo, idx) => (
                                 <div key={idx} className="p-4 bg-gray-800 rounded-xl flex justify-between items-center border border-gray-700 animate-fadeIn">
                                   <div className="flex items-center gap-3">
                                     <UserPlus size={18} className="text-blue-400"/>
                                     <span className="font-bold">{amigo}</span>
                                   </div>
                                   <button onClick={() => { const l = [...amigosParaAdicionar]; l.splice(idx, 1); setAmigosParaAdicionar(l); }} className="text-red-400 p-2 hover:bg-red-900/20 rounded"><Trash2 size={16}/></button>
                                 </div>
                               ))}

                               {/* Botão ou Input Adicionar Amigo */}
                               {!mostrandoInputAmigo ? (
                                 <button onClick={() => setMostrandoInputAmigo(true)} className="w-full py-3 border border-dashed border-gray-600 rounded-xl text-gray-400 hover:text-white hover:border-gray-400 hover:bg-gray-800 transition flex items-center justify-center gap-2">
                                   <PlusCircle size={18}/> Adicionar cota para Amigo
                                 </button>
                               ) : (
                                 <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 animate-fadeIn">
                                   <label className="text-xs text-gray-400 mb-1 block">Nome Completo do Amigo</label>
                                   <div className="flex gap-2">
                                     <input autoFocus type="text" className="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-3 outline-none focus:border-blue-500" value={nomeAmigoTemp} onChange={e => setNomeAmigoTemp(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionarAmigoLista()} />
                                     <button onClick={adicionarAmigoLista} className="bg-blue-600 hover:bg-blue-500 px-4 rounded-lg font-bold">OK</button>
                                   </div>
                                   <button onClick={() => setMostrandoInputAmigo(false)} className="text-xs text-red-400 mt-2 underline">Cancelar</button>
                                 </div>
                               )}
                             </div>
                           ) : (
                             /* MODO MULTI - SELEÇÃO (SIMPLES) */
                             <div className="space-y-4">
                               <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700">
                                 <span className="text-gray-300">Quantidade de Cotas</span>
                                 <div className="flex items-center gap-4">
                                   <button onClick={() => cotasQtd > 1 && setCotasQtd(cotasQtd - 1)} className="w-8 h-8 bg-gray-700 rounded-full font-bold hover:bg-gray-600">-</button>
                                   <span className="text-xl font-bold w-6 text-center">{cotasQtd}</span>
                                   <button onClick={() => cotasQtd < 10 && setCotasQtd(cotasQtd + 1)} className="w-8 h-8 bg-gray-700 rounded-full font-bold hover:bg-gray-600">+</button>
                                 </div>
                               </div>
                               <div className="space-y-2">
                                 <p className="text-xs text-gray-400 ml-1">Nomes das Cotas:</p>
                                 {nomesCotas.map((nome, index) => (
                                   <input key={index} type="text" placeholder={`Nome da Cota ${index + 1}`} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none" value={nome} onChange={e => { const n = [...nomesCotas]; n[index] = e.target.value; setNomesCotas(n); }} />
                                 ))}
                               </div>
                             </div>
                           )}

                           {/* RODAPÉ DA ETAPA 1: TOTAL E AVANÇAR */}
                           <div className="pt-4 border-t border-gray-800 mt-4">
                             <div className="flex justify-between items-center mb-4">
                               <span className="text-gray-400">Total Cotas:</span>
                               <span className="text-xl font-bold text-white">{calcularTotalCotas()}</span>
                             </div>
                             <div className="flex justify-between items-center mb-4">
                               <span className="text-gray-400">Valor Total:</span>
                               <span className="text-2xl font-bold text-emerald-400">{formatMoeda(bolao.valorCota * calcularTotalCotas())}</span>
                             </div>

                             <button 
                               onClick={() => {
                                 if (calcularTotalCotas() > 0) setEtapaCompra(1);
                                 else alert("Selecione pelo menos uma cota.");
                               }}
                               disabled={calcularTotalCotas() === 0}
                               className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition"
                             >
                               Avançar para Pagamento <ChevronRight size={20}/>
                             </button>
                           </div>
                         </div>
                       )}

                       {/* ETAPA 2: PAGAMENTO */}
                       {etapaCompra === 1 && (
                         <div className="space-y-6 animate-fadeIn">
                           
                           {/* RESUMO DA COMPRA */}
                           <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                             <h4 className="text-gray-400 text-xs font-bold uppercase mb-2">Resumo do Pedido</h4>
                             <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-2">
                               <span>{calcularTotalCotas()}x Cota Bolão</span>
                               <span className="font-bold text-white">{formatMoeda(bolao.valorCota * calcularTotalCotas())}</span>
                             </div>
                             <div className="text-right text-emerald-400 text-xl font-bold">
                               Total: {formatMoeda(bolao.valorCota * calcularTotalCotas())}
                             </div>
                           </div>

                           {/* SELEÇÃO DO MÉTODO */}
                           <div className="space-y-3">
                             <p className="text-xs text-gray-400 ml-1">Como deseja pagar?</p>
                             <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setMetodoPagamento('PIX')} className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 ${metodoPagamento === 'PIX' ? 'border-emerald-500 bg-emerald-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-500'}`}>
                                  <QrCode size={24} className={metodoPagamento === 'PIX' ? 'text-emerald-400' : 'text-gray-400'}/>
                                  <span className={`font-bold text-sm ${metodoPagamento === 'PIX' ? 'text-white' : 'text-gray-400'}`}>PIX</span>
                                </button>
                                <button onClick={() => setMetodoPagamento('DINHEIRO')} className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 ${metodoPagamento === 'DINHEIRO' ? 'border-yellow-500 bg-yellow-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-500'}`}>
                                  <Banknote size={24} className={metodoPagamento === 'DINHEIRO' ? 'text-yellow-400' : 'text-gray-400'}/>
                                  <span className={`font-bold text-sm ${metodoPagamento === 'DINHEIRO' ? 'text-white' : 'text-gray-400'}`}>Dinheiro</span>
                                </button>
                             </div>
                           </div>

                           {/* BOTÃO FINALIZAR */}
                           <button onClick={handleComprar} disabled={loadingPay} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 ${metodoPagamento === 'PIX' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50' : 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/50'}`}>
                              {loadingPay ? <RefreshCw className="animate-spin"/> : metodoPagamento === 'PIX' ? <><QrCode/> Gerar PIX Agora</> : <><CheckCircle/> Confirmar Pedido</>}
                           </button>
                         </div>
                       )}
                     </>
                   )}
                </div>
              )
            )}

            {/* LISTA DE PARTICIPANTES (FICA EMBAIXO) */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden mt-8">
               <div className="p-4 bg-gray-800/50 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Users size={18} className="text-emerald-500"/> Galera Confirmada</h3><span className="bg-emerald-900/50 text-emerald-400 text-xs px-2 py-1 rounded-full border border-emerald-500/20">{participantesConfirmados.length} Pagamentos</span></div>
               <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
                 {participantesConfirmados.map((p: any) => (
                   <div key={p.id} className="p-4 flex justify-between items-center hover:bg-white/5 transition"><div className="flex items-center gap-3"><div className="bg-emerald-500/10 p-2 rounded-full"><CheckCircle size={16} className="text-emerald-500" /></div><div><p className="font-bold text-sm text-gray-200">{p.usuario.nome}</p><p className="text-xs text-gray-500">{p.nomesCotas.join(', ')}</p></div></div><div className="text-right"><span className="block font-bold text-emerald-400 text-sm">{p.quantidade} cota(s)</span></div></div>
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