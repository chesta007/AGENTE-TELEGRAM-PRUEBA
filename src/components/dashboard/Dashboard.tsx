import { useState, useEffect } from 'react';
import { FileText, MessageSquare, Users, TrendingUp, Loader2, Sparkles, PieChart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PersonalityPanel } from '../agent/PersonalityPanel';

export function Dashboard({ darkMode }: { darkMode: boolean }) {
  const [stats, setStats] = useState({
    docs: 0,
    messagesToday: 0,
    contacts: 0,
    orgBalance: 0,
    orgName: 'Cargando...',
    totalSpending: 0,
    monthlyTokens: 0,
    totalTokens: 0
  });
  const [toolLogs, setToolLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'analytics' | 'personality'>('analytics');
  const [organizationId, setOrganizationId] = useState<string>('');

  const fetchStats = async () => {
    try {
      const { count: docsCount } = await supabase.from('documents').select('*', { count: 'exact', head: true });
      
      // 2. Chats últimas 24 horas (Evitar problemas de zona horaria)
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { count: msgCount } = await supabase.from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', last24h.toISOString());
        
      const { count: contactsCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true });

      // 4. Saldo y Nombre de la Organización (Tenant Context)
      const { data: orgData } = await supabase.from('organizations').select('id, name, credit_balance').limit(1).single();
      
      // 5. Consumo Total desde usage_logs (Costo y Tokens)
      const { data: usageData } = await supabase.from('usage_logs').select('cost_usd, tokens_used, created_at');
      const totalSpending = (usageData || []).reduce((acc, curr) => acc + Number(curr.cost_usd), 0);

      // 6. Tokens este mes
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0,0,0,0);
      
      const monthlyTokens = (usageData || [])
        .filter(u => new Date(u.created_at) >= startOfMonth)
        .reduce((acc, curr) => acc + (Number(curr.tokens_used) || 0), 0);

      const totalTokens = (usageData || []).reduce((acc, curr) => acc + (Number(curr.tokens_used) || 0), 0);


      setStats({ 
        docs: docsCount || 0, 
        messagesToday: msgCount || 0, 
        contacts: contactsCount || 0, 
        orgBalance: orgData?.credit_balance || 0,
        orgName: orgData?.name || 'Empresa',
        totalSpending: totalSpending,
        monthlyTokens: monthlyTokens,
        totalTokens: totalTokens 
      });

      if (orgData) setOrganizationId(orgData.id);

      const { data: logs } = await supabase
        .from('agent_tool_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      setToolLogs(logs || []);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Actualización de tokens y mensajes cada vez que hay cambios en Supabase
    const channel = supabase.channel('dashboard-stats-v5').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchStats()).on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => fetchStats()).on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchStats()).subscribe();
    
    // Polling de saldo cada 5 minutos
    const interval = setInterval(fetchStats, 5 * 60 * 1000);

    return () => { 
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const cards = [
    { title: 'Documentos', value: stats.docs, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Mensajes 24h', value: stats.messagesToday, icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { title: 'Contactos CRM', value: stats.contacts, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { 
      title: `Saldo ${stats.orgName}`, 
      value: `$${Number(stats.orgBalance).toFixed(4)}`, 
      icon: TrendingUp, 
      color: stats.orgBalance > 20 ? 'text-emerald-500' : (stats.orgBalance > 5 ? 'text-amber-500' : 'text-rose-500'), 
      bg: stats.orgBalance > 20 ? 'bg-emerald-500/10' : (stats.orgBalance > 5 ? 'bg-amber-500/10' : 'bg-rose-500/10') 
    },
    { title: 'Tokens (Este Mes)', value: stats.monthlyTokens.toLocaleString(), icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { title: 'Inversión en IA (USD)', value: stats.totalSpending > 0 ? `$${Number(stats.totalSpending).toFixed(4)}` : '$0.0000', icon: TrendingUp, color: 'text-slate-500', bg: 'bg-slate-500/10' },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={`text-3xl md:text-4xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>Lemovil Bot's <span className="text-[#0047FF]">AI</span> Analytics</h2>
          <p className={`${darkMode ? 'text-slate-500' : 'text-slate-500'} mt-1 font-medium text-sm md:text-base`}>Panel de control estratégico y monitoreo de recursos.</p>
        </div>
        
        <div className={`p-1 rounded-2xl flex gap-1 ${darkMode ? 'bg-zinc-900' : 'bg-slate-100'}`}>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-[#0047FF] text-white shadow-lg shadow-blue-500/20' : 'text-slate-500'}`}
          >
            <PieChart size={16} /> Analíticas
          </button>
          <button 
            onClick={() => setActiveTab('personality')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'personality' ? 'bg-[#0047FF] text-white shadow-lg shadow-blue-500/20' : 'text-slate-500'}`}
          >
            <Sparkles size={16} /> Personalidad
          </button>
        </div>
      </div>

      {activeTab === 'analytics' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {loading ? (
              <div className="col-span-1 sm:col-span-2 md:col-span-3 flex justify-center py-20">
                <Loader2 className="animate-spin text-[#0047FF]" size={40} />
              </div>
            ) : cards.map(card => (
              <div key={card.title} className={`p-6 md:p-8 rounded-[24px] border transition-all duration-300 ${darkMode ? 'bg-zinc-900 border-white/5 hover:border-white/10' : 'bg-white border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 md:hover:-translate-y-1'}`}>
                <div className="flex justify-between items-start mb-6 md:mb-8">
                  <div className={`p-3 md:p-4 rounded-2xl ${card.bg} ${card.color}`}>
                    <card.icon size={28} />
                  </div>
                  <div className={`flex items-center px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    LIVE
                  </div>
                </div>
                <h3 className={`font-bold text-[10px] uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{card.title}</h3>
                <p className={`text-4xl md:text-5xl font-black mt-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className={`p-6 md:p-8 rounded-[24px] border ${darkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
            <h3 className={`text-xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Acciones recientes del Agente</h3>
            <div className="space-y-4">
              {toolLogs.length === 0 ? (
                <p className="text-slate-500 text-sm italic">No se han registrado acciones automáticas recientemente.</p>
              ) : toolLogs.map(log => (
                <div key={log.id} className={`p-4 rounded-2xl border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <TrendingUp size={16} />
                      </div>
                      <p className={`font-bold text-sm uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-900'}`}>{log.tool_name.replace(/_/g, ' ')}</p>
                    </div>
                    <div className={`px-2 py-0.5 rounded-md text-[9px] font-black ${darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                      SUCCESS
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Parámetros</p>
                      <pre className={`text-[11px] p-2 rounded-lg overflow-x-auto ${darkMode ? 'bg-black/20 text-blue-300' : 'bg-white text-blue-600'}`}>
                        {JSON.stringify(log.arguments, null, 1)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Resultado</p>
                      <pre className={`text-[11px] p-2 rounded-lg overflow-x-auto ${darkMode ? 'bg-black/20 text-emerald-300' : 'bg-white text-emerald-600'}`}>
                        {JSON.stringify(log.result, null, 1)}
                      </pre>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-3 text-right">{new Date(log.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <PersonalityPanel darkMode={darkMode} organizationId={organizationId} />
      )}
    </div>
  );
}
