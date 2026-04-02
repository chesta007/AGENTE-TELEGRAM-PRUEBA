import { useState } from 'react';

export function AgentContext() {
  const [prompt, setPrompt] = useState('Eres un asistente útil y amable que ayuda a los usuarios de Telegram.');
  const [loading, setLoading] = useState(false);

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  const loadDefault = () => setPrompt('Eres un asistente experto en atención al cliente, capaz de resolver dudas, gestionar citas y registrar datos en el CRM de forma eficiente y profesional.');

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Contexto del Agente</h2>
      <textarea 
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full h-64 bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-zinc-50"
      />
      <div className="flex gap-4">
        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-zinc-100 text-zinc-900 px-6 py-3 rounded-lg font-semibold hover:bg-zinc-200 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar System Prompt y Reiniciar Agente'}
        </button>
        <button 
          onClick={loadDefault}
          className="bg-zinc-800 text-zinc-100 px-6 py-3 rounded-lg font-semibold hover:bg-zinc-700"
        >
          Cargar prompt por defecto
        </button>
      </div>
      <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <h4 className="text-sm font-semibold text-zinc-400 mb-2">Preview:</h4>
        <p className="text-zinc-300 italic">"{prompt}"</p>
      </div>
    </div>
  );
}
