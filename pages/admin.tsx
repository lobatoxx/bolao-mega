import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import axios from 'axios';
import { 
  Save, Users, CheckCircle, Trash2, Lock, Unlock, Plus, Search, 
  DollarSign, Calendar, LayoutDashboard, LogOut, Database, 
  PlayCircle, Ticket, CheckSquare, Eraser, Award, List 
} from 'lucide-react';
import Link from 'next/link';

// FORMATADORES
const formatMoeda = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatDate = (data: string | null) => {
  if (!data) return '-';
  const dateObj = new Date(data);
  return isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleDateString('pt-BR');
};
const formatDateInput = (data: string) => {
    if(!data) return '';
    const d = new Date(data);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function Admin() {
  // --- ESTADOS GLOBAIS ---
  const [senha, setSenha] = useState('');
  const [logado, setLogado] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [tab, setTab] = useState<'dashboard' | 'catalogo' | 'conferidor'>('dashboard');

  // --- DADOS DASHBOARD (HISTÓRICO & DETALHES) ---
  const { data: listaBoloes, mutate: refreshLista } = useSWR(logado ? '/api/bolao/todos' : null, fetcher);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: bolaoAtivo, mutate: refreshBolao } = useSWR(selectedId && logado ? `/api/bolao?id=${selectedId}` : null, fetcher);

  // FORMULÁRIO DASHBOARD
  const [modoEdicao, setModoEdicao] = useState(false);
  const [form, setForm] = useState({ concurso: '', data: '', premio: '', cota: '', tipoUnica: false });
  const [loading, setLoading] = useState(false);

  // --- DADOS CATÁLOGO & CONFERIDOR (IMPORTADOS DO SEU ARQUIVO ANTIGO) ---
  const [apostasValendo, setApostasValendo] = useState<any[]>([]); // Jogos importados no bolão
  const [nomeJogo, setNomeJogo] = useState('');
  const [novosNumerosSelecionados, setNovosNumerosSelecionados] = useState<number[]>([]); 
  const [listaJogos, setListaJogos] = useState<any[]>([]);
  const [jogosSelecionados, setJogosSelecionados] = useState<string[]>([]);
  
  // Conferidor
  const [resultadoStr, setResultadoStr] = useState('');
  const [relatorio, setRelatorio] = useState<any>(null);


  // ============================================================
  // 1. EFEITOS E CARREGAMENTOS
  // ============================================================
  
  // Quando seleciona um bolão na lista (Dashboard)
  useEffect(() => {
    if (bolaoAtivo && selectedId) {
      setModoEdicao(true);
      setForm({
        concurso: bolaoAtivo.concurso,
        data: formatDateInput(bolaoAtivo.dataSorteio),
        premio: bolaoAtivo.premioEstimado,
        cota: bolaoAtivo.valorCota,
        tipoUnica: bolaoAtivo.tipoCotaUnica
      });
      carregarApostasValendo(bolaoAtivo.id); // Carrega jogos vinculados
    }
  }, [bolaoAtivo, selectedId]);

  // Carrega catálogo ao entrar na aba
  useEffect(() => { if(logado && tab === 'catalogo') carregarCatalogo(); }, [logado, tab]);


  // ============================================================
  // 2. FUNÇÕES DE LOGIN & GESTÃO
  // ============================================================
  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      await axios.post('/api/admin/login', { password: senha });
      setLogado(true);
    } catch (err) { alert('Senha incorreta!'); } 
    finally { setLoginLoading(false); }
  };

  const handleNovo = () => {
    setSelectedId(null);
    setModoEdicao(false);
    setForm({ concurso: '', data: '', premio: '', cota: '', tipoUnica: false });
    setApostasValendo([]);
  };

  const handleSalvar = async () => {
    setLoading(true);
    try {
      const payload = {
        concurso: form.concurso,
        dataSorteio: form.data,
        premioEstimado: form.premio,
        valorCota: form.cota,
        tipoCotaUnica: form.tipoUnica,
        adminPassword: senha
      };

      if (modoEdicao && selectedId) {
        await axios.put('/api/bolao', { ...payload, id: selectedId, aberto: bolaoAtivo?.aberto });
        alert('Atualizado!');
      } else {
        await axios.post('/api/bolao', payload);
        alert('Criado!');
        handleNovo();
      }
      refreshLista();
      refreshBolao();
    } catch (err: any) { alert('Erro: ' + (err.response?.data?.error || err.message)); } 
    finally { setLoading(false); }
  };

  const handleToggleStatus = async () => {
    if (!bolaoAtivo) return;
    try {
      await axios.put('/api/bolao', {
        id: bolaoAtivo.id,
        concurso: bolaoAtivo.concurso,
        dataSorteio: bolaoAtivo.dataSorteio,
        premioEstimado: bolaoAtivo.premioEstimado,
        valorCota: bolaoAtivo.valorCota,
        tipoCotaUnica: bolaoAtivo.tipoCotaUnica,
        aberto: !bolaoAtivo.aberto,
        adminPassword: senha
      });
      refreshBolao(); refreshLista();
    } catch (err: any) { alert('Erro: ' + err.message); }
  };

  // ============================================================
  // 3. FUNÇÕES DE PARTICIPANTES (Novo Recurso)
  // ============================================================
  const confirmarPagamentoManual = async (participanteId: string) => {
    if(!confirm('Confirmar recebimento em dinheiro?')) return;
    try {
        await axios.post('/api/telegram/webhook', {
            callback_query: { data: `aprovar_${participanteId}`, message: { chat: { id: '0' }, message_id: '0' } }
        });
        alert('Confirmado!'); refreshBolao();
    } catch (err) { alert('Erro ao confirmar'); }
  };

  const deletarParticipante = async (pid: string) => {
      if(!confirm('Excluir participante?')) return;
      try {
        await axios.post('/api/telegram/webhook', { callback_query: { data: `rejeitar_${pid}`, message: { chat: { id: '0' }, message_id: '0' }}});
        refreshBolao();
      } catch (err) { alert('Erro ao excluir'); }
  };

  // ============================================================
  // 4. FUNÇÕES DO CATÁLOGO & CONFERIDOR (Restauradas)
  // ============================================================
  const carregarCatalogo = async () => {
    try {
       const res = await axios.post('/api/admin', { action: 'listar_catalogo', adminPassword: senha });
       setListaJogos(res.data);
    } catch(e) { console.error(e); }
  };

  const carregarApostasValendo = async (bId: string) => {
    try {
        const res = await axios.post('/api/admin', { action: 'listar_apostas', bolaoId: bId, adminPassword: senha });
        setApostasValendo(res.data);
    } catch(e) { console.error(e); }
  };

  const toggleNumeroGrid = (numero: number) => {
    if (novosNumerosSelecionados.includes(numero)) {
      setNovosNumerosSelecionados(prev => prev.filter(n => n !== numero));
    } else {
      if (novosNumerosSelecionados.length >= 6) return alert('Máximo de 6 dezenas!');
      setNovosNumerosSelecionados(prev => [...prev, numero]);
    }
  };

  const salvarJogo = async () => {
    const nums = [...novosNumerosSelecionados].sort((a,b) => a-b);
    if(nums.length < 6) return alert('Selecione 6 números!');
    try {
        await axios.post('/api/admin', { 
            action: 'salvar_catalogo', 
            nome: nomeJogo || `Jogo ${listaJogos.length + 1}`,
            numeros: nums, 
            adminPassword: senha 
        });
        alert('Salvo!');
        setNovosNumerosSelecionados([]); setNomeJogo('');
        carregarCatalogo();
    } catch(e) { alert('Erro ao salvar'); }
  };

  const excluirDoCatalogo = async (id: string) => { 
      if(confirm('Apagar?')) { 
          await axios.post('/api/admin', { action: 'excluir_catalogo', id, adminPassword: senha }); 
          carregarCatalogo(); 
      } 
  };
  
  const toggleSelecao = (id: string) => { 
    if (jogosSelecionados.includes(id)) setJogosSelecionados(jogosSelecionados.filter(i => i !== id)); 
    else setJogosSelecionados([...jogosSelecionados, id]); 
  };
  
  const jogarSelecionados = async () => { 
    if(!selectedId) return alert('Selecione um bolão no Dashboard primeiro!'); 
    if(jogosSelecionados.length === 0) return alert('Selecione jogos'); 
    if(!confirm(`Importar ${jogosSelecionados.length} jogos para o concurso atual?`)) return; 
    try {
        await axios.post('/api/admin', { action: 'vincular_jogos', bolaoId: selectedId, jogosIds: jogosSelecionados, adminPassword: senha }); 
        alert('Vinculados!'); setJogosSelecionados([]);
        // Se estiver no dashboard, atualiza a lista de apostas
        if(selectedId) carregarApostasValendo(selectedId);
    } catch(e) { alert('Erro ao vincular'); }
  };

  const excluirApostaDoBolao = async (id: string) => { 
      if(!confirm('Remover jogo deste bolão?')) return; 
      await axios.post('/api/admin', { action: 'excluir_aposta', id, adminPassword: senha }); 
      if(selectedId) carregarApostasValendo(selectedId); 
  };

  const conferir = async () => { 
    if(!selectedId) return alert('Selecione um bolão no Dashboard primeiro!'); 
    const nums = resultadoStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)); 
    const res = await axios.post('/api/admin', { action: 'conferir', bolaoId: selectedId, numerosSorteados: nums, adminPassword: senha }); 
    setRelatorio(res.data); 
  };


  // ============================================================
  // RENDERIZAÇÃO
  // ============================================================

  if (!logado) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-xl w-full max-w-sm border border-gray-700 shadow-2xl">
          <h1 className="text-white text-xl font-bold mb-4 flex items-center gap-2"><Lock size={20}/> Central Admin</h1>
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
             <input type="password" placeholder="Senha do .env" className="w-full p-3 bg-gray-900 border border-gray-600 rounded mb-4 text-white focus:border-blue-500 outline-none" value={senha} onChange={e => setSenha(e.target.value)} />
             <button disabled={loginLoading} className="w-full bg-blue-600 py-3 rounded font-bold text-white hover:bg-blue-500 transition">
               {loginLoading ? 'Verificando...' : 'Acessar'}
             </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col md:flex-row">
      <Head><title>Admin - Bolão</title></Head>
      
      {/* SIDEBAR DE NAVEGAÇÃO PRINCIPAL */}
      <aside className="w-full md:w-64 bg-gray-900 border-b md:border-r border-gray-800 shrink-0 flex flex-col h-auto md:h-screen sticky top-0">
        <div className="p-6 border-b border-gray-800 hidden md:block">
            <h2 className="font-bold text-xl flex items-center gap-2"><LayoutDashboard/> Admin</h2>
        </div>
        
        {/* MENU ABAS */}
        <nav className="p-4 space-y-2 flex md:block overflow-x-auto">
          <button onClick={() => setTab('dashboard')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 whitespace-nowrap transition ${tab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
             <List size={18}/> Gestão
          </button>
          <button onClick={() => setTab('catalogo')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 whitespace-nowrap transition ${tab === 'catalogo' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
             <Database size={18}/> Catálogo
          </button>
          <button onClick={() => setTab('conferidor')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 whitespace-nowrap transition ${tab === 'conferidor' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
             <Award size={18}/> Conferidor
          </button>
        </nav>

        <div className="mt-auto p-4 border-t border-gray-800">
             <Link href="/" target="_blank" className="w-full text-left p-3 rounded flex items-center gap-3 text-gray-400 hover:text-white hover:bg-gray-800 mb-2">
                 <LogOut size={18}/> Ver Site
             </Link>
             <button onClick={() => setLogado(false)} className="w-full text-left p-3 rounded flex items-center gap-3 text-red-400 hover:text-red-300 hover:bg-red-900/20">
                 <Lock size={18}/> Sair
             </button>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        
        {/* ========================================================================= */}
        {/* ABA DASHBOARD (COM SIDEBAR DE HISTÓRICO INTERNA) */}
        {/* ========================================================================= */}
        {tab === 'dashboard' && (
           <div className="flex flex-col xl:flex-row gap-6 h-full">
               
               {/* COLUNA ESQUERDA: HISTÓRICO DE BOLÕES */}
               <div className="w-full xl:w-80 space-y-4">
                  <button onClick={handleNovo} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
                      <Plus size={20}/> Criar Bolão
                  </button>
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-2 max-h-[500px] overflow-y-auto">
                      <h3 className="text-xs font-bold text-gray-500 uppercase p-2">Histórico</h3>
                      {listaBoloes?.map((b: any) => (
                          <div key={b.id} onClick={() => setSelectedId(b.id)} className={`p-3 rounded-lg cursor-pointer border mb-2 transition hover:bg-gray-800 ${selectedId === b.id ? 'bg-gray-800 border-blue-500 shadow' : 'bg-transparent border-transparent'}`}>
                              <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-white text-sm">Conc. {b.concurso}</span>
                                  {b.aberto ? <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"/> : <div className="w-2 h-2 rounded-full bg-red-500"/>}
                              </div>
                              <div className="text-xs text-gray-400 flex justify-between">
                                  <span>{formatDate(b.dataSorteio)}</span>
                                  <span>{b._count?.participantes || 0} part.</span>
                              </div>
                          </div>
                      ))}
                  </div>
               </div>

               {/* COLUNA DIREITA: FORMULÁRIO + TABELAS */}
               <div className="flex-1 space-y-6">
                   {/* 1. FORMULÁRIO DE EDIÇÃO */}
                   <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                {modoEdicao ? `Concurso ${form.concurso}` : 'Novo Bolão'}
                            </h2>
                            {modoEdicao && bolaoAtivo && (
                                <button onClick={handleToggleStatus} className={`px-4 py-2 rounded font-bold text-sm flex items-center gap-2 ${bolaoAtivo.aberto ? 'bg-red-900/30 text-red-400 border border-red-900/50' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50'}`}>
                                    {bolaoAtivo.aberto ? <><Lock size={16}/> Fechar</> : <><Unlock size={16}/> Reabrir</>}
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-xs text-gray-400 block mb-1">Concurso</label><input type="text" className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white" value={form.concurso} onChange={e => setForm({...form, concurso: e.target.value})} /></div>
                            <div><label className="text-xs text-gray-400 block mb-1">Data Sorteio</label><input type="date" className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white" value={form.data} onChange={e => setForm({...form, data: e.target.value})} /></div>
                            <div><label className="text-xs text-gray-400 block mb-1">Prêmio Estimado (R$)</label><input type="number" className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white" value={form.premio} onChange={e => setForm({...form, premio: e.target.value})} /></div>
                            <div><label className="text-xs text-gray-400 block mb-1">Valor da Cota (R$)</label><input type="number" className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white" value={form.cota} onChange={e => setForm({...form, cota: e.target.value})} /></div>
                        </div>

                        <div className="mt-4 flex items-center gap-3 bg-gray-950 p-3 rounded border border-gray-700 w-fit">
                            <button type="button" onClick={() => setForm({...form, tipoUnica: !form.tipoUnica})} className={`w-12 h-6 rounded-full p-1 transition-colors ${form.tipoUnica ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${form.tipoUnica ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                            <span className="text-sm font-bold text-gray-300">{form.tipoUnica ? 'Modo Cota Única (Restrito)' : 'Modo Multi Cotas (Livre)'}</span>
                        </div>

                        <button onClick={handleSalvar} disabled={loading} className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg">
                            <Save size={18}/> {modoEdicao ? 'Salvar Alterações' : 'Criar Bolão'}
                        </button>
                   </section>

                   {/* 2. TABELA DE PARTICIPANTES (Só no modo edição) */}
                   {modoEdicao && bolaoAtivo && (
                       <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                           <div className="flex justify-between items-center mb-6">
                               <h3 className="font-bold text-xl flex items-center gap-2"><Users size={20}/> Participantes</h3>
                               <div className="text-right">
                                   <p className="text-xs text-gray-400">Total Arrecadado</p>
                                   <p className="text-xl font-bold text-emerald-400">{formatMoeda(bolaoAtivo.participantes.filter((p:any) => p.status === 'pago').reduce((acc:number, p:any) => acc + p.valorTotal, 0))}</p>
                               </div>
                           </div>
                           <div className="overflow-x-auto">
                               <table className="w-full text-left text-sm text-gray-400">
                                   <thead className="bg-gray-950 uppercase font-bold text-xs"><tr><th className="p-3">Nome</th><th className="p-3">Cotas</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3 text-right">Ação</th></tr></thead>
                                   <tbody className="divide-y divide-gray-800">
                                       {bolaoAtivo.participantes.map((p: any) => (
                                           <tr key={p.id} className="hover:bg-gray-800/50">
                                               <td className="p-3 text-white font-medium">{p.usuario.nome}<span className="block text-xs text-gray-500">{p.usuario.cpf}</span></td>
                                               <td className="p-3">{p.quantidade}<div className="text-xs text-gray-500 max-w-[150px] truncate">{p.nomesCotas.join(', ')}</div></td>
                                               <td className="p-3 text-white">{formatMoeda(p.valorTotal)}</td>
                                               <td className="p-3">{p.status === 'pago' ? <span className="text-emerald-400 flex items-center gap-1 font-bold"><CheckCircle size={14}/> Pago</span> : p.metodo === 'DINHEIRO' ? <span className="text-yellow-400 font-bold bg-yellow-900/20 px-2 py-1 rounded text-xs">Aguardando Dinheiro</span> : <span className="text-gray-500">Pendente (PIX)</span>}</td>
                                               <td className="p-3 text-right">
                                                   {p.status === 'pendente' && p.metodo === 'DINHEIRO' && <button onClick={() => confirmarPagamentoManual(p.id)} className="text-emerald-400 hover:text-emerald-300 mr-3 font-bold text-xs border border-emerald-900 px-2 py-1 rounded bg-emerald-900/20">Aprovar</button>}
                                                   <button onClick={() => deletarParticipante(p.id)} className="text-red-500 hover:text-red-400"><Trash2 size={16}/></button>
                                               </td>
                                           </tr>
                                       ))}
                                       {bolaoAtivo.participantes.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-600">Nenhum participante.</td></tr>}
                                   </tbody>
                               </table>
                           </div>
                       </section>
                   )}
                   
                   {/* 3. LISTA DE JOGOS VINCULADOS (Apostas Valendo) */}
                   {modoEdicao && (
                       <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                           <h3 className="font-bold flex items-center gap-2 mb-4"><Ticket className="text-emerald-500"/> Jogos Valendo ({apostasValendo.length})</h3>
                           <div className="max-h-60 overflow-y-auto space-y-2">
                             {apostasValendo.map((aposta) => (
                               <div key={aposta.id} className="bg-gray-800 p-3 rounded flex justify-between items-center gap-2">
                                 <span className="text-sm font-bold text-gray-300">{aposta.origem || 'Jogo'}</span>
                                 <div className="flex gap-1 flex-wrap justify-center">
                                   {aposta.numeros.map((n:number) => <span key={n} className="bg-gray-900 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold text-emerald-400">{n}</span>)}
                                 </div>
                                 <button onClick={() => excluirApostaDoBolao(aposta.id)} className="text-red-500 hover:bg-red-900/30 p-1"><Trash2 size={14}/></button>
                               </div>
                             ))}
                             {apostasValendo.length === 0 && <p className="text-gray-500 text-sm">Nenhum jogo vinculado ainda. Vá na aba Catálogo.</p>}
                           </div>
                       </section>
                   )}
               </div>
           </div>
        )}

        {/* ========================================================================= */}
        {/* ABA CATÁLOGO */}
        {/* ========================================================================= */}
        {tab === 'catalogo' && (
          <div className="space-y-6 animate-fadeIn">
            {/* ... (MANTEVE O CÓDIGO DO CATÁLOGO IGUAL AO SEU) ... */}
            <div className="bg-gray-800 p-4 md:p-6 rounded-xl border border-gray-700">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-400"><Plus/> Novo Volante</h3>
              <div className="mb-4 flex gap-2">
                 <input type="text" placeholder="Nome do Jogo" value={nomeJogo} onChange={e => setNomeJogo(e.target.value)} className="p-3 bg-gray-900 rounded border border-gray-600 w-full outline-none focus:border-emerald-500" />
                 <button onClick={() => setNovosNumerosSelecionados([])} className="bg-gray-700 px-4 rounded text-gray-300 hover:text-white" title="Limpar"><Eraser size={20}/></button>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 mb-4">
                 {Array.from({length: 60}, (_, i) => i + 1).map((n) => (
                   <button key={n} onClick={() => toggleNumeroGrid(n)} className={`aspect-square rounded-full font-bold text-sm flex items-center justify-center transition ${novosNumerosSelecionados.includes(n) ? 'bg-emerald-500 text-black shadow-lg scale-110' : 'bg-gray-900 text-gray-500 hover:bg-gray-700'}`}>
                     {n < 10 ? `0${n}` : n}
                   </button>
                 ))}
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-sm text-gray-400">Selecionados: <strong className={novosNumerosSelecionados.length === 6 ? 'text-emerald-400' : 'text-white'}>{novosNumerosSelecionados.length}/6</strong></span>
                 <button onClick={salvarJogo} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-bold flex items-center gap-2 transition"><Save size={18}/> Salvar Jogo</button>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2"><Database/> Meus Jogos ({listaJogos.length})</h3>
                <div className="flex gap-2 w-full md:w-auto">
                   <button onClick={jogarSelecionados} disabled={jogosSelecionados.length === 0} className={`flex-1 md:flex-none px-4 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition ${jogosSelecionados.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}>
                     <PlayCircle size={16}/> Importar para Bolão ({jogosSelecionados.length})
                   </button>
                   <button onClick={() => setJogosSelecionados(jogosSelecionados.length === listaJogos.length ? [] : listaJogos.map(j => j.id))} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-bold text-gray-300">
                      {jogosSelecionados.length === listaJogos.length ? 'Desmarcar' : 'Todos'}
                   </button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                {listaJogos.map(j => (
                  <div key={j.id} className={`p-3 rounded flex justify-between items-center cursor-pointer transition border ${jogosSelecionados.includes(j.id) ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-gray-900 border-transparent hover:bg-gray-800'}`} onClick={() => toggleSelecao(j.id)}>
                    <div className="flex items-center gap-3">
                       <div className={`w-5 h-5 rounded border flex items-center justify-center ${jogosSelecionados.includes(j.id) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>{jogosSelecionados.includes(j.id) && <CheckSquare size={14} className="text-black"/>}</div>
                       <span className={`font-bold text-sm md:text-base ${jogosSelecionados.includes(j.id) ? 'text-emerald-300' : 'text-gray-300'}`}>{j.nome}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end items-center">
                      <div className="flex gap-1">{j.numeros.map((n: number) => (<span key={n} className="bg-gray-700 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold text-emerald-400">{n}</span>))}</div>
                      <button onClick={(e) => { e.stopPropagation(); excluirDoCatalogo(j.id); }} className="ml-2 text-gray-600 hover:text-red-500 p-2"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA CONFERIDOR */}
        {/* ========================================================================= */}
        {tab === 'conferidor' && (
           <div className="space-y-6 animate-fadeIn">
             <div className="bg-gray-800 p-6 rounded-xl border border-emerald-500/30">
               <h3 className="text-2xl font-bold mb-4">Conferidor</h3>
               <p className="text-sm text-gray-400 mb-2">Cole os números sorteados separados por vírgula. Ex: 05, 12, 33...</p>
               <input type="text" placeholder="01, 02, 03..." value={resultadoStr} onChange={e=>setResultadoStr(e.target.value)} className="w-full text-3xl text-center p-4 bg-black border border-emerald-600 rounded-xl text-emerald-400 font-mono tracking-widest"/>
               <button onClick={conferir} className="w-full mt-4 bg-emerald-600 py-4 rounded-xl font-bold text-lg hover:bg-emerald-500 transition">CONFERIR RESULTADO</button>
             </div>
             {relatorio && (
               <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                 <h4 className="text-lg font-bold mb-4 text-white">Relatório de Acertos</h4>
                 <div className="grid grid-cols-2 gap-4 text-center mb-4">
                   <div className="bg-gray-800 p-4 rounded"><p className="text-gray-400 text-sm">Jogos Conferidos</p><p className="font-bold text-xl text-white">{relatorio.totalJogos}</p></div>
                   <div className="bg-gray-800 p-4 rounded"><p className="text-gray-400 text-sm">Jogos Premiados</p><p className="font-bold text-xl text-yellow-400">{relatorio.vitorias.length}</p></div>
                 </div>
                 <div className="space-y-2">
                    {relatorio.vitorias.map((v:any)=>(
                    <div key={v.id} className="bg-yellow-900/10 border-l-4 border-yellow-500 p-4 flex justify-between items-center rounded-r">
                        <div><p className="font-bold text-yellow-400">{v.premio}</p><p className="text-xs text-gray-400">{v.origem}</p></div>
                        <div className="flex gap-1">{v.numeros.map((n:number)=><span key={n} className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${v.acertosNumeros.includes(n)?'bg-emerald-500 text-black':'bg-gray-700 text-gray-500'}`}>{n}</span>)}</div>
                    </div>
                    ))}
                    {relatorio.vitorias.length === 0 && <p className="text-center text-gray-500 py-4">Nenhum prêmio encontrado desta vez.</p>}
                 </div>
               </div>
             )}
           </div>
        )}
      </main>
    </div>
  );
}