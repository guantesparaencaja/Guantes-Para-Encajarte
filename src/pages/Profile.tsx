import { useStore } from '../store/useStore';
import { User, Settings, LogOut, Shield, ArrowLeft, UserPlus, Camera, Image as ImageIcon, Edit2, Check, X, Users, Lock, Trash2, Moon, Sun, Monitor, Flame, Award, CalendarCheck, TrendingUp, Bell, MessageSquare, CreditCard, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import React, { useState, useRef, useEffect } from 'react';
import { storage, db, auth } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

import { Modal } from '../components/Modal';
import { AlertCircle, Info, CheckCircle2, Send } from 'lucide-react';
import { sendPushNotification } from '../lib/fcmService';

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
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showManualNotification, setShowManualNotification] = useState(false);
  const [manualNotification, setManualNotification] = useState({ userId: '', title: '', message: '' });

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
      fetchPendingApprovals();
    }
    if (user) {
      fetchAttendance();
      fetchNotifications();
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

  const fetchPendingApprovals = async () => {
    try {
      // Fetch pending plan payments
      const paymentsQ = query(collection(db, 'plan_payments'), where('status', '==', 'submitted'));
      const paymentsSnapshot = await getDocs(paymentsQ);
      setPendingPayments(paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'notifications'),
        where('user_id', 'in', [user.id, 'admin']),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const sendNotification = async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    try {
      await setDoc(doc(collection(db, 'notifications')), {
        user_id: userId,
        title,
        message,
        type,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error sending notification:', err);
    }
  };

  const handleSendManualNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNotification.userId || !manualNotification.title || !manualNotification.message) {
      showAlert('Error', 'Todos los campos son obligatorios', 'error');
      return;
    }
    try {
      await sendPushNotification(
        manualNotification.userId,
        manualNotification.title,
        manualNotification.message
      );
      showAlert('Éxito', 'Notificación enviada correctamente', 'success');
      setShowManualNotification(false);
      setManualNotification({ userId: '', title: '', message: '' });
    } catch (err) {
      console.error('Error sending manual notification:', err);
      showAlert('Error', 'Error al enviar la notificación', 'error');
    }
  };

  const handleApprovePayment = async (payment: any) => {
    try {
      // Update payment status
      await updateDoc(doc(db, 'plan_payments', payment.id), { status: 'approved' });
      
      // Update user's plan
      await updateDoc(doc(db, 'users', payment.user_id), {
        plan_id: payment.plan_id,
        plan_name: payment.plan_name,
        plan_status: 'active',
        plan_start_date: serverTimestamp()
      });

      // Send push notification
      await sendPushNotification(
        payment.user_id,
        '¡Plan Aprobado!',
        `Tu pago para el plan ${payment.plan_name} ha sido aprobado. ¡Disfruta de tus beneficios!`
      );

      showAlert('Éxito', 'Pago de plan aprobado correctamente', 'success');
      fetchPendingApprovals();
    } catch (err) {
      console.error('Error approving payment:', err);
      showAlert('Error', 'Error al aprobar el pago', 'error');
    }
  };

  const handleRejectPayment = async (payment: any) => {
    try {
      await updateDoc(doc(db, 'plan_payments', payment.id), { status: 'rejected' });
      
      // Send push notification
      await sendPushNotification(
        payment.user_id,
        'Pago Rechazado',
        `Lo sentimos, tu pago para el plan ${payment.plan_name} ha sido rechazado. Por favor, contacta a soporte.`
      );

      showAlert('Info', 'Pago de plan rechazado', 'info');
      fetchPendingApprovals();
    } catch (err) {
      console.error('Error rejecting payment:', err);
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
      <header className="flex items-center justify-between mb-10">
        <button 
          onClick={() => navigate(-1)}
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors shadow-sm"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Mi Perfil</h1>
        <div className="w-12"></div>
      </header>

      <div className="flex flex-col items-center mb-12">
        <div className="relative mb-6">
          <div className="w-40 h-40 rounded-[3rem] border-4 border-primary/30 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-5xl font-bold text-primary overflow-hidden shadow-2xl shadow-primary/20 relative group">
            {profilePic ? (
              <img src={profilePic} alt="Profile" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            ) : (
              (user.name || 'U').charAt(0)
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress?.type === 'profile'}
            className="absolute -bottom-2 -right-2 bg-primary text-white p-3.5 rounded-2xl border-4 border-white dark:border-slate-950 shadow-2xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50 z-10"
          >
            <Camera className="w-5 h-5" />
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
          <div className="w-40 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-4 border border-slate-300 dark:border-slate-700">
            <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress.progress}%` }}></div>
          </div>
        )}
        {isEditing ? (
          <input 
            type="text" 
            value={editForm.name} 
            onChange={e => setEditForm({...editForm, name: e.target.value})}
            className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-3 text-center text-2xl font-bold text-slate-900 dark:text-white mb-3 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
          />
        ) : (
          <h2 className="text-3xl font-black leading-tight tracking-tight text-center text-slate-900 dark:text-white uppercase">{user.name || 'Usuario'}</h2>
        )}
        <div className="flex items-center gap-3 mt-2">
          {user.role === 'student' && (
            <span className="bg-primary/10 text-primary text-[11px] uppercase font-black px-4 py-1.5 rounded-xl tracking-[0.2em] border border-primary/20">
              Nivel {user.license_level}
            </span>
          )}
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold tracking-tight uppercase">{user.goal}</p>
        </div>
      </div>

      {user.role === 'student' && (
        <section className="mb-12">
          <h3 className="text-xl font-black mb-6 flex items-center gap-4 text-slate-900 dark:text-white uppercase tracking-tight">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <Award className="w-6 h-6 text-primary" />
            </div>
            Logros y Estadísticas
          </h3>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="glass-card p-6 rounded-[2.5rem] flex flex-col items-center justify-center text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
              <Flame className="w-10 h-10 text-orange-500 mb-3" />
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{user.streak || 0}</span>
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mt-2">Días Seguidos</span>
            </div>
            <div className="glass-card p-6 rounded-[2.5rem] flex flex-col items-center justify-center text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
              <CalendarCheck className="w-10 h-10 text-blue-500 mb-3" />
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{attendanceCount}</span>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mt-2">Clases Asistidas</span>
            </div>
          </div>
          
          <div className="glass-card rounded-[2.5rem] p-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <TrendingUp className="w-6 h-6 text-emerald-500" />
                </div>
                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Adherencia Semanal</h4>
              </div>
              <span className="text-emerald-500 font-black text-2xl">85%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800/50 rounded-full h-4 overflow-hidden border border-slate-200 dark:border-slate-700/50">
              <div className="bg-emerald-500 h-full rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]" style={{ width: '85%' }}></div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-5 text-center font-medium leading-relaxed">¡Excelente trabajo! Has cumplido la mayoría de tus entrenamientos y comidas esta semana.</p>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-6 mb-12">
        <div className="glass-card p-6 rounded-[2rem] flex flex-col items-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          {isEditing ? (
            <input 
              type="number" 
              value={editForm.weight} 
              onChange={e => setEditForm({...editForm, weight: Number(e.target.value)})}
              className="w-20 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-primary font-black text-xl py-1"
            />
          ) : (
            <span className="text-primary text-2xl font-black tracking-tight">{user.weight}kg</span>
          )}
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-[0.2em] mt-2">Peso Actual</span>
        </div>
        <div className="glass-card p-6 rounded-[2rem] flex flex-col items-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          {isEditing ? (
            <select 
              value={editForm.dominant_hand} 
              onChange={e => setEditForm({...editForm, dominant_hand: e.target.value})}
              className="w-24 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-primary font-black text-sm py-2"
            >
              <option value="Derecha">Derecha</option>
              <option value="Izquierda">Izquierda</option>
            </select>
          ) : (
            <span className="text-primary text-2xl font-black tracking-tight">{user.dominant_hand || 'Derecha'}</span>
          )}
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-[0.2em] mt-2">Mano Dominante</span>
        </div>
      </div>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Notificaciones</h3>
          </div>
          {notifications.length > 0 && (
            <span className="bg-primary text-white text-[11px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest shadow-lg shadow-primary/20">
              {notifications.length} nuevas
            </span>
          )}
        </div>
        <div className="glass-card rounded-[2.5rem] p-6 max-h-[400px] overflow-y-auto hide-scrollbar">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-40">
              <MessageSquare className="w-12 h-12 mb-4" />
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Bandeja de entrada vacía</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map(n => (
                <div key={n.id} className={`p-6 rounded-[2rem] border-2 flex gap-5 items-start transition-all hover:scale-[1.01] ${
                  n.type === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' :
                  n.type === 'error' ? 'bg-red-500/5 border-red-500/20' :
                  n.type === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' :
                  'bg-blue-500/5 border-blue-500/20'
                }`}>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{n.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">{n.message}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">
                      {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : 'Reciente'}
                    </p>
                  </div>
                  <button 
                    onClick={() => markNotificationAsRead(n.id)} 
                    className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-2xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-all border border-transparent"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <User className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Datos Personales</h3>
          </div>
          {isEditing ? (
            <div className="flex gap-3">
              <button 
                onClick={() => setIsEditing(false)} 
                className="w-11 h-11 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
              <button 
                onClick={handleSaveProfile} 
                className="w-11 h-11 flex items-center justify-center bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                <Check className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditing(true)} 
              className="w-11 h-11 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-primary rounded-2xl hover:bg-primary/10 transition-all border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="glass-card rounded-[2.5rem] p-8 space-y-2">
          <div className="flex justify-between items-center py-5 border-b border-slate-200/50 dark:border-slate-800/50">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-black uppercase tracking-widest">Email</p>
            <p className="text-slate-900 dark:text-white text-base font-bold tracking-tight">{user.email}</p>
          </div>
          <div className="flex justify-between items-center py-5 border-b border-slate-200/50 dark:border-slate-800/50">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-black uppercase tracking-widest">Rol</p>
            <p className="text-slate-900 dark:text-white text-base font-bold tracking-tight capitalize">{user.role}</p>
          </div>
          {user.role === 'student' && (
            <div className="flex justify-between items-center py-5">
              <p className="text-slate-500 dark:text-slate-400 text-sm font-black uppercase tracking-widest">Vidas Restantes</p>
              <div className="flex items-center gap-2 bg-red-500/10 px-4 py-1.5 rounded-xl border border-red-500/20">
                <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                <p className="text-red-500 text-base font-black">{user.lives}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {(user.role === 'admin' || user.email === 'guantesparaencajar@gmail.com') && (
        <>
          <section className="mb-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Aprobaciones Pendientes</h3>
            </div>
            
            <div className="space-y-8">
              {/* Plan Payments */}
              <div className="glass-card rounded-[2.5rem] p-8">
                <h4 className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] mb-8 flex items-center justify-between">
                  Pagos de Planes
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg border border-primary/20">{pendingPayments.length}</span>
                </h4>
                {pendingPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 opacity-40">
                    <CreditCard className="w-12 h-12 mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">Sin pagos pendientes</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pendingPayments.map(p => (
                      <div key={p.id} className="bg-white/40 dark:bg-slate-800/40 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-inner group">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{p.user_name}</p>
                            <p className="text-xs text-primary font-black uppercase tracking-widest mt-1">{p.plan_name}</p>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(p.submitted_at).toLocaleDateString()}</span>
                        </div>
                        <div className="aspect-video w-full overflow-hidden rounded-2xl mb-6 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative group/img">
                          <img 
                            src={p.payment_proof_url} 
                            alt="Comprobante" 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110 cursor-pointer" 
                            onClick={() => window.open(p.payment_proof_url, '_blank')} 
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <Monitor className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => handleApprovePayment(p)} 
                            className="flex-1 bg-emerald-500 text-white py-3.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                          >
                            Aprobar
                          </button>
                          <button 
                            onClick={() => handleRejectPayment(p)} 
                            className="flex-1 bg-red-500/10 text-red-500 py-3.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-red-500/20 transition-all border border-red-500/20 active:scale-95"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Usuarios Registrados</h3>
              </div>
              <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-xl border border-primary/20 text-[11px] font-black tracking-widest uppercase">
                {allUsers.length} Total
              </span>
            </div>
            <div className="glass-card rounded-[2.5rem] p-6 max-h-[400px] overflow-y-auto hide-scrollbar">
              {allUsers.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-12 font-bold uppercase tracking-widest opacity-40">No hay usuarios registrados</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allUsers.map(u => (
                    <div key={u.id} className="bg-white/40 dark:bg-slate-800/40 p-5 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center group hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-primary font-black text-lg border border-slate-200 dark:border-slate-800">
                          {u.profile_pic ? (
                            <img src={u.profile_pic} alt={u.name} className="w-full h-full object-cover rounded-2xl" />
                          ) : (
                            u.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{u.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] uppercase font-black px-3 py-1 rounded-lg tracking-[0.15em] border ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                          {u.role}
                        </span>
                        {u.id !== user.id && (
                          <button 
                            onClick={() => setUserToDelete({ id: u.id, name: u.name })}
                            className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all border border-red-500/10 active:scale-90"
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
            <div className="mt-6 p-6 bg-blue-500/5 rounded-[2rem] border border-blue-500/10 flex items-start gap-4">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
                Por seguridad de Firebase, las contraseñas y correos solo pueden ser modificados por los propios usuarios desde su cuenta.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                <Send className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Notificación Push</h3>
            </div>
            <div className="glass-card rounded-[2.5rem] p-8">
              {!showManualNotification ? (
                <button 
                  onClick={() => setShowManualNotification(true)}
                  className="w-full bg-primary text-white font-black py-5 rounded-[2rem] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-4 uppercase tracking-[0.2em]"
                >
                  <MessageSquare className="w-6 h-6" />
                  Nueva Notificación
                </button>
              ) : (
                <form onSubmit={handleSendManualNotification} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-4">Destinatario</label>
                    <select 
                      value={manualNotification.userId}
                      onChange={e => setManualNotification({...manualNotification, userId: e.target.value})}
                      className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] p-5 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                      required
                    >
                      <option value="">Seleccionar Usuario</option>
                      {allUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-4">Título del Mensaje</label>
                    <input 
                      type="text" 
                      placeholder="Ej: ¡Nuevo entrenamiento disponible!" 
                      value={manualNotification.title}
                      onChange={e => setManualNotification({...manualNotification, title: e.target.value})}
                      className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] p-5 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-4">Cuerpo del Mensaje</label>
                    <textarea 
                      placeholder="Escribe aquí el contenido de la notificación..." 
                      value={manualNotification.message}
                      onChange={e => setManualNotification({...manualNotification, message: e.target.value})}
                      className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] p-5 text-sm font-bold min-h-[120px] focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setShowManualNotification(false)} 
                      className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 bg-primary text-white py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20"
                    >
                      Enviar Ahora
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Crear Estudiante</h3>
            </div>
            <div className="glass-card rounded-[2.5rem] p-8">
              {!showCreateUser ? (
                <button 
                  onClick={() => setShowCreateUser(true)}
                  className="w-full bg-primary/10 text-primary font-black py-5 rounded-[2rem] hover:bg-primary/20 transition-all border border-primary/30 flex items-center justify-center gap-4 uppercase tracking-[0.2em]"
                >
                  <UserPlus className="w-6 h-6" />
                  Nuevo Estudiante
                </button>
              ) : (
                <form onSubmit={handleCreateUser} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-4">Correo Electrónico</label>
                    <input 
                      type="email" 
                      placeholder="ejemplo@correo.com" 
                      value={newUser.email}
                      onChange={e => setNewUser({...newUser, email: e.target.value})}
                      className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] p-5 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-4">Contraseña Temporal</label>
                    <input 
                      type="password" 
                      placeholder="Mínimo 6 caracteres" 
                      value={newUser.password}
                      onChange={e => setNewUser({...newUser, password: e.target.value})}
                      className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] p-5 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setShowCreateUser(false)} 
                      className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 bg-primary text-white py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20"
                    >
                      Crear Cuenta
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </>
      )}

      {user.role === 'student' && (
        <section className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Plan Actual</h3>
          </div>
          <div className="glass-card rounded-[2.5rem] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <p className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{user.plan_name || 'Sin Plan Activo'}</p>
              <span className={`text-[11px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest border shadow-lg ${
                user.plan_status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10' : 
                user.plan_status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-yellow-500/10' : 
                'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}>
                {user.plan_status === 'active' ? 'Activo' : user.plan_status === 'pending' ? 'Pendiente' : 'Inactivo'}
              </span>
            </div>
            {user.plan_start_date && (
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium relative z-10">
                Miembro desde el <span className="text-slate-900 dark:text-white font-bold">{user.plan_start_date?.toDate ? user.plan_start_date.toDate().toLocaleDateString() : new Date(user.plan_start_date).toLocaleDateString()}</span>
              </p>
            )}
            {!user.plan_id && (
              <button 
                onClick={() => navigate('/plans')}
                className="mt-8 w-full bg-primary text-white font-black py-4 rounded-2xl text-sm uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20"
              >
                Ver Planes Disponibles
              </button>
            )}
          </div>
        </section>
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
