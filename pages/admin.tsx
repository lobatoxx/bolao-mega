import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import axios from 'axios';
import { Save, Users, CheckCircle, Trash2, Lock, Unlock, Plus, Search, DollarSign, Calendar, Layout, LogOut } from 'lucide-react';

const fetcher = (url: string) => axios.get(url).then(res => res.data);
const formatMoeda = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default function Admin() {
  const [senha, setSenha] = useState('');
  const [logado, setLogado] = useState(false);
  const [loading, setLoading] = useState(false);

  // LISTA DE TODOS OS BOLÕES (SIDEBAR)
  const { data: listaBoloes, mutate: refreshLista } = useSWR(logado ? '/api/bolao/todos' : null, fetcher);
  
  // BOLÃO SELECIONADO (DETALHES)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: bolaoAtivo, mutate: refreshBolao } = useSWR(selectedId && logado ? `/api/bolao?id=${selectedId}` : null, fetcher);

  // FORMULÁRIO (CRIAÇÃO/EDIÇÃO)
  const [modoEdicao, setModoEdicao] = useState(false); // false = Criar Novo, true = Editar
  const [form, setForm] = useState({ concurso: '', data: '', premio: '', cota: '', tipoUnica: false });

  // EFEITO: Carrega dados no formulário quando seleciona um bolão
  useEffect(() => {
    if (bolaoAtivo && selectedId) {
      setModoEdicao(true);
      setForm({
        concurso: bolaoAtivo.concurso,
        data: bolaoAtivo.dataSorteio.split('T')[0],
        premio: bolaoAtivo.premioEstimado,
        cota: bolaoAtivo.valorCota,
        tipoUnica: bolaoAtivo.tipoCotaUnica
      });
    }
  }, [bolaoAtivo, selectedId]);

  // LOGIN SIMPLES
  const handleLogin = () => {
    if (senha === 'admin123') setLogado(true); // Troque pela sua senha real ou use env
    else alert('Senha incorreta');
  };

  // BOTÃO "NOVO BOLÃO"
  const handleNovo = () => {
    setSelectedId(null);
    setModoEdicao(false);
    setForm({ concurso: '', data: '', premio: '', cota: '', tipoUnica: false });
  };

  // SALVAR (CRIAR OU EDITAR)
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
        // EDITAR
        await axios.put('/api/bolao', { ...payload, id: selectedId, aberto: bolaoAtivo.aberto });
        alert('Bolão atualizado!');
      } else {
        // CRIAR NOVO
        await axios.post('/api/bolao', payload);
        alert('Novo Bolão criado!');
        handleNovo(); // Limpa
      }
      refreshLista();
      refreshBolao();
    } catch (err: any) {
      alert('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // FECHAR / REABRIR APOSTAS
  const handleToggleStatus = async () => {
    if (!bolaoAtivo) return;
    try {
      await axios.put('/api/bolao', {
        id: bolaoAtivo.id,
        // Mantém os dados atuais, muda só o status
        concurso: bolaoAtivo.concurso,
        dataSorteio: bolaoAtivo.dataSorteio,
        premioEstimado: bolaoAtivo.premioEstimado,
        valorCota: bolaoAtivo.valorCota,
        tipoCotaUnica: bolaoAtivo.tipoCotaUnica,
        aberto: !bolaoAtivo.aberto,
        adminPassword: senha
      });
      refreshBolao();
      refreshLista();
    } catch (err: any) {
      alert('Erro: ' + (err.response?.data?.error || err.message));
    }
  };

  // APROVAR PAGAMENTO MANUAL
  const confirmarPagamentoManual = async (participanteId: string) => {
    if(!confirm('Confirmar recebimento em dinheiro?')) return;
    try {
        // Simulamos o webhook do Telegram para reaproveitar a lógica de lista
        await axios.post('/api/telegram/webhook', {
            callback_query: {
                data: `aprovar_${participanteId}`,
                message: { chat: { id: '0' }, message_id: '0' } // Fake data
            }
        });
        alert('Confirmado!');
        refreshBolao();
    } catch (err) { alert('Erro ao confirmar'); }
  };

  if (!logado) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-xl w-full max-w-sm border border-gray-700">
          <h1 className="text-white text-xl font-bold mb-4 flex items-center gap-2"><Lock size={20}/> Área Restrita</h1>
          <input type="password" placeholder="Senha Admin" className="w-full p-3 bg-gray-900 border border-gray-600 rounded mb-4 text-white" value={senha} onChange={e => setSenha(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-blue-600 py-3 rounded font-bold text-white hover:bg-blue-500">Acessar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col md:flex-row">
      <Head><title>Admin - Bolão</title></Head>
      
      {/* --- SIDEBAR (HISTÓRICO) --- */}
      <aside className="w-full md:w-80 bg-gray-900 border-r border-gray-800 p-4 flex flex-col h-auto md:h-screen sticky top-0 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-xl flex items-center gap-2"><Layout size={20}/> Bolões</h2>
            <button onClick={() => setLogado(false)} className="text-gray-500 hover:text-white"><LogOut size={18}/></button>
        </div>
        
        <button onClick={handleNovo} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold mb-6 flex items-center justify-center gap-2 shadow-lg">
            <Plus size={20}/> Criar Novo
        </button>

        <div className="space-y-2 flex-1">
            {listaBoloes?.map((b: any) => (
                <div 
                    key={b.id} 
                    onClick={() => setSelectedId(b.id)}
                    className={`p-4 rounded-lg cursor-pointer border transition hover:bg-gray-800 ${selectedId === b.id ? 'bg-gray-800 border-blue-500' : 'bg-gray-900/50 border-gray-800'}`}
                >
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white">Conc. {b.concurso}</span>
                        {b.aberto ? <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">Aberto</span> 
                                  : <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">Fechado</span>}
                    </div>
                    <div className="text-xs text-gray-400 flex justify-between">
                        <span>{new Date(b.dataSorteio).toLocaleDateString('pt-BR')}</span>
                        <span>{b._count?.participantes || 0} part.</span>
                    </div>
                </div>
            ))}
        </div>
      </aside>

      {/* --- MAIN CONTENT (DETALHES) --- */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8">
            
            {/* 1. CONFIGURAÇÕES DO BOLÃO */}
            <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        {modoEdicao ? `Editando Concurso ${form.concurso}` : 'Novo Bolão'}
                    </h2>
                    {modoEdicao && bolaoAtivo && (
                         <button 
                            onClick={handleToggleStatus}
                            className={`px-4 py-2 rounded font-bold text-sm flex items-center gap-2 ${bolaoAtivo.aberto ? 'bg-red-900/30 text-red-400 border border-red-900/50 hover:bg-red-900/50' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/50'}`}
                         >
                            {bolaoAtivo.aberto ? <><Lock size={16}/> Fechar Apostas</> : <><Unlock size={16}/> Reabrir Apostas</>}
                         </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Concurso</label>
                        <input type="text" className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white" value={form.concurso} onChange={e => setForm({...form, concurso: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Data Sorteio</label>
                        <input type="date" className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white" value={form.data} onChange={e => setForm({...form, data: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Prêmio Estimado (R$)</label>
                        <input type="number" className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white" value={form.premio} onChange={e => setForm({...form, premio: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Valor da Cota (R$)</label>
                        <input type="number" className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white" value={form.cota} onChange={e => setForm({...form, cota: e.target.value})} />
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-3 bg-gray-950 p-3 rounded border border-gray-700 w-fit">
                    <button type="button" onClick={() => setForm({...form, tipoUnica: !form.tipoUnica})} className={`w-12 h-6 rounded-full p-1 transition-colors ${form.tipoUnica ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${form.tipoUnica ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                    <span className="text-sm font-bold text-gray-300">{form.tipoUnica ? 'Modo Cota Única (Restrito)' : 'Modo Multi Cotas (Livre)'}</span>
                </div>

                <button onClick={handleSalvar} disabled={loading} className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg">
                    {loading ? 'Salvando...' : <><Save size={18}/> {modoEdicao ? 'Salvar Alterações' : 'Criar Bolão'}</>}
                </button>
            </section>

            {/* 2. TABELA DE PARTICIPANTES (SÓ APARECE SE ESTIVER EM MODO EDIÇÃO) */}
            {modoEdicao && bolaoAtivo && (
                <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-xl flex items-center gap-2"><Users size={20}/> Participantes</h3>
                        <div className="text-right">
                            <p className="text-xs text-gray-400">Total Arrecadado</p>
                            <p className="text-xl font-bold text-emerald-400">
                                {formatMoeda(bolaoAtivo.participantes.filter((p:any) => p.status === 'pago').reduce((acc:number, p:any) => acc + p.valorTotal, 0))}
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-400">
                            <thead className="bg-gray-950 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-3">Nome</th>
                                    <th className="p-3">Cotas</th>
                                    <th className="p-3">Valor</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {bolaoAtivo.participantes.map((p: any) => (
                                    <tr key={p.id} className="hover:bg-gray-800/50">
                                        <td className="p-3 text-white font-medium">
                                            {p.usuario.nome}
                                            <span className="block text-xs text-gray-500">{p.usuario.cpf}</span>
                                        </td>
                                        <td className="p-3">
                                            {p.quantidade}
                                            <div className="text-xs text-gray-500 max-w-[150px] truncate">{p.nomesCotas.join(', ')}</div>
                                        </td>
                                        <td className="p-3 text-white">{formatMoeda(p.valorTotal)}</td>
                                        <td className="p-3">
                                            {p.status === 'pago' ? (
                                                <span className="text-emerald-400 flex items-center gap-1 font-bold"><CheckCircle size={14}/> Pago</span>
                                            ) : p.metodo === 'DINHEIRO' ? (
                                                <span className="text-yellow-400 font-bold bg-yellow-900/20 px-2 py-1 rounded text-xs">Aguardando Dinheiro</span>
                                            ) : (
                                                <span className="text-gray-500">Pendente (PIX)</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            {p.status === 'pendente' && p.metodo === 'DINHEIRO' && (
                                                <button onClick={() => confirmarPagamentoManual(p.id)} className="text-emerald-400 hover:text-emerald-300 mr-3 font-bold text-xs border border-emerald-900 px-2 py-1 rounded bg-emerald-900/20">
                                                    Aprovar
                                                </button>
                                            )}
                                            <button 
                                                onClick={async () => {
                                                    if(confirm('Excluir participante?')) {
                                                        await axios.post('/api/telegram/webhook', { callback_query: { data: `rejeitar_${p.id}`, message: { chat: { id: '0' }, message_id: '0' }}});
                                                        refreshBolao();
                                                    }
                                                }}
                                                className="text-red-500 hover:text-red-400"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {bolaoAtivo.participantes.length === 0 && (
                                    <tr><td colSpan={5} className="p-6 text-center text-gray-600">Nenhum participante ainda.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
      </main>
    </div>
  );
}