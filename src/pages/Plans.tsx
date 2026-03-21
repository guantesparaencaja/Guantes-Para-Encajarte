import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { ArrowLeft, CreditCard, Smartphone, Check, ShieldCheck, Zap, Star, Trophy, Flame, Edit2, Save, Clock, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface Plan {
  id: string;
  name: string;
  description: string;
  price_personalizada: number;
  price_decisao: number;
  icon: string;
  classes_per_month: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  number: string;
}

import { useRealtimeCollection } from '../hooks/useRealtimeCollection';

export function Plans() {
  const { data: plansData, loading: plansLoading } = useRealtimeCollection<Plan>('plans');
  const { data: methodsData, loading: methodsLoading } = useRealtimeCollection<PaymentMethod>('payment_methods');
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (plansData.length > 0) {
      setPlans([...plansData].sort((a, b) => parseInt(a.id) - parseInt(b.id)));
    } else if (!plansLoading) {
      // Seed initial plans if empty
      seedInitialData();
    }
  }, [plansData, plansLoading]);

  useEffect(() => {
    if (methodsData.length > 0) {
      setPaymentMethods(methodsData);
    } else if (!methodsLoading) {
      seedInitialMethods();
    }
  }, [methodsData, methodsLoading]);

  const seedInitialData = async () => {
    const initialPlans = [
      { id: '1', name: 'Clase Personalizada', description: 'Clase individual por sesión', price_personalizada: 25000, price_decisao: 35000, icon: 'Glove', classes_per_month: 1 },
      { id: '4', name: '4 clases / mes', description: 'Una clase por semana', price_personalizada: 85000, price_decisao: 120000, icon: 'Timer', classes_per_month: 4 },
      { id: '8', name: '8 clases / mes', description: 'Dos clases por semana', price_personalizada: 165000, price_decisao: 250000, icon: 'Glove', classes_per_month: 8 },
      { id: '12', name: '12 clases / mes', description: 'Tres clases por semana', price_personalizada: 260000, price_decisao: 370000, icon: 'Trophy', classes_per_month: 12 },
      { id: '16', name: '16 clases / mes', description: 'Entrenamiento intensivo', price_personalizada: 370000, price_decisao: 500000, icon: 'Zap', classes_per_month: 16 }
    ];
    for (const p of initialPlans) {
      await setDoc(doc(db, 'plans', p.id), p);
    }
  };

  const seedInitialMethods = async () => {
    const initialMethods = [
      { id: 'nequi', name: 'Nequi', number: '3022028477' },
      { id: 'breb', name: 'Bre-b', number: '1036681612' }
    ];
    for (const m of initialMethods) {
      await setDoc(doc(db, 'payment_methods', m.id), m);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap': return <Zap className="w-10 h-10 text-primary" />;
      case 'Star': return <Star className="w-10 h-10 text-primary" />;
      case 'Trophy': return <Trophy className="w-10 h-10 text-primary" />;
      case 'Flame': return <Flame className="w-10 h-10 text-primary" />;
      case 'Timer': return <Clock className="w-10 h-10 text-primary" />;
      default: return <Zap className="w-10 h-10 text-primary" />;
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

  const handleSelectPlan = async (plan: Plan) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        plan_id: plan.id,
        plan_name: plan.name,
        plan_status: 'pending_payment',
        classes_per_month: plan.classes_per_month,
        classes_remaining: plan.classes_per_month
      });
      navigate('/payments', { state: { planId: plan.id, planName: plan.name, classesPerMonth: plan.classes_per_month } });
    } catch (error) {
      console.error('Error selecting plan:', error);
      alert('Error al seleccionar el plan');
    }
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (plansLoading || methodsLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin shadow-2xl shadow-primary/20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans pb-24">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative h-96 overflow-hidden"
      >
        <img 
          src="https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&q=80" 
          className="w-full h-full object-cover scale-110"
          alt="Boxing background"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/40 dark:via-background-dark/40 to-transparent"></div>
        
        <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-20">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)} 
            className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/10 dark:bg-slate-900/10 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 text-slate-900 dark:text-white hover:bg-white/20 transition-all shadow-2xl"
          >
            <ArrowLeft className="w-7 h-7" />
          </motion.button>
          
          {user?.role === 'admin' && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => isEditing ? saveChanges() : setIsEditing(true)}
              className={`h-14 px-8 rounded-2xl backdrop-blur-xl border flex items-center gap-3 font-black uppercase tracking-[0.2em] text-[11px] transition-all shadow-2xl ${
                isEditing 
                  ? 'bg-emerald-500 border-emerald-400 text-white' 
                  : 'bg-white/10 dark:bg-slate-900/10 border-white/20 dark:border-slate-800/50 text-primary'
              }`}
            >
              {isEditing ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
              {isEditing ? 'Guardar' : 'Editar'}
            </motion.button>
          )}
        </div>

        <div className="absolute bottom-12 left-10 right-10 z-10">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-7xl font-black uppercase tracking-tighter italic leading-[0.85] text-slate-900 dark:text-white mb-4">
              Planes y <br /> <span className="text-primary drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">Precios</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 font-black uppercase tracking-[0.5em] text-[11px] opacity-80">Donde la derrota no tiene cavidad</p>
          </motion.div>
        </div>
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-8 -mt-10 relative z-10 space-y-12 max-w-5xl mx-auto"
      >
        {/* Intro Card */}
        <motion.div variants={itemVariants} className="glass-card rounded-[3.5rem] p-10 relative overflow-hidden group border-white/20 dark:border-slate-800/50 shadow-2xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-24 -mt-24 transition-transform duration-700 group-hover:scale-150"></div>
          <div className="flex items-center gap-8 mb-8">
            <div className="p-5 bg-primary/10 rounded-[2rem] border border-primary/20 shadow-inner">
              <ShieldCheck className="w-12 h-12 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">Clases Personalizadas</h2>
              <p className="text-[11px] font-black text-primary uppercase tracking-[0.3em] mt-2 opacity-80">El Artista • Decisao</p>
            </div>
          </div>
          <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
            Clases con mejor implementación y enfoque al boxeo en Decisao. Contamos con las herramientas para hacerte el mejor.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            {['HIT', 'Skills', 'Strong', 'Defensa Personal'].map((tag) => (
              <span key={tag} className="px-6 py-2 bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 backdrop-blur-sm">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Plans List */}
        <section>
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] mb-10 ml-6 opacity-60">Membresías Disponibles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {plans.map((plan) => (
              <motion.div 
                key={plan.id} 
                variants={itemVariants}
                whileHover={{ y: -10 }}
                className="glass-card rounded-[3rem] p-8 flex flex-col gap-8 transition-all duration-500 group border-white/20 dark:border-slate-800/50 shadow-2xl"
              >
                <div className="flex items-center gap-8">
                  <div className="w-24 h-24 bg-slate-100/50 dark:bg-slate-800/50 rounded-[2.5rem] flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50 transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 shadow-inner">
                    {getIcon(plan.icon)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-2xl italic uppercase tracking-tight text-slate-900 dark:text-white leading-tight">{plan.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2 opacity-80">{plan.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/30 dark:bg-slate-900/30 p-6 rounded-3xl border border-white/20 dark:border-slate-800/50 shadow-inner">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 opacity-60">Personalizadas</span>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={plan.price_personalizada}
                        onChange={(e) => handleUpdatePlan(plan.id, 'price_personalizada', parseInt(e.target.value))}
                        className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm w-full font-bold text-primary outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      />
                    ) : (
                      <span className="text-2xl font-black text-primary tracking-tighter">${plan.price_personalizada.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="bg-white/30 dark:bg-slate-900/30 p-6 rounded-3xl border border-white/20 dark:border-slate-800/50 shadow-inner">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 opacity-60">Decisao</span>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={plan.price_decisao}
                        onChange={(e) => handleUpdatePlan(plan.id, 'price_decisao', parseInt(e.target.value))}
                        className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm w-full font-bold text-purple-500 outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                      />
                    ) : (
                      <span className="text-2xl font-black text-purple-500 tracking-tighter">${plan.price_decisao.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {!isEditing && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectPlan(plan)}
                    className="w-full py-6 bg-primary text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-primary/30 hover:shadow-primary/50"
                  >
                    Elegir Plan y Pagar
                  </motion.button>
                )}
              </motion.div>
            ))}
          </div>
        </section>

        {/* Payment Methods */}
        <motion.section variants={itemVariants}>
          <div className="glass-card rounded-[4rem] p-12 relative overflow-hidden border-white/20 dark:border-slate-800/50 shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-150"></div>
            <h3 className="text-3xl font-black uppercase italic tracking-tight mb-12 flex items-center gap-6 text-slate-900 dark:text-white">
              <div className="p-4 bg-emerald-500/10 rounded-[1.5rem] border border-emerald-500/20 shadow-inner">
                <CreditCard className="w-8 h-8 text-emerald-500" />
              </div>
              Métodos de Pago
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {paymentMethods.map((method) => (
                <div key={method.id} className="bg-white/20 dark:bg-slate-900/20 p-8 rounded-[2.5rem] border border-white/20 dark:border-slate-800/50 flex items-center justify-between group backdrop-blur-sm shadow-inner">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm transition-transform group-hover:scale-110">
                      <Smartphone className="w-8 h-8 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 opacity-60">{method.name}</p>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={method.number}
                          onChange={(e) => handleUpdateMethod(method.id, e.target.value)}
                          className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3 text-sm font-bold w-48 outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                      ) : (
                        <p className="font-black text-2xl tracking-[0.1em] text-slate-900 dark:text-white">{method.number}</p>
                      )}
                    </div>
                  </div>
                  {!isEditing && (
                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        navigator.clipboard.writeText(method.number);
                        alert('Número copiado');
                      }}
                      className="w-14 h-14 flex items-center justify-center bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20 shadow-lg"
                    >
                      <Check className="w-6 h-6" />
                    </motion.button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-16 text-center">
              <motion.a 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                href="https://wa.me/573022028477" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-6 bg-emerald-500 text-white font-black uppercase italic px-12 py-8 rounded-[2.5rem] shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all tracking-[0.2em] text-lg"
              >
                Reserva tu clase hoy
              </motion.a>
              <div className="flex items-center justify-center gap-3 mt-8">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.4em] opacity-80">¡Cupos limitados! 🥊🔥</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Footer Info */}
        <div className="space-y-16 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              'Clases con entrenadores certificados',
              'Planes para todos los niveles',
              'Entrenamientos a domicilio y competencias internas'
            ].map((text) => (
              <motion.div 
                key={text} 
                variants={itemVariants}
                className="flex items-center gap-6 px-8 py-6 bg-white/10 dark:bg-slate-800/20 rounded-3xl border border-white/10 dark:border-slate-700/30 backdrop-blur-sm shadow-xl"
              >
                <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </div>
          
          <motion.div 
            variants={itemVariants}
            className="pt-16 border-t border-slate-200 dark:border-slate-800 text-center"
          >
            <h4 className="font-black text-4xl uppercase italic tracking-tighter text-slate-900 dark:text-white mb-10">¿Tienes dudas o inquietudes?</h4>
            <motion.a 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href="https://wa.me/573022028477" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-8 bg-white/10 dark:bg-slate-900/10 backdrop-blur-xl text-slate-900 dark:text-white font-black px-12 py-7 rounded-[3rem] hover:bg-primary hover:text-white transition-all border border-white/20 dark:border-slate-800/50 shadow-2xl group"
            >
              <div className="p-4 bg-emerald-500/10 rounded-2xl group-hover:bg-white/20 transition-colors shadow-inner">
                <MessageCircle className="w-8 h-8 text-emerald-500 group-hover:text-white" />
              </div>
              <span className="uppercase tracking-[0.2em] text-base">Contáctanos por WhatsApp</span>
            </motion.a>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
