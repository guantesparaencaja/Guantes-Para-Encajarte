/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
import { useClassReminders } from './hooks/useClassReminders';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const theme = useStore((state) => state.theme);
  const setUser = useStore((state) => state.setUser);
  const [loading, setLoading] = useState(true);
  useClassReminders();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          setUser({ id: firebaseUser.uid, ...userDoc.data() } as any);
        } else {
          // If user exists in Auth but not in Firestore, we might need to redirect to register
          // or create a minimal profile. For now, we'll just set the basic info.
          const userData = {
            name: firebaseUser.displayName || 'Usuario',
            email: firebaseUser.email,
            role: 'student',
            is_new_user: true
          };
          setUser({ id: firebaseUser.uid, ...userData } as any);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/saberes" element={<Saberes />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/community" element={<Community />} />
            <Route path="/meals" element={<Meals />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/payments" element={<Payments />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
