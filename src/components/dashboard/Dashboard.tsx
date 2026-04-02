import { useState, useEffect } from 'react';
import { FileText, MessageSquare, Users, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function Dashboard({ darkMode }: { darkMode: boolean }) {
  const [stats, setStats] = useState({
    docs: 0,
    messagesToday: 0,
    contacts: 0,
    balance: 0,
    spending: 0,
    totalTokens: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const { count: docsCount } = await supabase.from('documents').select('*', { count: 'exact', head: true });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: msgCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());
      const { count: contactsCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true });

      let currentBalance = 0;
      let totalUsage = 0;
      try {
        const orResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { 'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}` }
        });
        const orData = await orResponse.json();
        currentBalance = orData.data?.limit - orData.data?.usage || 0;
        totalUsage = orData.data?.usage || 0;
      } catch (e) { console.error("Balance fetch failed", e); }

      const { data: tokensData } = await supabase.from('messages').select('tokens');
      const totalTokens = (tokensData || []).reduce((acc, curr) => acc + (Number(curr.tokens) || 0), 0);

      setStats({ 
        docs: docsCount || 0, 
        messagesToday: msgCount || 0, 
        contacts: contactsCount || 0, 
        balance: currentBalance, 
        spending: totalUsage,
        totalTokens: totalTokens 
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Actualización de tokens y mensajes cada vez que hay cambios en Supabase
    const channel = supabase.channel('dashboard-stats-v4').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchStats()).on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => fetchStats()).on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchStats()).subscribe();
    
    // Polling de saldo cada 5 minutos (evitar saturar API externa)
    const interval = setInterval(fetchStats, 5 * 60 * 1000);

    return () => { 
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const cards = [
    { title: 'Documentos', value: stats.docs, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Mensajes Hoy', value: stats.messagesToday, icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { title: 'Contactos CRM', value: stats.contacts, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Gasto Total (USD)', value: `$${Number(stats.spending).toFixed(3)}`, icon: TrendingUp, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Saldo Iris', value: `$${Number(stats.balance).toFixed(2)}`, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Tokens Usados', value: stats.totalTokens.toLocaleString(), icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className={`text-4xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>Iris <span className="text-[#0047FF]">AI</span> Analytics</h2>
        <p className={`${darkMode ? 'text-slate-500' : 'text-slate-500'} mt-1 font-medium`}>Panel de control estratégico y monitoreo de recursos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 flex justify-center py-20">
            <Loader2 className="animate-spin text-[#0047FF]" size={40} />
          </div>
        ) : cards.map(card => (
          <div key={card.title} className={`p-8 rounded-[24px] border transition-all duration-300 ${darkMode ? 'bg-zinc-900 border-white/5 hover:border-white/10' : 'bg-white border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1'}`}>
            <div className="flex justify-between items-start mb-8">
              <div className={`p-3 rounded-2xl ${card.bg} ${card.color}`}>
                <card.icon size={26} />
              </div>
              <div className={`flex items-center px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                LIVE
              </div>
            </div>
            <h3 className={`font-bold text-[10px] uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{card.title}</h3>
            <p className={`text-5xl font-black mt-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
