import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Target, Dumbbell, Calendar, User, Users, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { OnboardingModal } from './OnboardingModal';
import { useStore } from '../store/useStore';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function Layout() {
  const location = useLocation();
  const user = useStore((state) => state.user);
  const [appSettings, setAppSettings] = useState({
    workouts_unlocked: false,
    nutrition_unlocked: false,
    technique_unlocked: false,
    challenge_unlocked: false,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setAppSettings(doc.data() as any);
      }
    });
    return () => unsubscribe();
  }, []);

  const navItems = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/saberes', icon: Target, label: 'Saberes', id: 'technique' },
    { path: '/workouts', icon: Dumbbell, label: 'Entrenos', id: 'workouts' },
    { path: '/calendar', icon: Calendar, label: 'Calendario' },
    { path: '/community', icon: Users, label: 'Comunidad' },
    { path: '/profile', icon: User, label: 'Perfil' },
  ];

  const isSpecialUser = user?.email === 'guantesparaencajar@gmail.com' || user?.role === 'admin' || user?.plan === 'premium';
  
  const visibleNavItems = navItems.filter(item => {
    if (!item.id) return true;
    if (isSpecialUser) return true;
    if (item.id === 'workouts' && appSettings.workouts_unlocked) return true;
    if (item.id === 'technique' && appSettings.technique_unlocked) return true;
    return false;
  });

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
      <OnboardingModal />
      <main className="flex-1 pb-24 overflow-y-auto">
        <Outlet />
      </main>
      
      {/* WhatsApp Floating Button */}
      <a 
        href="https://wa.me/573022028477" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-24 right-4 z-50 bg-[#25D366] text-white p-3 rounded-full shadow-lg shadow-[#25D366]/30 hover:scale-110 transition-transform flex items-center justify-center"
        title="Soporte por WhatsApp"
      >
        <MessageSquare className="w-6 h-6" />
      </a>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background-light dark:bg-background-dark/95 backdrop-blur-lg border-t border-primary/20">
        <div className="flex justify-around items-center h-20 px-4 max-w-md mx-auto">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={twMerge(
                  "flex flex-col items-center gap-1 transition-colors",
                  isActive ? "text-primary" : "text-slate-500 dark:text-slate-400 hover:text-primary"
                )}
              >
                <Icon className={clsx("w-6 h-6", isActive && "fill-primary/20")} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
