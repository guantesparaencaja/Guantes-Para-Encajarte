import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { ArrowLeft, CreditCard, Smartphone, Check, ShieldCheck, Zap, Star, Trophy, Flame, Edit2, Save, X, Clock, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Plan {
  id: string;
  name: string;
  description: string;
  price_personalizada: number;
  price_decisao: number;
  icon: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  number: string;
}

export function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const plansSnap = await getDocs(collection(db, 'plans'));
      const methodsSnap = await getDocs(collection(db, 'payment_methods'));
      
      let plansData = plansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
      let methodsData = methodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));

      if (plansData.length === 0) {
        // Initial data if empty
        const initialPlans = [
          { id: '1', name: 'Clase Personalizada', description: 'Clase individual por sesión', price_personalizada: 25000, price_decisao: 35000, icon: 'Glove' },
          { id: '4', name: '4 clases / mes', description: 'Una clase por semana', price_personalizada: 85000, price_decisao: 120000, icon: 'Timer' },
          { id: '8', name: '8 clases / mes', description: 'Dos clases por semana', price_personalizada: 165000, price_decisao: 250000, icon: 'Glove' },
          { id: '12', name: '12 clases / mes', description: 'Tres clases por semana', price_personalizada: 260000, price_decisao: 370000, icon: 'Trophy' },
          { id: '16', name: '16 clases / mes', description: 'Entrenamiento intensivo', price_personalizada: 370000, price_decisao: 500000, icon: 'Zap' }
        ];
        for (const p of initialPlans) {
          await setDoc(doc(db, 'plans', p.id), p);
        }
        plansData = initialPlans;
      }

      if (methodsData.length === 0) {
        const initialMethods = [
          { id: 'nequi', name: 'Nequi', number: '3022028477' },
          { id: 'breb', name: 'Bre-b', number: '1036681612' }
        ];
        for (const m of initialMethods) {
          await setDoc(doc(db, 'payment_methods', m.id), m);
        }
        methodsData = initialMethods;
      }

      setPlans(plansData.sort((a, b) => parseInt(a.id) - parseInt(b.id)));
      setPaymentMethods(methodsData);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlan = async (id: string, field: string, value: any) => {
    const updatedPlans = plans.map(p => p.id === id ? { ...p, [field]: value } : p);
    setPlans(updatedPlans);
  };

  const handleUpdateMethod = async (id: string, value: string) => {
    const updatedMethods = paymentMethods.map(m => m.id === id ? { ...m, number: value } : m);
    setPaymentMethods(updatedMethods);
  };

  const saveChanges = async () => {
    try {
      for (const p of plans) {
        await updateDoc(doc(db, 'plans', p.id), { ...p });
      }
      for (const m of paymentMethods) {
        await updateDoc(doc(db, 'payment_methods', m.id), { ...m });
      }
      setIsEditing(false);
      alert('Cambios guardados correctamente');
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Error al guardar los cambios');
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Glove': return <Flame className="w-8 h-8 text-orange-500" />;
      case 'Timer': return <Clock className="w-8 h-8 text-blue-500" />;
      case 'Trophy': return <Trophy className="w-8 h-8 text-yellow-500" />;
      case 'Zap': return <Zap className="w-8 h-8 text-purple-500" />;
      default: return <Star className="w-8 h-8 text-primary" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin shadow-2xl shadow-primary/20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display pb-24">
      {/* Header */}
      <div className="relative h-80 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&q=80" 
          className="w-full h-full object-cover"
          alt="Boxing background"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/60 dark:via-background-dark/60 to-transparent"></div>
        
        <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
          <button 
            onClick={() => navigate(-1)} 
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-primary transition-all shadow-lg active:scale-95"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          {user?.role === 'admin' && (
            <button 
              onClick={() => isEditing ? saveChanges() : setIsEditing(true)}
              className={`h-12 px-6 rounded-2xl backdrop-blur-md border flex items-center gap-3 font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95 ${
                isEditing 
                  ? 'bg-emerald-500 border-emerald-400 text-white' 
                  : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-primary'
              }`}
            >
              {isEditing ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
              {isEditing ? 'Guardar' : 'Editar'}
            </button>
          )}
        </div>

        <div className="absolute bottom-10 left-8 right-8 z-10">
          <h1 className="text-5xl font-black uppercase tracking-tighter italic leading-none text-slate-900 dark:text-white mb-2">
            Planes y <br /> <span className="text-primary">Precios</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Donde la derrota no tiene cavidad</p>
        </div>
      </div>

      <div className="px-6 -mt-6 relative z-10 space-y-10">
        {/* Intro Card */}
        <div className="glass-card rounded-[3rem] p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center gap-6 mb-6">
            <div className="p-4 bg-primary/10 rounded-[1.5rem] border border-primary/20">
              <ShieldCheck className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">Clases Personalizadas</h2>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1">El Artista • Decisao</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Clases con mejor implementación y enfoque al boxeo en Decisao. Contamos con las herramientas para hacerte el mejor.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {['HIT', 'Skills', 'Strong', 'Defensa Personal'].map((tag) => (
              <span key={tag} className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Plans List */}
        <section>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mb-8 ml-4">Membresías Disponibles</h3>
          <div className="space-y-6">
            {plans.map((plan) => (
              <div key={plan.id} className="glass-card rounded-[2.5rem] p-6 flex flex-col gap-6 hover:scale-[1.02] transition-all duration-500 group">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-[2rem] flex items-center justify-center border border-slate-200 dark:border-slate-700/50 transition-transform group-hover:rotate-6">
                    {getIcon(plan.icon)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-xl italic uppercase tracking-tight text-slate-900 dark:text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{plan.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/40 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Personalizadas</span>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={plan.price_personalizada}
                        onChange={(e) => handleUpdatePlan(plan.id, 'price_personalizada', parseInt(e.target.value))}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm w-full font-bold text-primary outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    ) : (
                      <span className="text-xl font-black text-primary tracking-tight">${plan.price_personalizada.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="bg-white/40 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Decisao</span>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={plan.price_decisao}
                        onChange={(e) => handleUpdatePlan(plan.id, 'price_decisao', parseInt(e.target.value))}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm w-full font-bold text-purple-500 outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    ) : (
                      <span className="text-xl font-black text-purple-500 tracking-tight">${plan.price_decisao.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {!isEditing && (
                  <button
                    onClick={() => navigate('/payments', { state: { planId: plan.id, planName: plan.name } })}
                    className="w-full py-5 bg-primary text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Elegir Plan y Pagar
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Payment Methods */}
        <section>
          <div className="glass-card rounded-[3rem] p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full -mr-20 -mt-20"></div>
            <h3 className="text-2xl font-black uppercase italic tracking-tight mb-8 flex items-center gap-4 text-slate-900 dark:text-white">
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <CreditCard className="w-6 h-6 text-emerald-500" />
              </div>
              Métodos de Pago
            </h3>
            
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div key={method.id} className="bg-white/40 dark:bg-slate-800/40 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between group">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-800">
                      <Smartphone className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{method.name}</p>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={method.number}
                          onChange={(e) => handleUpdateMethod(method.id, e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-bold w-40 outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      ) : (
                        <p className="font-black text-xl tracking-widest text-slate-900 dark:text-white">{method.number}</p>
                      )}
                    </div>
                  </div>
                  {!isEditing && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(method.number);
                        alert('Número copiado');
                      }}
                      className="w-12 h-12 flex items-center justify-center bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20 active:scale-90"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <a 
                href="https://wa.me/573022028477" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-4 bg-emerald-500 text-white font-black uppercase italic px-8 py-6 rounded-[2rem] shadow-2xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all tracking-widest"
              >
                Reserva tu clase hoy
              </a>
              <div className="flex items-center justify-center gap-2 mt-6">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.3em]">¡Cupos limitados! 🥊🔥</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer Info */}
        <div className="space-y-12 pb-12">
          <div className="grid grid-cols-1 gap-4">
            {[
              'Clases con entrenadores certificados',
              'Planes para todos los niveles',
              'Entrenamientos a domicilio y competencias internas'
            ].map((text) => (
              <div key={text} className="flex items-center gap-4 px-6 py-4 bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">{text}</p>
              </div>
            ))}
          </div>
          
          <div className="pt-12 border-t border-slate-200 dark:border-slate-800 text-center">
            <h4 className="font-black text-2xl uppercase italic tracking-tight text-slate-900 dark:text-white mb-6">¿Tienes dudas o inquietudes?</h4>
            <a 
              href="https://wa.me/573022028477" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-900 dark:text-white font-black px-10 py-5 rounded-[2rem] hover:bg-primary hover:text-white transition-all border border-slate-200 dark:border-slate-800 shadow-xl group"
            >
              <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:bg-white/20 transition-colors">
                <MessageCircle className="w-6 h-6 text-emerald-500 group-hover:text-white" />
              </div>
              <span className="uppercase tracking-widest text-sm">Contáctanos por WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
