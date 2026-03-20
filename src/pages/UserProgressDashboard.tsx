import React, { useState, useEffect } from 'react';
import { Trophy, Flame, Clock, Dumbbell, Calendar, TrendingUp, ChevronRight, Activity, Award } from 'lucide-react';
import { motion } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { calculateStreak, StreakInfo } from '../utils/streakCalculator';
import { ACHIEVEMENTS, Achievement } from '../utils/achievements';
import { TrainingCalendar } from '../components/TrainingCalendar';

interface WorkoutRecord {
  id: string;
  timestamp: any;
  durationSeconds: number;
  exercises: any[];
  caloriesEstimate: number;
}

export const UserProgressDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [streak, setStreak] = useState<StreakInfo>({ currentStreak: 0, bestStreak: 0, lastWorkoutDate: null });

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      const userId = auth.currentUser.uid;

      try {
        // Fetch Workouts
        const q = query(
          collection(db, 'workout_history'),
          where('userId', '==', userId),
          orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const workoutData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WorkoutRecord[];
        
        setWorkouts(workoutData);

        // Calculate Streak
        const dates = workoutData
          .filter(w => w.timestamp)
          .map(w => w.timestamp.toDate());
        setStreak(calculateStreak(dates));

        // Fetch Achievements
        const aq = query(collection(db, 'user_achievements'), where('userId', '==', userId));
        const achievementSnapshot = await getDocs(aq);
        setUnlockedAchievements(achievementSnapshot.docs.map(doc => doc.data().achievementId));

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalMinutes = Math.floor(workouts.reduce((acc, w) => acc + w.durationSeconds, 0) / 60);
  const totalWorkouts = workouts.length;
  const totalExercises = workouts.reduce((acc, w) => acc + w.exercises.length, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-24">
      <header className="mb-8">
        <span className="text-xs font-black uppercase tracking-[0.3em] text-primary mb-2 block">Tu Progreso</span>
        <h1 className="text-4xl font-black uppercase tracking-tight">Panel de Control</h1>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Flame className="text-orange-500" />} label="Días en el Ring" value={`${streak.currentStreak} días`} />
        <StatCard icon={<Clock className="text-blue-500" />} label="Minutos Totales" value={`${totalMinutes}`} />
        <StatCard icon={<Dumbbell className="text-emerald-500" />} label="Entrenamientos" value={`${totalWorkouts}`} />
        <StatCard icon={<Trophy className="text-yellow-500" />} label="Logros" value={`${unlockedAchievements.length}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Calendar & Achievements */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Calendario de Entrenamiento
              </h2>
            </div>
            <TrainingCalendar workoutDates={workouts.filter(w => w.timestamp).map(w => w.timestamp.toDate())} />
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Logros Desbloqueados
              </h2>
              <span className="text-xs font-bold text-slate-500">{unlockedAchievements.length} / {ACHIEVEMENTS.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {ACHIEVEMENTS.map(achievement => {
                const isUnlocked = unlockedAchievements.includes(achievement.id);
                return (
                  <div 
                    key={achievement.id}
                    className={`p-4 rounded-2xl border flex flex-col items-center text-center transition-all ${
                      isUnlocked ? 'bg-slate-900 border-primary/30' : 'bg-slate-900/30 border-slate-800 opacity-40 grayscale'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${isUnlocked ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-600'}`}>
                      <Activity className="w-6 h-6" />
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-tight leading-tight mb-1">{achievement.title}</h3>
                    <p className="text-[8px] text-slate-500 leading-tight">{achievement.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Recent Activity & Streak */}
        <div className="space-y-8">
          <section className="bg-gradient-to-br from-primary/20 to-slate-900 p-6 rounded-3xl border border-primary/20">
            <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Mejor Racha
            </h3>
            <div className="text-5xl font-black mb-2">{streak.bestStreak}</div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Días Consecutivos</p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Actividad Reciente
            </h2>
            <div className="space-y-4">
              {workouts.slice(0, 5).map(workout => (
                <div key={workout.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm">Entrenamiento de Boxeo</h4>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                      {workout.timestamp?.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} • {Math.floor(workout.durationSeconds / 60)} min
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-primary">+{workout.caloriesEstimate} kcal</span>
                  </div>
                </div>
              ))}
              {workouts.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">Aún no has entrenado.</p>
                  <p className="text-xs uppercase font-black tracking-widest mt-2">¡Comienza hoy!</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 flex flex-col gap-3">
    <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-black text-white">{value}</p>
    </div>
  </div>
);
