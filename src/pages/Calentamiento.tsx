import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, ExternalLink, Loader2, Video, Upload, Settings } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db, storage } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export const Calentamiento: React.FC = () => {
  const navigate = useNavigate();
  const setHasWarmedUp = useStore((state) => state.setHasWarmedUp);
  const user = useStore((state) => state.user);

  const [videoConfig, setVideoConfig] = useState<{
    tipo: 'youtube' | 'storage';
    videoUrl: string;
    titulo: string;
    descripcion: string;
    duracion: string;
  } | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [editForm, setEditForm] = useState({
    tipo: 'youtube' as 'youtube' | 'storage',
    videoUrl: '',
    titulo: '',
    descripcion: '',
    duracion: ''
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'calentamiento'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setVideoConfig(data);
        setEditForm(data);
      } else {
        const defaultConfig = {
          tipo: 'youtube' as const,
          videoUrl: 'https://www.youtube.com/watch?v=pJNtGvOdSZA',
          titulo: 'Calentamiento de Boxeo',
          descripcion: 'Rutina de movilidad y activación',
          duracion: '10 minutos'
        };
        setVideoConfig(defaultConfig);
        setEditForm(defaultConfig);
      }
      setLoadingVideo(false);
    });
    return () => unsub();
  }, []);

  const getYoutubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match ? match[1] : '';
  };

  const handleUploadVideo = async (): Promise<string> => {
    if (!videoFile) return editForm.videoUrl;
    
    return new Promise((resolve, reject) => {
      const extension = videoFile.name.split('.').pop() || 'mp4';
      const storageRef = ref(storage, `calentamiento/video_${Date.now()}.${extension}`);
      const uploadTask = uploadBytesResumable(storageRef, videoFile);
      
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  const handleSaveVideo = async () => {
    setSaving(true);
    setSaveError(null);
    setUploading(videoFile !== null);
    
    try {
      let finalUrl = editForm.videoUrl;
      let finalTipo = editForm.tipo;
      
      if (videoFile) {
        finalUrl = await handleUploadVideo();
        finalTipo = 'storage';
      }
      
      await setDoc(doc(db, 'configuracion', 'calentamiento'), {
        tipo: finalTipo,
        videoUrl: finalUrl,
        titulo: editForm.titulo,
        descripcion: editForm.descripcion,
        duracion: editForm.duracion,
        actualizadoEn: new Date().toISOString()
      });
      
      setVideoFile(null);
      setUploadProgress(0);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display p-4 pb-24">
      <header className="flex items-center justify-between mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="text-primary flex size-12 shrink-0 items-center justify-center"
        >
          <ArrowLeft className="w-8 h-8" />
        </button>
        <h1 className="text-xl font-bold tracking-tight uppercase italic">Calentamiento Obligatorio</h1>
        <div className="w-12"></div>
      </header>

      <main className="flex-1 flex flex-col gap-6 max-w-2xl mx-auto w-full">
        <div className="bg-slate-800/50 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
          {loadingVideo ? (
            <div className="p-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Cargando video...</p>
            </div>
          ) : videoConfig?.tipo === 'storage' ? (
            <div className="aspect-video w-full bg-black">
              <video 
                src={videoConfig.videoUrl} 
                controls 
                className="w-full h-full"
                poster="https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&q=80"
              />
            </div>
          ) : (
            <div className="p-8 bg-slate-950 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6 border border-primary/30">
                <Play className="w-10 h-10 text-primary fill-current" />
              </div>
              
              <h2 className="text-2xl font-black uppercase italic mb-2">{videoConfig?.titulo || 'Calentamiento de Boxeo'}</h2>
              <p className="text-slate-400 text-sm mb-8 max-w-xs">{videoConfig?.duracion || '10 minutos'} — {videoConfig?.descripcion || 'Movilidad y activación'}</p>
              
              <a 
                href={videoConfig?.videoUrl || 'https://www.youtube.com/watch?v=pJNtGvOdSZA'}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary text-white font-black uppercase italic px-10 py-4 rounded-2xl hover:bg-primary/90 transition-all flex items-center gap-3 shadow-lg shadow-primary/40"
              >
                Ver Video en YouTube
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          )}
          
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black uppercase italic text-lg">{videoConfig?.titulo || 'Rutina de Movilidad'}</h3>
                <p className="text-slate-400 text-xs">Duración estimada: {videoConfig?.duracion || '10 minutos'}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-slate-300 text-sm leading-relaxed">
                {videoConfig?.descripcion || 'Esta secuencia está diseñada específicamente para boxeadores. Enfócate en la movilidad de hombros, cadera y tobillos.'}
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
                  <p className="text-[10px] font-black text-primary uppercase italic mb-1">Enfoque</p>
                  <p className="text-xs font-bold">Articulaciones</p>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
                  <p className="text-[10px] font-black text-primary uppercase italic mb-1">Intensidad</p>
                  <p className="text-xs font-bold">Baja / Media</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => {
              setHasWarmedUp(true);
              navigate(-1);
            }}
            className="w-full bg-primary text-white font-black uppercase italic py-4 rounded-2xl shadow-lg shadow-primary/20"
          >
            He terminado, volver a entrenos
          </button>
          <p className="text-center text-[10px] text-slate-500 uppercase font-bold tracking-widest">
            "El sudor en el entrenamiento ahorra sangre en la batalla"
          </p>
        </div>

        {user?.role === 'admin' && (
          <div className="bg-slate-800/50 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl mt-8">
            <div className="p-6 border-b border-slate-700 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-primary" />
                <h3 className="font-black uppercase italic text-lg">Gestionar Video de Calentamiento</h3>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Selector de tipo */}
              <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800">
                <button 
                  onClick={() => setEditForm({...editForm, tipo: 'youtube'})}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${editForm.tipo === 'youtube' ? 'bg-primary text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}
                >
                  📺 URL YouTube
                </button>
                <button 
                  onClick={() => setEditForm({...editForm, tipo: 'storage'})}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${editForm.tipo === 'storage' ? 'bg-primary text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}
                >
                  📁 Subir Video
                </button>
              </div>

              <div className="space-y-4">
                {editForm.tipo === 'youtube' ? (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">URL de YouTube</label>
                    <input
                      type="text"
                      value={editForm.videoUrl}
                      onChange={(e) => setEditForm({...editForm, videoUrl: e.target.value})}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:border-primary outline-none"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                      Seleccionar Video (MP4, MOV — máx 500MB)
                    </label>
                    <input 
                      type="file" 
                      id="video-upload"
                      accept="video/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setVideoFile(e.target.files[0]);
                      }}
                      className="hidden"
                    />
                    <label 
                      htmlFor="video-upload"
                      className={`w-full aspect-video rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden relative
                        ${videoFile ? 'border-primary bg-primary/5' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-800'}
                      `}
                    >
                      {videoFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle className="w-10 h-10 text-emerald-500" />
                          <span className="text-sm font-bold text-white">{videoFile.name}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-black">
                            {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Video className="w-10 h-10 text-slate-500" />
                          <span className="text-sm font-bold text-slate-400">Toca para seleccionar tu video</span>
                          <span className="text-[10px] text-slate-600 uppercase font-black">MP4, MOV, AVI, WebM</span>
                        </div>
                      )}
                    </label>
                    
                    {uploading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>Subiendo video...</span>
                          <span>{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Título</label>
                  <input
                    type="text"
                    value={editForm.titulo}
                    onChange={(e) => setEditForm({...editForm, titulo: e.target.value})}
                    placeholder="Ej: Calentamiento de Boxeo 10 min"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Descripción</label>
                  <textarea
                    value={editForm.descripcion}
                    onChange={(e) => setEditForm({...editForm, descripcion: e.target.value})}
                    placeholder="Describe el video..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:border-primary outline-none resize-none h-20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Duración</label>
                  <input
                    type="text"
                    value={editForm.duracion}
                    onChange={(e) => setEditForm({...editForm, duracion: e.target.value})}
                    placeholder="Ej: 10 minutos"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:border-primary outline-none"
                  />
                </div>

                {saveSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm text-center font-bold">
                    ✅ Video actualizado — los estudiantes ya lo ven
                  </div>
                )}
                {saveError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm text-center">
                    {saveError}
                  </div>
                )}

                <button
                  onClick={handleSaveVideo}
                  disabled={saving || uploading}
                  className="w-full bg-primary text-white font-black uppercase italic py-4 rounded-2xl disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                >
                  {uploading ? `Subiendo video ${Math.round(uploadProgress)}%...` : saving ? 'Guardando...' : '💾 Guardar Video'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

