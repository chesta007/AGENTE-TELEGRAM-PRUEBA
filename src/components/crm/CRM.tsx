import React, { useState, useEffect } from 'react';
import { Search, Plus, Loader2, X, Phone, MapPin, Tag, Flame } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase, getDefaultOrgId } from '@/lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Contact {
  id: number;
  full_name: string;
  phone: string;
  city?: string;
  email?: string;
  notes?: string;
  interest?: string;
  status: 'Nuevo' | 'En contacto' | 'Cliente' | 'HOT';
  last_interaction?: string;
  organization_id: string;
  source?: string;
}

interface NewContactForm {
  full_name: string;
  phone: string;
  city: string;
  status: Contact['status'];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  'Nuevo':       'bg-blue-500/10 text-blue-400',
  'En contacto': 'bg-amber-500/10 text-amber-400',
  'Cliente':     'bg-emerald-500/10 text-emerald-400',
  'HOT':         'bg-rose-500/10 text-rose-400',
};

// ─── Componente ───────────────────────────────────────────────────────────────
export function CRM({ darkMode }: { darkMode?: boolean }) {
  const [contacts, setContacts]             = useState<Contact[]>([]);
  const [loading, setLoading]               = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery]       = useState('');
  const [filter, setFilter]                 = useState<string>('Todos');
  const [isAddOpen, setIsAddOpen]           = useState(false);
  const [newContact, setNewContact]         = useState<NewContactForm>({
    full_name: '', phone: '', city: '', status: 'Nuevo',
  });
  const [saving, setSaving] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchContacts = async () => {
    setLoading(true);
    try {
      // Obtener org_id (BIGINT) del helper compartido
      const orgId = await getDefaultOrgId();

      let query = supabase
        .from('contacts')
        .select('*')
        .order('last_interaction', { ascending: false, nullsFirst: false });

      // Siempre filtrar por organization_id (multi-tenancy)
      if (orgId !== null) {
        query = query.eq('organization_id', orgId);
      }

      // Filtrar por status
      if (filter !== 'Todos') {
        query = query.eq('status', filter);
      }

      // Búsqueda por nombre completo (columna corregida: full_name)
      if (searchQuery.trim()) {
        query = query.ilike('full_name', `%${searchQuery.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, [filter, searchQuery]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('crm-contacts-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchContacts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [filter, searchQuery]);

  // ── Agregar contacto ───────────────────────────────────────────────────────
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.full_name.trim() || !newContact.phone.trim()) return;
    setSaving(true);
    try {
      // Usar el mismo org_id BIGINT del helper
      const orgId = await getDefaultOrgId();

      const { data, error } = await supabase
        .from('contacts')
        .insert([{
          full_name:       newContact.full_name.trim(),
          phone:           newContact.phone.trim(),
          city:            newContact.city.trim() || null,
          status:          newContact.status,
          organization_id: orgId,
          source:          'dashboard',
        }])
        .select()
        .single();

      if (error) throw error;
      setContacts(prev => [data, ...prev]);
      setIsAddOpen(false);
      setNewContact({ full_name: '', phone: '', city: '', status: 'Nuevo' });
    } catch (err: any) {
      console.error('Error adding contact:', err);
      alert('Error al agregar contacto: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const bg    = darkMode ? 'bg-zinc-900 border-white/5'    : 'bg-white border-slate-100 shadow-sm';
  const table = darkMode ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-slate-100';
  const row   = darkMode ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50';
  const input = darkMode
    ? 'bg-zinc-800 border-white/10 text-white placeholder:text-zinc-500 focus:border-blue-500/50'
    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-3xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            CRM
          </h2>
          <p className={`text-sm mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {contacts.length} contacto{contacts.length !== 1 ? 's' : ''} registrados
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-[#0047FF] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} /> Agregar contacto
        </button>
      </div>

      {/* Filtros + Búsqueda */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {(['Todos', 'Nuevo', 'En contacto', 'Cliente', 'HOT'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                filter === f
                  ? 'bg-[#0047FF] text-white shadow-md'
                  : (darkMode ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')
              }`}
            >
              {f === 'HOT' ? '🔥 HOT' : f}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm outline-none transition-all ${input}`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className={`rounded-2xl border overflow-hidden ${table}`}>
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-[#0047FF]" size={28} />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase tracking-widest font-bold ${darkMode ? 'bg-white/5 text-zinc-500' : 'bg-slate-50 text-slate-400'}`}>
              <tr>
                <th className="p-4">Nombre</th>
                <th className="p-4">Teléfono</th>
                <th className="p-4 hidden md:table-cell">Ciudad</th>
                <th className="p-4 hidden lg:table-cell">Interés</th>
                <th className="p-4">Estado</th>
                <th className="p-4 hidden sm:table-cell">Última interacción</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    No se encontraron contactos
                  </td>
                </tr>
              ) : (
                contacts.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedContact(c)}
                    className={`border-t cursor-pointer transition-all ${row}`}
                  >
                    {/* Nombre — corregido: full_name */}
                    <td className="p-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                          {(c.full_name || '?')[0].toUpperCase()}
                        </div>
                        <span className={darkMode ? 'text-white' : 'text-slate-900'}>{c.full_name}</span>
                      </div>
                    </td>
                    <td className={`p-4 ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>{c.phone}</td>
                    <td className={`p-4 hidden md:table-cell ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>{c.city || '—'}</td>
                    <td className={`p-4 hidden lg:table-cell max-w-[180px] truncate ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>{c.interest || '—'}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[c.status] || 'bg-zinc-800 text-zinc-400'}`}>
                        {c.status === 'HOT' ? '🔥 ' : ''}{c.status}
                      </span>
                    </td>
                    <td className={`p-4 hidden sm:table-cell text-xs ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                      {c.last_interaction ? new Date(c.last_interaction).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialog: Detalle de contacto */}
      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className={`border ${darkMode ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-slate-100'} max-w-md`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-black">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                {(selectedContact?.full_name || '?')[0].toUpperCase()}
              </div>
              {selectedContact?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-4 pt-2">
              <div className={`grid grid-cols-2 gap-3 p-4 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Estado</p>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${STATUS_STYLES[selectedContact.status]}`}>
                    {selectedContact.status}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Canal</p>
                  <span className={`text-xs font-semibold capitalize ${darkMode ? 'text-zinc-300' : 'text-slate-600'}`}>
                    {selectedContact.source || 'telegram'}
                  </span>
                </div>
              </div>

              {[
                { icon: Phone, label: 'Teléfono', value: selectedContact.phone },
                { icon: MapPin, label: 'Ciudad', value: selectedContact.city || '—' },
                { icon: Tag, label: 'Interés', value: selectedContact.interest || '—' },
                { icon: Flame, label: 'Notas', value: selectedContact.notes || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${darkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                    <Icon size={14} className={darkMode ? 'text-zinc-400' : 'text-slate-500'} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{label}</p>
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-800'}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Agregar contacto */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className={`border ${darkMode ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-slate-100'} max-w-md`}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Agregar nuevo contacto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddContact} className="space-y-4 pt-2">
            {[
              { label: 'Nombre completo *', field: 'full_name', type: 'text', placeholder: 'Ej: Juan Pérez', required: true },
              { label: 'Teléfono / ID Telegram *', field: 'phone', type: 'text', placeholder: 'Ej: 3516123456', required: true },
              { label: 'Ciudad', field: 'city', type: 'text', placeholder: 'Ej: Córdoba', required: false },
            ].map(({ label, field, type, placeholder, required }) => (
              <div key={field}>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>{label}</label>
                <input
                  required={required}
                  type={type}
                  placeholder={placeholder}
                  value={newContact[field as keyof NewContactForm]}
                  onChange={e => setNewContact({ ...newContact, [field]: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all ${input}`}
                />
              </div>
            ))}

            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Estado inicial</label>
              <select
                value={newContact.status}
                onChange={e => setNewContact({ ...newContact, status: e.target.value as Contact['status'] })}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all ${input}`}
              >
                <option value="Nuevo">Nuevo</option>
                <option value="En contacto">En contacto</option>
                <option value="Cliente">Cliente</option>
                <option value="HOT">🔥 HOT</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsAddOpen(false)} className={`px-4 py-2.5 rounded-xl text-sm font-bold ${darkMode ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} transition-all`}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20">
                {saving ? 'Guardando...' : 'Guardar contacto'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
