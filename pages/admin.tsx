import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import axios from 'axios';
import useSWR from 'swr';
import { Lock, Save, List, CheckSquare, Database, Plus, PlayCircle, Award, LayoutDashboard, Home as HomeIcon, Edit, Trash2, X, RefreshCw } from 'lucide-react';
import Link from 'next/link';

// FORMATADORES
const formatMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
const formatDate = (data: string) => new Date(data).toLocaleDateString('pt-BR');
const formatDateInput = (data: string) => new Date(data).toISOString().split('T')[0];

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [tab, setTab] = useState('dashboard'); // dashboard, catalogo, sorteio

  // DADOS DO BOLÃO
  const { data: bolao, mutate } = useSWR('/api/bolao', fetcher);
  
  // ESTADOS DO FORMULÁRIO DE BOLÃO (CRIAR/EDITAR)
  const [editMode, setEditMode] = useState(false);
  const [novoConcurso, setNovoConcurso] = useState('');
  const [novoData, setNovoData] = useState('');
  const [novoPremio, setNovoPremio] = useState('');
  const [novoValorCota, setNovoValorCota] = useState('');

  // --- FUNÇÃO DE LOGIN FAKE ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) setIsLogged(true); 
  };

  // --- FUNÇÕES DE GESTÃO DO BOLÃO ---
  const handleEditClick = () => {
    if(!bolao) return;
    setEditMode(true);
    setNovoConcurso(bolao.concurso);
    setNovoData(formatDateInput(bolao.dataSorteio));
    setNovoPremio(bolao.premioEstimado);
    setNovoValorCota(bolao.valorCota);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setNovoConcurso('');
    setNovoData('');
    setNovoPremio('');
    setNovoValorCota('');
  };

  const handleSalvarBolao = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editMode) {
        // EDITAR
        await axios.put('/api/bolao', {
          id: bolao.id,
          concurso: novoConcurso,
          dataSorteio: novoData,
          premioEstimado: novoPremio,
          valorCota: novoValorCota,
          adminPassword: password
        });
        alert('Bolão atualizado!');
        handleCancelEdit();
      } else {
        // CRIAR NOVO
        if(!confirm('Isso vai desativar o bolão anterior. Continuar?')) return;
        await axios.post('/api/bolao', {
          concurso: novoConcurso,
          dataSorteio: novoData,
          premioEstimado: novoPremio,
          valorCota: novoValorCota,
          adminPassword: password
        });
        alert('Novo Bolão criado!');
      }
      mutate();
    } catch (err: any) { alert(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const handleExcluirBolao = async () => {
    if (!confirm('TEM CERTEZA? Isso vai apagar o bolão e todos os pagamentos vinculados.')) return;
    try {
      await axios.delete('/api/bolao', {
        data: { id: bolao.id, adminPassword: password }
      });
      alert('Bolão excluído.');
      mutate();
    } catch (err: any) { alert(err.response?.data?.error || 'Erro ao excluir'); }
  };


  // --- COMPONENTE: PAINEL DE GESTÃO DO BOLÃO ---
  const BolaoManager = () => {
    return (
      <div className="space-y-6 animate-fadeIn">
        
        {/* FORMULÁRIO */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-xl font-bold flex items-center gap-2 text-white">
               {editMode ? <><Edit className="text-blue-400"/> Editando Bolão</> : <><Plus className="text-emerald-400"/> Novo Bolão</>}
             </h3>
             {editMode && (
               <button onClick={handleCancelEdit} className="text-xs text-gray-400 hover:text-white flex items-center gap-1 border border-gray-600 px-2 py-1 rounded">
                 <X size={14}/> Cancelar
               </button>
             )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="Concurso (ex: 2550)" className="p-3 bg-gray-900 rounded border border-gray-600 w-full" value={novoConcurso} onChange={e => setNovoConcurso(e.target.value)} />
            <input type="date" className="p-3 bg-gray-900 rounded border border-gray-600 w-full text-gray-300" value={novoData} onChange={e => setNovoData(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <input type="number" placeholder="Prêmio Estimado" className="p-3 bg-gray-900 rounded border border-gray-600 w-full" value={novoPremio} onChange={e => setNovoPremio(e.target.value)} />
            <input type="number" placeholder="Valor Cota" className="p-3 bg-gray-900 rounded border border-gray-600 w-full" value={novoValorCota} onChange={e => setNovoValorCota(e.target.value)} />
          </div>

          <button onClick={handleSalvarBolao} className={`w-full mt-4 py-3 rounded font-bold transition flex items-center justify-center gap-2 ${editMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
            {editMode ? <><Save size={18}/> Salvar Alterações</> : <><Plus size={18}/> Abrir Bolão</>}
          </button>
        </div>

        {/* VISUALIZAÇÃO DO BOLÃO ATIVO */}
        {bolao ? (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 relative group">
            <div className="flex justify-between items-start">
              <div>
                <span className="bg-emerald-900/50 text-emerald-400 text-xs px-2 py-1 rounded border border-emerald-500/20">Ativo Agora</span>
                <h2 className="text-2xl font-bold mt-2">Concurso {bolao.concurso}</h2>
                <p className="text-gray-400 text-sm">{formatDate(bolao.dataSorteio)}</p>
              </div>
              <div className="text-right">
                 <p className="text-sm text-gray-400">Prêmio</p>
                 <p className="text-xl font-bold text-emerald-400">{formatMoeda(bolao.premioEstimado)}</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3 border-t border-gray-700 pt-4">
              <button onClick={handleEditClick} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded flex items-center justify-center gap-2 text-sm font-bold">
                <Edit size={16}/> Editar
              </button>
              <button onClick={handleExcluirBolao} className="flex-1 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 text-red-400 py-2 rounded flex items-center justify-center gap-2 text-sm font-bold">
                <Trash2 size={16}/> Excluir
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 opacity-50 border border-dashed border-gray-700 rounded-xl">
            <p>Nenhum bolão ativo no momento.</p>
          </div>
        )}
      </div>
    );
  };

  // --- COMPONENTE: GESTÃO DE CATÁLOGO ---
  const CatalogoManager = () => {
    const [nomeJogo, setNomeJogo] = useState('');
    const [numerosStr, setNumerosStr] = useState('');
    const [listaJogos, setListaJogos] = useState<any[]>([]);

    const carregarCatalogo = async () => {
      const res = await axios.post('/api/admin', { action: 'listar_catalogo', adminPassword: password });
      setListaJogos(res.data);
    };

    const salvarJogo = async () => {
      const nums = numerosStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)).sort((a,b) => a-b);
      if(nums.length < 6) return alert('Insira pelo menos 6 números');
      
      await axios.post('/api/admin', { 
        action: 'salvar_catalogo', 
        nome: nomeJogo, 
        numeros: nums, 
        adminPassword: password 
      });
      alert('Jogo Salvo!');
      setNumerosStr('');
      carregarCatalogo();
    };

    const jogarNoBolao = async () => {
       if(!bolao) return alert('Nenhum bolão ativo. Crie um primeiro na aba Bolão.');
       const ids = listaJogos.map(j => j.id);
       if(!confirm(`Deseja importar ${ids.length} jogos do catálogo para o Bolão atual?`)) return;

       await axios.post('/api/admin', {
         action: 'vincular_jogos',
         bolaoId: bolao.id,
         jogosIds: ids,
         adminPassword: password
       });
       alert('Jogos vinculados ao bolão!');
    };

    React.useEffect(() => { if(isLogged) carregarCatalogo(); }, []);

    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-400"><Plus/> Novo Jogo no Catálogo</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <input type="text" placeholder="Nome (ex: Jogo da Sorte 01)" value={nomeJogo} onChange={e => setNomeJogo(e.target.value)} className="p-3 bg-gray-900 rounded border border-gray-600 w-full" />
            <input type="text" placeholder="Números (ex: 05, 10, 15, 20...)" value={numerosStr} onChange={e => setNumerosStr(e.target.value)} className="p-3 bg-gray-900 rounded border border-gray-600 w-full" />
          </div>
          <button onClick={salvarJogo} className="mt-4 bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-bold flex items-center gap-2">
            <Save size={18}/> Salvar no Banco
          </button>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-xl font-bold flex items-center gap-2"><Database/> Meus Jogos Guardados ({listaJogos.length})</h3>
             <button onClick={jogarNoBolao} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-sm font-bold flex items-center gap-2">
               <PlayCircle size={16}/> Jogar Todos no Bolão Atual
             </button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {listaJogos.map(j => (
              <div key={j.id} className="bg-gray-900 p-3 rounded flex justify-between items-center">
                <span className="font-bold text-gray-300">{j.nome}</span>
                <div className="flex gap-2">
                  {j.numeros.map((n: number) => (
                    <span key={n} className="bg-gray-700 w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold text-emerald-400">{n}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // --- COMPONENTE: CONFERIDOR ---
  const Conferidor = () => {
    const [resultadoStr, setResultadoStr] = useState('');
    const [relatorio, setRelatorio] = useState<any>(null);

    const conferir = async () => {
      if(!bolao) return alert('Erro: Bolão não carregado. Crie um bolão primeiro.');
      const nums = resultadoStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
      if(nums.length < 6) return alert('Insira as 6 dezenas sorteadas');

      const res = await axios.post('/api/admin', {
        action: 'conferir',
        bolaoId: bolao.id,
        numerosSorteados: nums,
        adminPassword: password
      });
      setRelatorio(res.data);
    };

    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-gray-800 p-6 rounded-xl border border-emerald-500/30 shadow-lg shadow-emerald-900/20">
          <h3 className="text-2xl font-bold mb-2 text-white">Conferidor Oficial</h3>
          <p className="text-gray-400 text-sm mb-6">Digite os números sorteadas pela Caixa e veja a mágica.</p>
          
          <input 
            type="text" 
            placeholder="Ex: 04, 11, 25, 30, 45, 59" 
            value={resultadoStr} 
            onChange={e => setResultadoStr(e.target.value)}
            className="w-full text-3xl font-mono text-center p-4 bg-black border border-emerald-600 rounded-xl text-emerald-400 tracking-widest focus:outline-none focus:ring-2 ring-emerald-500"
          />
          
          <button onClick={conferir} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 py-4 rounded-xl font-bold text-lg shadow-xl">
            CHECKAR RESULTADO 🎲
          </button>
        </div>

        {relatorio && (
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-700">
            <h4 className="text-lg font-bold mb-4">Relatório do Concurso</h4>
            <div className="grid grid-cols-3 gap-4 mb-6 text-center">
              <div className="bg-gray-800 p-4 rounded-lg">
                <p className="text-gray-400 text-xs">Total Jogos</p>
                <p className="text-2xl font-bold">{relatorio.totalJogos}</p>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg border border-yellow-600/50">
                <p className="text-gray-400 text-xs">Prêmios</p>
                <p className="text-2xl font-bold text-yellow-400">{relatorio.vitorias.length}</p>
              </div>
            </div>

            {relatorio.vitorias.length > 0 ? (
              <div className="space-y-2">
                {relatorio.vitorias.map((v: any) => (
                  <div key={v.id} className="bg-gradient-to-r from-yellow-900/50 to-transparent p-4 rounded border-l-4 border-yellow-500 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-yellow-400 text-lg">{v.premio}</p>
                      <p className="text-xs text-gray-300">{v.origem}</p>
                    </div>
                    <div className="flex gap-1">
                      {v.numeros.map((n: number) => (
                        <span key={n} className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold ${v.acertosNumeros.includes(n) ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-500'}`}>
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">Nenhum prêmio dessa vez... 😢</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // --- TELA DE LOGIN ADMIN ---
  if (!isLogged) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-gray-900 p-8 rounded-2xl border border-gray-800 w-full max-w-sm text-center">
          <Lock size={48} className="mx-auto text-red-500 mb-4"/>
          <h1 className="text-2xl font-bold text-white mb-6">Central de Comando</h1>
          <input 
            type="password" 
            placeholder="Senha Mestra" 
            className="w-full p-3 bg-black border border-gray-700 rounded-lg text-white mb-4"
            value={password} onChange={e => setPassword(e.target.value)}
          />
          <button className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-lg font-bold text-white">Acessar Sistema</button>
          <div className="mt-4">
            <Link href="/" className="text-gray-500 hover:text-white text-sm">Voltar ao site</Link>
          </div>
        </form>
      </div>
    );
  }

  // --- RENDERIZAÇÃO PRINCIPAL ---
  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col md:flex-row">
      <Head><title>Admin - Bolão</title></Head>
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-gray-900 border-b md:border-r border-gray-800">
        <div className="p-6 border-b border-gray-800 hidden md:block">
          <h2 className="font-bold text-xl flex items-center gap-2"><LayoutDashboard/> Admin</h2>
        </div>
        <nav className="p-4 space-y-2 flex md:block overflow-x-auto">
          <button onClick={() => setTab('dashboard')} className={`w-full text-left p-3 rounded flex items-center gap-3 ${tab === 'dashboard' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}>
            <List size={18}/> <span className="hidden md:inline">Bolão Atual</span><span className="md:hidden">Bolão</span>
          </button>
          <button onClick={() => setTab('catalogo')} className={`w-full text-left p-3 rounded flex items-center gap-3 ${tab === 'catalogo' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}>
            <Database size={18}/> <span className="hidden md:inline">Catálogo</span><span className="md:hidden">Jogos</span>
          </button>
          <button onClick={() => setTab('conferidor')} className={`w-full text-left p-3 rounded flex items-center gap-3 ${tab === 'conferidor' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}>
            <Award size={18}/> <span className="hidden md:inline">Conferidor</span><span className="md:hidden">Checar</span>
          </button>
          <div className="hidden md:block pt-8 border-t border-gray-800 mt-4">
            <Link href="/" className="w-full text-left p-3 rounded flex items-center gap-3 text-gray-400 hover:text-white hover:bg-gray-800">
              <HomeIcon size={18}/> Ver Site
            </Link>
          </div>
        </nav>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">
            {tab === 'dashboard' && 'Gestão do Bolão'}
            {tab === 'catalogo' && 'Meus Jogos Salvos'}
            {tab === 'conferidor' && 'Conferência de Resultados'}
          </h1>
          {bolao && (
            <span className="bg-emerald-900 text-emerald-300 px-4 py-1 rounded-full text-xs md:text-sm border border-emerald-500/30">
              Ativo: {bolao.concurso}
            </span>
          )}
        </header>

        {tab === 'dashboard' && <BolaoManager />}
        {tab === 'catalogo' && <CatalogoManager />}
        {tab === 'conferidor' && <Conferidor />}
        
      </main>
    </div>
  );
}