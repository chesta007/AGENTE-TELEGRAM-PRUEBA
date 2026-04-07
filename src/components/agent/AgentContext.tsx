import { useState, useEffect } from 'react';
import { Save, RotateCcw, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase, getDefaultOrgId } from '@/lib/supabase';

const DEFAULT_PROMPT = 'Eres un asistente experto en atención al cliente, capaz de resolver dudas, gestionar citas y registrar datos en el CRM de forma eficiente y profesional.';

export function AgentContext({ darkMode }: { darkMode?: boolean }) {
  const [prompt, setPrompt]   = useState(DEFAULT_PROMPT);
  const [orgId, setOrgId]     = useState<string | null>(null);
  const [contextId, setContextId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [status, setStatus]   = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const orgId = await getDefaultOrgId();
        if (orgId === null) return;
        setOrgId(String(orgId));

        const { data: ctx } = await supabase
          .from('agent_context')
          .select('*')
          .eq('organization_id', orgId)
          .maybeSingle();

        if (ctx?.system_prompt) {
          setPrompt(ctx.system_prompt);
          setContextId(ctx.id);
        }
      } catch (err) {
        console.error('Error cargando agent_context:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    setStatus(null);
    try {
      let error;
      if (contextId) {
        ({ error } = await supabase
          .from('agent_context')
          .update({ system_prompt: prompt, updated_at: new Date().toISOString() })
          .eq('id', contextId));
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('agent_context')
          .insert([{ system_prompt: prompt, organization_id: orgId }])
          .select('id')
          .single();
        error = insertErr;
        if (inserted) setContextId(inserted.id);
      }

      if (error) throw error;
      setStatus({ type: 'success', msg: '✅ System Prompt guardado correctamente.' });
      setTimeout(() => setStatus(null), 4000);
    } catch (err: any) {
      setStatus({ type: 'error', msg: '❌ Error: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = darkMode
    ? 'bg-zinc-800 border-white/10 text-white focus:border-blue-500/50'
    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin text-[#0047FF]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className={`text-3xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          Contexto del Agente
        </h2>
        <p className={`text-sm mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          El System Prompt define la personalidad y el rol base del agente IA.
          Complementa las configuraciones de personalidad del panel ADN.
        </p>
      </div>

      <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
        <label className={`block text-xs font-bold uppercase tracking-widest mb-3 ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
          System Prompt
        </label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={10}
          placeholder="Define el comportamiento base del agente..."
          className={`w-full p-4 rounded-xl border text-sm leading-relaxed outline-none transition-all resize-none ${inputClass}`}
        />
        <p className={`text-xs mt-2 text-right ${darkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
          {prompt.length} caracteres
        </p>
      </div>

      {/* Preview */}
      <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
        <p className={`text-[10px] uppercase font-bold tracking-widest mb-2 ${darkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
          Preview
        </p>
        <p className={`text-sm italic leading-relaxed ${darkMode ? 'text-zinc-400' : 'text-slate-600'}`}>
          "{prompt}"
        </p>
      </div>

      {/* Feedback */}
      {status && (
        <div className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium ${
          status.type === 'success'
            ? (darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
            : (darkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-700')
        }`}>
          {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {status.msg}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0047FF] text-white font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Guardando...' : 'Guardar System Prompt'}
        </button>

        <button
          onClick={() => setPrompt(DEFAULT_PROMPT)}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
            darkMode ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <RotateCcw size={16} /> Restablecer predeterminado
        </button>
      </div>
    </div>
  );
}
