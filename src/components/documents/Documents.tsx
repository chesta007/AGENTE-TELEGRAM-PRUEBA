import React, { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DocumentRecord {
  id: number;
  name: string;
  size: number;
  status: string;
  storage_path: string;
  created_at: string;
}

export function Documents() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('id', { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploading(true);
    try {
      // Create unique path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('knowledge')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(uploadError.message || 'Error al subir archivo. Verifica que el bucket existe.');
      }

      // Insert record
      const { error: dbError } = await supabase
        .from('documents')
        .insert([{
          name: file.name,
          size: file.size,
          status: 'Pendiente',
          storage_path: filePath
        }]);

      if (dbError) throw dbError;

      fetchDocuments();
    } catch (err: any) {
      console.error('Error in upload process:', err);
      alert(err.message || 'Ocurrió un error al subir el documento.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: DocumentRecord) => {
    if (!window.confirm(`¿Seguro que deseas eliminar ${doc.name}?`)) return;

    try {
      // Remove from storage
      if (doc.storage_path) {
        await supabase.storage.from('knowledge').remove([doc.storage_path]);
      } else {
        // Fallback si guardabas el nombre
        await supabase.storage.from('knowledge').remove([doc.name]);
      }

      // Remove from DB
      const { error } = await supabase
        .from('documents')
        .delete()
        .match({ id: doc.id });

      if (error) throw error;
      
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Error al eliminar el documento.');
    }
  };

  const handleIndex = async (doc: DocumentRecord) => {
    if (doc.status === 'Indexando...') return;

    try {
      // Actualizar a "Indexando..."
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'Indexando...' } : d));
      
      await supabase
        .from('documents')
        .update({ status: 'Indexando...' })
        .match({ id: doc.id });

      // Simular delay de indexado de 2 segundos
      await new Promise(res => setTimeout(res, 2000));

      // Actualizar a "Indexado"
      const { error } = await supabase
        .from('documents')
        .update({ status: 'Indexado' })
        .match({ id: doc.id });

      if (error) throw error;

      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'Indexado' } : d));
    } catch (err) {
      console.error('Error indexing document:', err);
      alert('Error en el proceso de indexado.');
      fetchDocuments(); // Revert on error
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Documentos</h2>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept=".txt,.pdf,.csv" 
        />
        <button 
          onClick={handleUploadClick}
          disabled={uploading}
          className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
          {uploading ? 'Subiendo...' : 'Subir documento'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-zinc-500" size={32} />
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-[#111111] p-12 rounded-xl border border-zinc-800 flex flex-col items-center justify-center text-center">
          <FileText size={48} className="text-zinc-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Aún no hay documentos cargados</h3>
          <p className="text-zinc-400 mb-6">Sube tu primer documento para comenzar a indexar.</p>
          <button 
            onClick={handleUploadClick}
            disabled={uploading}
            className="bg-indigo-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-600 transition-all disabled:opacity-50"
          >
            Subir documento
          </button>
        </div>
      ) : (
        <div className="bg-[#111111] rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-zinc-800/50 text-zinc-400 text-sm">
              <tr>
                <th className="p-4">Nombre</th>
                <th className="p-4">Tamaño</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id} className="border-t border-zinc-800 hover:bg-zinc-800/50 transition-all">
                  <td className="p-4 font-semibold break-all">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-zinc-500 flex-shrink-0" />
                      {doc.name}
                    </div>
                  </td>
                  <td className="p-4 text-zinc-400 text-sm">{formatSize(doc.size)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 ${
                      doc.status === 'Indexado' ? 'bg-emerald-500/10 text-emerald-400' :
                      doc.status === 'Indexando...' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-zinc-800 text-zinc-300'
                    }`}>
                      {doc.status === 'Indexando...' && <RefreshCw size={12} className="animate-spin" />}
                      {doc.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {doc.status !== 'Indexado' && (
                      <button 
                        onClick={() => handleIndex(doc)}
                        disabled={doc.status === 'Indexando...'}
                        className="text-xs bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                      >
                        Indexar
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(doc)}
                      className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 p-1.5 rounded transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
