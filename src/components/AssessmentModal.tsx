import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { X, CheckCircle2, Target, Zap, AlertTriangle, ChefHat, Dumbbell } from 'lucide-react';

export function AssessmentModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    goal: user?.goal || 'mantener',
    activity_level: user?.activity_level || 'moderado',
    experience_level: user?.experience_level || 'intermedio',
    injuries: user?.injuries || '',
    dietary_restrictions: user?.dietary_restrictions || ''
  });

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', String(user.id));
      const now = new Date().toISOString();
      const updateData = {
        ...formData,
        assessment_completed: true,
        assessment_updated_at: now
      };
      await updateDoc(userRef, updateData);
      setUser({ ...user, ...updateData });
      onClose();
    } catch (error) {
      console.error('Error saving assessment:', error);
      alert('Error al guardar. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: 'Tu Objetivo Principal',
      icon: <Target className="w-8 h-8 text-primary" />,
      content: (
        <div className="grid grid-cols-1 gap-3">
          {['bajar', 'mantener', 'subir'].map((g) => (
            <button
              key={g}
              onClick={() => setFormData({ ...formData, goal: g })}
              className={`p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${formData.goal === g ? 'border-primary bg-primary/10' : 'border-slate-700 bg-slate-900'}`}
            >
              <span className="capitalize font-bold">{g === 'bajar' ? 'Bajar Peso' : g === 'subir' ? 'Aumentar Peso' : 'Mantener Peso'}</span>
              {formData.goal === g && <CheckCircle2 className="w-5 h-5 text-primary" />}
            </button>
          ))}
        </div>
      )
    },
    {
      title: 'Nivel de Actividad',
      icon: <Zap className="w-8 h-8 text-yellow-500" />,
      content: (
        <div className="grid grid-cols-1 gap-3">
          {[
            { id: 'sedentario', label: 'Sedentario', desc: 'Poca o ninguna actividad' },
            { id: 'ligero', label: 'Ligero', desc: '1-3 días por semana' },
            { id: 'moderado', label: 'Moderado', desc: '3-5 días por semana' },
            { id: 'intenso', label: 'Intenso', desc: '6-7 días por semana' }
          ].map((a) => (
            <button
              key={a.id}
              onClick={() => setFormData({ ...formData, activity_level: a.id })}
              className={`p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${formData.activity_level === a.id ? 'border-primary bg-primary/10' : 'border-slate-700 bg-slate-900'}`}
            >
              <div>
                <p className="font-bold">{a.label}</p>
                <p className="text-xs text-slate-400">{a.desc}</p>
              </div>
              {formData.activity_level === a.id && <CheckCircle2 className="w-5 h-5 text-primary" />}
            </button>
          ))}
        </div>
      )
    },
    {
      title: 'Experiencia y Salud',
      icon: <Dumbbell className="w-8 h-8 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Nivel de Experiencia</label>
            <div className="grid grid-cols-3 gap-2">
              {['principiante', 'intermedio', 'avanzado'].map((e) => (
                <button
                  key={e}
                  onClick={() => setFormData({ ...formData, experience_level: e })}
                  className={`py-2 rounded-lg border text-xs font-bold capitalize ${formData.experience_level === e ? 'bg-primary border-primary text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Lesiones o Dolores
            </label>
            <textarea
              value={formData.injuries}
              onChange={(e) => setFormData({ ...formData, injuries: e.target.value })}
              placeholder="Ej: Dolor en rodilla derecha, hernia discal..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white resize-none h-24"
            />
          </div>
        </div>
      )
    },
    {
      title: 'Alimentación',
      icon: <ChefHat className="w-8 h-8 text-emerald-500" />,
      content: (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Restricciones Alimenticias</label>
            <textarea
              value={formData.dietary_restrictions}
              onChange={(e) => setFormData({ ...formData, dietary_restrictions: e.target.value })}
              placeholder="Ej: Vegano, alérgico al maní, sin gluten..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white resize-none h-32"
            />
          </div>
          <p className="text-xs text-slate-500 italic">
            Esta información nos ayuda a generar planes de comida y entrenamiento que se adapten a ti.
          </p>
        </div>
      )
    }
  ];

  const currentStep = steps[step - 1];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-xl">
              {currentStep.icon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{currentStep.title}</h3>
              <p className="text-xs text-slate-400">Paso {step} de {steps.length}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {currentStep.content}
        </div>

        <div className="p-6 border-t border-slate-700 flex gap-3 bg-slate-800/50">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-4 rounded-2xl font-bold bg-slate-700 text-white hover:bg-slate-600 transition-all"
            >
              Atrás
            </button>
          )}
          <button
            onClick={() => step < steps.length ? setStep(step + 1) : handleSave()}
            disabled={loading}
            className="flex-[2] py-4 rounded-2xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              step < steps.length ? 'Siguiente' : 'Finalizar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
