import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';

const VIDEO_URL = 'https://www.youtube.com/watch?v=pJNtGvOdSZA'; 

export const Calentamiento: React.FC = () => {
  const navigate = useNavigate();
  const setHasWarmedUp = useStore((state) => state.setHasWarmedUp);

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display p-4 pb-24">
      <header className="flex items-center justify-between mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="text-primary flex size-12 shrink-0 items-center justify-center"
        >
          <ArrowLeft className="w-8 h-8" />
        </button>
        <h1 className="text-xl font-bold tracking-tight uppercase italic">Calentamiento Obligatorio</h1>
        <div className="w-12"></div>
      </header>

      <main className="flex-1 flex flex-col gap-6 max-w-2xl mx-auto w-full">
        <div className="bg-slate-800/50 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
          <div className="p-8 bg-slate-950 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6 border border-primary/30">
              <Play className="w-10 h-10 text-primary fill-current" />
            </div>
            
            <h2 className="text-2xl font-black uppercase italic mb-2">Calentamiento de Boxeo</h2>
            <p className="text-slate-400 text-sm mb-8 max-w-xs">10 minutos — Movilidad y activación</p>
            
            <a 
              href={VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary text-white font-black uppercase italic px-10 py-4 rounded-2xl hover:bg-primary/90 transition-all flex items-center gap-3 shadow-lg shadow-primary/40"
            >
              Ver Video en YouTube
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
          
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black uppercase italic text-lg">Rutina de Movilidad</h3>
                <p className="text-slate-400 text-xs">Duración estimada: 10 minutos</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-slate-300 text-sm leading-relaxed">
                Esta secuencia está diseñada específicamente para boxeadores. Enfócate en la movilidad de hombros, cadera y tobillos.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
                  <p className="text-[10px] font-black text-primary uppercase italic mb-1">Enfoque</p>
                  <p className="text-xs font-bold">Articulaciones</p>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
                  <p className="text-[10px] font-black text-primary uppercase italic mb-1">Intensidad</p>
                  <p className="text-xs font-bold">Baja / Media</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => {
              setHasWarmedUp(true);
              navigate(-1);
            }}
            className="w-full bg-primary text-white font-black uppercase italic py-4 rounded-2xl shadow-lg shadow-primary/20"
          >
            He terminado, volver a entrenos
          </button>
          <p className="text-center text-[10px] text-slate-500 uppercase font-bold tracking-widest">
            "El sudor en el entrenamiento ahorra sangre en la batalla"
          </p>
        </div>
      </main>
    </div>
  );
};

