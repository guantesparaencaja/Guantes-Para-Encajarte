import { useStore } from '../store/useStore';
import { User, Settings, LogOut, Shield, ArrowLeft, UserPlus, Camera, Image as ImageIcon, Edit2, Check, X, Users, Lock, Trash2, Moon, Sun, Monitor, Flame, Award, CalendarCheck, TrendingUp, Bell, MessageSquare, CreditCard, Heart, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { storage, db, auth } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

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

  const handleFirestoreError = useCallback((error: any, operationType: string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }, []);

  const showAlert = useCallback((title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  }, []);

  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubPayments: (() => void) | undefined;
    let unsubAttendance: (() => void) | undefined;
    let unsubNotifications: (() => void) | undefined;

    if (user?.role === 'admin' || user?.email === 'guantesparaencajar@gmail.com' || user?.email === 'hernandezkevin001998@gmail.com') {
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllUsers(usersData);
      }, (err) => handleFirestoreError(err, 'list', 'users'));

      const paymentsQ = query(collection(db, 'payments'), where('status', '==', 'submitted'));
      unsubPayments = onSnapshot(paymentsQ, (snapshot) => {
        setPendingPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => handleFirestoreError(err, 'list', 'payments'));
    }

    if (user) {
      const allQ = query(collection(db, 'bookings'), where('user_id', '==', String(user.id)));
      unsubAttendance = onSnapshot(allQ, (snapshot) => {
        const attended = snapshot.docs.filter(d => d.data().status !== 'cancelled').length;
        setAttendanceCount(attended);
      }, (err) => handleFirestoreError(err, 'list', 'bookings'));

      const q = query(
        collection(db, 'notifications'),
        where('user_id', 'in', [user.id, 'admin']),
        where('read', '==', false)
      );
      unsubNotifications = onSnapshot(q, (snapshot) => {
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => handleFirestoreError(err, 'list', 'notifications'));
    }

    try {
      if ('Notification' in window) {
        setNotificationsEnabled(Notification.permission === 'granted');
      }
    } catch (e) {
      console.error('Notification API error:', e);
    }

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubPayments) unsubPayments();
      if (unsubAttendance) unsubAttendance();
      if (unsubNotifications) unsubNotifications();
    };
  }, [user?.id, user?.role, user?.email, handleFirestoreError]);

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
      await updateDoc(doc(db, 'payments', payment.id), { 
        status: 'approved',
        verifiedAt: serverTimestamp(),
        verifiedBy: user?.id
      });
      
      // Update user's plan
      await updateDoc(doc(db, 'users', payment.user_id), {
        plan_id: payment.plan_id,
        plan_name: payment.plan_name,
        plan_status: 'active',
        plan_start_date: serverTimestamp(),
        classes_per_month: payment.classes_per_month || 0,
        classes_remaining: payment.classes_per_month || 0
      });

      // Send push notification
      await sendPushNotification(
        payment.user_id,
        '¡Plan Aprobado!',
        `Tu pago para el plan ${payment.plan_name} ha sido aprobado. ¡Disfruta de tus beneficios!`
      );

      showAlert('Éxito', 'Pago de plan aprobado correctamente', 'success');
    } catch (err) {
      handleFirestoreError(err, 'update', `payments/${payment.id}`);
    }
  };

  const handleRejectPayment = async (payment: any) => {
    try {
      await updateDoc(doc(db, 'payments', payment.id), { 
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        verifiedBy: user?.id
      });
      
      // Update user status back to pending payment so they can try again
      await updateDoc(doc(db, 'users', payment.user_id), {
        plan_status: 'pending_payment'
      });

      // Send push notification
      await sendPushNotification(
        payment.user_id,
        'Pago Rechazado',
        `Lo sentimos, tu pago para el plan ${payment.plan_name} ha sido rechazado. Por favor, verifica tu comprobante e intenta de nuevo.`
      );

      showAlert('Info', 'Pago de plan rechazado', 'info');
    } catch (err) {
      handleFirestoreError(err, 'update', `payments/${payment.id}`);
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
    } catch (err: any) {
      handleFirestoreError(err, 'write', 'users');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      showAlert('Éxito', 'Usuario eliminado correctamente de la base de datos.', 'success');
      setUserToDelete(null);
    } catch (error) {
      handleFirestoreError(error, 'delete', `users/${userToDelete.id}`);
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
      handleFirestoreError(error, 'update', `users/${user.id}`);
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
              handleFirestoreError(error, 'update', `users/${user.id}`);
            }
          }
        }
      );
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100
      }
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display p-4 pb-24"
    >
      <motion.header variants={itemVariants} className="flex items-center justify-between mb-10">
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors shadow-sm"
        >
          <ArrowLeft className="w-6 h-6" />
        </motion.button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Mi Perfil</h1>
        <div className="w-12"></div>
      </motion.header>

      <motion.div variants={itemVariants} className="flex flex-col items-center mb-12">
        <div className="relative mb-6">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="w-40 h-40 rounded-[3rem] border-4 border-primary/30 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-5xl font-bold text-primary overflow-hidden shadow-2xl shadow-primary/20 relative group"
          >
            {profilePic ? (
              <img src={profilePic} alt="Profile" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            ) : (
              (user.name || 'U').charAt(0)
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </motion.div>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress?.type === 'profile'}
            className="absolute -bottom-2 -right-2 bg-primary text-white p-3.5 rounded-2xl border-4 border-white dark:border-slate-950 shadow-2xl hover:bg-primary-dark transition-all disabled:opacity-50 z-10"
          >
            <Camera className="w-5 h-5" />
          </motion.button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={(e) => handleImageUpload(e, setProfilePic, true)}
          />
        </div>
        {uploadProgress?.type === 'profile' && (
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '10rem' }}
            className="bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-4 border border-slate-300 dark:border-slate-700"
          >
            <motion.div 
              className="bg-primary h-full transition-all duration-300" 
              style={{ width: `${uploadProgress.progress}%` }}
            ></motion.div>
          </motion.div>
        )}
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.input 
              key="edit-name"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              type="text" 
              value={editForm.name} 
              onChange={e => setEditForm({...editForm, name: e.target.value})}
              className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-3 text-center text-2xl font-bold text-slate-900 dark:text-white mb-3 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
            />
          ) : (
            <motion.h2 
              key="view-name"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="text-3xl font-black leading-tight tracking-tight text-center text-slate-900 dark:text-white uppercase"
            >
              {user.name || 'Usuario'}
            </motion.h2>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-3 mt-2">
          {user.role === 'student' && (
            <span className="bg-primary/10 text-primary text-[11px] uppercase font-black px-4 py-1.5 rounded-xl tracking-[0.2em] border border-primary/20">
              Nivel {user.license_level}
            </span>
          )}
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold tracking-tight uppercase">{user.goal}</p>
        </div>
      </motion.div>

      {user.role === 'student' && (
        <motion.section variants={itemVariants} className="mb-12">
          <h3 className="text-xl font-black mb-6 flex items-center gap-4 text-slate-900 dark:text-white uppercase tracking-tight">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <Award className="w-6 h-6 text-primary" />
            </div>
            Logros y Estadísticas
          </h3>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <motion.div 
              whileHover={{ y: -5 }}
              className="glass-card p-6 rounded-[2.5rem] flex flex-col items-center justify-center text-center relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
              <Flame className="w-10 h-10 text-orange-500 mb-3" />
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{user.streak || 0}</span>
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mt-2">Días Seguidos</span>
            </motion.div>
            <motion.div 
              whileHover={{ y: -5 }}
              className="glass-card p-6 rounded-[2.5rem] flex flex-col items-center justify-center text-center relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
              <CalendarCheck className="w-10 h-10 text-blue-500 mb-3" />
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{attendanceCount}</span>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mt-2">Clases Asistidas</span>
            </motion.div>
          </div>
          
          <motion.div 
            whileHover={{ y: -5 }}
            className="glass-card rounded-[2.5rem] p-8"
          >
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
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '85%' }}
                transition={{ duration: 1, delay: 0.5 }}
                className="bg-emerald-500 h-full rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]"
              ></motion.div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-5 text-center font-medium leading-relaxed">¡Excelente trabajo! Has cumplido la mayoría de tus entrenamientos y comidas esta semana.</p>
          </motion.div>
        </motion.section>
      )}

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-6 mb-12">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="glass-card p-6 rounded-[2rem] flex flex-col items-center relative overflow-hidden group"
        >
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
        </motion.div>
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="glass-card p-6 rounded-[2rem] flex flex-col items-center relative overflow-hidden group"
        >
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
        </motion.div>
      </motion.div>

      <motion.section variants={itemVariants} className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Notificaciones</h3>
          </div>
          <AnimatePresence>
            {notifications.length > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="bg-primary text-white text-[11px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest shadow-lg shadow-primary/20"
              >
                {notifications.length} nuevas
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="glass-card rounded-[2.5rem] p-6 max-h-[400px] overflow-y-auto hide-scrollbar">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-40">
              <MessageSquare className="w-12 h-12 mb-4" />
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Bandeja de entrada vacía</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {notifications.map(n => (
                  <motion.div 
                    key={n.id} 
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`p-6 rounded-[2rem] border-2 flex gap-5 items-start transition-all hover:scale-[1.01] ${
                      n.type === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' :
                      n.type === 'error' ? 'bg-red-500/5 border-red-500/20' :
                      n.type === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' :
                      'bg-blue-500/5 border-blue-500/20'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{n.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">{n.message}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">
                        {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : 'Reciente'}
                      </p>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => markNotificationAsRead(n.id)} 
                      className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-2xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-all border border-transparent"
                    >
                      <Check className="w-5 h-5" />
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <User className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Datos Personales</h3>
          </div>
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div 
                key="edit-actions"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex gap-3"
              >
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsEditing(false)} 
                  className="w-11 h-11 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                >
                  <X className="w-5 h-5" />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSaveProfile} 
                  className="w-11 h-11 flex items-center justify-center bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  <Check className="w-5 h-5" />
                </motion.button>
              </motion.div>
            ) : (
              <motion.button 
                key="view-actions"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditing(true)} 
                className="w-11 h-11 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-primary rounded-2xl hover:bg-primary/10 transition-all border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                <Edit2 className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>
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
      </motion.section>

      {(user.role === 'admin' || user.email === 'guantesparaencajar@gmail.com' || user.email === 'hernandezkevin001998@gmail.com') && (
        <motion.div variants={itemVariants} className="space-y-12">
          <section>
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Aprobaciones Pendientes</h3>
            </div>
            
            <div className="space-y-8">
              <motion.div 
                whileHover={{ y: -5 }}
                className="glass-card rounded-[2.5rem] p-8"
              >
                <h4 className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] mb-8 flex items-center justify-between">
                  Pagos de Planes
                  <AnimatePresence>
                    {pendingPayments.length > 0 && (
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="bg-primary/10 text-primary px-3 py-1 rounded-lg border border-primary/20"
                      >
                        {pendingPayments.length}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </h4>
                {pendingPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 opacity-40">
                    <CreditCard className="w-12 h-12 mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">Sin pagos pendientes</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AnimatePresence mode="popLayout">
                      {pendingPayments.map(p => (
                        <motion.div 
                          key={p.id} 
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="bg-white/40 dark:bg-slate-800/40 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-inner group"
                        >
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
                            <motion.button 
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleApprovePayment(p)} 
                              className="flex-1 bg-emerald-500 text-white py-3.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                            >
                              Aprobar
                            </motion.button>
                            <motion.button 
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleRejectPayment(p)} 
                              className="flex-1 bg-red-500/10 text-red-500 py-3.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-red-500/20 transition-all border border-red-500/20"
                            >
                              Rechazar
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            </div>
          </section>

          <section>
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
            <motion.div 
              whileHover={{ y: -5 }}
              className="glass-card rounded-[2.5rem] p-6 max-h-[400px] overflow-y-auto hide-scrollbar"
            >
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
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setUserToDelete({ id: u.id, name: u.name })}
                            className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all border border-red-500/10"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
            <div className="mt-6 p-6 bg-blue-500/5 rounded-[2rem] border border-blue-500/10 flex items-start gap-4">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
                Por seguridad de Firebase, las contraseñas y correos solo pueden ser modificados por los propios usuarios desde su cuenta.
              </p>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                <Send className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Notificación Push</h3>
            </div>
            <motion.div 
              whileHover={{ y: -5 }}
              className="glass-card rounded-[2.5rem] p-8"
            >
              {!showManualNotification ? (
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowManualNotification(true)}
                  className="w-full bg-primary text-white font-black py-5 rounded-[2rem] hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-4 uppercase tracking-[0.2em]"
                >
                  <MessageSquare className="w-6 h-6" />
                  Nueva Notificación
                </motion.button>
              ) : (
                <motion.form 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleSendManualNotification} 
                  className="space-y-6"
                >
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
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button" 
                      onClick={() => setShowManualNotification(false)} 
                      className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Cancelar
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit" 
                      className="flex-1 bg-primary text-white py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-xl shadow-primary/20"
                    >
                      Enviar Ahora
                    </motion.button>
                  </div>
                </motion.form>
              )}
            </motion.div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Crear Estudiante</h3>
            </div>
            <motion.div 
              whileHover={{ y: -5 }}
              className="glass-card rounded-[2.5rem] p-8"
            >
              {!showCreateUser ? (
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateUser(true)}
                  className="w-full bg-primary/10 text-primary font-black py-5 rounded-[2rem] hover:bg-primary/20 transition-all border border-primary/30 flex items-center justify-center gap-4 uppercase tracking-[0.2em]"
                >
                  <UserPlus className="w-6 h-6" />
                  Nuevo Estudiante
                </motion.button>
              ) : (
                <motion.form 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleCreateUser} 
                  className="space-y-6"
                >
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
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button" 
                      onClick={() => setShowCreateUser(false)} 
                      className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Cancelar
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit" 
                      className="flex-1 bg-primary text-white py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-xl shadow-primary/20"
                    >
                      Crear Cuenta
                    </motion.button>
                  </div>
                </motion.form>
              )}
            </motion.div>
          </section>
        </motion.div>
      )}

      {user.role === 'student' && (
        <motion.section 
          variants={itemVariants}
          className="mb-12"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Plan Actual</h3>
          </div>
          <motion.div 
            whileHover={{ y: -5 }}
            className="glass-card rounded-[2.5rem] p-8 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{user.plan_name || 'Sin Plan Activo'}</p>
                {user.plan_status === 'active' && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                      {user.classes_remaining ?? 0} clases restantes este mes
                    </p>
                  </div>
                )}
              </div>
              <span className={`text-[11px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest border shadow-lg ${
                user.plan_status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10' : 
                user.plan_status === 'pending_payment' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-yellow-500/10' : 
                user.plan_status === 'pending_verification' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/10' : 
                'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}>
                {user.plan_status === 'active' ? 'Activo' : 
                 user.plan_status === 'pending_payment' ? 'Pendiente de Pago' : 
                 user.plan_status === 'pending_verification' ? 'En Revisión' : 
                 'Inactivo'}
              </span>
            </div>
            {user.plan_start_date && (
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium relative z-10">
                Miembro desde el <span className="text-slate-900 dark:text-white font-bold">{user.plan_start_date?.toDate ? user.plan_start_date.toDate().toLocaleDateString() : new Date(user.plan_start_date).toLocaleDateString()}</span>
              </p>
            )}
            {!user.plan_id && (
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/plans')}
                className="mt-8 w-full bg-primary text-white font-black py-4 rounded-2xl text-sm uppercase tracking-[0.2em] transition-all shadow-xl shadow-primary/20"
              >
                Ver Planes Disponibles
              </motion.button>
            )}
          </motion.div>
        </motion.section>
      )}

      <motion.section 
        variants={itemVariants}
        className="mb-12"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
            <ImageIcon className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Transformación</h3>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <motion.div 
            whileHover={{ y: -5 }}
            className="flex flex-col gap-4"
          >
            <div 
              onClick={() => !uploadProgress && beforeInputRef.current?.click()}
              className={`aspect-[3/4] glass-card rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-all overflow-hidden relative group ${uploadProgress?.type === 'before' ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {beforePic ? (
                <img src={beforePic} alt="Antes" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:bg-primary/10 transition-colors">
                    <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-primary" />
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Foto Inicio</span>
                </div>
              )}
              <AnimatePresence>
                {uploadProgress?.type === 'before' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
                  >
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <span className="text-white font-black text-lg">{uploadProgress.progress}%</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <input type="file" ref={beforeInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, setBeforePic, false, true, false)} />
            <p className="text-center text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Antes</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="flex flex-col gap-4"
          >
            <div 
              onClick={() => canUploadAfter && !uploadProgress && afterInputRef.current?.click()}
              className={`aspect-[3/4] glass-card rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center ${canUploadAfter ? 'cursor-pointer hover:border-primary/50' : 'cursor-not-allowed opacity-70'} transition-all overflow-hidden relative group ${uploadProgress?.type === 'after' ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {afterPic ? (
                <img src={afterPic} alt="Después" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:bg-primary/10 transition-colors">
                    {canUploadAfter ? (
                      <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-primary" />
                    ) : (
                      <Lock className="w-8 h-8 text-slate-600" />
                    )}
                  </div>
                  <span className="text-xs font-black text-slate-400 text-center px-4 uppercase tracking-widest">
                    {canUploadAfter ? 'Foto 1 Mes' : 'Se habilita al mes'}
                  </span>
                </div>
              )}
              <AnimatePresence>
                {uploadProgress?.type === 'after' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
                  >
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <span className="text-white font-black text-lg">{uploadProgress.progress}%</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <input type="file" ref={afterInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, setAfterPic, false, false, true)} disabled={!canUploadAfter} />
            <p className="text-center text-[11px] font-black text-primary uppercase tracking-[0.2em]">Después</p>
          </motion.div>
        </div>
      </motion.section>

      <motion.section 
        variants={itemVariants}
        className="mb-12"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Ajustes</h3>
        </div>
        
        <div className="space-y-6">
          <motion.div 
            whileHover={{ x: 5 }}
            className="glass-card rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Bell className={`w-5 h-5 ${notificationsEnabled ? 'text-primary' : 'text-slate-500'}`} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Notificaciones</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Recordatorios de clase</p>
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={requestNotificationPermission}
                disabled={notificationsEnabled}
                className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${notificationsEnabled ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-primary text-white shadow-lg shadow-primary/20'}`}
              >
                {notificationsEnabled ? 'Activadas' : 'Activar'}
              </motion.button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Recibe un aviso en tu dispositivo 1 hora antes de que comience tu clase para que nunca te pierdas un entrenamiento.
            </p>
          </motion.div>

          <motion.div 
            whileHover={{ x: 5 }}
            className="glass-card rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/50"
          >
            <p className="text-sm font-black text-slate-900 dark:text-white mb-6 uppercase tracking-widest">Tema de la Aplicación</p>
            <div className="flex gap-3">
              {[
                { id: 'light', icon: Sun, label: 'Claro' },
                { id: 'dark', icon: Moon, label: 'Oscuro' },
                { id: 'system', icon: Monitor, label: 'Sistema' }
              ].map((t) => (
                <motion.button 
                  key={t.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTheme(t.id as any)}
                  className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${theme === t.id ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <t.icon className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ x: 5 }}
            className="glass-card rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/50"
          >
            <p className="text-sm font-black text-slate-900 dark:text-white mb-6 uppercase tracking-widest">Soporte y Ayuda</p>
            <motion.a 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              href="https://wa.me/573022028477" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 bg-[#25D366] text-white p-4 rounded-2xl hover:bg-[#25D366]/90 transition-all shadow-lg shadow-[#25D366]/20"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-sm font-black uppercase tracking-widest">WhatsApp Soporte</span>
            </motion.a>
            <p className="text-[10px] text-slate-500 mt-4 text-center uppercase tracking-widest font-bold">
              ¿Tienes dudas o inquietudes? Escríbenos directamente.
            </p>
          </motion.div>

          {(user.email === 'hernandezkevin001998@gmail.com' || user.email === 'guantesparaencajar@gmail.com') && user.role !== 'admin' && (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={async () => {
                try {
                  const userRef = doc(db, 'users', String(user.id));
                  await updateDoc(userRef, { role: 'admin' });
                  setUser({ ...user, role: 'admin' } as any);
                  showAlert('Éxito', '¡Ahora eres administrador! Recarga la página si es necesario.', 'success');
                } catch (err) {
                  handleFirestoreError(err, 'update', `users/${user.id}`);
                }
              }}
              className="w-full flex items-center justify-center p-5 bg-purple-600 text-white rounded-[2rem] hover:bg-purple-700 transition-all shadow-xl shadow-purple-600/20"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6" />
                <span className="text-sm font-black uppercase tracking-widest">Reclamar Permisos de Admin</span>
              </div>
            </motion.button>
          )}

          <motion.button 
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout} 
            className="w-full flex items-center justify-between p-6 glass-card rounded-[2rem] border border-red-500/20 text-red-500 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="text-sm font-black uppercase tracking-widest">Cerrar Sesión</span>
            </div>
            <ChevronRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </div>
      </motion.section>

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
    </motion.div>
  );
}
