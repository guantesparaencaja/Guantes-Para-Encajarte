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
      case 'Glove': return <Flame className="w-6 h-6 text-red-500" />;
      case 'Timer': return <Clock className="w-6 h-6 text-blue-500" />;
      case 'Trophy': return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 'Zap': return <Zap className="w-6 h-6 text-purple-500" />;
      default: return <Star className="w-6 h-6 text-primary" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-display pb-20">
      {/* Header */}
      <div className="relative h-64 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&q=80" 
          className="w-full h-full object-cover opacity-40"
          alt="Boxing background"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
        <div className="absolute top-6 left-6 right-6 flex justify-between items-center">
          <button onClick={() => navigate(-1)} className="p-3 bg-slate-900/80 rounded-2xl backdrop-blur-md border border-slate-700">
            <ArrowLeft className="w-6 h-6" />
          </button>
          {user?.role === 'admin' && (
            <button 
              onClick={() => isEditing ? saveChanges() : setIsEditing(true)}
              className={`p-3 rounded-2xl backdrop-blur-md border flex items-center gap-2 font-bold ${isEditing ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-900/80 border-slate-700'}`}
            >
              {isEditing ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
              {isEditing ? 'Guardar' : 'Editar'}
            </button>
          )}
        </div>
        <div className="absolute bottom-6 left-6">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic">Planes y Precios</h1>
          <p className="text-slate-400 font-medium">Donde la derrota no tiene cavidad</p>
        </div>
      </div>

      <div className="px-6 -mt-4 relative z-10 space-y-6">
        {/* Intro Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/20 rounded-2xl">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold uppercase italic">Clases Personalizadas</h2>
              <p className="text-xs text-slate-400">El Artista • Decisao</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Clases con mejor implementación y enfoque al boxeo en Decisao. Contamos con las herramientas para hacerte el mejor.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-400">HIT</span>
            <span className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-400">Skills</span>
            <span className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-400">Strong</span>
            <span className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-400">Defensa Personal</span>
          </div>
        </div>

        {/* Plans List */}
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-slate-900/50 border border-slate-800 rounded-3xl p-5 flex items-center gap-4 hover:bg-slate-900 transition-all">
              <div className="p-4 bg-slate-800 rounded-2xl">
                {getIcon(plan.icon)}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg italic uppercase">{plan.name}</h3>
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Personalizadas:</span>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={plan.price_personalizada}
                        onChange={(e) => handleUpdatePlan(plan.id, 'price_personalizada', parseInt(e.target.value))}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs w-24 text-right"
                      />
                    ) : (
                      <span className="text-sm font-bold text-primary">${plan.price_personalizada.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Decisao:</span>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={plan.price_decisao}
                        onChange={(e) => handleUpdatePlan(plan.id, 'price_decisao', parseInt(e.target.value))}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs w-24 text-right"
                      />
                    ) : (
                      <span className="text-sm font-bold text-purple-400">${plan.price_decisao.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => navigate('/calendar')}
                    className="w-full mt-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Elegir Plan y Reservar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Payment Methods */}
        <div className="bg-gradient-to-br from-primary/20 to-purple-900/20 border border-primary/30 rounded-3xl p-6">
          <h3 className="text-xl font-black uppercase italic mb-4 flex items-center gap-2">
            <CreditCard className="w-6 h-6" /> Métodos de Pago
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {paymentMethods.map((method) => (
              <div key={method.id} className="bg-slate-950/50 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{method.name}</p>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={method.number}
                        onChange={(e) => handleUpdateMethod(method.id, e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm w-32"
                      />
                    ) : (
                      <p className="font-bold text-lg tracking-wider">{method.number}</p>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(method.number);
                      alert('Número copiado');
                    }}
                    className="p-2 bg-white/5 rounded-xl hover:bg-white/10"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <a 
              href="https://wa.me/573022028477" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-500 text-white font-black uppercase italic px-8 py-4 rounded-2xl shadow-xl shadow-emerald-500/20 hover:scale-105 transition-transform"
            >
              Reserva tu clase hoy
            </a>
            <p className="text-[10px] text-slate-500 mt-4 uppercase tracking-widest">¡Cupos limitados! 🥊🔥</p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center space-y-2 pb-10">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Clases con entrenadores certificados</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Planes para todos los niveles</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Entrenamientos a domicilio y competencias internas</p>
          
          <div className="mt-8 pt-8 border-t border-slate-800">
            <h4 className="font-bold text-lg mb-2">¿Tienes dudas o inquietudes?</h4>
            <a 
              href="https://wa.me/573022028477" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-slate-800 text-white font-bold px-6 py-3 rounded-xl hover:bg-slate-700 transition-colors"
            >
              <MessageCircle className="w-5 h-5 text-emerald-400" />
              Contáctanos por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
