import React, { useState, useEffect } from 'react';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

export function CRM({ darkMode }: { darkMode: boolean }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', city: '', status: 'Nuevo' });

  const fetchContacts = async () => {
    setLoading(true);
    try {
      let query = supabase.from('contacts').select('*');
      if (filter !== 'Todos') query = query.eq('status', filter);
      if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
      const { data, error } = await query.order('id', { ascending: false });
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [filter, searchQuery]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from('contacts').insert([newContact]).select().single();
      if (error) throw error;
      setContacts([data, ...contacts]);
      setIsAddOpen(false);
      setNewContact({ name: '', phone: '', city: '', status: 'Nuevo' });
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  };

  const statusColors: any = {
    'Nuevo': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    'En contacto': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'Cliente': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    'HOT': 'bg-red-500/20 text-red-600 border-red-500/30'
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className={`text-3xl md:text-4xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>CRM</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Gestión de prospectos y clientes de Lemovil Bot's.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#0047FF] text-white px-6 py-4 md:py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus size={20} /> <span className="md:hidden lg:inline text-sm">Nuevo Contacto</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto scrollbar-hide">
          {['Todos', 'HOT', 'Nuevo', 'En contacto', 'Cliente'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${filter === f ? 'bg-[#0047FF] text-white shadow-md' : (darkMode ? 'bg-zinc-800 text-slate-400 hover:bg-zinc-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}`}>
              {f === 'HOT' ? '🔥 Leads Calientes' : f}
            </button>
          ))}
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Buscar por nombre..." value={searchQuery} onChange={handleSearch} className={`w-full border-none rounded-2xl pl-12 pr-4 py-4 md:py-2.5 outline-none font-medium text-sm transition-all ${darkMode ? 'bg-zinc-900 text-white focus:ring-2 focus:ring-blue-500/30' : 'bg-white shadow-sm border border-slate-100 focus:ring-2 focus:ring-blue-500/20'}`} />
        </div>
      </div>

      <div className={`rounded-[24px] border overflow-hidden transition-all ${darkMode ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
        {loading ? (
          <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-[#0047FF]" size={32} /></div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className={`text-[10px] uppercase tracking-widest font-black ${darkMode ? 'bg-zinc-800/50 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                  <tr>
                    <th className="p-5">Nombre</th>
                    <th className="p-5">Teléfono</th>
                    <th className="p-5">Ciudad</th>
                    <th className="p-5">Estado</th>
                    <th className="p-5 text-right">Última interacción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/10">
                  {contacts.length === 0 ? (
                    <tr><td colSpan={5} className="p-20 text-center text-slate-500 font-medium italic">No hay contactos encontrados</td></tr>
                  ) : (
                    contacts.map(c => {
                      const isHot = c.status === 'HOT';
                      return (
                        <tr key={c.id} onClick={() => setSelectedContact(c)} className={`
                          hover:bg-blue-500/[0.02] cursor-pointer transition-all 
                          ${darkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}
                          ${isHot ? 'bg-red-500/[0.05] animate-pulse border-2 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : ''}
                        `}>
                          <td className="p-5 font-bold text-sm tracking-tight flex items-center gap-2">
                            {c.full_name || c.name}
                            {isHot && <span className="animate-bounce">🔥</span>}
                          </td>
                          <td className="p-5 text-sm text-slate-500">{c.phone}</td>
                          <td className="p-5 text-sm text-slate-500">{c.city}</td>
                          <td className="p-5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${statusColors[c.status] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                              {c.status === 'HOT' ? '🔥 INTERESADO' : c.status}
                            </span>
                          </td>
                          <td className="p-5 text-sm text-slate-400 text-right font-medium">{c.last_interaction ? new Date(c.last_interaction).toLocaleDateString() : '-'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile List View */}
            <div className="md:hidden divide-y divide-slate-100/10">
              {contacts.length === 0 ? (
                <div className="p-20 text-center text-slate-500 font-medium italic">No hay contactos encontrados</div>
              ) : (
                contacts.map(c => {
                  const isHot = c.status === 'HOT';
                  return (
                    <div key={c.id} onClick={() => setSelectedContact(c)} 
                      className={`p-5 active:bg-blue-500/5 transition-all ${isHot ? 'bg-red-500/[0.08] border-l-4 border-red-500' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-black text-lg tracking-tight flex items-center gap-2">
                          {c.full_name || c.name}
                          {isHot && <span>🔥</span>}
                        </h4>
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border uppercase tracking-wider ${statusColors[c.status] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                          {c.status === 'HOT' ? 'INTERESADO' : c.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 font-medium">{c.phone} • {c.city}</p>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="bg-[#111111] border-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>{selectedContact?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Teléfono: {selectedContact?.phone}</p>
            <p>Ciudad: {selectedContact?.city}</p>
            <div className="h-40 bg-zinc-900 rounded-lg p-4 text-sm text-zinc-400">Historial de chat...</div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-[#111111] border-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Agregar nuevo contacto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddContact} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Nombre</label>
              <input required type="text" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Teléfono</label>
              <input required type="text" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Ciudad</label>
              <input type="text" value={newContact.city} onChange={e => setNewContact({...newContact, city: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Estado</label>
              <select value={newContact.status} onChange={e => setNewContact({...newContact, status: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 outline-none focus:border-indigo-500">
                <option value="Nuevo">Nuevo</option>
                <option value="En contacto">En contacto</option>
                <option value="Cliente">Cliente</option>
              </select>
            </div>
            <div className="flex justify-end pt-4">
              <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md font-medium transition-colors">
                Guardar contacto
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
