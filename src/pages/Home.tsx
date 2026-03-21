import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Heart, Flame, Trophy, Play, Dumbbell, Calendar, Utensils, Quote, Smile, Zap, Target, Activity, Star, AlertCircle, Droplets, RefreshCw, ChevronRight, Video, Upload, Trash2, Lock, CheckCircle2, Info } from 'lucide-react';
import { Modal } from '../components/Modal';
import { AssessmentModal } from '../components/AssessmentModal';
import { doc, updateDoc, setDoc, collection, onSnapshot, query, limit, orderBy, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { generateLocalWorkout } from '../services/geminiService';

const QUOTES = [
  { text: "La vida es como andar en bicicleta. Para mantener el equilibrio, debes seguir moviéndote.", emoji: "🚲" },
  { text: "El único modo de hacer un gran trabajo es amar lo que haces.", emoji: "❤️" },
  { text: "No cuentes los días, haz que los días cuenten.", emoji: "📅" },
  { text: "La mejor forma de predecir el futuro es creándolo.", emoji: "✨" },
  { text: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", emoji: "📈" },
  { text: "No te detengas cuando estés cansado, detente cuando hayas terminado.", emoji: "🥊" },
  { text: "La disciplina es el puente entre las metas y los logros.", emoji: "🌉" },
  { text: "Tu único límite eres tú mismo.", emoji: "🚀" },
  { text: "El dolor es temporal, la gloria es para siempre.", emoji: "🏆" },
  { text: "Cree que puedes y ya habrás recorrido la mitad del camino.", emoji: "💪" },
  { text: "La motivación te pone en marcha, el hábito te mantiene.", emoji: "🔄" },
  { text: "No busques el momento perfecto, toma el momento y hazlo perfecto.", emoji: "⌛" },
  { text: "Si quieres algo que nunca has tenido, tendrás que hacer algo que nunca has hecho.", emoji: "🌟" },
  { text: "La fuerza no proviene de la capacidad física, sino de una voluntad indomable.", emoji: "🔥" },
  { text: "El fracaso es solo la oportunidad de comenzar de nuevo de forma más inteligente.", emoji: "🧠" },
  { text: "No se trata de ser el mejor, se trata de ser mejor que ayer.", emoji: "📈" },
  { text: "La paciencia es amarga, pero su fruto es dulce.", emoji: "🍎" },
  { text: "Todo lo que siempre has querido está al otro lado del miedo.", emoji: "🌈" },
  { text: "Los campeones no se hacen en los gimnasios, se hacen de algo que tienen en su interior.", emoji: "🥊" },
  { text: "La mente es el límite. Mientras la mente pueda ver el hecho de que puedes hacer algo, puedes hacerlo.", emoji: "💭" }
];

const normalJokes = [
  "¿Qué le dice un semáforo a otro? ¡No me mires que me estoy cambiando!",
  "¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter.",
  "¿Qué le dice una iguana a su hermana gemela? Somos iguanitas.",
  "¿Qué hace una abeja en el gimnasio? ¡Zum-ba!",
  "¿Cómo se dice pañuelo en japonés? Saka-moko.",
  "¿Qué le dice un jaguar a otro jaguar? Jaguar you?",
  "¿Por qué los osos panda no quieren casarse? Porque tienen ojeras.",
  "¿Qué le dice un techo a otro? Te-echo de menos.",
  "¿Cómo se llama el campeón de buceo japonés? Tokofondo.",
  "¿Y el subcampeón? Kasitoko.",
  "¿Qué le dice una pulga a otra? ¿Vamos a pie o esperamos al perro?",
  "¿Por qué los esqueletos no pelean entre ellos? Porque no tienen agallas.",
  "¿Qué hace un perro con un taladro? Ta-drando.",
  "¿Cuál es el colmo de un zapatero? Que su mujer sea una zapatilla.",
  "¿Qué le dice un pez a otro? Nada.",
  "¿Por qué las focas miran siempre hacia arriba? ¡Porque ahí están los focos!",
  "¿Qué le dice una impresora a otra? ¿Esa hoja es tuya o es una impresión mía?",
  "¿Cómo se dice 'estoy perdido' en chino? Chon-ta-ma-la.",
  "¿Qué le dice una piedra a otra? La vida es dura.",
  "¿Por qué los fantasmas son malos mentirosos? Porque se les ve el plumero.",
  "¿Qué le dice un fideo a otro? ¡Oye, mi cuerpo pide salsa!",
  "¿Por qué los tomates no toman café? Porque toman té-mate.",
  "¿Qué hace un mudo bailando? ¡Muda-nza!",
  "¿Cómo se dice 'perro' en chino? Chu-chu-ma-lo.",
  "¿Qué le dice una taza a otra? ¿Qué taza-ciendo?",
  "¿Por qué los elefantes no usan computadora? Porque le tienen miedo al mouse.",
  "¿Qué hace un cocinero cuando está triste? ¡Llora-cebolla!",
  "¿Cómo se dice 'espejo' en chino? ¡Ay-soy-yo!",
  "¿Qué le dice un cable a otro? ¡Somos intocables!",
  "¿Por qué los libros de historia son tan pesados? Porque tienen mucho pasado."
];

const darkJokes = [
  "¿Por qué los esqueletos no pelean entre ellos? Porque no tienen agallas.",
  "¿Qué hace un vampiro con un tractor? Sembrar el pánico.",
  "¿Cuál es el colmo de un electricista? Que su mujer se llame Luz y los hijos le sigan la corriente.",
  "Mi abuelo tiene el corazón de un león... y una prohibición de por vida para entrar al zoológico.",
  "¿Qué le dice un gusano a otro? Me voy a dar una vuelta a la manzana.",
  "¿Por qué el libro de matemáticas estaba triste? Porque tenía muchos problemas.",
  "¿Qué hace una abeja en el gimnasio? ¡Zum-ba!",
  "¿Qué le dice un pez a otro? Nada.",
  "¿Por qué las focas miran siempre hacia arriba? ¡Porque ahí están los focos!",
  "¿Cuál es el colmo de un ciego? Que se llame Casimiro y viva en el noveno B.",
  "¿Qué hace un leproso tocando la guitarra? Carne picada.",
  "¿Por qué los huérfanos no pueden jugar al béisbol? Porque no saben dónde está la casa.",
  "¿Qué es lo peor de comer un vegetal? La silla de ruedas.",
  "¿Por qué Hitler se suicidó? Porque vio la cuenta del gas.",
  "¿Qué tienen en común un padre y un boomerang? Que esperas que vuelvan pero no siempre lo hacen.",
  "¿Cuál es la diferencia entre un niño y una bolsa de basura? Que la bolsa de basura no grita cuando la tiras.",
  "¿Por qué el niño sin brazos no pudo abrir su regalo? Porque no tenía manos... y además era cáncer.",
  "¿Qué hace un niño sirio en un columpio? Marear a los francotiradores.",
  "¿Por qué los caníbales no comen payasos? Porque saben raro.",
  "¿Qué es rojo y malo para los dientes? Un ladrillo.",
  "¿Cuál es la diferencia entre un Ferrari y un montón de cadáveres? Que no tengo un Ferrari en mi garaje.",
  "¿Por qué el cementerio está tan concurrido? Porque la gente se muere por entrar.",
  "¿Qué le dice un mudo a un sordo? Nada, y el sordo no lo oye.",
  "¿Por qué los negros son tan buenos corriendo? Porque los que no lo eran están en la cárcel.",
  "¿Qué hace un niño con cáncer en un columpio? Molestar a los que sí van a llegar a adultos.",
  "¿Por qué el Titanic se hundió? Porque el capitán quería un poco de hielo para su whisky.",
  "¿Qué es lo último que pasa por la cabeza de un mosquito al chocar contra un parabrisas? Su trasero.",
  "¿Por qué los caníbales prefieren a los turistas? Porque vienen con su propia maleta de carne.",
  "¿Qué hace un epiléptico en una tina? Un batido.",
  "¿Por qué el espantapájaros ganó un premio? Porque era sobresaliente en su campo.",
  "¿Qué es lo más difícil de comer un vegetal? La silla de ruedas.",
  "¿Por qué los huérfanos no pueden jugar al escondite? Porque nadie los busca.",
  "¿Cuál es la diferencia entre un judío y un boy scout? Que el boy scout vuelve del campamento.",
  "¿Qué hace un niño sin piernas en el fútbol? El balón.",
  "¿Por qué los bebés muertos no lloran? Porque están muertos.",
  "¿Qué es lo más blanco de un negro? Su dueño.",
  "¿Por qué los ciegos no pueden hacer paracaidismo? Porque asustan al perro guía.",
  "¿Qué es negro y no puede girar? Un niño con un cuchillo en el ojo.",
  "¿Por qué los niños con síndrome de Down no pueden ser terroristas? Porque son especiales, no explosivos.",
  "¿Qué es lo más gracioso de un niño muerto? Que no crece.",
  "¿Por qué los caníbales no comen políticos? Porque tienen el corazón de piedra y no tienen entrañas.",
  "¿Qué hace un niño en una licuadora? Un batido de fresa.",
  "¿Por qué los esqueletos no salen a bailar? Porque no tienen cuerpo.",
  "¿Qué es lo peor de que te atropelle un camión de helados? Que el sabor que querías se desperdicie.",
  "¿Por qué los fantasmas no pueden tener hijos? Porque son estériles... y están muertos.",
  "¿Qué le dice un suicida a otro? ¡Nos vemos abajo!",
  "¿Por qué los cementerios tienen muros? Porque la gente se muere por entrar.",
  "¿Qué es lo más triste de un payaso muerto? Que no puede hacer globos con sus pulmones.",
  "¿Por qué los zombis no comen cerebros de políticos? Porque no encuentran ninguno.",
  "¿Qué hace un niño con una sola pierna en el parque? El ridículo."
];

export function Home() {
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const [dailyQuote, setDailyQuote] = useState({ text: '', emoji: '' });
  const [dailyJokes, setDailyJokes] = useState<{normal: string, dark: string[]}>({ normal: '', dark: [] });
  const [showAssessment, setShowAssessment] = useState(false);
  const [dailyWorkout, setDailyWorkout] = useState<any>(null);
  const [challengeVideo, setChallengeVideo] = useState<{ url: string, id: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [appSettings, setAppSettings] = useState({
    workouts_unlocked: false,
    nutrition_unlocked: false,
    technique_unlocked: false,
    challenge_unlocked: false,
  });
  const setUser = useStore((state) => state.setUser);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Fetch global settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setAppSettings(doc.data() as any);
      }
    });

    // Check if assessment is needed (every 3 months)
    const checkAssessment = () => {
      if (!user.assessment_completed) {
        setShowAssessment(true);
        return;
      }

      if (user.assessment_updated_at) {
        const lastUpdate = new Date(user.assessment_updated_at);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        if (lastUpdate < threeMonthsAgo) {
          setShowAssessment(true);
        }
      } else {
        // If completed but no date (legacy), set it now or show modal
        setShowAssessment(true);
      }
    };

    checkAssessment();
  }, [user, navigate]);

  const refreshJokesAndQuotes = () => {
    const randomDayIndex = Math.floor(Math.random() * 10000);
    setDailyQuote(QUOTES[randomDayIndex % QUOTES.length]);
    
    const normalJoke = normalJokes[randomDayIndex % normalJokes.length];
    const darkJoke1 = darkJokes[randomDayIndex % darkJokes.length];
    const darkJoke2 = darkJokes[(randomDayIndex + 1) % darkJokes.length];
    const darkJoke3 = darkJokes[(randomDayIndex + 2) % darkJokes.length];
    
    setDailyJokes({
      normal: normalJoke,
      dark: [darkJoke1, darkJoke2, darkJoke3]
    });
  };

  useEffect(() => {
    // Calculate index based on days since epoch, changing at 9 PM (21:00)
    const now = new Date();
    // Shift time back by 21 hours so that "midnight" for the calculation is 9 PM
    const shiftedTime = new Date(now.getTime() - 21 * 60 * 60 * 1000);
    const dayIndex = Math.floor(shiftedTime.getTime() / (1000 * 60 * 60 * 24));

    setDailyQuote(QUOTES[dayIndex % QUOTES.length]);
    
    // Select 1 normal joke and 3 dark jokes based on dayIndex
    const normalJoke = normalJokes[dayIndex % normalJokes.length];
    const darkJoke1 = darkJokes[dayIndex % darkJokes.length];
    const darkJoke2 = darkJokes[(dayIndex + 1) % darkJokes.length];
    const darkJoke3 = darkJokes[(dayIndex + 2) % darkJokes.length];
    
    setDailyJokes({
      normal: normalJoke,
      dark: [darkJoke1, darkJoke2, darkJoke3]
    });

    // Generate daily workout - only if relevant user data changed
    if (user) {
      const workout = generateLocalWorkout(
        user.age || 25,
        user.goal || 'Mantener peso',
        user.experience_level || 'principiante',
        [],
        ['Cuerpo Completo'],
        45
      );
      
      // Only set if different from current daily workout to avoid re-render loops
      setDailyWorkout((prev: any) => {
        if (JSON.stringify(prev) === JSON.stringify(workout)) return prev;
        return workout;
      });
    }
  }, [user?.age, user?.goal, user?.experience_level]);

  useEffect(() => {
    // Listen for the latest challenge video
    const q = query(collection(db, 'challenges'), orderBy('createdAt', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setChallengeVideo({ url: doc.data().url, id: doc.id });
      } else {
        setChallengeVideo(null);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!user) return null;

  const handleWaterClick = async (index: number) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const currentCount = user.water_intake?.date === today ? user.water_intake.count : 0;
    
    // If clicking the same glass that is the current max, decrease by 1 (unfill)
    // Otherwise, fill up to the clicked glass
    const newCount = (index + 1 === currentCount) ? index : index + 1;

    try {
      const userRef = doc(db, 'users', String(user.id));
      const waterData = { date: today, count: newCount };
      await updateDoc(userRef, { water_intake: waterData });
      setUser({ ...user, water_intake: waterData });
    } catch (error) {
      console.error('Error updating water intake:', error);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const waterCount = user?.water_intake?.date === today ? user.water_intake.count : 0;

  const isSpecialUser = user?.email === 'guantesparaencajar@gmail.com' || user?.email === 'hernandezkevin001998@gmail.com' || user?.role === 'admin';
  const isPersonalPlan = user?.plan === 'personal' && !isSpecialUser;
  
  const isWorkoutUnlocked = isSpecialUser || user?.plan === 'premium' || appSettings.workouts_unlocked;
  const isNutritionUnlocked = isSpecialUser || user?.plan === 'premium' || appSettings.nutrition_unlocked;
  const isTechniqueUnlocked = isSpecialUser || user?.plan === 'premium' || appSettings.technique_unlocked;
  const isChallengeUnlocked = isSpecialUser || user?.plan === 'premium' || appSettings.challenge_unlocked;

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024 * 1024) {
      showAlert('Error', 'El video es demasiado grande. Máximo 200MB.', 'error');
      return;
    }

    const storageRef = ref(storage, `challenges/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error('Error uploading video:', error);
        setUploadProgress(null);
        showAlert('Error', 'Error al subir el video.', 'error');
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        const oldChallenges = await getDocs(collection(db, 'challenges'));
        for (const doc of oldChallenges.docs) {
          await deleteDoc(doc.ref);
        }

        await addDoc(collection(db, 'challenges'), {
          url: downloadURL,
          createdAt: new Date().toISOString(),
          createdBy: user.id
        });
        
        setUploadProgress(null);
      }
    );
  };

  const handleDeleteChallenge = async () => {
    if (!challengeVideo) return;
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar Reto?',
      message: '¿Estás seguro de que quieres eliminar el reto del día?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'challenges', challengeVideo.id));
          setChallengeVideo(null);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error('Error deleting challenge:', error);
          showAlert('Error', 'No se pudo eliminar el reto.', 'error');
        }
      }
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans pb-24">
      <AssessmentModal isOpen={showAssessment} onClose={() => setShowAssessment(false)} />

      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
            <span className="text-3xl font-bold text-primary">{user.name.charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Hola, {user.name}</h1>
            {user.role === 'student' && (
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Nivel {user.license_level} • {user.goal}</p>
            )}
            {user.role !== 'student' && (
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 capitalize mt-1">{user.role}</p>
            )}
          </div>
        </div>
        {user.role === 'student' && (
          <div className="flex gap-3">
            <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm" title="Experiencia">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{user.xp || 0}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{user.lives}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm" title="Días en el Ring">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{user.streak}</span>
            </div>
          </div>
        )}
      </header>

      {/* Reto del Día Section */}
      <section className={`mb-16 relative ${!isChallengeUnlocked ? 'opacity-60 grayscale' : ''}`}>
        {!isChallengeUnlocked && (
          <div className="absolute inset-0 bg-slate-950/20 z-30 flex items-center justify-center rounded-[2.5rem] backdrop-blur-[2px]">
            <Lock className="w-12 h-12 text-white/50" />
          </div>
        )}
        <div className="glass-card p-8 rounded-[2.5rem] relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                <Trophy className="w-8 h-8 text-orange-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Reto del Día</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">¡Supera tus límites hoy!</p>
              </div>
            </div>
            {isSpecialUser && (
              <div className="flex gap-2">
                <label className="cursor-pointer p-2.5 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors border border-primary/20">
                  <Upload className="w-5 h-5" />
                  <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                </label>
                {challengeVideo && (
                  <button 
                    onClick={handleDeleteChallenge}
                    className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors border border-red-500/20"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {uploadProgress !== null && (
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-primary font-medium">Subiendo video...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div 
                  className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {challengeVideo ? (
            <div className="aspect-video rounded-lg overflow-hidden bg-black relative">
              <video 
                src={challengeVideo.url} 
                controls 
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="aspect-video rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center bg-slate-900/30 text-slate-500">
              <Video className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-xs">No hay reto disponible para hoy</p>
            </div>
          )}
        </div>
      </section>

      {user.role === 'student' && (
        <section className="mb-16">
          <div className="glass-card p-8 rounded-[2.5rem]">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary mb-3">Progreso de Licencia</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Nivel {user.license_level}</p>
              </div>
              <div className="p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                <Trophy className="w-9 h-9 text-yellow-500" />
              </div>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800/50 h-5 rounded-full overflow-hidden mb-4 border border-slate-200 dark:border-slate-700/50">
              <div className="bg-primary h-full shadow-[0_0_20px_rgba(0,119,255,0.5)] transition-all duration-1000" style={{ width: '35%' }}></div>
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">35% para el siguiente nivel</p>
          </div>
        </section>
      )}

      <h2 className="text-2xl font-bold mb-8 flex items-center gap-4 text-slate-900 dark:text-white tracking-tight">
        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
          <Droplets className="w-7 h-7 text-blue-500 animate-pulse" />
        </div>
        Hidratación Diaria
      </h2>
      <div className="glass-card p-10 rounded-[3rem] mb-16 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 transition-transform group-hover:scale-110"></div>
        
        <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
          {/* Character Visual */}
          <div className="relative">
            <motion.div 
              animate={{ 
                y: [0, -10, 0],
                scale: waterCount >= 7 ? [1, 1.08, 1] : 1
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-40 h-40 bg-blue-500/10 rounded-[3rem] flex items-center justify-center border border-blue-500/20 relative overflow-hidden shadow-inner"
            >
              <span className="text-7xl z-10">
                {waterCount === 0 ? "😫" : 
                 waterCount < 3 ? "😐" :
                 waterCount < 5 ? "😊" :
                 waterCount < 7 ? "😎" :
                 "🤩"}
              </span>
              
              {/* Water level inside character circle */}
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${(waterCount / 7) * 100}%` }}
                className="absolute bottom-0 left-0 right-0 bg-blue-500/25 transition-all duration-1000 ease-out"
              />
            </motion.div>
            
            {waterCount >= 7 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                className="absolute -top-4 -right-4 bg-yellow-500 text-white p-3 rounded-2xl shadow-2xl shadow-yellow-500/40 border-2 border-white dark:border-slate-900"
              >
                <Trophy className="w-6 h-6" />
              </motion.div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="mb-10">
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 leading-tight tracking-tight">
                {waterCount === 0 ? "¡Tengo muchísima sed! 🌵" : 
                 waterCount < 3 ? "Un poco mejor, ¡más agua! 💧" :
                 waterCount < 5 ? "¡Me siento hidratado! ✨" :
                 waterCount < 7 ? "¡Casi al 100%! 🚀" :
                 "¡Nivel de hidratación ÓPTIMO! 🏆"}
              </h3>
              <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
                Has bebido <span className="text-blue-500 font-bold">{waterCount}</span> de <span className="text-slate-900 dark:text-white font-bold">7</span> vasos hoy.
              </p>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-5">
              {[...Array(7)].map((_, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.15, y: -6 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleWaterClick(i)}
                  className={`relative w-14 h-20 rounded-b-[1.5rem] border-2 transition-all duration-500 ${
                    i < waterCount 
                      ? 'bg-blue-500/20 border-blue-400 shadow-xl shadow-blue-500/15' 
                      : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                  }`}
                >
                  {/* Glass reflection */}
                  <div className="absolute top-1.5 left-1.5 w-1.5 h-6 bg-white/20 rounded-full" />
                  
                  {/* Water filling animation */}
                  <AnimatePresence>
                    {i < waterCount && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: '100%', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500/40 to-blue-300/30 rounded-b-[14px]"
                      />
                    )}
                  </AnimatePresence>

                  {/* Bubbles animation when full */}
                  {i < waterCount && (
                    <motion.div 
                      animate={{ y: [-5, -20], opacity: [0, 1, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/30 rounded-full"
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-8 flex items-center gap-4 text-slate-900 dark:text-white tracking-tight">
        <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
          <Zap className="w-7 h-7 text-yellow-500 animate-pulse" />
        </div>
        Tu Entrenamiento de Hoy
      </h2>

      {dailyWorkout && (
        <div className={`glass-card p-10 rounded-[3rem] mb-16 relative overflow-hidden group ${!isWorkoutUnlocked ? 'opacity-60 grayscale' : ''}`}>
          {!isWorkoutUnlocked && (
            <div className="absolute inset-0 bg-slate-950/20 z-20 flex items-center justify-center backdrop-blur-[2px]">
              <Lock className="w-14 h-14 text-white/50" />
            </div>
          )}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32"></div>
          <div className="flex justify-between items-center mb-10 relative z-10">
            <div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">{dailyWorkout.workout_name}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.25em] mt-4">Rutina del día • {dailyWorkout.exercises.length} Ejercicios</p>
            </div>
            <button 
              onClick={() => isWorkoutUnlocked && navigate('/workouts')}
              className={`p-4 bg-primary/10 text-primary rounded-2xl hover:bg-primary/20 transition-all border border-primary/20 shadow-lg shadow-primary/5 ${!isWorkoutUnlocked ? 'cursor-not-allowed' : ''}`}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>
          
          <div className="flex gap-6 overflow-x-auto pb-6 hide-scrollbar relative z-10">
            {dailyWorkout.exercises.map((ex: any, idx: number) => (
              <div key={idx} className="flex-shrink-0 w-64 bg-white/40 dark:bg-slate-800/40 p-5 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 hover:border-primary/30 transition-all duration-300 group/item">
                <div className="aspect-video bg-slate-200 dark:bg-slate-800 rounded-2xl mb-5 overflow-hidden shadow-inner relative">
                  <img 
                    src={`https://picsum.photos/seed/${ex.name}/400/300`} 
                    alt={ex.name} 
                    className="w-full h-full object-cover opacity-90 group-hover/item:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1 tracking-tight">{ex.name}</h4>
                <p className="text-xs text-primary font-black uppercase tracking-widest mt-3">{ex.sets} series x {ex.reps}</p>
              </div>
            ))}
          </div>
          
          <button 
            onClick={() => isWorkoutUnlocked && navigate('/workouts')}
            disabled={!isWorkoutUnlocked}
            className={`w-full mt-10 bg-primary text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 text-lg ${!isWorkoutUnlocked ? 'cursor-not-allowed' : ''}`}
          >
            {isWorkoutUnlocked ? <Play className="w-7 h-7 fill-current" /> : <Lock className="w-7 h-7" />}
            {isWorkoutUnlocked ? 'Comenzar Entrenamiento' : 'Sección Bloqueada'}
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <button 
          onClick={() => isTechniqueUnlocked && navigate('/saberes')}
          className={`relative overflow-hidden flex flex-col gap-6 glass-card p-10 rounded-[2.5rem] transition-all text-left group min-h-[240px] ${!isTechniqueUnlocked ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5'}`}
        >
          {!isTechniqueUnlocked && (
            <div className="absolute inset-0 bg-slate-950/20 z-20 flex items-center justify-center backdrop-blur-[2px]">
              <Lock className="w-12 h-12 text-white/50" />
            </div>
          )}
          <div className="flex items-center justify-between relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
              <Target className="w-10 h-10" />
            </div>
            <span className="bg-primary/10 text-primary text-[11px] font-black px-5 py-2.5 rounded-xl uppercase tracking-[0.2em] border border-primary/20">Técnica</span>
          </div>
          <div className="relative z-10">
            <h3 className="font-black text-3xl text-slate-900 dark:text-white uppercase tracking-tight leading-none group-hover:text-primary transition-colors">Aprender Boxeo</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-4 font-medium leading-relaxed">{isTechniqueUnlocked ? 'Domina los fundamentos del boxeo.' : 'Sección Bloqueada'}</p>
          </div>
        </button>

        <button 
          onClick={() => isWorkoutUnlocked && navigate('/workouts')}
          className={`relative overflow-hidden flex flex-col gap-6 glass-card p-10 rounded-[2.5rem] transition-all text-left group min-h-[240px] ${!isWorkoutUnlocked ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5'}`}
        >
          {!isWorkoutUnlocked && (
            <div className="absolute inset-0 bg-slate-950/20 z-20 flex items-center justify-center backdrop-blur-[2px]">
              <Lock className="w-12 h-12 text-white/50" />
            </div>
          )}
          <div className="flex items-center justify-between relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
              <Dumbbell className="w-10 h-10" />
            </div>
            <span className="bg-primary/10 text-primary text-[11px] font-black px-5 py-2.5 rounded-xl uppercase tracking-[0.2em] border border-primary/20">Entrenamiento</span>
          </div>
          <div className="relative z-10">
            <h3 className="font-black text-3xl text-slate-900 dark:text-white group-hover:text-primary transition-colors uppercase tracking-tight leading-none">Rutinas Pro</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-4 font-medium leading-relaxed">{isWorkoutUnlocked ? 'Ejercicios para fortalecer todo el cuerpo.' : 'Sección Bloqueada'}</p>
          </div>
        </button>

        <button onClick={() => navigate('/calendar')} className="relative overflow-hidden flex flex-col gap-6 glass-card p-10 rounded-[2.5rem] hover:border-purple-500/40 transition-all text-left group min-h-[240px] hover:shadow-xl hover:shadow-purple-500/5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full -mr-32 -mt-32 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
              <Calendar className="w-10 h-10" />
            </div>
            <span className="bg-purple-500/10 text-purple-500 text-[11px] font-black px-5 py-2.5 rounded-xl uppercase tracking-[0.2em] border border-purple-500/20">Presencial</span>
          </div>
          <div className="relative z-10">
            <h3 className="font-black text-3xl text-slate-900 dark:text-white group-hover:text-purple-500 transition-colors uppercase tracking-tight leading-none">Reservar Clase</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-4 font-medium leading-relaxed">Agenda tu sesión con el profesor.</p>
          </div>
        </button>

        <button 
          onClick={() => isNutritionUnlocked && navigate('/meals')}
          className={`relative overflow-hidden flex flex-col gap-6 glass-card p-10 rounded-[2.5rem] transition-all text-left group min-h-[240px] ${!isNutritionUnlocked ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-orange-500/40 hover:shadow-xl hover:shadow-orange-500/5'}`}
        >
          {!isNutritionUnlocked && (
            <div className="absolute inset-0 bg-slate-950/20 z-20 flex items-center justify-center backdrop-blur-[2px]">
              <Lock className="w-12 h-12 text-white/50" />
            </div>
          )}
          <div className="flex items-center justify-between relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
              <Utensils className="w-10 h-10" />
            </div>
            <span className="bg-orange-500/10 text-orange-500 text-[11px] font-black px-5 py-2.5 rounded-xl uppercase tracking-[0.2em] border border-orange-500/20">Nutrición</span>
          </div>
          <div className="relative z-10">
            <h3 className="font-black text-3xl text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors uppercase tracking-tight leading-none">Alimentación</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-4 font-medium leading-relaxed">{isNutritionUnlocked ? 'Recetas y planes de alimentación.' : 'Sección Bloqueada'}</p>
          </div>
        </button>

        <button onClick={() => navigate('/plans')} className="relative overflow-hidden flex flex-col gap-6 glass-card p-10 rounded-[2.5rem] hover:border-blue-400/40 transition-all text-left group md:col-span-2 shadow-xl shadow-black/5 hover:shadow-blue-400/5">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/5 rounded-full -mr-40 -mt-40 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-18 h-18 rounded-2xl bg-blue-400/10 flex items-center justify-center text-blue-400 border border-blue-400/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
              <Star className="w-9 h-9" />
            </div>
            <span className="bg-blue-400/10 text-blue-400 text-[11px] font-black px-5 py-2.5 rounded-xl uppercase tracking-[0.2em] border border-blue-400/20">Membresía</span>
          </div>
          <div className="relative z-10">
            <h3 className="font-black text-3xl text-slate-900 dark:text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight leading-none">Planes y Precios</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-4 font-medium leading-relaxed">Conoce nuestras tarifas y reserva tu clase.</p>
          </div>
        </button>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex justify-end mb-[-1.5rem] relative z-20">
          <button 
            onClick={refreshJokesAndQuotes}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 px-4 py-2 rounded-2xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 shadow-lg"
            title="Mostrar otra frase y chistes"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Actualizar</span>
          </button>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-10 rounded-[2.5rem] border border-slate-800 relative overflow-hidden shadow-2xl">
          <Quote className="absolute top-8 right-8 w-20 h-20 text-white/5 rotate-180" />
          <h3 className="text-primary font-black text-[11px] uppercase tracking-[0.25em] mb-8 flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-2xl border border-primary/20">{dailyQuote.emoji}</div>
            Frase del Día
          </h3>
          <p className="text-2xl font-medium italic text-slate-100 relative z-10 leading-relaxed tracking-tight">
            "{dailyQuote.text}"
          </p>
        </div>

        <div className="glass-card p-10 rounded-[2.5rem] mb-12">
          <h3 className="flex items-center gap-4 font-black text-2xl mb-10 text-slate-900 dark:text-white uppercase tracking-tight">
            <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
              <Smile className="w-7 h-7 text-yellow-500" />
            </div>
            Rincón del Humor
          </h3>
          
          <div className="space-y-8">
            <div className="bg-white/40 dark:bg-slate-800/40 p-8 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
              <span className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.25em] mb-4 block">Chiste Normal</span>
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{dailyJokes.normal}</p>
            </div>
            
            <div className="bg-white/40 dark:bg-slate-800/40 p-8 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
              <span className="text-[11px] font-black text-red-500 uppercase tracking-[0.25em] mb-4 block">Humor Negro</span>
              <ul className="space-y-6">
                {dailyJokes.dark.map((joke, idx) => (
                  <li key={idx} className="text-lg text-slate-600 dark:text-slate-300 border-l-4 border-red-500/30 pl-6 leading-relaxed font-medium">
                    {joke}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
      {/* Alert Modal */}
      <Modal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
      >
        <div className="flex flex-col items-center text-center p-4">
          {alertModal.type === 'success' && <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />}
          {alertModal.type === 'error' && <AlertCircle className="w-16 h-16 text-red-500 mb-4" />}
          {alertModal.type === 'info' && <Info className="w-16 h-16 text-blue-500 mb-4" />}
          <p className="text-slate-300">{alertModal.message}</p>
          <button
            onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
            className="mt-6 w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-700 transition-colors"
          >
            Entendido
          </button>
        </div>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.title}
      >
        <div className="flex flex-col items-center text-center p-4">
          <AlertCircle className="w-16 h-16 text-orange-500 mb-4" />
          <p className="text-slate-300 mb-6">{confirmModal.message}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
              className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmModal.onConfirm}
              className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>

      {/* Admin Global Settings Toggle */}
      {user?.role === 'admin' && (
        <div className="mt-12 p-6 bg-slate-800/50 rounded-3xl border border-slate-700/50 mb-8">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Panel de Control de Secciones (Admin)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setDoc(doc(db, 'settings', 'global'), { workouts_unlocked: !appSettings.workouts_unlocked }, { merge: true })}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${appSettings.workouts_unlocked ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-900/50 border-slate-700 text-slate-400'}`}
            >
              <Dumbbell className="w-5 h-5" />
              <span className="text-xs font-bold uppercase">{appSettings.workouts_unlocked ? 'Entrenamientos: ABIERTOS' : 'Entrenamientos: CERRADOS'}</span>
            </button>
            <button 
              onClick={() => setDoc(doc(db, 'settings', 'global'), { nutrition_unlocked: !appSettings.nutrition_unlocked }, { merge: true })}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${appSettings.nutrition_unlocked ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-900/50 border-slate-700 text-slate-400'}`}
            >
              <Utensils className="w-5 h-5" />
              <span className="text-xs font-bold uppercase">{appSettings.nutrition_unlocked ? 'Nutrición: ABIERTA' : 'Nutrición: CERRADA'}</span>
            </button>
            <button 
              onClick={() => setDoc(doc(db, 'settings', 'global'), { technique_unlocked: !appSettings.technique_unlocked }, { merge: true })}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${appSettings.technique_unlocked ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-900/50 border-slate-700 text-slate-400'}`}
            >
              <Target className="w-5 h-5" />
              <span className="text-xs font-bold uppercase">{appSettings.technique_unlocked ? 'Técnica: ABIERTA' : 'Técnica: CERRADA'}</span>
            </button>
            <button 
              onClick={() => setDoc(doc(db, 'settings', 'global'), { challenge_unlocked: !appSettings.challenge_unlocked }, { merge: true })}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${appSettings.challenge_unlocked ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-900/50 border-slate-700 text-slate-400'}`}
            >
              <Trophy className="w-5 h-5" />
              <span className="text-xs font-bold uppercase">{appSettings.challenge_unlocked ? 'Reto: ABIERTO' : 'Reto: CERRADO'}</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 text-center uppercase tracking-widest">Estos cambios afectan a todos los usuarios que no son Premium.</p>
        </div>
      )}
    </div>
  );
}
