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
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans">
      <OnboardingModal />
      <main className="flex-1 pb-32 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>
      
      {/* WhatsApp Floating Button */}
      <a 
        href="https://wa.me/573022028477" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-28 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-xl shadow-[#25D366]/20 hover:scale-110 transition-transform flex items-center justify-center"
        title="Soporte por WhatsApp"
      >
        <MessageSquare className="w-6 h-6" />
      </a>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-primary/5 px-2 py-2">
          <div className="flex justify-around items-center h-16">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={twMerge(
                    "flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300",
                    isActive 
                      ? "bg-primary text-white shadow-lg shadow-primary/30" 
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <Icon className={clsx("w-5 h-5", isActive ? "stroke-[2.5px]" : "stroke-[1.5px]")} />
                  <span className={clsx(
                    "text-[9px] font-bold uppercase tracking-wider mt-1",
                    isActive ? "opacity-100" : "opacity-60"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
