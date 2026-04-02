import { useState, useEffect } from 'react';
import { FileText, MessageSquare, Users, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function Dashboard() {
  const [stats, setStats] = useState({
    docs: 0,
    messagesToday: 0,
    contacts: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // 1. Total Documentos
      const { count: docsCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

      // 2. Chats hoy (mensajes desde las 00:00 de hoy)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      // 3. Contactos CRM
      const { count: contactsCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });

      setStats({
        docs: docsCount || 0,
        messagesToday: msgCount || 0,
        contacts: contactsCount || 0
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Suscribirse a cambios para actualización automática
    const channel = supabase
      .channel('dashboard-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchStats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const cards = [
    { title: 'Total Documentos', value: stats.docs, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
    { title: 'Mensajes Hoy', value: stats.messagesToday, icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { title: 'Contactos CRM', value: stats.contacts, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-8 font-['Inter',_sans-serif]">
      <div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h2>
        <p className="text-slate-500 mt-1">Resumen de actividad en tiempo real de Iris AI.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 flex justify-center py-20">
            <Loader2 className="animate-spin text-[#0047FF]" size={40} />
          </div>
        ) : cards.map(card => (
          <div key={card.title} className="bg-white p-7 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                <card.icon size={26} />
              </div>
              <div className="flex items-center text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-bold">
                <TrendingUp size={14} className="mr-1" /> LIVE
              </div>
            </div>
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-widest">{card.title}</h3>
            <p className="text-5xl font-black text-slate-900 mt-2">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
