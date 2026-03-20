import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BookOpen, Calendar, MessageSquare, User, Dumbbell, Utensils, ArrowRight, CheckCircle2, Home } from 'lucide-react';

const TUTORIAL_STEPS = [
  {
    title: 'Inicio',
    icon: Home,
    description: 'Tu panel principal. Aquí encontrarás la frase del día para motivarte, un chiste de boxeo para sonreír, y un resumen rápido de tu progreso.',
    example: 'Ejemplo: Revisa la frase del día antes de entrenar para entrar en la zona.'
  },
  {
    title: 'Saberes',
    icon: BookOpen,
    description: 'La biblioteca del boxeador. Aprende teoría, historia del boxeo, reglas y técnicas fundamentales.',
    example: 'Ejemplo: Si no sabes cómo vendarte las manos, busca el tutorial aquí.'
  },
  {
    title: 'Entrenamiento',
    icon: Dumbbell,
    description: 'Tus rutinas personalizadas. Encuentra entrenamientos de boxeo, fuerza y acondicionamiento adaptados a tu nivel.',
    example: 'Ejemplo: Selecciona "Rutina de Sombra" y sigue el temporizador integrado.'
  },
  {
    title: 'Calendario',
    icon: Calendar,
    description: 'Reserva tus clases presenciales o virtuales. Selecciona el día y la hora que mejor te convenga.',
    example: 'Ejemplo: Toca un día en el calendario y elige un horario disponible para reservar tu clase.'
  },
  {
    title: 'Comunidad',
    icon: MessageSquare,
    description: 'Conecta con otros boxeadores. Comparte tus logros, haz preguntas y mantente al día con los anuncios del gimnasio.',
    example: 'Ejemplo: Sube una foto de tus guantes nuevos o reacciona al mensaje del entrenador.'
  },
  {
    title: 'Nutrición',
    icon: Utensils,
    description: 'Planes de alimentación para complementar tu entrenamiento. Encuentra recetas y consejos nutricionales.',
    example: 'Ejemplo: Busca un batido de recuperación post-entrenamiento.'
  },
  {
    title: 'Perfil',
    icon: User,
    description: 'Tu espacio personal. Actualiza tus datos, sube fotos de tu progreso (antes y después) y revisa tus estadísticas.',
    example: 'Ejemplo: Sube una foto cada mes para ver cómo cambia tu cuerpo.'
  }
];

export function Tutorial({ onComplete }: { onComplete: () => void }) {
  const user = useStore(state => state.user);
  const setUser = useStore(state => state.setUser);
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < TUTORIAL_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', String(user.id));
      await updateDoc(userRef, { tutorial_completed: true });
      setUser({ ...user, tutorial_completed: true } as any);
      onComplete();
    } catch (error) {
      console.error('Error saving tutorial completion:', error);
      onComplete(); // Complete anyway so user isn't stuck
    }
  };

  const currentStep = TUTORIAL_STEPS[step];
  const Icon = currentStep.icon;

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in duration-300 relative overflow-hidden">
        
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-700">
          <div 
            className="h-full bg-primary transition-all duration-300" 
            style={{ width: `${((step + 1) / TUTORIAL_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="flex justify-between items-center mb-6 mt-2">
          <h2 className="text-xl font-bold text-white">Guía Rápida</h2>
          <span className="text-xs font-bold text-slate-400">{step + 1} / {TUTORIAL_STEPS.length}</span>
        </div>
        
        <div className="flex flex-col items-center text-center space-y-6 min-h-[250px] animate-in slide-in-from-right-4" key={step}>
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50 shadow-[0_0_30px_rgba(0,119,255,0.3)]">
            <Icon className="w-10 h-10 text-primary" />
          </div>
          
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">{currentStep.title}</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              {currentStep.description}
            </p>
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-left">
              <p className="text-xs text-slate-400 italic">
                <span className="font-bold text-primary not-italic">💡 Tip:</span> {currentStep.example}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button 
            onClick={handleComplete} 
            className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:text-white transition-colors text-sm"
          >
            Saltar
          </button>
          <button 
            onClick={handleNext} 
            className="flex-[2] py-3 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
          >
            {step === TUTORIAL_STEPS.length - 1 ? (
              <>¡Entendido! <CheckCircle2 className="w-5 h-5" /></>
            ) : (
              <>Siguiente <ArrowRight className="w-5 h-5" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
