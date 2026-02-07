import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import axios from 'axios';
import { 
  Copy, RefreshCw, CheckCircle, Users, QrCode, Trophy, Calendar, 
  LogOut, Ticket, PlusCircle, ArrowLeft, Banknote, UserPlus, 
  Trash2, ChevronRight, X 
} from 'lucide-react';

// --- FORMATADORES ---
const formatMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
const formatDate = (data: string | null) => data ? new Date(data).toLocaleDateString('pt-BR') : 'Pendente';

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function Home() {
  // --- ESTADOS GLOBAIS ---
  const [user, setUser] = useState<any>(null);
  const { data: bolao } = useSWR('/api/bolao', fetcher, { refreshInterval: 5000 });

  // --- LOGIN & REGISTER ---
  const [cpfAuth, setCpfAuth] = useState('');
  const [nomeAuth, setNomeAuth] = useState('');
  const [telAuth, setTelAuth] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // --- CONTROLE DE FLUXO (WIZARD) ---
  const [modoCompra, setModoCompra] = useState(false); // Abre o Modal de Compra
  const [etapaCompra, setEtapaCompra] = useState(0);   // 0: Escolher Cotas | 1: Pagamento
  
  // --- ESTADOS DE PAGAMENTO ---
  const [loadingPay, setLoadingPay] = useState(false);
  const [pixData, setPixData] = useState<{code: string, img: string, id: string} | null>(null);
  const [metodoPagamento, setMetodoPagamento] = useState<'PIX' | 'DINHEIRO'>('PIX');
  const [esperandoAprovacao, setEsperandoAprovacao] = useState(false);
  const [totalComprasAnterior, setTotalComprasAnterior] = useState(0);

  // --- DADOS DO FORMULÁRIO (MULTI COTAS) ---
  const [cotasQtd, setCotasQtd] = useState(1);
  const [nomesCotas, setNomesCotas] = useState<string[]>(['']);
  
  // --- DADOS DO FORMULÁRIO (COTA ÚNICA) ---
  const [incluirMinhaCota, setIncluirMinhaCota] = useState(true);
  const [amigosParaAdicionar, setAmigosParaAdicionar] = useState<string[]>([]);
  const [mostrandoInputAmigo, setMostrandoInputAmigo] = useState(false);
  const [nomeAmigoTemp, setNomeAmigoTemp] = useState('');

  // --- CÁLCULOS AUXILIARES ---
  const minhasCompras = bolao?.participantes?.filter((p: any) => p.usuarioId === user?.id && p.status === 'pago') || [];
  const totalMinhasCotas = minhasCompras.reduce((acc: number, p: any) => acc + p.quantidade, 0);
  const participantesConfirmados = bolao?.participantes?.filter((p: any) => p.status === 'pago') || [];
  const jaTenhoMinhaCota = minhasCompras.some((p: any) => p.nomesCotas.includes(user?.nome));


  // ==================================================================================
  // 1. MONITORAMENTO AUTOMÁTICO DE PIX (Polling)
  // ==================================================================================
  useEffect(() => {
    let intervalo: NodeJS.Timeout;

    // Só liga o monitoramento se tiver um ID de PIX na tela
    if (pixData && pixData.id) {
        intervalo = setInterval(async () => {
            try {
                // Pergunta pro servidor: "Esse ID já pagou?"
                const res = await axios.post('/api/pagamento/verificar', { id: pixData.id });
                
                if (res.data.status === 'approved') {
                    setPixData(null);     // Fecha QR Code
                    setModoCompra(false); // Fecha Janela de Compra
                    setEtapaCompra(0);    // Reseta Wizard
                    alert("🎉 PAGAMENTO CONFIRMADO! Boa sorte!");
                }
            } catch (error) {
                console.error("Erro verificando pix", error);
            }
        }, 3000); // Roda a cada 3 segundos
    }

    // Limpeza: Se o usuário fechar o modal ou pagar, para de rodar
    return () => {
        if (intervalo) clearInterval(intervalo);
    };
  }, [pixData]);


  // ==================================================================================
  // 2. MONITORAMENTO DE APROVAÇÃO MANUAL (DINHEIRO)
  // ==================================================================================
  useEffect(() => {
    // Se o número de compras aumentou, significa que o Admin aprovou
    if (minhasCompras.length > totalComprasAnterior) {
      if (esperandoAprovacao) { 
          setEsperandoAprovacao(false); 
          setModoCompra(false); 
          setEtapaCompra(0);
          alert("🎉 Pagamento em Dinheiro CONFIRMADO pelo Admin!"); 
      }
      setTotalComprasAnterior(minhasCompras.length);
    }
  }, [minhasCompras.length, esperandoAprovacao, totalComprasAnterior]);


  // ==================================================================================
  // 3. REGRAS DE NEGÓCIO E SINCRONIZAÇÃO
  // ==================================================================================
  
  // Sincroniza inputs de nomes quando muda a quantidade (Modo Multi)
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

  // Define se "Minha Cota" vem marcada por padrão (Modo Único)
  useEffect(() => {
      if(jaTenhoMinhaCota) setIncluirMinhaCota(false);
      else setIncluirMinhaCota(true);
  }, [jaTenhoMinhaCota, modoCompra]);


  // ==================================================================================
  // 4. FUNÇÕES DE AÇÃO
  // ==================================================================================

  const adicionarAmigoLista = () => {
    if(!nomeAmigoTemp.trim().includes(' ') || nomeAmigoTemp.trim().split(' ').length < 2) {
        return alert('Por favor, digite o Nome Completo do amigo (Nome e Sobrenome).');
    }
    setAmigosParaAdicionar([...amigosParaAdicionar, nomeAmigoTemp.trim()]);
    setNomeAmigoTemp('');
    setMostrandoInputAmigo(false);
  };

  const calcularTotalCotas = () => {
    if (bolao?.tipoCotaUnica) {
      // (Eu vou comprar?) + (Quantos amigos?)
      return (incluirMinhaCota && !jaTenhoMinhaCota ? 1 : 0) + amigosParaAdicionar.length;
    }
    return cotasQtd; // Modo Multi
  };

  const handleComprar = async () => {
    setLoadingPay(true);
    try {
      let listaFinalNomes: string[] = [];
      let quantidadeFinal = 0;

      // Prepara os dados baseados no modo
      if (bolao.tipoCotaUnica) {
        if (incluirMinhaCota && !jaTenhoMinhaCota) listaFinalNomes.push(user.nome);
        listaFinalNomes = [...listaFinalNomes, ...amigosParaAdicionar];
        quantidadeFinal = listaFinalNomes.length;
      } else {
        if (nomesCotas.some(n => n.trim() === '')) throw new Error('Preencha o nome de todas as cotas.');
        listaFinalNomes = nomesCotas;
        quantidadeFinal = cotasQtd;
      }

      if (quantidadeFinal === 0) throw new Error("Selecione pelo menos uma cota para continuar.");

      // Envia para API
      const res = await axios.post('/api/pagamento/criar', {
        bolaoId: bolao.id,
        usuarioId: user.id,
        nomesCotas: listaFinalNomes,
        quantidade: quantidadeFinal,
        metodo: metodoPagamento
      });

      if (res.data.tipo === 'DINHEIRO') {
        setEsperandoAprovacao(true);
      } else {
        // Salva ID para o Polling funcionar
        setPixData({ 
            code: res.data.qr_code, 
            img: res.data.qr_code_base64, 
            id: res.data.id 
        }); 
      }

    } catch (err: any) { 
        alert(err.message || 'Erro ao processar compra.'); 
    } finally { 
        setLoadingPay(false); 
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await axios.post('/api/auth', { action: 'login', cpf: cpfAuth });
      setUser(res.data);
      setNomesCotas([res.data.nome]); 
    } catch (err) {
      if(confirm('CPF não encontrado. Deseja fazer o cadastro agora?')) setIsRegistering(true);
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


  // ==================================================================================
  // 5. RENDERIZAÇÃO (INTERFACE)
  // ==================================================================================

  // --- TELA DE LOGIN ---
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
              <input required type="text" value={cpfAuth} onChange={e => setCpfAuth(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-3 outline-none transition focus:border-emerald-500" placeholder="CPF (apenas números)"/>
              <button disabled={authLoading} className="w-full bg-emerald-500 hover:bg-emerald-400 py-3 rounded-lg font-bold shadow-lg shadow-emerald-900/50 transition">
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
              <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-sm text-gray-400 hover:text-white text-center block">Voltar para Login</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- TELA PRINCIPAL DO SISTEMA ---
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-20 selection:bg-emerald-500/30">
      <Head><title>Bolão da Firma</title></Head>

      {/* HEADER FIXO */}
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
            {/* CARD DESTAQUE DO PRÊMIO */}
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

            {/* LÓGICA DE EXIBIÇÃO: CARTEIRA vs COMPRA */}
            {minhasCompras.length > 0 && !modoCompra ? (
               // --- MODO 1: MINHA CARTEIRA (RECIBOS) ---
               <div className="space-y-4 animate-fadeIn">
                 
                 {/* Resumo */}
                 <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/50 p-6 rounded-2xl text-center space-y-2">
                   <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto text-black shadow-lg">
                     <Ticket size={24} />
                   </div>
                   <h3 className="text-xl font-bold text-yellow-400">Você está no jogo!</h3>
                   <p className="text-gray-300">Você garantiu <strong className="text-white">{totalMinhasCotas} cotas</strong> no total.</p>
                   
                   {bolao.aberto ? (
                     <button 
                        onClick={() => { setModoCompra(true); setEtapaCompra(0); }} 
                        className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold w-full shadow-lg flex items-center justify-center gap-2 transition"
                     >
                       <PlusCircle size={20}/> Comprar Mais / Amigos
                     </button>
                   ) : (
                     <div className="mt-4 p-2 bg-red-900/30 rounded text-red-300 text-sm border border-red-900/50 font-bold">
                        🚫 Apostas encerradas.
                     </div>
                   )}
                 </div>

                 {/* Lista Individual de Compras */}
                 <h4 className="text-sm text-gray-400 ml-1 font-bold uppercase">Seus Recibos ({minhasCompras.length})</h4>
                 <div className="space-y-3">
                   {minhasCompras.map((compra: any, idx: number) => (
                     <div key={compra.id} className="bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-md">
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
              // --- MODO 2: FLUXO DE COMPRA (WIZARD) ---
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
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl animate-fadeIn relative">
                   
                   {/* CABEÇALHO DO WIZARD (NAVEGAÇÃO) */}
                   <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                     {/* Botão Fechar (X) - Só aparece na etapa 0 e se não estiver pagando */}
                     {minhasCompras.length > 0 && !pixData && !esperandoAprovacao && etapaCompra === 0 && (
                        <button onClick={() => setModoCompra(false)} className="text-gray-400 hover:text-white p-1">
                            <X size={20}/>
                        </button>
                     )}
                     
                     {/* Botão Voltar (Setinha) - Só aparece na etapa 1 */}
                     {etapaCompra === 1 && !pixData && !esperandoAprovacao && (
                        <button onClick={() => setEtapaCompra(0)} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-medium">
                            <ArrowLeft size={16}/> Voltar
                        </button>
                     )}
                     
                     <h3 className="font-bold text-white text-lg absolute left-1/2 transform -translate-x-1/2">
                       {pixData || esperandoAprovacao ? 'Pagamento' : etapaCompra === 0 ? '1. Definir Cotas' : '2. Pagamento'}
                     </h3>
                     <div className="w-6"></div> {/* Espaçador invisível para centralizar título */}
                   </div>

                   {/* --- ESTADO A: ESPERANDO APROVAÇÃO MANUAL --- */}
                   {esperandoAprovacao ? (
                     <div className="bg-yellow-500/10 border border-yellow-500/50 p-8 rounded-2xl text-center shadow-xl animate-pulse">
                        <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto text-black mb-4 font-bold text-2xl">$</div>
                        <h3 className="text-2xl font-bold text-yellow-400 mb-2">Aguardando Confirmação</h3>
                        <p className="text-gray-300 mb-4">Entregue o valor ao <strong>Admin</strong>.</p>
                        <p className="text-xs text-gray-500">Sua tela atualizará automaticamente assim que ele confirmar.</p>
                        <button onClick={() => setEsperandoAprovacao(false)} className="mt-6 text-sm underline text-gray-400 hover:text-white">
                            Cancelar / Voltar
                        </button>
                     </div>

                   ) : pixData ? (
                     // --- ESTADO B: PAGAMENTO PIX (COM POLLING) ---
                     <div className="text-center space-y-4">
                       <h3 className="text-white font-bold">Escaneie para Pagar</h3>
                       <div className="bg-white p-2 rounded-xl inline-block shadow-lg">
                          <img src={`data:image/png;base64,${pixData.img}`} className="w-48 h-48" alt="QR Code PIX" />
                       </div>
                       
                       <div className="space-y-2">
                           <button onClick={() => {navigator.clipboard.writeText(pixData.code); alert('Código copiado!')}} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition">
                             <Copy size={16}/> Copiar Código PIX
                           </button>
                           <p className="text-xs text-emerald-400 font-bold animate-pulse">
                               <RefreshCw size={12} className="inline mr-1 animate-spin"/>
                               Aguardando confirmação automática...
                           </p>
                       </div>
                       
                       <button onClick={() => setPixData(null)} className="text-gray-500 text-xs underline mt-4 hover:text-white">
                           Voltar / Cancelar
                       </button>
                     </div>

                   ) : (
                     // --- ESTADO C: FORMULÁRIOS (WIZARD) ---
                     <>
                       {/* ETAPA 1: ESCOLHA DE COTAS */}
                       {etapaCompra === 0 && (
                         <div className="space-y-6 animate-fadeIn">
                           
                           {/* MODO COTA ÚNICA - LÓGICA ESPECIAL */}
                           {bolao.tipoCotaUnica ? (
                             <div className="space-y-3">
                               <p className="text-sm text-gray-400 mb-2">
                                   Neste bolão, cada pessoa pode ter apenas 1 cota em seu nome.
                               </p>
                               
                               {/* Opção: Minha Cota */}
                               <div 
                                 onClick={() => !jaTenhoMinhaCota && setIncluirMinhaCota(!incluirMinhaCota)}
                                 className={`p-4 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                                    jaTenhoMinhaCota ? 'bg-emerald-900/10 border-emerald-500/30 opacity-60 cursor-default' 
                                    : incluirMinhaCota ? 'bg-emerald-900/20 border-emerald-500' 
                                    : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                                 }`}
                               >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition ${incluirMinhaCota || jaTenhoMinhaCota ? 'bg-emerald-500 border-emerald-500' : 'border-gray-500'}`}>
                                       {(incluirMinhaCota || jaTenhoMinhaCota) && <CheckCircle size={16} className="text-black"/>}
                                    </div>
                                    <div>
                                      <p className="font-bold text-white">{user.nome} (Você)</p>
                                      {jaTenhoMinhaCota && <span className="text-xs text-emerald-400 font-bold">✅ Já garantida!</span>}
                                    </div>
                                  </div>
                               </div>

                               {/* Lista de Amigos Adicionados */}
                               {amigosParaAdicionar.map((amigo, idx) => (
                                 <div key={idx} className="p-4 bg-gray-800 rounded-xl flex justify-between items-center border border-gray-700 animate-fadeIn">
                                   <div className="flex items-center gap-3">
                                     <UserPlus size={18} className="text-blue-400"/>
                                     <span className="font-bold text-white">{amigo}</span>
                                   </div>
                                   <button onClick={() => { const l = [...amigosParaAdicionar]; l.splice(idx, 1); setAmigosParaAdicionar(l); }} className="text-red-400 p-2 hover:bg-red-900/20 rounded transition">
                                     <Trash2 size={16}/>
                                   </button>
                                 </div>
                               ))}

                               {/* Botão/Input para Adicionar Amigo */}
                               {!mostrandoInputAmigo ? (
                                 <button onClick={() => setMostrandoInputAmigo(true)} className="w-full py-3 border border-dashed border-gray-600 rounded-xl text-gray-400 hover:text-white hover:border-gray-400 hover:bg-gray-800 transition flex items-center justify-center gap-2">
                                   <PlusCircle size={18}/> Adicionar cota para Amigo
                                 </button>
                               ) : (
                                 <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 animate-fadeIn">
                                   <label className="text-xs text-gray-400 mb-1 block">Nome Completo do Amigo</label>
                                   <div className="flex gap-2">
                                     <input 
                                        autoFocus 
                                        type="text" 
                                        className="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-3 outline-none focus:border-blue-500 text-white" 
                                        value={nomeAmigoTemp} 
                                        onChange={e => setNomeAmigoTemp(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && adicionarAmigoLista()} 
                                        placeholder="Ex: João da Silva"
                                     />
                                     <button onClick={adicionarAmigoLista} className="bg-blue-600 hover:bg-blue-500 px-4 rounded-lg font-bold text-white">OK</button>
                                   </div>
                                   <button onClick={() => setMostrandoInputAmigo(false)} className="text-xs text-red-400 mt-2 underline">Cancelar adição</button>
                                 </div>
                               )}
                             </div>
                           ) : (
                             /* MODO MULTI COTAS - SELEÇÃO PADRÃO */
                             <div className="space-y-4">
                               <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700">
                                 <span className="text-gray-300">Quantidade de Cotas</span>
                                 <div className="flex items-center gap-4">
                                   <button onClick={() => cotasQtd > 1 && setCotasQtd(cotasQtd - 1)} className="w-8 h-8 bg-gray-700 rounded-full font-bold hover:bg-gray-600 text-white">-</button>
                                   <span className="text-xl font-bold w-6 text-center text-white">{cotasQtd}</span>
                                   <button onClick={() => cotasQtd < 10 && setCotasQtd(cotasQtd + 1)} className="w-8 h-8 bg-gray-700 rounded-full font-bold hover:bg-gray-600 text-white">+</button>
                                 </div>
                               </div>
                               <div className="space-y-2">
                                 <p className="text-xs text-gray-400 ml-1">Nomes para os recibos:</p>
                                 {nomesCotas.map((nome, index) => (
                                   <input 
                                     key={index} 
                                     type="text" 
                                     placeholder={`Nome da Cota ${index + 1}`} 
                                     className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none text-white placeholder-gray-500" 
                                     value={nome} 
                                     onChange={e => { const n = [...nomesCotas]; n[index] = e.target.value; setNomesCotas(n); }} 
                                   />
                                 ))}
                               </div>
                             </div>
                           )}

                           {/* RODAPÉ DA ETAPA 1: TOTAL E AVANÇAR */}
                           <div className="pt-4 border-t border-gray-800 mt-4">
                             <div className="flex justify-between items-center mb-4">
                               <span className="text-gray-400">Total de Cotas:</span>
                               <span className="text-xl font-bold text-white">{calcularTotalCotas()}</span>
                             </div>
                             <div className="flex justify-between items-center mb-4">
                               <span className="text-gray-400">Valor Total:</span>
                               <span className="text-2xl font-bold text-emerald-400">{formatMoeda(bolao.valorCota * calcularTotalCotas())}</span>
                             </div>

                             <button 
                               onClick={() => {
                                 if (calcularTotalCotas() > 0) setEtapaCompra(1);
                                 else alert("Selecione pelo menos uma cota para continuar.");
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
                           
                           {/* RESUMO DO PEDIDO */}
                           <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
                             <h4 className="text-gray-400 text-xs font-bold uppercase mb-2 border-b border-gray-700 pb-2">Resumo do Pedido</h4>
                             <div className="flex justify-between items-center mb-2">
                               <span className="text-gray-300">{calcularTotalCotas()}x Cota Bolão</span>
                               <span className="font-bold text-white">{formatMoeda(bolao.valorCota * calcularTotalCotas())}</span>
                             </div>
                             <div className="text-right text-emerald-400 text-xl font-bold pt-2 border-t border-gray-700 mt-2">
                               Total: {formatMoeda(bolao.valorCota * calcularTotalCotas())}
                             </div>
                           </div>

                           {/* SELEÇÃO DO MÉTODO */}
                           <div className="space-y-3">
                             <p className="text-xs text-gray-400 ml-1 font-bold uppercase">Como deseja pagar?</p>
                             <div className="grid grid-cols-2 gap-3">
                                
                                <button 
                                  onClick={() => setMetodoPagamento('PIX')} 
                                  className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 ${
                                    metodoPagamento === 'PIX' 
                                    ? 'border-emerald-500 bg-emerald-900/20 shadow-emerald-900/20 shadow-lg' 
                                    : 'border-gray-700 bg-gray-800 hover:border-gray-500 hover:bg-gray-700'
                                  }`}
                                >
                                  <QrCode size={28} className={metodoPagamento === 'PIX' ? 'text-emerald-400' : 'text-gray-400'}/>
                                  <span className={`font-bold text-sm ${metodoPagamento === 'PIX' ? 'text-white' : 'text-gray-400'}`}>PIX</span>
                                </button>
                                
                                <button 
                                  onClick={() => setMetodoPagamento('DINHEIRO')} 
                                  className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 ${
                                    metodoPagamento === 'DINHEIRO' 
                                    ? 'border-yellow-500 bg-yellow-900/20 shadow-yellow-900/20 shadow-lg' 
                                    : 'border-gray-700 bg-gray-800 hover:border-gray-500 hover:bg-gray-700'
                                  }`}
                                >
                                  <Banknote size={28} className={metodoPagamento === 'DINHEIRO' ? 'text-yellow-400' : 'text-gray-400'}/>
                                  <span className={`font-bold text-sm ${metodoPagamento === 'DINHEIRO' ? 'text-white' : 'text-gray-400'}`}>Dinheiro</span>
                                </button>

                             </div>
                           </div>

                           {/* BOTÃO FINALIZAR */}
                           <button 
                             onClick={handleComprar} 
                             disabled={loadingPay} 
                             className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl transition transform active:scale-95 flex items-center justify-center gap-2 ${
                               metodoPagamento === 'PIX' 
                               ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50 text-white' 
                               : 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/50 text-white'
                             }`}
                           >
                              {loadingPay ? (
                                <><RefreshCw className="animate-spin"/> Processando...</>
                              ) : metodoPagamento === 'PIX' ? (
                                <><QrCode/> Gerar PIX Agora</>
                              ) : (
                                <><CheckCircle/> Confirmar Pedido</>
                              )}
                           </button>
                         </div>
                       )}
                     </>
                   )}
                </div>
              )
            )}

            {/* LISTA PÚBLICA DE PARTICIPANTES */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden mt-8 mb-8">
               <div className="p-4 bg-gray-800/50 flex justify-between items-center border-b border-gray-800">
                 <h3 className="font-bold flex items-center gap-2 text-white">
                    <Users size={18} className="text-emerald-500"/> Galera Confirmada
                 </h3>
                 <span className="bg-emerald-900/50 text-emerald-400 text-xs px-3 py-1 rounded-full border border-emerald-500/20 font-bold">
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
                   <div className="text-center p-8">
                      <p className="text-gray-500 text-sm mb-1">Ninguém pagou ainda.</p>
                      <p className="text-emerald-500 font-bold text-sm">Seja o primeiro a garantir sua sorte!</p>
                   </div>
                 )}
               </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 opacity-50">
            <Trophy size={64} className="mx-auto mb-4 text-gray-600"/>
            <p>Aguardando criação de um novo bolão...</p>
          </div>
        )}
      </main>
    </div>
  );
}