import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { UserPlus, Mail, Lock, User, Scale, Hand, Target, ArrowLeft, ArrowRight, Ruler } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { sendEmail } from '../lib/email';

export function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    weight: '',
    height: '',
    age: '',
    dominant_hand: 'Derecha',
    boxing_goal: 'Aprender a defenderme',
    fitness_goal: 'Mantener peso',
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setUser = useStore((state) => state.setUser);

  const handleNext = () => setStep(step + 1);
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate(-1);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      handleNext();
      return;
    }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      const userData = {
        name: formData.name,
        email: formData.email,
        weight: parseFloat(formData.weight),
        height: parseFloat(formData.height),
        age: parseInt(formData.age),
        dominant_hand: formData.dominant_hand,
        boxing_goal: formData.boxing_goal,
        fitness_goal: formData.fitness_goal,
        goal: formData.fitness_goal,
        role: 'student',
        streak: 0,
        lives: 3,
        license_level: 1,
        profile_pic: null,
        is_new_user: false,
        tutorial_completed: false
      };

      await setDoc(doc(db, 'users', user.uid), userData);
      
      // Send welcome email
      await sendEmail(
        formData.email,
        '¡Bienvenido a GUANTES!',
        `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f172a; color: #f1f5f9; border-radius: 10px;">
          <h1 style="color: #0077ff; text-align: center;">¡Hola ${formData.name}!</h1>
          <p style="font-size: 16px; line-height: 1.5;">Bienvenido a <strong>GUANTES</strong>, tu nueva comunidad de entrenamiento. Estamos muy emocionados de tenerte con nosotros.</p>
          <p style="font-size: 16px; line-height: 1.5;">Tu objetivo de <strong>${formData.boxing_goal}</strong> y <strong>${formData.fitness_goal}</strong> es nuestra prioridad. Prepárate para sudar, aprender y alcanzar tus metas.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://guantes.app" style="background-color: #0077ff; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Comenzar a Entrenar</a>
          </div>
        </div>
        `
      );

      setUser({ id: user.uid, ...userData } as any);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error de registro');
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased">
      <div className="flex items-center bg-transparent p-4 justify-between z-10">
        <div className="text-primary flex size-12 shrink-0 items-center justify-center cursor-pointer" onClick={handleBack}>
          <ArrowLeft className="w-8 h-8" />
        </div>
        <div className="flex-1 text-center pr-12">
          <span className="text-primary font-bold tracking-widest uppercase text-sm">Paso {step} de 3</span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center pt-4 pb-4 px-6">
        <h1 className="text-slate-100 tracking-tight text-3xl font-bold leading-tight text-center">
          {step === 1 && "Únete a GUANTES"}
          {step === 2 && "Tu Perfil Físico"}
          {step === 3 && "Tus Objetivos"}
        </h1>
      </div>

      <form onSubmit={handleRegister} className="flex flex-col gap-4 px-6 pt-4 pb-12 flex-1">
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        
        {step === 1 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-primary ml-1">Nombre Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-800/30 border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3 pl-10 text-slate-100 placeholder-slate-500 transition-all" 
                  placeholder="Tu nombre" 
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-primary ml-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-slate-800/30 border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3 pl-10 text-slate-100 placeholder-slate-500 transition-all" 
                  placeholder="tu@email.com" 
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-primary ml-1">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input 
                  type="password" 
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-slate-800/30 border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3 pl-10 text-slate-100 placeholder-slate-500 transition-all" 
                  placeholder="••••••••" 
                  required
                />
              </div>
            </div>
            
            <button type="button" onClick={handleNext} className="mt-6 w-full bg-primary text-white font-bold py-4 rounded-lg shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 neon-glow">
              <span>SIGUIENTE</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-primary ml-1">Edad</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-5 h-5" />
                </div>
                <input 
                  type="number" 
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  className="w-full bg-slate-800/30 border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3 pl-10 text-slate-100 placeholder-slate-500 transition-all" 
                  placeholder="Ej: 25" 
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-primary ml-1">Peso Actual (kg)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Scale className="w-5 h-5" />
                </div>
                <input 
                  type="number" 
                  value={formData.weight}
                  onChange={(e) => setFormData({...formData, weight: e.target.value})}
                  className="w-full bg-slate-800/30 border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3 pl-10 text-slate-100 placeholder-slate-500 transition-all" 
                  placeholder="Ej: 75" 
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-primary ml-1">Altura (cm)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Ruler className="w-5 h-5" />
                </div>
                <input 
                  type="number" 
                  value={formData.height}
                  onChange={(e) => setFormData({...formData, height: e.target.value})}
                  className="w-full bg-slate-800/30 border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3 pl-10 text-slate-100 placeholder-slate-500 transition-all" 
                  placeholder="Ej: 175" 
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-primary ml-1">Mano Dominante</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Hand className="w-5 h-5" />
                </div>
                <select 
                  value={formData.dominant_hand}
                  onChange={(e) => setFormData({...formData, dominant_hand: e.target.value})}
                  className="w-full bg-slate-800/30 border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3 pl-10 text-slate-100 transition-all"
                >
                  <option value="Derecha">Derecha</option>
                  <option value="Izquierda">Izquierda</option>
                  <option value="Ambidiestra">Ambidiestra</option>
                </select>
              </div>
            </div>
            
            <button type="button" onClick={handleNext} className="mt-6 w-full bg-primary text-white font-bold py-4 rounded-lg shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 neon-glow">
              <span>SIGUIENTE</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-primary ml-1">Objetivo en Boxeo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Target className="w-5 h-5" />
                </div>
                <select 
                  value={formData.boxing_goal}
                  onChange={(e) => setFormData({...formData, boxing_goal: e.target.value})}
                  className="w-full bg-slate-800/30 border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3 pl-10 text-slate-100 transition-all"
                >
                  <option value="Aprender a defenderme">Aprender a defenderme</option>
                  <option value="Solo practicarlo para ser bueno peleando">Solo practicarlo para ser bueno peleando</option>
                  <option value="Ser boxeador de competencia">Ser boxeador de competencia</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-primary ml-1">Objetivo Físico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Target className="w-5 h-5" />
                </div>
                <select 
                  value={formData.fitness_goal}
                  onChange={(e) => setFormData({...formData, fitness_goal: e.target.value})}
                  className="w-full bg-slate-800/30 border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3 pl-10 text-slate-100 transition-all"
                >
                  <option value="Mantener peso">Mantener peso</option>
                  <option value="Bajar peso">Bajar peso</option>
                  <option value="Ser mas musculoso">Ser mas musculoso</option>
                </select>
              </div>
            </div>

            <button type="submit" className="mt-6 w-full bg-primary text-white font-bold py-4 rounded-lg shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 neon-glow">
              <span>FINALIZAR REGISTRO</span>
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
