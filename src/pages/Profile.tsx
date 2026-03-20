import { useStore } from '../store/useStore';
import { User, Settings, LogOut, Shield, ArrowLeft, UserPlus, Camera, Image as ImageIcon, Edit2, Check, X, Users, Lock, Trash2, Moon, Sun, Monitor, Flame, Award, CalendarCheck, TrendingUp, Bell, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import React, { useState, useRef, useEffect } from 'react';
import { storage, db, auth } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp, deleteDoc, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

import { Modal } from '../components/Modal';
import { AlertCircle, Info, CheckCircle2 } from 'lucide-react';

export function Profile() {
  const user = useStore((state) => state.user);
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const setUser = useStore((state) => state.setUser);
  const navigate = useNavigate();
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'student' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [beforePic, setBeforePic] = useState<string | null>(null);
  const [afterPic, setAfterPic] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{type: string, progress: number} | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [userToDelete, setUserToDelete] = useState<{id: string, name: string} | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.email === 'guantesparaencajar@gmail.com') {
      fetchAllUsers();
    }
    if (user) {
      fetchAttendance();
    }
    try {
      if ('Notification' in window) {
        setNotificationsEnabled(Notification.permission === 'granted');
      }
    } catch (e) {
      console.error('Notification API error:', e);
    }
  }, [user]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showAlert('No soportado', 'Tu navegador no soporta notificaciones.', 'info');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    if (permission === 'granted') {
      new Notification('¡Notificaciones activadas!', {
        body: 'Te avisaremos 1 hora antes de tus clases.',
        icon: '/favicon.ico'
      });
    }
  };

  const fetchAttendance = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'bookings'), where('user_id', '==', String(user.id)), where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      // For simplicity, we count active bookings as attendance for now, 
      // ideally we'd count past bookings that weren't cancelled.
      // Let's count all bookings that are not cancelled.
      const allQ = query(collection(db, 'bookings'), where('user_id', '==', String(user.id)));
      const allSnapshot = await getDocs(allQ);
      const attended = allSnapshot.docs.filter(d => d.data().status !== 'cancelled').length;
      setAttendanceCount(attended);
    } catch (err) {
      console.error('Error fetching attendance:', err);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(usersData);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  if (!user) return null;

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password);
      const newUserId = userCredential.user.uid;
      
      await setDoc(doc(db, 'users', newUserId), {
        name: 'Nuevo Estudiante', 
        email: newUser.email, 
        weight: 0,
        age: 0,
        dominant_hand: 'Derecha',
        boxing_goal: 'Aprender a defenderme',
        fitness_goal: 'Mantener peso',
        goal: 'Mantener peso',
        role: 'student',
        streak: 0,
        lives: 3,
        license_level: 1,
        profile_pic: null,
        created_at: serverTimestamp(),
        is_new_user: true,
        tutorial_completed: false
      });
      
      showAlert('Éxito', 'Usuario creado con éxito', 'success');
      setShowCreateUser(false);
      setNewUser({ email: '', password: '', role: 'student' });
      fetchAllUsers();
    } catch (err: any) {
      console.error(err);
      showAlert('Error', 'Error al crear usuario: ' + err.message, 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      showAlert('Éxito', 'Usuario eliminado correctamente de la base de datos.', 'success');
      setUserToDelete(null);
      fetchAllUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showAlert('Error', 'Error al eliminar el usuario.', 'error');
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    weight: user?.weight || 0,
    height: user?.height || 0,
    dominant_hand: user?.dominant_hand || 'Derecha',
  });

  const [canUploadAfter, setCanUploadAfter] = useState(false);

  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || '',
        weight: user.weight || 0,
        height: user.height || 0,
        dominant_hand: user.dominant_hand || 'Derecha',
      });
      if (user.profile_pic) setProfilePic(user.profile_pic);
      if (user.before_pic) setBeforePic(user.before_pic);
      if (user.after_pic) setAfterPic(user.after_pic);

      if (user.created_at) {
        const createdAt = user.created_at.toDate ? user.created_at.toDate() : new Date(user.created_at);
        const diffTime = Math.abs(new Date().getTime() - createdAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setCanUploadAfter(diffDays >= 30);
      } else {
        setCanUploadAfter(true);
      }
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', String(user.id));
      const updatedData = {
        ...editForm,
        profile_pic: profilePic,
        before_pic: beforePic,
        after_pic: afterPic
      };
      
      await updateDoc(userRef, updatedData);
      setUser({ ...user, ...updatedData } as any);
      setIsEditing(false);
      showAlert('Éxito', 'Perfil actualizado correctamente', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showAlert('Error', 'Error al actualizar el perfil', 'error');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void, isProfilePic = false, isBefore = false, isAfter = false) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showAlert('Error', 'Por favor, selecciona una imagen.', 'error');
        return;
      }

      const type = isProfilePic ? 'profile' : isBefore ? 'before' : 'after';
      const storageRef = ref(storage, `images/${user?.id}/${type}_${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress({ type, progress: Math.round(progress) });
        },
        (error) => {
          console.error('Error al subir la imagen:', error);
          showAlert('Error', 'Error al subir la imagen: ' + error.message, 'error');
          setUploadProgress(null);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setter(downloadURL);
          setUploadProgress(null);
          
          if ((isProfilePic || isBefore || isAfter) && user) {
            try {
              const userRef = doc(db, 'users', String(user.id));
              const updatedData = {
                profile_pic: isProfilePic ? downloadURL : profilePic,
                before_pic: isBefore ? downloadURL : beforePic,
                after_pic: isAfter ? downloadURL : afterPic
              };
              await updateDoc(userRef, updatedData);
              setUser({ ...user, ...updatedData } as any);
            } catch (error) {
              console.error('Error saving pic:', error);
            }
          }
        }
      );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display p-4 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div className="text-primary flex size-12 shrink-0 items-center justify-center cursor-pointer" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Mi Perfil</h1>
        <div className="w-12"></div>
      </header>

      <div className="flex flex-col items-center mb-8">
        <div className="relative mb-4">
          <div className="w-32 h-32 rounded-full border-4 border-primary neon-glow flex items-center justify-center bg-slate-800 text-4xl font-bold text-primary overflow-hidden">
            {profilePic ? (
              <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              (user.name || 'U').charAt(0)
            )}
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress?.type === 'profile'}
            className="absolute bottom-1 right-1 bg-primary text-white p-2 rounded-full border-2 border-background-dark shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={(e) => handleImageUpload(e, setProfilePic, true)}
          />
        </div>
        {uploadProgress?.type === 'profile' && (
          <div className="w-32 bg-slate-700 h-1 rounded-full overflow-hidden mb-2">
            <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress.progress}%` }}></div>
          </div>
        )}
        {isEditing ? (
          <input 
            type="text" 
            value={editForm.name} 
            onChange={e => setEditForm({...editForm, name: e.target.value})}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1 text-center text-xl font-bold text-white mb-1"
          />
        ) : (
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-center">{user.name || 'Usuario'}</h2>
        )}
        <div className="flex items-center gap-2 mt-1">
          {user.role === 'student' && (
            <span className="bg-primary/20 text-primary text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-widest border border-primary/30">
              Nivel {user.license_level}
            </span>
          )}
          <p className="text-slate-400 text-sm font-medium">{user.goal}</p>
        </div>
      </div>

      {user.role === 'student' && (
        <section className="mb-8">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
            <Award className="w-5 h-5 text-primary" />
            Logros y Estadísticas
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
              <Flame className="w-8 h-8 text-orange-500 mb-2" />
              <span className="text-3xl font-black text-white">{user.streak || 0}</span>
              <span className="text-xs font-bold text-orange-400 uppercase tracking-widest mt-1">Días Seguidos</span>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
              <CalendarCheck className="w-8 h-8 text-blue-500 mb-2" />
              <span className="text-3xl font-black text-white">{attendanceCount}</span>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mt-1">Clases Asistidas</span>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-white">Adherencia Semanal</h4>
              </div>
              <span className="text-emerald-400 font-black text-xl">85%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
              <div className="bg-emerald-400 h-full rounded-full" style={{ width: '85%' }}></div>
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">¡Excelente trabajo! Has cumplido la mayoría de tus entrenamientos y comidas esta semana.</p>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex flex-col items-center">
          {isEditing ? (
            <input 
              type="number" 
              value={editForm.weight} 
              onChange={e => setEditForm({...editForm, weight: Number(e.target.value)})}
              className="w-16 bg-slate-900 border border-slate-700 rounded text-center text-primary font-bold"
            />
          ) : (
            <span className="text-primary text-lg font-bold">{user.weight}kg</span>
          )}
          <span className="text-[10px] text-slate-500 uppercase font-semibold mt-1">Peso</span>
        </div>
        <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex flex-col items-center">
          {isEditing ? (
            <select 
              value={editForm.dominant_hand} 
              onChange={e => setEditForm({...editForm, dominant_hand: e.target.value})}
              className="w-20 bg-slate-900 border border-slate-700 rounded text-center text-primary font-bold text-xs p-1"
            >
              <option value="Derecha">Derecha</option>
              <option value="Izquierda">Izquierda</option>
            </select>
          ) : (
            <span className="text-primary text-lg font-bold">{user.dominant_hand || 'Derecha'}</span>
          )}
          <span className="text-[10px] text-slate-500 uppercase font-semibold mt-1">Mano</span>
        </div>
      </div>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold leading-tight tracking-tight">Datos Personales</h3>
          </div>
          {isEditing ? (
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)} className="p-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
                <X className="w-4 h-4" />
              </button>
              <button onClick={handleSaveProfile} className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setIsEditing(true)} className="p-1.5 bg-slate-800 text-primary rounded-lg hover:bg-slate-700 border border-slate-700">
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="bg-slate-800/30 rounded-2xl p-4 neon-border">
          <div className="flex justify-between py-3 border-b border-slate-700/50">
            <p className="text-slate-400 text-sm font-medium">Email</p>
            <p className="text-slate-100 text-sm font-bold">{user.email}</p>
          </div>
          <div className="flex justify-between py-3 border-b border-slate-700/50">
            <p className="text-slate-400 text-sm font-medium">Rol</p>
            <p className="text-slate-100 text-sm font-bold capitalize">{user.role}</p>
          </div>
          {user.role === 'student' && (
            <div className="flex justify-between py-3">
              <p className="text-slate-400 text-sm font-medium">Vidas Restantes</p>
              <p className="text-red-500 text-sm font-bold">{user.lives} ❤️</p>
            </div>
          )}
        </div>
      </section>

      {(user.role === 'admin' || user.email === 'guantesparaencajar@gmail.com') && (
        <>
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Usuarios Registrados ({allUsers.length})</h3>
            </div>
            <div className="bg-slate-800/30 rounded-2xl p-4 neon-border max-h-64 overflow-y-auto">
              {allUsers.length === 0 ? (
                <p className="text-slate-400 text-sm text-center">No hay usuarios registrados.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {allUsers.map(u => (
                    <div key={u.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-slate-100">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-widest border ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-primary/20 text-primary border-primary/30'}`}>
                          {u.role}
                        </span>
                        {u.id !== user.id && (
                          <button 
                            onClick={() => setUserToDelete({ id: u.id, name: u.name })}
                            className="p-1.5 bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              * Por seguridad de Firebase, las contraseñas y correos solo pueden ser modificados por los propios usuarios desde su cuenta.
            </p>
          </section>

          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Crear Estudiante</h3>
            </div>
          <div className="bg-slate-800/30 rounded-2xl p-4 neon-border">
            {!showCreateUser ? (
              <button 
                onClick={() => setShowCreateUser(true)}
                className="w-full bg-primary/20 text-primary font-bold py-3 rounded-lg hover:bg-primary/30 transition-all border border-primary/50"
              >
                + Nuevo Estudiante
              </button>
            ) : (
              <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
                <input 
                  type="email" 
                  placeholder="Correo electrónico" 
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full bg-slate-800/50 border-slate-700 rounded-lg p-3 text-sm"
                  required
                />
                <input 
                  type="password" 
                  placeholder="Contraseña temporal" 
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  className="w-full bg-slate-800/50 border-slate-700 rounded-lg p-3 text-sm"
                  required
                />
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setShowCreateUser(false)} className="flex-1 bg-slate-700 text-white py-2 rounded-lg text-sm font-bold">Cancelar</button>
                  <button type="submit" className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-bold">Crear</button>
                </div>
              </form>
            )}
          </div>
        </section>
        </>
      )}

      <section className="mb-8">
        <h3 className="text-lg font-bold mb-4">Transformación</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <div 
              onClick={() => !uploadProgress && beforeInputRef.current?.click()}
              className={`aspect-[3/4] bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden relative ${uploadProgress?.type === 'before' ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {beforePic ? (
                <img src={beforePic} alt="Antes" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImageIcon className="w-8 h-8 text-slate-500 mb-2" />
                  <span className="text-xs font-bold text-slate-400">Foto Inicio</span>
                </>
              )}
              {uploadProgress?.type === 'before' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-white font-bold text-sm">{uploadProgress.progress}%</span>
                </div>
              )}
            </div>
            <input type="file" ref={beforeInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, setBeforePic, false, true, false)} />
            <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Antes</p>
          </div>
          <div className="flex flex-col gap-2">
            <div 
              onClick={() => canUploadAfter && !uploadProgress && afterInputRef.current?.click()}
              className={`aspect-[3/4] bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center ${canUploadAfter ? 'cursor-pointer hover:border-primary/50' : 'cursor-not-allowed opacity-70'} transition-colors overflow-hidden relative ${uploadProgress?.type === 'after' ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {afterPic ? (
                <img src={afterPic} alt="Después" className="w-full h-full object-cover" />
              ) : (
                <>
                  {canUploadAfter ? (
                    <ImageIcon className="w-8 h-8 text-slate-500 mb-2" />
                  ) : (
                    <Lock className="w-8 h-8 text-slate-600 mb-2" />
                  )}
                  <span className="text-xs font-bold text-slate-400 text-center px-2">
                    {canUploadAfter ? 'Foto 1 Mes' : 'Se habilita al mes'}
                  </span>
                </>
              )}
              {uploadProgress?.type === 'after' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-white font-bold text-sm">{uploadProgress.progress}%</span>
                </div>
              )}
            </div>
            <input type="file" ref={afterInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, setAfterPic, false, false, true)} disabled={!canUploadAfter} />
            <p className="text-center text-xs font-bold text-primary uppercase tracking-widest">Después</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-bold leading-tight tracking-tight">Ajustes</h3>
        </div>
        <div className="space-y-2">
          
          <div className="bg-slate-800/30 rounded-2xl p-4 neon-border mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Notificaciones</p>
              <Bell className={`w-5 h-5 ${notificationsEnabled ? 'text-primary' : 'text-slate-500'}`} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-300">Recordatorios de clase</span>
              <button 
                onClick={requestNotificationPermission}
                disabled={notificationsEnabled}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${notificationsEnabled ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
              >
                {notificationsEnabled ? 'Activadas' : 'Activar'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Recibe un aviso en tu dispositivo 1 hora antes de que comience tu clase.
            </p>
          </div>

          <div className="bg-slate-800/30 rounded-2xl p-4 neon-border mb-4">
            <p className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-widest">Tema de la Aplicación</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setTheme('light')}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === 'light' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
              >
                <Sun className="w-5 h-5" />
                <span className="text-xs font-bold">Claro</span>
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === 'dark' ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(0,119,255,0.2)]' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
              >
                <Moon className="w-5 h-5" />
                <span className="text-xs font-bold">Oscuro</span>
              </button>
              <button 
                onClick={() => setTheme('system')}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === 'system' ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
              >
                <Monitor className="w-5 h-5" />
                <span className="text-xs font-bold">Sistema</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-2xl p-4 neon-border mb-4">
            <p className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-widest">Soporte y Ayuda</p>
            <a 
              href="https://wa.me/573022028477" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/50 p-3 rounded-xl hover:bg-[#25D366]/30 transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-sm font-bold">Contactar por WhatsApp</span>
            </a>
            <p className="text-[10px] text-slate-500 mt-2 text-center">
              ¿Tienes dudas o inquietudes? Escríbenos directamente.
            </p>
          </div>

          {user.email === 'hernandezkevin001998@gmail.com' && user.role !== 'admin' && (
            <button 
              onClick={async () => {
                try {
                  const userRef = doc(db, 'users', String(user.id));
                  await updateDoc(userRef, { role: 'admin' });
                  setUser({ ...user, role: 'admin' } as any);
                  showAlert('Éxito', '¡Ahora eres administrador! Recarga la página si es necesario.', 'success');
                } catch (err) {
                  console.error(err);
                  showAlert('Error', 'Error al hacerte admin', 'error');
                }
              }}
              className="w-full flex items-center justify-center p-4 bg-purple-600/20 rounded-xl border border-purple-500/50 hover:bg-purple-600/30 transition-colors mb-4"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-bold text-purple-400">Reclamar Permisos de Admin</span>
              </div>
            </button>
          )}

          <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium text-red-500">Cerrar Sesión</span>
            </div>
          </button>
        </div>
      </section>
      {/* Alert Modal */}
      <Modal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
      >
        <div className="flex flex-col items-center text-center p-4">
          {alertModal.type === 'success' && <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />}
          {alertModal.type === 'error' && <AlertCircle className="w-16 h-16 text-red-500 mb-4" />}
          {alertModal.type === 'info' && <Info className="w-16 h-16 text-blue-500 mb-4" />}
          <p className="text-slate-300">{alertModal.message}</p>
          <button
            onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
            className="mt-6 w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-700 transition-colors"
          >
            Entendido
          </button>
        </div>
      </Modal>

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">¿Eliminar Usuario?</h3>
            <p className="text-slate-400 text-center text-sm mb-6">
              Estás a punto de eliminar a <span className="text-white font-bold">{userToDelete.name}</span>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteUser}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
