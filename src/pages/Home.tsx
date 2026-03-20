import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Heart, Flame, Trophy, Play, Dumbbell, Calendar, Utensils, Quote, Smile, Zap, Target, Activity, Star, AlertCircle, Droplets, RefreshCw, ChevronRight, Video, Upload, Trash2, Lock } from 'lucide-react';
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

    // Generate daily workout
    if (user) {
      const workout = generateLocalWorkout(
        user.age || 25,
        user.goal || 'Mantener peso',
        user.experience_level || 'principiante',
        [],
        ['Cuerpo Completo'],
        45
      );
      setDailyWorkout(workout);
    }
  }, [user]);

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

  const isSpecialUser = user?.email === 'guantesparaencajar@gmail.com' || user?.role === 'admin';
  const isPersonalPlan = user?.plan === 'personal' && !isSpecialUser;
  
  const isWorkoutUnlocked = isSpecialUser || user?.plan === 'premium' || appSettings.workouts_unlocked;
  const isNutritionUnlocked = isSpecialUser || user?.plan === 'premium' || appSettings.nutrition_unlocked;
  const isTechniqueUnlocked = isSpecialUser || user?.plan === 'premium' || appSettings.technique_unlocked;
  const isChallengeUnlocked = isSpecialUser || user?.plan === 'premium' || appSettings.challenge_unlocked;

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024 * 1024) {
      alert('El video es demasiado grande. Máximo 200MB.');
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
        alert('Error al subir el video.');
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
    if (!window.confirm('¿Estás seguro de que quieres eliminar el reto del día?')) return;

    try {
      await deleteDoc(doc(db, 'challenges', challengeVideo.id));
      setChallengeVideo(null);
    } catch (error) {
      console.error('Error deleting challenge:', error);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display p-4 pb-24">
      <AssessmentModal isOpen={showAssessment} onClose={() => setShowAssessment(false)} />

      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary">
            <span className="text-xl font-bold text-primary">{user.name.charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Hola, {user.name}</h1>
            {user.role === 'student' && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nivel {user.license_level} • {user.goal}</p>
            )}
            {user.role !== 'student' && (
              <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{user.role}</p>
            )}
          </div>
        </div>
        {user.role === 'student' && (
          <div className="flex gap-3">
            <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20" title="Experiencia">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-sm font-bold text-primary">{user.xp || 0}</span>
            </div>
            <div className="flex items-center gap-1 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              <span className="text-sm font-bold text-red-500">{user.lives}</span>
            </div>
            <div className="flex items-center gap-1 bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/20" title="Días en el Ring">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span className="text-sm font-bold text-orange-500">{user.streak}</span>
            </div>
          </div>
        )}
      </header>

      {/* Reto del Día Section */}
      <section className={`mb-8 relative ${!isChallengeUnlocked ? 'opacity-60 grayscale' : ''}`}>
        {!isChallengeUnlocked && (
          <div className="absolute inset-0 bg-slate-950/20 z-30 flex items-center justify-center rounded-xl">
            <Lock className="w-10 h-10 text-primary/50" />
          </div>
        )}
        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Trophy className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Reto del Día</h2>
                <p className="text-xs text-slate-400">¡Supera tus límites hoy!</p>
              </div>
            </div>
            {isSpecialUser && (
              <div className="flex gap-2">
                <label className="cursor-pointer p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                  <Upload className="w-5 h-5" />
                  <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                </label>
                {challengeVideo && (
                  <button 
                    onClick={handleDeleteChallenge}
                    className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
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
        <section className="mb-8">
          <div className="bg-surface p-5 rounded-xl border border-border-mute shadow-lg shadow-primary/5 bg-slate-800/50">
            <div className="flex justify-between items-end mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Progreso de Licencia</p>
                <p className="text-xl font-bold">Nivel {user.license_level}</p>
              </div>
              <Trophy className="w-8 h-8 text-yellow-500" />
            </div>
            <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden mb-2">
              <div className="bg-primary h-full shadow-[0_0_12px_rgba(0,119,255,0.6)]" style={{ width: '35%' }}></div>
            </div>
            <p className="text-xs text-slate-400">35% para el siguiente nivel</p>
          </div>
        </section>
      )}

      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Droplets className="w-5 h-5 text-blue-400 animate-pulse" />
        Hidratación Diaria
      </h2>
      <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 mb-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
        
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          {/* Character Visual */}
          <div className="relative">
            <motion.div 
              animate={{ 
                y: [0, -5, 0],
                scale: waterCount >= 7 ? [1, 1.1, 1] : 1
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center border-2 border-blue-500/30 relative"
            >
              <span className="text-5xl">
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
                className="absolute bottom-0 left-0 right-0 bg-blue-500/20 rounded-b-full transition-all duration-1000"
              />
            </motion.div>
            
            {waterCount >= 7 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-2 -right-2 bg-yellow-500 text-white p-1.5 rounded-full shadow-lg"
              >
                <Trophy className="w-4 h-4" />
              </motion.div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white mb-1">
                {waterCount === 0 ? "¡Tengo muchísima sed! 🌵" : 
                 waterCount < 3 ? "Un poco mejor, ¡más agua! 💧" :
                 waterCount < 5 ? "¡Me siento hidratado! ✨" :
                 waterCount < 7 ? "¡Casi al 100%! 🚀" :
                 "¡Nivel de hidratación ÓPTIMO! 🏆"}
              </h3>
              <p className="text-sm text-slate-400">
                Has bebido <span className="text-blue-400 font-bold">{waterCount}</span> de <span className="text-white font-bold">7</span> vasos hoy.
              </p>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              {[...Array(7)].map((_, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleWaterClick(i)}
                  className={`relative w-10 h-14 rounded-b-xl border-2 transition-all duration-300 ${
                    i < waterCount 
                      ? 'bg-blue-500/40 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {/* Glass reflection */}
                  <div className="absolute top-1 left-1 w-1 h-4 bg-white/10 rounded-full" />
                  
                  {/* Water filling animation */}
                  <AnimatePresence>
                    {i < waterCount && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: '100%', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-600/60 to-blue-400/40 rounded-b-[10px]"
                      />
                    )}
                  </AnimatePresence>

                  {/* Bubbles animation when full */}
                  {i < waterCount && (
                    <motion.div 
                      animate={{ y: [-5, -15], opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-white/40 rounded-full"
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500 animate-pulse" />
        Tu Entrenamiento de Hoy
      </h2>

      {dailyWorkout && (
        <div className={`bg-slate-800/80 p-5 rounded-2xl border border-primary/30 mb-8 shadow-xl relative overflow-hidden group ${!isWorkoutUnlocked ? 'opacity-60 grayscale' : ''}`}>
          {!isWorkoutUnlocked && (
            <div className="absolute inset-0 bg-slate-950/20 z-20 flex items-center justify-center">
              <Lock className="w-10 h-10 text-primary/50" />
            </div>
          )}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
          <div className="flex justify-between items-center mb-4 relative z-10">
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{dailyWorkout.workout_name}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Rutina del día • {dailyWorkout.exercises.length} Ejercicios</p>
            </div>
            <button 
              onClick={() => isWorkoutUnlocked && navigate('/workouts')}
              className={`p-2 bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors ${!isWorkoutUnlocked ? 'cursor-not-allowed' : ''}`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide relative z-10">
            {dailyWorkout.exercises.map((ex: any, idx: number) => (
              <div key={idx} className="flex-shrink-0 w-48 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                <div className="aspect-video bg-slate-800 rounded-lg mb-2 overflow-hidden">
                  <img 
                    src={`https://picsum.photos/seed/${ex.name}/300/200`} 
                    alt={ex.name} 
                    className="w-full h-full object-cover opacity-60"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h4 className="text-sm font-bold text-white line-clamp-1">{ex.name}</h4>
                <p className="text-[10px] text-primary font-bold uppercase mt-1">{ex.sets} series x {ex.reps}</p>
              </div>
            ))}
          </div>
          
          <button 
            onClick={() => isWorkoutUnlocked && navigate('/workouts')}
            disabled={!isWorkoutUnlocked}
            className={`w-full mt-4 bg-primary text-white font-black py-3 rounded-xl uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${!isWorkoutUnlocked ? 'cursor-not-allowed' : ''}`}
          >
            {isWorkoutUnlocked ? <Play className="w-5 h-5 fill-current" /> : <Lock className="w-5 h-5" />}
            {isWorkoutUnlocked ? 'Comenzar Entrenamiento' : 'Sección Bloqueada'}
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button 
          onClick={() => isTechniqueUnlocked && navigate('/boxing')}
          className={`relative overflow-hidden flex flex-col gap-2 bg-slate-800/80 p-6 rounded-2xl border border-slate-700 transition-all text-left group min-h-[160px] shadow-lg ${!isTechniqueUnlocked ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-primary/50'}`}
        >
          {!isTechniqueUnlocked && (
            <div className="absolute inset-0 bg-slate-950/20 z-20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary/50" />
            </div>
          )}
          <div className="flex items-center justify-between relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
              <Target className="w-7 h-7" />
            </div>
            <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-primary/30">Técnica</span>
          </div>
          <div className="relative z-10 mt-3">
            <h3 className="font-black text-xl text-white uppercase tracking-tight">Aprender Boxeo</h3>
            <p className="text-sm text-slate-400 mt-1 font-medium">{isTechniqueUnlocked ? 'Domina los fundamentos del boxeo.' : 'Sección Bloqueada'}</p>
          </div>
        </button>

        <button 
          onClick={() => isWorkoutUnlocked && navigate('/workouts')}
          className={`relative overflow-hidden flex flex-col gap-2 bg-slate-800/80 p-6 rounded-2xl border border-slate-700 transition-all text-left group min-h-[160px] shadow-lg ${!isWorkoutUnlocked ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-primary/50'}`}
        >
          {!isWorkoutUnlocked && (
            <div className="absolute inset-0 bg-slate-950/20 z-20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary/50" />
            </div>
          )}
          <div className="flex items-center justify-between relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <Dumbbell className="w-7 h-7" />
            </div>
            <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-primary/30">Entrenamiento</span>
          </div>
          <div className="relative z-10 mt-3">
            <h3 className="font-black text-xl text-white group-hover:text-primary transition-colors uppercase tracking-tight">Rutina de cuerpo completo</h3>
            <p className="text-sm text-slate-400 mt-1 font-medium">{isWorkoutUnlocked ? 'Ejercicios para fortalecer todo el cuerpo.' : 'Sección Bloqueada'}</p>
          </div>
        </button>

        <button onClick={() => navigate('/calendar')} className="relative overflow-hidden flex flex-col gap-2 bg-slate-800/80 p-6 rounded-2xl border border-slate-700 hover:border-purple-500/50 transition-all text-left group min-h-[160px] shadow-lg">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-500 shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
              <Calendar className="w-7 h-7" />
            </div>
            <span className="bg-purple-500/20 text-purple-500 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-purple-500/30">Presencial</span>
          </div>
          <div className="relative z-10 mt-3">
            <h3 className="font-black text-xl text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight">Reservar Clase</h3>
            <p className="text-sm text-slate-400 mt-1 font-medium">Agenda tu sesión con el profesor.</p>
          </div>
        </button>

        <button 
          onClick={() => isNutritionUnlocked && navigate('/meals')}
          className={`relative overflow-hidden flex flex-col gap-2 bg-slate-800/80 p-6 rounded-2xl border border-slate-700 transition-all text-left group min-h-[160px] shadow-lg ${!isNutritionUnlocked ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-orange-500/50'}`}
        >
          {!isNutritionUnlocked && (
            <div className="absolute inset-0 bg-slate-950/20 z-20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-orange-500/50" />
            </div>
          )}
          <div className="flex items-center justify-between relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-500">
              <Utensils className="w-7 h-7" />
            </div>
            <span className="bg-orange-500/20 text-orange-500 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-orange-500/30">Nutrición</span>
          </div>
          <div className="relative z-10 mt-3">
            <h3 className="font-black text-xl text-white uppercase tracking-tight">Comidas Saludables</h3>
            <p className="text-sm text-slate-400 mt-1 font-medium">{isNutritionUnlocked ? 'Recetas y planes de alimentación.' : 'Sección Bloqueada'}</p>
          </div>
        </button>

        <button onClick={() => navigate('/plans')} className="relative overflow-hidden flex flex-col gap-2 bg-slate-800/80 p-5 rounded-2xl border border-slate-700 hover:border-blue-400/50 transition-all text-left group md:col-span-2">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-12 h-12 rounded-xl bg-blue-400/20 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-400/20">
              <Star className="w-6 h-6" />
            </div>
            <span className="bg-blue-400/20 text-blue-400 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Premium</span>
          </div>
          <div className="relative z-10 mt-2">
            <h3 className="font-bold text-lg text-white">Planes y Precios</h3>
            <p className="text-sm text-slate-400 mt-1">Conoce nuestras tarifas y reserva tu clase.</p>
          </div>
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-end mb-[-1rem] relative z-20">
          <button 
            onClick={refreshJokesAndQuotes}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-slate-700 shadow-lg"
            title="Mostrar otra frase y chistes"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 relative overflow-hidden shadow-xl">
          <Quote className="absolute top-4 right-4 w-12 h-12 text-slate-700/50 rotate-180" />
          <h3 className="text-primary font-bold text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="text-xl">{dailyQuote.emoji}</span> Frase del Día
          </h3>
          <p className="text-lg font-medium italic text-slate-200 relative z-10 leading-relaxed">
            "{dailyQuote.text}"
          </p>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
          <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-white">
            <Smile className="w-5 h-5 text-yellow-500" />
            Rincón del Humor
          </h3>
          
          <div className="space-y-4">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1 block">Chiste Normal</span>
              <p className="text-sm text-slate-300">{dailyJokes.normal}</p>
            </div>
            
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1 block">Humor Negro</span>
              <ul className="space-y-3">
                {dailyJokes.dark.map((joke, idx) => (
                  <li key={idx} className="text-sm text-slate-300 border-l-2 border-red-500/30 pl-3">
                    {joke}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
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
