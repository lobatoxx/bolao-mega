import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import axios from 'axios';
import useSWR from 'swr';
import { Lock, Save, List, Database, Plus, PlayCircle, Award, LayoutDashboard, Home as HomeIcon, Edit, Trash2, X, Ticket, CheckSquare, Unlock, Eraser } from 'lucide-react';
import Link from 'next/link';

// --- FORMATADORES (CORRIGIDO DATA 1969) ---
const formatMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
// Se a data vier nula, vazia ou inválida, retorna tracinho em vez de 1969
const formatDate = (data: string | null) => {
  if (!data) return '-';
  const dateObj = new Date(data);
  return isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleDateString('pt-BR');
};
const formatDateInput = (data: string) => new Date(data).toISOString().split('T')[0];

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function AdminPage() {
  // --- ESTADOS GLOBAIS ---
  const [password, setPassword] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [tab, setTab] = useState('dashboard'); 

  // DADOS DO BOLÃO
  const { data: bolao, mutate } = useSWR('/api/bolao', fetcher);
  
  // --- ESTADOS: BOLÃO (DASHBOARD) ---
  const [editMode, setEditMode] = useState(false);
  const [novoConcurso, setNovoConcurso] = useState('');
  const [novoData, setNovoData] = useState('');
  const [novoPremio, setNovoPremio] = useState('');
  const [novoValorCota, setNovoValorCota] = useState('');
  const [apostasValendo, setApostasValendo] = useState<any[]>([]);

  // --- ESTADOS: CATÁLOGO (GRID 01-60) ---
  const [nomeJogo, setNomeJogo] = useState('');
  const [novosNumerosSelecionados, setNovosNumerosSelecionados] = useState<number[]>([]); 
  const [listaJogos, setListaJogos] = useState<any[]>([]);
  const [jogosSelecionados, setJogosSelecionados] = useState<string[]>([]);

  // --- ESTADOS: CONFERIDOR ---
  const [resultadoStr, setResultadoStr] = useState('');
  const [relatorio, setRelatorio] = useState<any>(null);


  // ==========================================
  // 1. LÓGICA DE LOGIN
  // ==========================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoadingLogin(true);
    try {
      await axios.post('/api/admin', { action: 'check_auth', adminPassword: password });
      setIsLogged(true);
    } catch (error) {
      alert('Senha Incorreta! Acesso Negado.');
      setIsLogged(false);
    } finally {
      setLoadingLogin(false);
    }
  };


  // ==========================================
  // 2. LÓGICA DO BOLÃO
  // ==========================================
  useEffect(() => {
    if(isLogged && bolao && tab === 'dashboard') {
      carregarApostasValendo();
    }
  }, [isLogged, bolao, tab]);

  const carregarApostasValendo = async () => {
    if(!bolao) return;
    const res = await axios.post('/api/admin', { action: 'listar_apostas', bolaoId: bolao.id, adminPassword: password });
    setApostasValendo(res.data);
  };

  const toggleStatusAberto = async () => {
    if(!bolao) return;
    const acao = bolao.aberto ? 'ENCERRAR' : 'REABRIR';
    if(!confirm(`Tem certeza que deseja ${acao} as apostas?`)) return;

    try {
        await axios.put('/api/bolao', {
            id: bolao.id,
            concurso: bolao.concurso,
            dataSorteio: bolao.dataSorteio,
            premioEstimado: bolao.premioEstimado,
            valorCota: bolao.valorCota,
            aberto: !bolao.aberto,
            adminPassword: password
        });
        mutate();
    } catch (err: any) { alert(err.response?.data?.error); }
  };

  const handleEditClick = () => { if(!bolao) return; setEditMode(true); setNovoConcurso(bolao.concurso); setNovoData(formatDateInput(bolao.dataSorteio)); setNovoPremio(bolao.premioEstimado); setNovoValorCota(bolao.valorCota); };
  const handleCancelEdit = () => { setEditMode(false); };
  
  const handleSalvarBolao = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editMode) {
        await axios.put('/api/bolao', { id: bolao.id, concurso: novoConcurso, dataSorteio: novoData, premioEstimado: novoPremio, valorCota: novoValorCota, aberto: bolao.aberto, adminPassword: password });
        alert('Atualizado!'); handleCancelEdit();
      } else {
        if(!confirm('Criar novo bolão?')) return;
        await axios.post('/api/bolao', { concurso: novoConcurso, dataSorteio: novoData, premioEstimado: novoPremio, valorCota: novoValorCota, adminPassword: password });
        alert('Criado!'); setNovoConcurso(''); setNovoData(''); setNovoPremio(''); setNovoValorCota('');
      }
      mutate();
    } catch (err: any) { alert(err.response?.data?.error); }
  };
  
  const handleExcluirBolao = async () => { if (!confirm('TEM CERTEZA?')) return; await axios.delete('/api/bolao', { data: { id: bolao.id, adminPassword: password } }); mutate(); };
  
  const excluirApostaDoBolao = async (id: string) => { if(!confirm('Remover jogo?')) return; await axios.post('/api/admin', { action: 'excluir_aposta', id, adminPassword: password }); carregarApostasValendo(); };


  // ==========================================
  // 3. LÓGICA DO CATÁLOGO (GRID 01-60)
  // ==========================================
  const carregarCatalogo = async () => {
    const res = await axios.post('/api/admin', { action: 'listar_catalogo', adminPassword: password });
    setListaJogos(res.data);
  };

  useEffect(() => { if(isLogged && tab === 'catalogo') carregarCatalogo(); }, [isLogged, tab]);

  // Função para marcar/desmarcar números no Grid
  const toggleNumeroGrid = (numero: number) => {
    if (novosNumerosSelecionados.includes(numero)) {
      setNovosNumerosSelecionados(prev => prev.filter(n => n !== numero));
    } else {
      if (novosNumerosSelecionados.length >= 6) return alert('Máximo de 6 dezenas por jogo!');
      setNovosNumerosSelecionados(prev => [...prev, numero]);
    }
  };

  const salvarJogo = async () => {
    const nums = [...novosNumerosSelecionados].sort((a,b) => a-b);
    if(nums.length < 6) return alert('Selecione 6 números no volante!');
    
    await axios.post('/api/admin', { 
      action: 'salvar_catalogo', 
      nome: nomeJogo || `Jogo ${listaJogos.length + 1}`,
      numeros: nums, 
      adminPassword: password 
    });
    
    alert('Jogo Salvo!');
    setNovosNumerosSelecionados([]);
    setNomeJogo('');
    carregarCatalogo();
  };

  const excluirDoCatalogo = async (id: string) => { if(confirm('Apagar?')) { await axios.post('/api/admin', { action: 'excluir_catalogo', id, adminPassword: password }); carregarCatalogo(); } }
  
  const toggleSelecao = (id: string) => { 
    if (jogosSelecionados.includes(id)) setJogosSelecionados(jogosSelecionados.filter(i => i !== id)); 
    else setJogosSelecionados([...jogosSelecionados, id]); 
  };
  
  const jogarSelecionados = async () => { 
    if(!bolao) return alert('Sem bolão ativo'); 
    if(jogosSelecionados.length === 0) return alert('Selecione jogos'); 
    if(!confirm(`Importar ${jogosSelecionados.length} jogos?`)) return; 
    await axios.post('/api/admin', { action: 'vincular_jogos', bolaoId: bolao.id, jogosIds: jogosSelecionados, adminPassword: password }); 
    alert('Vinculados!'); setJogosSelecionados([]); 
  };

  // ==========================================
  // 4. LÓGICA CONFERIDOR
  // ==========================================
  const conferir = async () => { 
    if(!bolao) return; 
    const nums = resultadoStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)); 
    const res = await axios.post('/api/admin', { action: 'conferir', bolaoId: bolao.id, numerosSorteados: nums, adminPassword: password }); 
    setRelatorio(res.data); 
  };


  // --- TELA DE LOGIN ---
  if (!isLogged) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-gray-900 p-8 rounded-2xl border border-gray-800 w-full max-w-sm text-center">
          <Lock size={48} className="mx-auto text-red-500 mb-4"/>
          <h1 className="text-2xl font-bold text-white mb-6">Central de Comando</h1>
          <input type="password" placeholder="Senha Mestra" className="w-full p-3 bg-black border border-gray-700 rounded-lg text-white mb-4" value={password} onChange={e => setPassword(e.target.value)} />
          <button disabled={loadingLogin} className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-lg font-bold text-white">{loadingLogin ? 'Validando...' : 'Acessar Sistema'}</button>
          <div className="mt-4"><Link href="/" className="text-gray-500 hover:text-white text-sm">Voltar ao site</Link></div>
        </form>
      </div>
    );
  }

  // --- RENDERIZAÇÃO PRINCIPAL ---
  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col md:flex-row">
      <Head><title>Admin - Bolão</title></Head>
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-gray-900 border-b md:border-r border-gray-800 shrink-0">
        <div className="p-6 border-b border-gray-800 hidden md:block"><h2 className="font-bold text-xl flex items-center gap-2"><LayoutDashboard/> Admin</h2></div>
        <nav className="p-4 space-y-2 flex md:block overflow-x-auto">
          <button onClick={() => setTab('dashboard')} className={`w-full text-left p-3 rounded flex items-center gap-3 whitespace-nowrap ${tab === 'dashboard' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}><List size={18}/> Bolão</button>
          <button onClick={() => setTab('catalogo')} className={`w-full text-left p-3 rounded flex items-center gap-3 whitespace-nowrap ${tab === 'catalogo' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}><Database size={18}/> Catálogo</button>
          <button onClick={() => setTab('conferidor')} className={`w-full text-left p-3 rounded flex items-center gap-3 whitespace-nowrap ${tab === 'conferidor' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}><Award size={18}/> Conferidor</button>
          <div className="hidden md:block pt-8 border-t border-gray-800 mt-4"><Link href="/" className="w-full text-left p-3 rounded flex items-center gap-3 text-gray-400 hover:text-white hover:bg-gray-800"><HomeIcon size={18}/> Ver Site</Link></div>
        </nav>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">{tab === 'dashboard' ? 'Gestão do Bolão' : tab === 'catalogo' ? 'Jogos Salvos' : 'Conferidor'}</h1>
          {bolao && <span className={`px-4 py-1 rounded-full text-xs md:text-sm border font-bold ${bolao.aberto ? 'bg-emerald-900 text-emerald-300 border-emerald-500/30' : 'bg-red-900 text-red-300 border-red-500/30'}`}>{bolao.aberto ? 'APOSTAS ABERTAS' : 'APOSTAS ENCERRADAS'}</span>}
        </header>

        {/* --- ABA DASHBOARD --- */}
        {tab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            {/* FORMULÁRIO DE BOLÃO */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">{editMode ? 'Editando' : 'Novo Bolão'}</h3>
                {editMode && <button onClick={handleCancelEdit} className="text-xs border px-2 py-1 rounded">Cancelar</button>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Concurso" className="p-3 bg-gray-900 rounded border border-gray-600 w-full" value={novoConcurso} onChange={e => setNovoConcurso(e.target.value)} />
                <input type="date" className="p-3 bg-gray-900 rounded border border-gray-600 w-full text-gray-300" value={novoData} onChange={e => setNovoData(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <input type="number" placeholder="Prêmio" className="p-3 bg-gray-900 rounded border border-gray-600 w-full" value={novoPremio} onChange={e => setNovoPremio(e.target.value)} />
                <input type="number" placeholder="Cota R$" className="p-3 bg-gray-900 rounded border border-gray-600 w-full" value={novoValorCota} onChange={e => setNovoValorCota(e.target.value)} />
              </div>
              <button onClick={handleSalvarBolao} className="w-full mt-4 py-3 rounded font-bold bg-blue-600 hover:bg-blue-500"><Save size={18} className="inline mr-2"/> Salvar</button>
            </div>

            {/* CARD DO BOLÃO ATUAL */}
            {bolao && (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 relative">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mt-2">Concurso {bolao.concurso}</h2>
                    <p className="text-gray-400 text-sm">{formatDate(bolao.dataSorteio)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Prêmio</p>
                    <p className="text-xl font-bold text-emerald-400">{formatMoeda(bolao.premioEstimado)}</p>
                  </div>
                </div>
                <div className="mt-6 flex gap-3 border-t border-gray-700 pt-4 flex-wrap">
                  <button onClick={toggleStatusAberto} className={`flex-1 py-3 rounded flex items-center justify-center gap-2 text-sm font-bold border ${bolao.aberto ? 'bg-red-900/40 hover:bg-red-900/60 border-red-500/50 text-red-200' : 'bg-emerald-900/40 hover:bg-emerald-900/60 border-emerald-500/50 text-emerald-200'}`}>
                    {bolao.aberto ? <><Lock size={16}/> ENCERRAR APOSTAS</> : <><Unlock size={16}/> REABRIR APOSTAS</>}
                  </button>
                  <button onClick={handleEditClick} className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded flex items-center justify-center gap-2 text-sm font-bold"><Edit size={16}/> Editar</button>
                  <button onClick={handleExcluirBolao} className="flex-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 py-3 rounded flex items-center justify-center gap-2 text-sm font-bold"><Trash2 size={16}/> Excluir</button>
                </div>
              </div>
            )}

            {/* LISTA DE JOGOS IMPORTADOS */}
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                <h3 className="font-bold flex items-center gap-2 mb-4"><Ticket className="text-emerald-500"/> Jogos Valendo ({apostasValendo.length})</h3>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {apostasValendo.map((aposta) => (
                    <div key={aposta.id} className="bg-gray-800 p-3 rounded flex justify-between items-center gap-2">
                      <span className="text-sm font-bold text-gray-300">{aposta.origem || 'Jogo'}</span>
                      <div className="flex gap-1 flex-wrap justify-center">
                        {aposta.numeros.map((n:number) => <span key={n} className="bg-gray-900 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold text-emerald-400">{n}</span>)}
                      </div>
                      <button onClick={() => excluirApostaDoBolao(aposta.id)} className="text-red-500 hover:bg-red-900/30 p-1"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        )}

        {/* --- ABA CATÁLOGO (GRID 01-60) --- */}
        {tab === 'catalogo' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-gray-800 p-4 md:p-6 rounded-xl border border-gray-700">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-400"><Plus/> Novo Volante</h3>
              <div className="mb-4 flex gap-2">
                 <input type="text" placeholder="Nome do Jogo (ex: Jogo da Sorte)" value={nomeJogo} onChange={e => setNomeJogo(e.target.value)} className="p-3 bg-gray-900 rounded border border-gray-600 w-full outline-none focus:border-emerald-500" />
                 <button onClick={() => setNovosNumerosSelecionados([])} className="bg-gray-700 px-4 rounded text-gray-300 hover:text-white" title="Limpar"><Eraser size={20}/></button>
              </div>

              {/* GRID 1-60 */}
              <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 mb-4">
                 {Array.from({length: 60}, (_, i) => i + 1).map((n) => (
                   <button
                     key={n}
                     onClick={() => toggleNumeroGrid(n)}
                     className={`aspect-square rounded-full font-bold text-sm flex items-center justify-center transition ${
                       novosNumerosSelecionados.includes(n) 
                         ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/50 scale-110' 
                         : 'bg-gray-900 text-gray-500 hover:bg-gray-700'
                     }`}
                   >
                     {n < 10 ? `0${n}` : n}
                   </button>
                 ))}
              </div>

              <div className="flex justify-between items-center">
                 <span className="text-sm text-gray-400">
                   Selecionados: <strong className={novosNumerosSelecionados.length === 6 ? 'text-emerald-400' : 'text-white'}>{novosNumerosSelecionados.length}/6</strong>
                 </span>
                 <button onClick={salvarJogo} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-bold flex items-center gap-2 transition"><Save size={18}/> Salvar Jogo</button>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2"><Database/> Meus Jogos ({listaJogos.length})</h3>
                <div className="flex gap-2 w-full md:w-auto">
                   <button onClick={jogarSelecionados} disabled={jogosSelecionados.length === 0} className={`flex-1 md:flex-none px-4 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition ${jogosSelecionados.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}>
                     <PlayCircle size={16}/> Jogar ({jogosSelecionados.length})
                   </button>
                   <button onClick={() => setJogosSelecionados(jogosSelecionados.length === listaJogos.length ? [] : listaJogos.map(j => j.id))} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-bold text-gray-300">
                      {jogosSelecionados.length === listaJogos.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                   </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                {listaJogos.map(j => (
                  <div key={j.id} className={`p-3 rounded flex justify-between items-center cursor-pointer transition border ${jogosSelecionados.includes(j.id) ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-gray-900 border-transparent hover:bg-gray-800'}`} onClick={() => toggleSelecao(j.id)}>
                    <div className="flex items-center gap-3">
                       <div className={`w-5 h-5 rounded border flex items-center justify-center ${jogosSelecionados.includes(j.id) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>
                          {jogosSelecionados.includes(j.id) && <CheckSquare size={14} className="text-black"/>}
                       </div>
                       <span className={`font-bold text-sm md:text-base ${jogosSelecionados.includes(j.id) ? 'text-emerald-300' : 'text-gray-300'}`}>{j.nome}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end items-center">
                      <div className="flex gap-1">
                        {j.numeros.map((n: number) => (
                          <span key={n} className="bg-gray-700 w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full text-[10px] md:text-xs font-bold text-emerald-400">{n}</span>
                        ))}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); excluirDoCatalogo(j.id); }} className="ml-2 text-gray-600 hover:text-red-500 p-2"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* --- ABA CONFERIDOR --- */}
        {tab === 'conferidor' && (
          <div className="space-y-6 animate-fadeIn">
             <div className="bg-gray-800 p-6 rounded-xl border border-emerald-500/30">
               <h3 className="text-2xl font-bold mb-4">Conferidor</h3>
               <input type="text" placeholder="Resultado (ex: 01, 02, 03...)" value={resultadoStr} onChange={e=>setResultadoStr(e.target.value)} className="w-full text-3xl text-center p-4 bg-black border border-emerald-600 rounded-xl text-emerald-400"/>
               <button onClick={conferir} className="w-full mt-4 bg-emerald-600 py-4 rounded-xl font-bold text-lg">CONFERIR</button>
             </div>
             {relatorio && (
               <div className="bg-gray-900 p-6 rounded-xl">
                 <h4 className="text-lg font-bold mb-4">Resultado</h4>
                 <div className="grid grid-cols-2 gap-4 text-center mb-4">
                   <div className="bg-gray-800 p-4 rounded"><p>Jogos</p><p className="font-bold text-xl">{relatorio.totalJogos}</p></div>
                   <div className="bg-gray-800 p-4 rounded"><p>Prêmios</p><p className="font-bold text-xl text-yellow-400">{relatorio.vitorias.length}</p></div>
                 </div>
                 {relatorio.vitorias.map((v:any)=>(
                   <div key={v.id} className="bg-yellow-900/20 border-l-4 border-yellow-500 p-4 mb-2 flex justify-between items-center">
                     <div><p className="font-bold text-yellow-400">{v.premio}</p><p className="text-xs">{v.origem}</p></div>
                     <div className="flex gap-1">{v.numeros.map((n:number)=><span key={n} className={`w-6 h-6 flex items-center justify-center rounded-full text-xs ${v.acertosNumeros.includes(n)?'bg-emerald-500 text-white':'bg-gray-700'}`}>{n}</span>)}</div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
}