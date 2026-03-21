/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from './store/useStore';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Saberes } from './pages/Saberes';
import { Workouts } from './pages/Workouts';
import { Calendar } from './pages/Calendar';
import { Profile } from './pages/Profile';
import { Community } from './pages/Community';
import { Meals } from './pages/Meals';
import { Plans } from './pages/Plans';
import { Payments } from './pages/Payments';
import { PaymentReview } from './pages/PaymentReview';
import { useClassReminders } from './hooks/useClassReminders';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initializePushNotifications } from './lib/pushNotifications';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const location = window.location.pathname;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      navigate('/');
      return;
    }

    if (user.role === 'admin') return;

    // Navigation Guards for students
    const isPublicPath = ['/profile', '/plans', '/payments', '/payment-review'].includes(location);
    
    if (!user.plan_id || user.plan_status === 'none' || !user.plan_status) {
      if (location !== '/plans' && location !== '/profile') {
        navigate('/plans');
      }
    } else if (user.plan_status === 'pending_payment') {
      if (location !== '/payments' && location !== '/profile') {
        navigate('/payments');
      }
    } else if (user.plan_status === 'pending_verification') {
      if (location !== '/payment-review' && location !== '/profile') {
        navigate('/payment-review');
      }
    } else if (user.plan_status === 'active') {
      // Allowed to access everything
    }
  }, [user, navigate, location, allowedRoles]);

  return <>{children}</>;
}

export default function App() {
  const theme = useStore((state) => state.theme);
  const setUser = useStore((state) => state.setUser);
  const [loading, setLoading] = useState(true);
  useClassReminders();

  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubUser = onSnapshot(userRef, async (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            const adminEmails = ['hernandezkevin001998@gmail.com', 'guantesparaencajar@gmail.com'];
            if (firebaseUser.email && adminEmails.includes(firebaseUser.email) && data.role !== 'admin') {
              await updateDoc(userRef, { role: 'admin' });
            }
            setUser({ id: firebaseUser.uid, ...data } as any);
            initializePushNotifications(firebaseUser.uid);
          } else {
            const adminEmails = ['hernandezkevin001998@gmail.com', 'guantesparaencajar@gmail.com'];
            const userData = {
              name: firebaseUser.displayName || 'Usuario',
              email: firebaseUser.email,
              role: (firebaseUser.email && adminEmails.includes(firebaseUser.email)) ? 'admin' : 'student',
              is_new_user: true
            };
            await setDoc(userRef, userData);
            setUser({ id: firebaseUser.uid, ...userData } as any);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error syncing user data:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
        if (unsubUser) unsubUser();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
    };
  }, [setUser]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-yellow-500 text-yellow-950 py-2 px-4 flex items-center justify-center gap-2 text-sm font-bold sticky top-0 z-[100] shadow-lg"
          >
            <WifiOff className="w-4 h-4" />
            <span>Sin conexión — tus acciones se guardarán cuando vuelvas</span>
          </motion.div>
        )}
      </AnimatePresence>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route element={<Layout />}>
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/saberes" element={<ProtectedRoute><Saberes /></ProtectedRoute>} />
              <Route path="/workouts" element={<ProtectedRoute><Workouts /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
              <Route path="/meals" element={<ProtectedRoute><Meals /></ProtectedRoute>} />
              <Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
              <Route path="/payment-review" element={<ProtectedRoute><PaymentReview /></ProtectedRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </div>
  );
}
