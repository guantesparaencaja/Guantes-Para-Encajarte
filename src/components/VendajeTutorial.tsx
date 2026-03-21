import React from 'react';
import { ShieldCheck, Video, CheckCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export function VendajeTutorial() {
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const setHasSeenVendaje = useStore((state) => state.setHasSeenVendaje);

  const handleComplete = async () => {
    setHasSeenVendaje(true);
    if (user) {
      try {
        const userRef = doc(db, 'users', String(user.id));
        await updateDoc(userRef, { 
          vendaje_progreso: 100,
          hasSeenVendaje: true 
        });
        setUser({ ...user, vendaje_progreso: 100 });
      } catch (err) {
        console.error('Error updating vendaje progress:', err);
      }
    }
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-6 border border-primary/30 shadow-2xl shadow-primary/10 mb-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
      
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className="bg-primary/20 p-3 rounded-xl">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">Seguridad Primero</h2>
          <p className="text-primary font-bold text-sm">Aprende a vendarte correctamente</p>
        </div>
      </div>

      <p className="text-slate-300 mb-6 relative z-10">
        Antes de comenzar con tu entrenamiento y proceso de licencia, es obligatorio saber cómo proteger tus manos. Un buen vendaje previene lesiones graves.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 relative z-10">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col items-center justify-center text-center gap-3">
          <Video className="w-8 h-8 text-slate-400" />
          <div>
            <h3 className="font-bold text-white">Vendaje Básico</h3>
            <p className="text-xs text-slate-400">Ideal para principiantes</p>
          </div>
          <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors w-full">
            Ver Tutorial
          </button>
        </div>
        
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col items-center justify-center text-center gap-3">
          <Video className="w-8 h-8 text-slate-400" />
          <div>
            <h3 className="font-bold text-white">Vendaje Profesional</h3>
            <p className="text-xs text-slate-400">Mayor protección para sparring</p>
          </div>
          <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors w-full">
            Ver Tutorial
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 relative z-10">
        <button 
          onClick={handleComplete}
          className="flex-1 bg-primary text-black font-black uppercase tracking-widest py-4 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-5 h-5" />
          Ya sé vendarme / Continuar
        </button>
      </div>
    </div>
  );
}
