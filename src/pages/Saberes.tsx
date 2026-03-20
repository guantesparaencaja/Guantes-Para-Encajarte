import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { PlayCircle, CheckCircle, Lock, ArrowLeft, Upload, Check, Video, Plus, X, Edit2, Trash2, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storage, db } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { InteractiveLesson } from '../components/InteractiveLesson';
import { BoxingGlossary } from '../components/BoxingGlossary';
import { VendajeTutorial } from '../components/VendajeTutorial';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: number;
  level: number;
  category: string;
  video_url: string;
}

interface Combo {
  id: string;
  name: string;
  golpeo_approved: boolean;
  saco_approved: boolean;
  manillas_approved: boolean;
  video_url?: string;
  level: number;
}

interface ComboProgress {
  id: string;
  combo_id: string;
  user_id: string;
  user_name: string;
  video_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: any;
}

export function Saberes() {
  const user = useStore((state) => state.user);
  const hasWarmedUp = useStore((state) => state.hasWarmedUp);
  const hasSeenVendaje = useStore((state) => state.hasSeenVendaje);
  const setHasWarmedUp = useStore((state) => state.setHasWarmedUp);
  const setUser = useStore((state) => state.setUser);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingComboId, setUploadingComboId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [tutorialUploadProgress, setTutorialUploadProgress] = useState<number | null>(null);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [comboProgress, setComboProgress] = useState<ComboProgress[]>([]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [showAddCombo, setShowAddCombo] = useState(false);
  const [newComboName, setNewComboName] = useState('');
  const adminVideoInputRef = useRef<HTMLInputElement>(null);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [showAddTutorial, setShowAddTutorial] = useState(false);
  const [newTutorial, setNewTutorial] = useState({ title: '', description: '', duration: 60, level: 1, category: 'técnica', video_url: '' });
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, title: string, message: string, confirmText?: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});
  const [activeLesson, setActiveLesson] = useState<Tutorial | null>(null);

  const handleTutorialClick = (tutorial: Tutorial) => {
    const isWarmup = tutorial.category.toLowerCase().includes('calentamiento') || tutorial.category.toLowerCase().includes('movilidad');
    
    if (isWarmup) {
      setHasWarmedUp(true);
      setActiveLesson(tutorial);
    } else if (!hasWarmedUp) {
      setConfirmDialog({
        isOpen: true,
        title: '¡Espera! Calentamiento Obligatorio',
        message: 'Debes completar una secuencia de movilidad o calentamiento antes de iniciar tu rutina para evitar lesiones.',
        confirmText: 'Ir a Calentamiento',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          navigate('/workouts'); // Redirect to workouts where warmups are
        }
      });
    } else {
      setActiveLesson(tutorial);
    }
  };

  const fetchCombos = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'combos'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Combo));
      setCombos(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchComboProgress = async () => {
    if (!user) return;
    try {
      let q;
      if (user.role === 'admin' || user.role === 'teacher') {
        q = query(collection(db, 'combo_progress'));
      } else {
        q = query(collection(db, 'combo_progress'), where('user_id', '==', String(user.id)));
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as ComboProgress));
      setComboProgress(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTutorials();
    fetchCombos();
    fetchComboProgress();
  }, [user]);

  const fetchTutorials = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'tutorials'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tutorial));
      setTutorials(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTutorialVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        alert('Por favor, selecciona un archivo de video.');
        return;
      }
      
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = async () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > 80) {
          alert('El video no puede durar más de 80 segundos.');
        } else {
          const storageRef = ref(storage, `tutorials/${Date.now()}_${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);

          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setTutorialUploadProgress(Math.round(progress));
            },
            (error) => {
              console.error('Error al subir el video: ', error);
              alert('Error al subir el video: ' + error.message);
              setTutorialUploadProgress(null);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setNewTutorial({ ...newTutorial, video_url: downloadURL });
              setTutorialUploadProgress(null);
            }
          );
        }
      };
      video.src = URL.createObjectURL(file);
    }
  };

  const handleAddTutorial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'tutorials'), newTutorial);
      setShowAddTutorial(false);
      setNewTutorial({ title: '', description: '', duration: 60, level: 1, category: 'técnica', video_url: '' });
      fetchTutorials();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTutorial = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Tutorial',
      message: '¿Estás seguro de que deseas eliminar este tutorial de forma definitiva?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'tutorials', id));
          fetchTutorials();
        } catch (err) {
          console.error(err);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleVideoUploadClick = (comboId: string) => {
    setUploadingComboId(comboId);
    setUploadProgress(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Por favor, selecciona un archivo de video.');
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = async () => {
      window.URL.revokeObjectURL(video.src);
      if (video.duration > 80) {
        alert('El video no puede durar más de 80 segundos.');
      } else {
        setUploadProgress(0);
        
        const storageRef = ref(storage, `videos/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          },
          (error) => {
            alert('Error al subir el video: ' + error.message);
            setUploadProgress(null);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            if (user?.role === 'admin' && editingCombo) {
              try {
                await updateDoc(doc(db, 'combos', editingCombo.id), { video_url: downloadURL });
                fetchCombos();
                setEditingCombo(null);
                setUploadProgress(null);
              } catch (err) {
                console.error(err);
              }
            } else if (uploadingComboId && user) {
              try {
                await addDoc(collection(db, 'combo_progress'), {
                  combo_id: uploadingComboId,
                  user_id: String(user.id),
                  user_name: user.name,
                  video_url: downloadURL,
                  status: 'pending',
                  created_at: serverTimestamp()
                });
                fetchComboProgress();
                setUploadProgress(null);
                setUploadingComboId(null);
                alert('Video enviado para revisión correctamente.');
              } catch (err) {
                console.error(err);
              }
            }
          }
        );
      }
    };
    video.src = URL.createObjectURL(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (adminVideoInputRef.current) {
      adminVideoInputRef.current.value = '';
    }
  };

  const handleAddCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComboName.trim()) return;
    
    try {
      await addDoc(collection(db, 'combos'), { 
        name: newComboName, 
        level: 1,
        golpeo_approved: false,
        saco_approved: false,
        manillas_approved: false
      });
      fetchCombos();
      setNewComboName('');
      setShowAddCombo(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProgressVideo = (comboId: string, userId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Video de Prueba',
      message: '¿Estás seguro de que deseas eliminar este video de prueba?',
      onConfirm: async () => {
        try {
          // Implementation depends on how progress is stored
          console.log('Delete progress video', comboId, userId);
        } catch (err) {
          console.error(err);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteCombo = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Combo',
      message: '¿Estás seguro de que deseas eliminar este combo de forma definitiva?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'combos', id));
          fetchCombos();
        } catch (err) {
          console.error(err);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleApproveCombo = async (comboId: string, type: 'golpeo' | 'saco' | 'manillas') => {
    try {
      const comboRef = doc(db, 'combos', comboId);
      await updateDoc(comboRef, { [`${type}_approved`]: true });
      fetchCombos();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter combos: students only see combos with video_url
  const visibleCombos = user?.role === 'admin' ? combos : combos.filter(c => c.video_url);

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display p-4 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div className="text-primary flex size-12 shrink-0 items-center justify-center cursor-pointer" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Licencia Provisional</h1>
        <div className="w-12"></div>
      </header>

      <input 
        type="file" 
        accept="video/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      <input 
        type="file" 
        accept="video/*" 
        ref={adminVideoInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      <BoxingGlossary />

      {!hasSeenVendaje ? (
        <VendajeTutorial />
      ) : (
        <>
          <section className="mb-6">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Aprender Boxeo</h2>
        <p className="text-slate-400 mb-6">Tutoriales y videos explicativos para cada habilidad.</p>
        
        {(user?.role === 'admin' || user?.role === 'teacher') && (
          <div className="mb-6">
            {!showAddTutorial ? (
              <button 
                onClick={() => setShowAddTutorial(true)}
                className="w-full flex items-center justify-center gap-2 bg-primary/20 text-primary border border-primary/50 py-3 rounded-xl font-bold hover:bg-primary/30 transition-all"
              >
                <Plus className="w-5 h-5" />
                Agregar Video Explicativo
              </button>
            ) : (
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">Nuevo Video Explicativo</h3>
                  <button onClick={() => setShowAddTutorial(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddTutorial} className="flex flex-col gap-3">
                  <input 
                    type="text" 
                    placeholder="Título del video" 
                    value={newTutorial.title}
                    onChange={(e) => setNewTutorial({...newTutorial, title: e.target.value})}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    required
                  />
                  <textarea 
                    placeholder="Descripción" 
                    value={newTutorial.description}
                    onChange={(e) => setNewTutorial({...newTutorial, description: e.target.value})}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none h-20"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="number" 
                      placeholder="Duración (segundos, máx 80)" 
                      value={newTutorial.duration}
                      onChange={(e) => setNewTutorial({...newTutorial, duration: parseInt(e.target.value)})}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                      max="80"
                      required
                    />
                    <select 
                      value={newTutorial.level}
                      onChange={(e) => setNewTutorial({...newTutorial, level: parseInt(e.target.value)})}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      {[1,2,3,4,5,6,7].map(l => <option key={l} value={l}>Nivel {l}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Subir Video (Max 80s)</label>
                    <input 
                      type="file" 
                      accept="video/*" 
                      onChange={handleTutorialVideoUpload}
                      disabled={tutorialUploadProgress !== null}
                      className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 disabled:opacity-50"
                    />
                    {tutorialUploadProgress !== null && (
                      <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mt-1">
                        <div className="bg-primary h-full transition-all duration-300" style={{ width: `${tutorialUploadProgress}%` }}></div>
                      </div>
                    )}
                    <span className="text-xs text-slate-500 text-center my-1">O pega una URL</span>
                    <input 
                      type="url" 
                      placeholder="URL del video" 
                      value={newTutorial.video_url}
                      onChange={(e) => setNewTutorial({...newTutorial, video_url: e.target.value})}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <button type="submit" disabled={!newTutorial.video_url} className="bg-primary text-white font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors mt-2 disabled:opacity-50">
                    Guardar Video
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {tutorials.map(tutorial => (
            <div key={tutorial.id} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden group">
              <div className="aspect-video bg-slate-900 relative">
                <video src={tutorial.video_url} controls className="w-full h-full object-cover" />
                {(user?.role === 'admin' || user?.role === 'teacher') && (
                  <button 
                    onClick={() => handleDeleteTutorial(tutorial.id)}
                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full z-30 opacity-100 transition-opacity shadow-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{tutorial.title}</h3>
                  <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded">Nivel {tutorial.level}</span>
                </div>
                <p className="text-sm text-slate-400 mb-4">{tutorial.description}</p>
                <button 
                  onClick={() => handleTutorialClick(tutorial)}
                  className="w-full bg-primary/20 text-primary font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-primary/30 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Iniciar Lección Interactiva
                </button>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-3xl font-bold tracking-tight mb-2">Progreso de Licencia</h2>
        <p className="text-slate-400 mb-6">Domina el arte del boxeo a través de niveles técnicos.</p>
        
        {user?.role === 'admin' && (
          <div className="mb-6">
            {!showAddCombo ? (
              <button 
                onClick={() => setShowAddCombo(true)}
                className="w-full flex items-center justify-center gap-2 bg-primary/20 text-primary border border-primary/50 py-3 rounded-xl font-bold hover:bg-primary/30 transition-all"
              >
                <Plus className="w-5 h-5" />
                Agregar Combo
              </button>
            ) : (
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">Nuevo Combo</h3>
                  <button onClick={() => setShowAddCombo(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddCombo} className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Nombre del combo (ej. 12/21/56)" 
                    value={newComboName}
                    onChange={(e) => setNewComboName(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-white"
                    required
                  />
                  <button type="submit" className="bg-primary text-white font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                    Guardar
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
        
        {uploadProgress !== null && (
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-4">
            <p className="text-sm font-bold text-slate-300 mb-2">Subiendo video...</p>
            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </div>
        )}

        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700 shadow-lg shadow-primary/5">
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Nivel Actual</p>
              <p className="text-xl font-bold">Nivel {user?.license_level || 1}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-400">{user?.xp || 0} XP</p>
              <p className="text-[10px] text-slate-500">{((user?.xp || 0) % 100)} / 100 para Nivel {(user?.license_level || 1) + 1}</p>
            </div>
          </div>
          <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden mb-2">
            <div className="bg-primary h-full shadow-[0_0_12px_rgba(0,119,255,0.6)] transition-all duration-500" style={{ width: `${((user?.xp || 0) % 100)}%` }}></div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        {user?.role === 'admin' && comboProgress.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4">Videos Pendientes de Revisión</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {comboProgress.filter(p => p.status === 'pending').map(progress => {
                const comboName = combos.find(c => c.id === progress.combo_id)?.name || 'Combo Desconocido';
                return (
                  <div key={progress.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold">{progress.user_name}</h4>
                        <p className="text-xs text-slate-400">{comboName}</p>
                      </div>
                      <span className="bg-yellow-500/20 text-yellow-500 text-[10px] font-bold px-2 py-1 rounded uppercase">
                        Pendiente
                      </span>
                    </div>
                    <video src={progress.video_url} controls className="w-full h-48 object-cover rounded-lg mb-3 bg-slate-900" />
                    <div className="flex gap-2">
                      <button 
                        onClick={async () => {
                          await updateDoc(doc(db, 'combo_progress', progress.id), { status: 'approved' });
                          fetchComboProgress();
                        }}
                        className="flex-1 bg-emerald-500/20 text-emerald-500 py-2 rounded-lg text-sm font-bold hover:bg-emerald-500/30 transition-colors"
                      >
                        Aprobar
                      </button>
                      <button 
                        onClick={async () => {
                          await updateDoc(doc(db, 'combo_progress', progress.id), { status: 'rejected' });
                          fetchComboProgress();
                        }}
                        className="flex-1 bg-red-500/20 text-red-500 py-2 rounded-lg text-sm font-bold hover:bg-red-500/30 transition-colors"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
              {comboProgress.filter(p => p.status === 'pending').length === 0 && (
                <p className="text-slate-400 text-sm col-span-full">No hay videos pendientes de revisión.</p>
              )}
            </div>
          </div>
        )}

        <h3 className="text-lg font-bold">Lista de Saberes Box</h3>
        
        {visibleCombos.length === 0 && (
          <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <p className="text-slate-400 font-medium">No hay combos disponibles por el momento.</p>
          </div>
        )}

        {visibleCombos.map((combo, index) => {
          const isCompleted = combo.golpeo_approved && combo.saco_approved && combo.manillas_approved;
          const isActive = index === 0 || (visibleCombos[index - 1]?.golpeo_approved && visibleCombos[index - 1]?.saco_approved && visibleCombos[index - 1]?.manillas_approved);
          const isLocked = !isActive && !isCompleted && user?.role !== 'admin';

          return (
            <div key={combo.id} className={`group relative flex flex-col gap-4 p-4 rounded-xl border transition-colors ${
              isCompleted ? 'bg-slate-800 border-primary/50 ring-1 ring-primary/20' : 
              isActive || user?.role === 'admin' ? 'bg-slate-800 border-slate-700 hover:border-primary/40' : 
              'bg-slate-800/50 border-slate-700 opacity-60 grayscale'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                  isCompleted ? 'bg-primary/20 text-primary' : 
                  isActive || user?.role === 'admin' ? 'bg-slate-700 text-slate-400' : 
                  'bg-slate-700 text-slate-500'
                }`}>
                  {isLocked ? <Lock className="w-6 h-6" /> : <span className="text-xl font-bold">{index + 1}</span>}
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className={`font-bold text-lg ${isLocked ? 'text-slate-400' : ''}`}>{combo.name}</h3>
                      {combo.video_url ? (
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 mt-1">
                          <Video className="w-3 h-3" /> Video Explicativo Disponible
                        </span>
                      ) : user?.role === 'admin' ? (
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1 mt-1">
                          Sin Video (Oculto para estudiantes)
                        </span>
                      ) : null}
                    </div>
                    {isCompleted && <CheckCircle className="text-primary w-6 h-6" />}
                    {isActive && !isCompleted && user?.role !== 'admin' && <span className="text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 rounded">ACTIVO</span>}
                    
                    {user?.role === 'admin' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingCombo(combo);
                            adminVideoInputRef.current?.click();
                          }}
                          className="p-1.5 text-slate-400 hover:text-primary bg-slate-700/50 rounded-lg transition-colors"
                          title="Subir Video Explicativo (Máx 80s)"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCombo(combo.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-700/50 rounded-lg transition-colors"
                          title="Eliminar Combo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {!isLocked && user?.role !== 'admin' && (
                <div className="flex flex-col gap-3 mt-2 border-t border-slate-700 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-300">Aprobaciones:</span>
                    <div className="flex gap-2">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase ${combo.golpeo_approved ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-700 text-slate-400'}`}>
                        {combo.golpeo_approved && <Check className="w-3 h-3" />} Golpeo
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase ${combo.saco_approved ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-700 text-slate-400'}`}>
                        {combo.saco_approved && <Check className="w-3 h-3" />} Saco
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase ${combo.manillas_approved ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-700 text-slate-400'}`}>
                        {combo.manillas_approved && <Check className="w-3 h-3" />} Manillas
                      </div>
                    </div>
                  </div>

                  {user?.role === 'student' && !isCompleted && (
                    <button 
                      onClick={() => handleVideoUploadClick(combo.id)}
                      className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                      <Video className="w-4 h-4" />
                      Subir Video de Prueba (Máx 80s)
                    </button>
                  )}

                  {(user?.role === 'admin' || user?.role === 'teacher') && !isCompleted && (
                    <div className="flex gap-2">
                      {!combo.golpeo_approved && (
                        <button 
                          onClick={() => handleApproveCombo(combo.id, 'golpeo')}
                          className="flex-1 flex items-center justify-center gap-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" /> Aprobar Golpeo
                        </button>
                      )}
                      {!combo.saco_approved && (
                        <button 
                          onClick={() => handleApproveCombo(combo.id, 'saco')}
                          className="flex-1 flex items-center justify-center gap-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" /> Aprobar Saco
                        </button>
                      )}
                      {!combo.manillas_approved && (
                        <button 
                          onClick={() => handleApproveCombo(combo.id, 'manillas')}
                          className="flex-1 flex items-center justify-center gap-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" /> Aprobar Manillas
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-300 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-700 text-white py-3 rounded-xl font-bold hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                {confirmDialog.confirmText || 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeLesson && (
        <InteractiveLesson
          title={activeLesson.title}
          level={activeLesson.level}
          steps={[
            {
              title: 'Aprende la Técnica',
              description: activeLesson.description,
              duration: activeLesson.duration,
              type: 'video',
              video_url: activeLesson.video_url
            },
            {
              title: 'Práctica Libre',
              description: 'Practica el movimiento frente al espejo o con sombra.',
              duration: 60,
              type: 'practice'
            },
            {
              title: 'Quiz de Conocimiento',
              description: 'Demuestra lo que has aprendido.',
              duration: 0,
              type: 'quiz',
              quiz: {
                question: `¿Cuál es el objetivo principal de ${activeLesson.title}?`,
                options: [
                  'Mejorar la resistencia cardiovascular',
                  'Perfeccionar la técnica y postura',
                  'Aumentar la fuerza máxima',
                  'Relajar los músculos'
                ],
                correctAnswer: 1
              }
            }
          ]}
          onClose={() => setActiveLesson(null)}
          onComplete={async () => {
            if (user) {
              const newXp = (user.xp || 0) + 50;
              const newLevel = Math.floor(newXp / 100) + 1; // 100 XP per level
              
              try {
                await updateDoc(doc(db, 'users', String(user.id)), { 
                  xp: newXp,
                  license_level: newLevel > user.license_level ? newLevel : user.license_level
                });
                setUser({ 
                  ...user, 
                  xp: newXp,
                  license_level: newLevel > user.license_level ? newLevel : user.license_level
                });
                alert(`¡Lección completada con éxito! Has ganado 50 XP. ${newLevel > user.license_level ? '¡Has subido de nivel!' : ''}`);
              } catch (err) {
                console.error("Error updating XP:", err);
              }
            }
            setActiveLesson(null);
          }}
        />
      )}
      </>
      )}
    </div>
  );
}
