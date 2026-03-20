import { create } from 'zustand';

interface User {
  id: number;
  name: string;
  email: string;
  weight: number;
  dominant_hand: string;
  goal: string;
  lives: number;
  streak: number;
  role: string;
  license_level: number;
  age?: number;
  height?: number;
  is_new_user?: boolean;
  tutorial_completed?: boolean;
  mood?: string;
  mood_updated_at?: string;
  password?: string;
  profile_pic?: string;
  before_pic?: string;
  after_pic?: string;
  created_at?: any;
  training_location?: 'casa' | 'gym';
  training_days?: string[];
  training_focus?: Record<string, string[]>;
  weekly_workout_plan?: any;
  weekly_meal_plan?: any;
  assessment_completed?: boolean;
  activity_level?: string;
  injuries?: string;
  dietary_restrictions?: string;
  experience_level?: string;
  assessment_updated_at?: string;
  water_intake?: {
    date: string;
    count: number;
  };
  weight_logs?: Record<string, string>;
  custom_routines?: any[];
  xp?: number;
  plan?: string;
  last_workout?: string;
}

interface AppState {
  user: User | null;
  theme: 'light' | 'dark' | 'system';
  hasWarmedUp: boolean;
  hasSeenVendaje: boolean;
  setUser: (user: User | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setHasWarmedUp: (warmedUp: boolean) => void;
  setHasSeenVendaje: (seen: boolean) => void;
  loseLife: () => void;
  increaseStreak: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  theme: (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system',
  hasWarmedUp: false,
  hasSeenVendaje: localStorage.getItem('hasSeenVendaje') === 'true',
  setUser: (user) => set({ user }),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  setHasWarmedUp: (hasWarmedUp) => set({ hasWarmedUp }),
  setHasSeenVendaje: (hasSeenVendaje) => {
    localStorage.setItem('hasSeenVendaje', String(hasSeenVendaje));
    set({ hasSeenVendaje });
  },
  loseLife: () => set((state) => ({
    user: state.user ? { ...state.user, lives: Math.max(0, state.user.lives - 1) } : null
  })),
  increaseStreak: () => set((state) => ({
    user: state.user ? { ...state.user, streak: state.user.streak + 1 } : null
  })),
}));
