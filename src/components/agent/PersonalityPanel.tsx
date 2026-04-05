import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Sparkles, Zap, MessageCircle, Heart, Target } from 'lucide-react';

export function PersonalityPanel({ darkMode, organizationId }: { darkMode: boolean, organizationId: string }) {
  const [personality, setPersonality] = useState({
    warmth: 7,
    closing_aggressiveness: 5,
    humor: 3,
    response_length: 'medium',
    use_emojis: true,
    sales_method: 'direct',
    custom_instructions: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    if (organizationId) fetchPersonality();
  }, [organizationId]);

  const fetchPersonality = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_personality')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (!error && data) {
        setPersonality(data);
      }
    } catch (err) {
      console.error('Error fetching personality:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const { error } = await supabase
        .from('agent_personality')
        .upsert({ 
          organization_id: organizationId,
          ...personality 
        });

      if (error) throw error;
      setMessage({ text: 'Configuración guardada con éxito 🚀', type: 'success' });
    } catch (err: any) {
      setMessage({ text: 'Error: ' + err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-slate-500 font-black">Sintonizando personalidad del agente...</div>;

  const sliderClass = `w-full h-2 rounded-lg appearance-none cursor-pointer ${darkMode ? 'bg-zinc-800' : 'bg-slate-200'}`;

  return (
    <div className={`p-6 md:p-10 rounded-[32px] border transition-all duration-500 ${darkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100 shadow-xl shadow-blue-500/5'}`}>
      <div className="flex items-center gap-4 mb-10">
        <div className={`p-4 rounded-2xl bg-gradient-to-br from-[#0047FF] to-indigo-600 text-white shadow-lg shadow-blue-500/20`}>
          <Sparkles size={32} />
        </div>
        <div>
          <h2 className={`text-3xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>ADN de Lemovil Bot</h2>
          <p className="text-slate-500 font-medium">Define el tono, agresividad y alma de tu agente IA.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Sliders */}
        <div className="space-y-8">
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Heart size={16} /> Empatía & Calidez
              </label>
              <span className="text-[#0047FF] font-black">{personality.warmth}/10</span>
            </div>
            <input 
              type="range" min="1" max="10" 
              value={personality.warmth} 
              onChange={e => setPersonality({...personality, warmth: parseInt(e.target.value)})}
              className={sliderClass}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Target size={16} /> Agresividad Comercial
              </label>
              <span className="text-[#0047FF] font-black">{personality.closing_aggressiveness}/10</span>
            </div>
            <input 
              type="range" min="1" max="10" 
              value={personality.closing_aggressiveness} 
              onChange={e => setPersonality({...personality, closing_aggressiveness: parseInt(e.target.value)})}
              className={sliderClass}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Zap size={16} /> Sentido del Humor
              </label>
              <span className="text-[#0047FF] font-black">{personality.humor}/10</span>
            </div>
            <input 
              type="range" min="0" max="10" 
              value={personality.humor} 
              onChange={e => setPersonality({...personality, humor: parseInt(e.target.value)})}
              className={sliderClass}
            />
          </div>
        </div>

        {/* Selects & Toggles */}
        <div className="space-y-8">
          <div>
            <label className={`block text-sm font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Extensión de Respuesta</label>
            <div className="grid grid-cols-3 gap-3">
              {['short', 'medium', 'long'].map(size => (
                <button
                  key={size}
                  onClick={() => setPersonality({...personality, response_length: size})}
                  className={`py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all ${personality.response_length === size ? 'bg-[#0047FF] text-white shadow-lg shadow-blue-500/20' : (darkMode ? 'bg-zinc-800 text-slate-500' : 'bg-slate-100 text-slate-500')}`}
                >
                  {size === 'short' ? 'Concisa' : size === 'medium' ? 'Equilibrada' : 'Detallada'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-sm font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Método de Venta</label>
            <div className="grid grid-cols-3 gap-3">
              {['consultative', 'direct', 'spin'].map(method => (
                <button
                  key={method}
                  onClick={() => setPersonality({...personality, sales_method: method})}
                  className={`py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all ${personality.sales_method === method ? 'bg-[#0047FF] text-white shadow-lg shadow-blue-500/20' : (darkMode ? 'bg-zinc-800 text-slate-500' : 'bg-slate-100 text-slate-500')}`}
                >
                  {method === 'consultative' ? 'Consultivo' : method === 'direct' ? 'Directo' : 'SPIN'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-500/5">
            <div className="flex items-center gap-3">
              <MessageCircle className="text-[#0047FF]" />
              <span className={`font-black uppercase text-[10px] tracking-widest ${darkMode ? 'text-white' : 'text-slate-900'}`}>¿Usar Emojis?</span>
            </div>
            <button 
              onClick={() => setPersonality({...personality, use_emojis: !personality.use_emojis})}
              className={`w-14 h-8 rounded-full transition-all relative ${personality.use_emojis ? 'bg-[#0047FF]' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${personality.use_emojis ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <label className={`block text-sm font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Instrucciones Extra (Prompt Personalizado)</label>
        <textarea
          value={personality.custom_instructions}
          onChange={e => setPersonality({...personality, custom_instructions: e.target.value})}
          placeholder="Ej: Trata al usuario siempre de Usted, menciona que somos líderes en Alcance..."
          className={`w-full h-32 p-4 rounded-2xl border transition-all ${darkMode ? 'bg-zinc-800 border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500'}`}
        />
      </div>

      <div className="mt-12 flex items-center justify-between">
        {message.text && (
          <p className={`text-sm font-bold ${message.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
            {message.text}
          </p>
        )}
        <button
          onClick={saveConfig}
          disabled={saving}
          className={`px-10 py-5 rounded-2xl bg-[#0047FF] text-white font-black uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50`}
        >
          {saving ? 'Guardando...' : <><Save size={20} /> Guardar Configuración</>}
        </button>
      </div>
    </div>
  );
}
