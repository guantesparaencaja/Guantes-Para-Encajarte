import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Dumbbell, Play, Clock, ArrowLeft, Upload, Home, Building2, X, Plus, Trash2, Video, Search, CheckSquare, Square, Calendar, MapPin, RefreshCw, ChevronRight, ChevronDown, Info, Settings, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getYouTubeEmbedUrl } from '../services/geminiService';

interface Category {
  id: string;
  name: string;
}

interface WorkoutVideo {
  id: string;
  category_id: string;
  title: string;
  description: string;
  instructions?: string;
  common_errors?: string;
  video_url?: string;
  difficulty?: string;
  equipment?: string;
}

interface CustomRoutine {
  id: string;
  user_id: string;
  name: string;
  exercises: string[];
  createdAt: string;
}

export function Workouts() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [videos, setVideos] = useState<WorkoutVideo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [editingVideo, setEditingVideo] = useState<WorkoutVideo | null>(null);
  const [newVideo, setNewVideo] = useState({ title: '', description: '', instructions: '', common_errors: '', video_url: '', difficulty: 'principiante', equipment: 'Sin equipo' });
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, title: string, message: string, confirmText?: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [selectedVideoDetails, setSelectedVideoDetails] = useState<WorkoutVideo | null>(null);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [userRoutines, setUserRoutines] = useState<CustomRoutine[]>([]);
  const [newRoutineName, setNewRoutineName] = useState('');

  const user = useStore((state) => state.user);
  const hasWarmedUp = useStore((state) => state.hasWarmedUp);
  const setHasWarmedUp = useStore((state) => state.setHasWarmedUp);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fullScreenVideoUrl, setFullScreenVideoUrl] = useState<string | null>(null);

  const handleVideoClick = (video: WorkoutVideo) => {
    const category = categories.find(c => c.id === video.category_id);
    const isWarmup = category?.name.toLowerCase().includes('calentamiento') || category?.name.toLowerCase().includes('movilidad');
    
    if (isWarmup) {
      setHasWarmedUp(true);
      setSelectedVideoDetails(video);
    } else if (!hasWarmedUp) {
      setConfirmDialog({
        isOpen: true,
        title: '¡Espera! Calentamiento Obligatorio',
        message: 'Debes completar una secuencia de movilidad o calentamiento antes de iniciar tu rutina para evitar lesiones.',
        confirmText: 'Ir a Calentamiento',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          // Find a warmup category
          const warmupCategory = categories.find(c => c.name.toLowerCase().includes('calentamiento') || c.name.toLowerCase().includes('movilidad'));
          if (warmupCategory) {
            setSelectedCategory(warmupCategory.id);
          }
        }
      });
    } else {
      setSelectedVideoDetails(video);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchVideos();
    if (user) fetchUserRoutines();
  }, [user]);

  const fetchUserRoutines = async () => {
    try {
      const q = query(collection(db, 'custom_routines'), where('user_id', '==', String(user?.id)));
      const querySnapshot = await getDocs(q);
      const routinesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomRoutine));
      setUserRoutines(routinesData);
    } catch (error) {
      console.error("Error fetching routines:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'workout_categories'));
      const catsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(catsData);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchVideos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'workout_videos'));
      const videosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutVideo));
      setVideos(videosData);
    } catch (error) {
      console.error("Error fetching videos:", error);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'workout_categories'), { name: newCategoryName });
      setCategories([...categories, { id: docRef.id, name: newCategoryName }]);
      setNewCategoryName('');
      setShowAddCategory(false);
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Categoría',
      message: '¿Estás seguro de que deseas eliminar esta categoría? Se eliminarán todos los videos asociados.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'workout_categories', id));
          setCategories(categories.filter(c => c.id !== id));
          
          // Delete associated videos
          const videosToDelete = videos.filter(v => v.category_id === id);
          for (const video of videosToDelete) {
            await deleteDoc(doc(db, 'workout_videos', video.id));
          }
          setVideos(videos.filter(v => v.category_id !== id));
          
          if (selectedCategory === id) setSelectedCategory(null);
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        } catch (error) {
          console.error("Error deleting category:", error);
        }
      }
    });
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const storageRef = ref(storage, `workouts/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      }, 
      (error) => {
        console.error("Error uploading video:", error);
        setUploadProgress(null);
        alert('Error al subir el video');
      }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setNewVideo({ ...newVideo, video_url: downloadURL });
        setUploadProgress(null);
      }
    );
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !newVideo.title) return;
    try {
      const videoData = { ...newVideo, category_id: selectedCategory };
      if (editingVideo) {
        await updateDoc(doc(db, 'workout_videos', editingVideo.id), videoData);
        setVideos(videos.map(v => v.id === editingVideo.id ? { id: editingVideo.id, ...videoData } : v));
        setEditingVideo(null);
      } else {
        const docRef = await addDoc(collection(db, 'workout_videos'), videoData);
        setVideos([...videos, { id: docRef.id, ...videoData }]);
      }
      setNewVideo({ title: '', description: '', instructions: '', common_errors: '', video_url: '', difficulty: 'principiante' });
      setShowAddVideo(false);
    } catch (error) {
      console.error("Error saving video:", error);
    }
  };

  const startEditVideo = (video: WorkoutVideo) => {
    setEditingVideo(video);
    setNewVideo({
      title: video.title,
      description: video.description,
      instructions: video.instructions || '',
      common_errors: video.common_errors || '',
      video_url: video.video_url || '',
      difficulty: video.difficulty || 'principiante'
    });
    setShowAddVideo(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteVideo = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Video',
      message: '¿Estás seguro de que deseas eliminar este video?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'workout_videos', id));
          setVideos(videos.filter(v => v.id !== id));
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        } catch (error) {
          console.error("Error deleting video:", error);
        }
      }
    });
  };

  const seedMuscleWikiVideos = async () => {
    try {
      // Check if categories already exist to avoid duplication
      const existingCats = await getDocs(collection(db, 'workout_categories'));
      if (!existingCats.empty) {
        const confirmSeed = window.confirm('Ya existen categorías. ¿Deseas cargar más videos de prueba? Esto podría generar duplicados si ya están cargados.');
        if (!confirmSeed) return;
      }

      // Helper to find or create category
      const getCategoryId = async (name: string) => {
        const q = query(collection(db, 'workout_categories'), where('name', '==', name));
        const snap = await getDocs(q);
        if (!snap.empty) return snap.docs[0].id;
        const docRef = await addDoc(collection(db, 'workout_categories'), { name });
        return docRef.id;
      };

      const catIds = {
        chest: await getCategoryId('Pecho'),
        back: await getCategoryId('Espalda'),
        legs: await getCategoryId('Piernas'),
        shoulders: await getCategoryId('Hombros'),
        abs: await getCategoryId('Abdominales'),
        glutes: await getCategoryId('Glúteos'),
        arms: await getCategoryId('Brazos'),
        cardio: await getCategoryId('Cardio'),
        boxing: await getCategoryId('Boxeo')
      };

      // Comprehensive list of MuscleWiki videos (under 30s)
      const sampleVideos = [
        // PECHO
        {
          category_id: catIds.chest,
          title: 'Press de Banca con Barra',
          description: 'Acuéstate en un banco plano, baja la barra al pecho y empuja hacia arriba.',
          instructions: '1. Acuéstate en el banco con los pies apoyados en el suelo.\n2. Sujeta la barra con un agarre algo más ancho que los hombros.\n3. Baja la barra lentamente hasta la parte media del pecho.\n4. Empuja la barra hacia arriba extendiendo los brazos completamente.',
          common_errors: 'Levantar los pies del suelo, arquear demasiado la espalda o rebotar la barra en el pecho.',
          video_url: 'https://www.youtube.com/embed/rT7DgCr-3pg',
          difficulty: 'intermedio'
        },
        {
          category_id: catIds.chest,
          title: 'Aperturas con Mancuernas',
          description: 'Acuéstate en un banco y abre los brazos con mancuernas, manteniendo una ligera flexión en los codos.',
          instructions: '1. Sujeta las mancuernas sobre el pecho con las palmas enfrentadas.\n2. Baja las mancuernas hacia los lados en un arco amplio.\n3. Siente el estiramiento en el pecho y vuelve a la posición inicial.',
          common_errors: 'Extender los codos completamente o bajar demasiado las mancuernas poniendo en riesgo el hombro.',
          video_url: 'https://www.youtube.com/embed/eozdVDA78K0',
          difficulty: 'principiante'
        },
        {
          category_id: catIds.chest,
          title: 'Flexiones de Pecho (Push-ups)',
          description: 'Baja el cuerpo manteniendo la espalda recta y empuja hacia arriba.',
          instructions: '1. Colócate en posición de plancha con las manos bajo los hombros.\n2. Baja el cuerpo hasta que el pecho casi toque el suelo.\n3. Mantén el core contraído y empuja hacia arriba.',
          common_errors: 'Dejar caer la cadera o encoger los hombros hacia las orejas.',
          video_url: 'https://www.youtube.com/embed/IODxDxX7oi4',
          difficulty: 'principiante'
        },
        // ESPALDA
        {
          category_id: catIds.back,
          title: 'Dominadas (Pull-ups)',
          description: 'Cuélgate de una barra y tira de tu cuerpo hacia arriba hasta que la barbilla pase la barra.',
          instructions: '1. Sujeta la barra con un agarre prono (palmas hacia afuera).\n2. Tira de tu cuerpo hacia arriba hasta que la barbilla pase la barra.\n3. Baja lentamente hasta la posición inicial.',
          common_errors: 'Balancear el cuerpo o no completar el rango de movimiento.',
          video_url: 'https://www.youtube.com/embed/eGo4IYVPNfQ',
          difficulty: 'avanzado'
        },
        {
          category_id: catIds.back,
          title: 'Remo con Mancuerna a una mano',
          description: 'Apoya una mano en un banco y tira de la mancuerna hacia tu cadera.',
          instructions: '1. Apoya una rodilla y una mano en un banco.\n2. Con la otra mano, tira de la mancuerna hacia la cadera manteniendo el codo pegado al cuerpo.\n3. Baja lentamente.',
          common_errors: 'Girar el torso o tirar con el brazo en lugar de la espalda.',
          video_url: 'https://www.youtube.com/embed/dFzUjzfih7k',
          difficulty: 'principiante'
        },
        {
          category_id: catIds.back,
          title: 'Jalón al Pecho',
          description: 'Tira de la barra hacia la parte superior del pecho mientras mantienes la espalda recta.',
          instructions: '1. Siéntate en la máquina y sujeta la barra con un agarre ancho.\n2. Tira de la barra hacia la parte superior del pecho inclinándote ligeramente hacia atrás.\n3. Vuelve a la posición inicial con control.',
          common_errors: 'Tirar de la barra detrás de la nuca o usar demasiado impulso.',
          video_url: 'https://www.youtube.com/embed/CAwf7n6Luuc',
          difficulty: 'principiante'
        },
        // PIERNAS
        {
          category_id: catIds.legs,
          title: 'Sentadilla con Barra',
          description: 'Coloca la barra en tus hombros, baja las caderas y vuelve a subir.',
          instructions: '1. Coloca la barra sobre los trapecios.\n2. Baja la cadera manteniendo la espalda recta y el pecho arriba.\n3. Empuja con los talones para volver a subir.',
          common_errors: 'Levantar los talones o dejar que las rodillas se cierren.',
          video_url: 'https://www.youtube.com/embed/bEv6CCg2BC8',
          difficulty: 'intermedio'
        },
        {
          category_id: catIds.legs,
          title: 'Zancadas (Lunges)',
          description: 'Da un paso adelante y baja la rodilla trasera hacia el suelo.',
          instructions: '1. Da un paso hacia adelante.\n2. Baja la rodilla trasera hasta que casi toque el suelo.\n3. Mantén el torso erguido.',
          common_errors: 'Paso demasiado corto o inclinar el torso hacia adelante.',
          video_url: 'https://www.youtube.com/embed/D7KaRcUTQeE',
          difficulty: 'principiante'
        },
        {
          category_id: catIds.legs,
          title: 'Prensa de Piernas',
          description: 'Empuja la plataforma con las piernas hasta que estén casi extendidas.',
          instructions: '1. Siéntate en la máquina y apoya los pies en la plataforma.\n2. Empuja la plataforma extendiendo las piernas sin bloquear las rodillas.\n3. Baja lentamente.',
          common_errors: 'Bloquear las rodillas al extender o despegar la zona lumbar del asiento.',
          video_url: 'https://www.youtube.com/embed/IZxyjW7MPJQ',
          difficulty: 'intermedio'
        },
        // HOMBROS
        {
          category_id: catIds.shoulders,
          title: 'Press Militar con Barra',
          description: 'Empuja la barra desde tus hombros hacia arriba sobre tu cabeza.',
          instructions: '1. Sujeta la barra a la altura de los hombros.\n2. Empuja la barra hacia arriba extendiendo los brazos por completo.\n3. Baja lentamente hasta la posición inicial.',
          common_errors: 'Arquear la espalda baja o no bloquear los codos arriba.',
          video_url: 'https://www.youtube.com/embed/2yjwxt_Yeas',
          difficulty: 'intermedio'
        },
        {
          category_id: catIds.shoulders,
          title: 'Elevaciones Laterales',
          description: 'Levanta las mancuernas hacia los lados hasta la altura de los hombros.',
          instructions: '1. Sujeta las mancuernas a los lados.\n2. Eleva los brazos lateralmente con una ligera flexión de codo hasta la altura de los hombros.\n3. Baja lentamente.',
          common_errors: 'Subir por encima de los hombros o usar impulso.',
          video_url: 'https://www.youtube.com/embed/3VcKaXpzqRo',
          difficulty: 'principiante'
        },
        {
          category_id: catIds.shoulders,
          title: 'Face Pulls',
          description: 'Tira de la cuerda hacia tu cara, separando las manos al final del movimiento.',
          instructions: '1. Sujeta la cuerda de la polea alta.\n2. Tira de la cuerda hacia tu cara, separando las manos y llevando los codos hacia atrás.\n3. Vuelve lentamente.',
          common_errors: 'Tirar con demasiada carga o no rotar externamente los hombros.',
          video_url: 'https://www.youtube.com/embed/rep-qVOkqgk',
          difficulty: 'intermedio'
        },
        // ABDOMINALES
        {
          category_id: catIds.abs,
          title: 'Plancha Estática',
          description: 'Mantén el cuerpo recto apoyado en los antebrazos y las puntas de los pies.',
          instructions: '1. Apóyate en los antebrazos y las puntas de los pies.\n2. Mantén el cuerpo en línea recta desde la cabeza hasta los talones.\n3. Contrae el abdomen y mantén la posición.',
          common_errors: 'Levantar demasiado la cadera o dejarla caer.',
          video_url: 'https://www.youtube.com/embed/ASdvN_XEl_c',
          difficulty: 'principiante'
        },
        {
          category_id: catIds.abs,
          title: 'Crunch Abdominal',
          description: 'Túmbate boca arriba y eleva el tronco contrayendo el abdomen.',
          instructions: '1. Túmbate boca arriba con las rodillas flexionadas.\n2. Eleva los hombros del suelo contrayendo el abdomen.\n3. Baja lentamente.',
          common_errors: 'Tirar del cuello con las manos o subir demasiado rápido.',
          video_url: 'https://www.youtube.com/embed/Xyd_fa5zoEU',
          difficulty: 'principiante'
        },
        {
          category_id: catIds.abs,
          title: 'Elevación de Piernas',
          description: 'Tumbado boca arriba, levanta las piernas rectas hasta que queden perpendiculares al suelo.',
          instructions: '1. Túmbate boca arriba con las manos bajo los glúteos.\n2. Levanta las piernas rectas hasta que queden perpendiculares al suelo.\n3. Baja lentamente sin tocar el suelo.',
          common_errors: 'Arquear la espalda baja o bajar las piernas demasiado rápido.',
          video_url: 'https://www.youtube.com/embed/l4kQd9eWclE',
          difficulty: 'intermedio'
        },
        // GLUTEOS
        {
          category_id: catIds.glutes,
          title: 'Puente de Glúteo',
          description: 'Túmbate boca arriba y eleva la cadera apretando los glúteos.',
          instructions: '1. Túmbate boca arriba con las rodillas flexionadas y los pies apoyados.\n2. Eleva la cadera apretando los glúteos en la parte superior.\n3. Baja lentamente.',
          common_errors: 'Arquear demasiado la espalda o no apretar los glúteos.',
          video_url: 'https://www.youtube.com/embed/wPM8icPu6H8',
          difficulty: 'principiante'
        },
        {
          category_id: catIds.glutes,
          title: 'Peso Muerto Rumano',
          description: 'Baja la barra manteniendo las piernas casi rectas para estirar los isquiotibiales y glúteos.',
          instructions: '1. Sujeta la barra frente a los muslos.\n2. Baja la barra manteniendo la espalda recta y las rodillas ligeramente flexionadas.\n3. Siente el estiramiento en los isquiotibiales y vuelve a subir.',
          common_errors: 'Arquear la espalda o flexionar demasiado las rodillas.',
          video_url: 'https://www.youtube.com/embed/JCXUYuzwuyw',
          difficulty: 'intermedio'
        },
        {
          category_id: catIds.glutes,
          title: 'Hip Thrust',
          description: 'Apoya la espalda en un banco y eleva la cadera con peso sobre la pelvis.',
          instructions: '1. Apoya la parte superior de la espalda en un banco.\n2. Coloca una barra sobre la pelvis.\n3. Eleva la cadera hasta que el cuerpo esté paralelo al suelo, apretando los glúteos.',
          common_errors: 'No completar el rango de movimiento o hiperextender la espalda.',
          video_url: 'https://www.youtube.com/embed/LM8LG_tr8_g',
          difficulty: 'avanzado'
        },
        // BRAZOS
        {
          category_id: catIds.arms,
          title: 'Curl de Bíceps con Barra',
          description: 'Flexiona los codos para llevar la barra hacia tus hombros.',
          instructions: '1. Sujeta la barra con las palmas hacia arriba.\n2. Flexiona los codos llevando la barra hacia los hombros sin mover los brazos.\n3. Baja lentamente.',
          common_errors: 'Balancear el cuerpo o mover los codos hacia adelante.',
          video_url: 'https://www.youtube.com/embed/lyn7uY99iSg',
          difficulty: 'principiante'
        },
        {
          category_id: catIds.arms,
          title: 'Extensión de Tríceps en Polea',
          description: 'Empuja la barra hacia abajo extendiendo completamente los codos.',
          instructions: '1. Sujeta la barra de la polea alta.\n2. Empuja la barra hacia abajo extendiendo los codos por completo.\n3. Vuelve lentamente manteniendo los codos pegados al cuerpo.',
          common_errors: 'Separar los codos del cuerpo o usar el peso del cuerpo para empujar.',
          video_url: 'https://www.youtube.com/embed/2-LAMcpzHLU',
          difficulty: 'principiante'
        },
        {
          category_id: catIds.arms,
          title: 'Martillo con Mancuernas',
          description: 'Sujeta las mancuernas con agarre neutro y flexiona los codos.',
          instructions: '1. Sujeta las mancuernas con las palmas enfrentadas.\n2. Flexiona los codos llevando las mancuernas hacia los hombros.\n3. Baja lentamente.',
          common_errors: 'Balancear el cuerpo o no completar el rango de movimiento.',
          video_url: 'https://www.youtube.com/embed/zC3nLlEvin4',
          difficulty: 'principiante'
        },
        // CARDIO
        {
          category_id: catIds.cardio,
          title: 'Burpees',
          description: 'Baja a posición de flexión, salta hacia adelante y luego salta hacia arriba.',
          video_url: 'https://www.youtube.com/embed/auBLPXO8Fww',
          difficulty: 'intermedio'
        },
        {
          category_id: catIds.cardio,
          title: 'Jumping Jacks',
          description: 'Salta abriendo piernas y brazos simultáneamente.',
          video_url: 'https://www.youtube.com/embed/nGaXj3kkmzU',
          difficulty: 'principiante'
        },
        // BOXEO
        {
          category_id: catIds.boxing,
          title: 'Sombra de Boxeo (Shadow Boxing)',
          description: 'Lanza golpes al aire practicando técnica y movimiento de pies.',
          video_url: 'https://www.youtube.com/embed/MUPvVp_5pJA',
          difficulty: 'principiante'
        },
        {
          category_id: catIds.boxing,
          title: 'Saltar la Cuerda',
          description: 'Ejercicio fundamental para coordinación y resistencia cardiovascular.',
          video_url: 'https://www.youtube.com/embed/u3zgHI8QnqE',
          difficulty: 'intermedio'
        }
      ];

      // Add videos avoiding duplicates by title
      const existingVideos = await getDocs(collection(db, 'workout_videos'));
      const existingTitles = new Set(existingVideos.docs.map(d => d.data().title));

      for (const video of sampleVideos) {
        if (!existingTitles.has(video.title)) {
          const embedUrl = `${video.video_url}?autoplay=1&loop=1&playlist=${video.video_url.split('/').pop()}&controls=0&mute=1&modestbranding=1&rel=0`;
          await addDoc(collection(db, 'workout_videos'), { ...video, video_url: embedUrl });
        }
      }

      fetchCategories();
      fetchVideos();
      alert('Contenido de MuscleWiki actualizado exitosamente.');
    } catch (error) {
      console.error('Error seeding videos:', error);
      alert('Error al cargar los videos.');
    }
  };

  const filteredVideos = videos.filter(v => {
    const matchesCategory = selectedCategory ? v.category_id === selectedCategory : true;
    const matchesDifficulty = selectedDifficulty ? v.difficulty === selectedDifficulty : true;
    const matchesEquipment = selectedEquipment ? v.equipment === selectedEquipment : true;
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesDifficulty && matchesEquipment && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white pb-24">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-900 dark:text-white" />
          </button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Directorio de Entrenamientos</h1>
        </div>
      </header>

      <section className="p-4 max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar ejercicios..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 md:pb-0">
            <button
              onClick={() => setSelectedDifficulty(null)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${!selectedDifficulty ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
            >
              Todas (Dificultad)
            </button>
            {['principiante', 'intermedio', 'avanzado'].map(diff => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all capitalize ${selectedDifficulty === diff ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
              >
                {diff}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 md:pb-0 mt-2">
            <button
              onClick={() => setSelectedEquipment(null)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${!selectedEquipment ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
            >
              Cualquier Equipo
            </button>
            {['Sin equipo', 'Saco pesado', 'Con compañero', 'Mancuernas', 'Kettlebell', 'Bandas', 'Barra'].map(eq => (
              <button
                key={eq}
                onClick={() => setSelectedEquipment(eq)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedEquipment === eq ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
              >
                {eq}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Categorías</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Explora los entrenamientos disponibles.</p>
          </div>
        </div>
        
        {(user?.role === 'admin' || user?.role === 'teacher') && (
          <div className="mb-8 bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white"><Dumbbell className="w-5 h-5 text-primary" /> Gestionar Categorías</h2>
              <div className="flex gap-2">
                {categories.length === 0 && (
                  <button onClick={seedMuscleWikiVideos} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white px-3 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium">
                    Cargar Videos de Prueba
                  </button>
                )}
                <button onClick={() => setShowAddCategory(!showAddCategory)} className="bg-primary text-white p-2 rounded-lg hover:bg-primary/90">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {showAddCategory && (
              <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                  placeholder="Nueva categoría (ej. Pecho)" 
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                  required
                />
                <button type="submit" className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold">Agregar</button>
              </form>
            )}

            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{cat.name}</span>
                  <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${!selectedCategory ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${selectedCategory === cat.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {(user?.role === 'admin' || user?.role === 'teacher') && selectedCategory && (
          <div className="mb-8">
            <button 
              onClick={() => {
                setShowAddVideo(!showAddVideo);
                if (showAddVideo) {
                  setEditingVideo(null);
                  setNewVideo({ title: '', description: '', video_url: '', difficulty: 'principiante' });
                }
              }}
              className="w-full bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="w-5 h-5" /> {showAddVideo ? 'Cancelar' : 'Agregar Video o Combo a esta Categoría'}
            </button>

            {showAddVideo && (
              <form onSubmit={handleAddVideo} className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mt-4 flex flex-col gap-3 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{editingVideo ? 'Editar Entrenamiento' : 'Nuevo Entrenamiento'}</h3>
                <input 
                  type="text" 
                  placeholder="Título del ejercicio o combo" 
                  value={newVideo.title} 
                  onChange={e => setNewVideo({...newVideo, title: e.target.value})} 
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" 
                  required 
                />
                <textarea 
                  placeholder="Descripción corta (para la tarjeta)" 
                  value={newVideo.description} 
                  onChange={e => setNewVideo({...newVideo, description: e.target.value})} 
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white resize-none h-20" 
                  required 
                />
                <textarea 
                  placeholder="Instrucciones detalladas" 
                  value={newVideo.instructions} 
                  onChange={e => setNewVideo({...newVideo, instructions: e.target.value})} 
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white resize-none h-24" 
                />
                <textarea 
                  placeholder="Errores comunes a evitar" 
                  value={newVideo.common_errors} 
                  onChange={e => setNewVideo({...newVideo, common_errors: e.target.value})} 
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white resize-none h-24" 
                />
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Dificultad</label>
                  <select 
                    value={newVideo.difficulty}
                    onChange={e => setNewVideo({...newVideo, difficulty: e.target.value})}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-primary"
                  >
                    <option value="principiante">Principiante</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="avanzado">Avanzado</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Equipo Necesario</label>
                  <select 
                    value={newVideo.equipment || 'Sin equipo'}
                    onChange={e => setNewVideo({...newVideo, equipment: e.target.value})}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-primary"
                  >
                    <option value="Sin equipo">Sin equipo</option>
                    <option value="Saco pesado">Saco pesado</option>
                    <option value="Con compañero">Con compañero</option>
                    <option value="Mancuernas">Mancuernas</option>
                    <option value="Kettlebell">Kettlebell</option>
                    <option value="Bandas">Bandas</option>
                    <option value="Barra">Barra</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Multimedia (Opcional para Combos)</label>
                  <input 
                    type="file" 
                    accept="video/mp4,video/x-m4v,video/*,image/gif" 
                    onChange={handleVideoUpload}
                    disabled={uploadProgress !== null}
                    className="text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 disabled:opacity-50"
                  />
                  {uploadProgress !== null && (
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-1">
                      <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                  <span className="text-xs text-slate-500 text-center my-1">O pega una URL</span>
                  <input 
                    type="url" 
                    placeholder="URL del video (YouTube, Vimeo) o deja vacío para Combo" 
                    value={newVideo.video_url} 
                    onChange={e => setNewVideo({...newVideo, video_url: e.target.value})} 
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" 
                  />
                  <p className="text-[10px] text-slate-500 italic">* Si no agregas video, se guardará como un "Combo" de ejercicios.</p>
                </div>
                <button type="submit" className="bg-primary text-white font-bold py-2 rounded-lg mt-2">Guardar Entrenamiento</button>
              </form>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredVideos.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700/50">
              <Video className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">No hay videos en esta categoría.</p>
            </div>
          ) : (
            filteredVideos.map(video => (
              <div key={video.id} onClick={() => handleVideoClick(video)} className="flex flex-col gap-2 group cursor-pointer rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-primary/50 transition-colors shadow-sm">
                <div className="relative aspect-[16/9] bg-slate-100 dark:bg-slate-900">
                  {video.video_url ? (
                    (() => {
                      const videoSrc = getYouTubeEmbedUrl(video.video_url);
                      return videoSrc.includes('youtube.com') || videoSrc.includes('youtu.be') ? (
                        <iframe 
                          src={videoSrc} 
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                          allowFullScreen
                        ></iframe>
                      ) : videoSrc.toLowerCase().endsWith('.gif') ? (
                        <img 
                          src={videoSrc} 
                          alt={video.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <video 
                          src={videoSrc} 
                          className="absolute inset-0 w-full h-full object-cover" 
                          muted
                          playsInline
                        />
                      );
                    })()
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600">
                      <Dumbbell className="w-8 h-8 mb-2" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Combo</span>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <div className="bg-white/90 dark:bg-slate-800/90 text-primary p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100">
                      <Info className="w-5 h-5" />
                    </div>
                  </div>
                  
                  {(user?.role === 'admin' || user?.role === 'teacher') && (
                    <div className="absolute top-2 right-2 flex gap-2 z-30 opacity-100 transition-opacity shadow-lg">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditVideo(video);
                        }}
                        className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVideo(video.id);
                        }}
                        className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h4 className="font-bold text-sm leading-tight text-slate-900 dark:text-white line-clamp-2">{video.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{video.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {video.difficulty && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">
                        {video.difficulty}
                      </span>
                    )}
                    {video.equipment && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-1 rounded">
                        {video.equipment}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                {confirmDialog.confirmText || 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVideoDetails && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="relative aspect-video bg-black">
              {selectedVideoDetails.video_url ? (
                (() => {
                  const videoSrc = getYouTubeEmbedUrl(selectedVideoDetails.video_url);
                  return videoSrc.includes('youtube.com') || videoSrc.includes('youtu.be') ? (
                    <iframe 
                      src={videoSrc.replace('controls=0', 'controls=1').replace('mute=1', 'mute=0')} 
                      className="absolute inset-0 w-full h-full"
                      allowFullScreen
                    ></iframe>
                  ) : videoSrc.toLowerCase().endsWith('.gif') ? (
                    <img 
                      src={videoSrc} 
                      alt={selectedVideoDetails.title}
                      className="absolute inset-0 w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <video 
                      src={videoSrc} 
                      className="absolute inset-0 w-full h-full object-contain" 
                      controls
                      autoPlay
                      playsInline
                    />
                  );
                })()
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <Dumbbell className="w-16 h-16 mb-4" />
                  <span className="text-lg font-bold uppercase tracking-widest">Combo</span>
                </div>
              )}
              <button 
                onClick={() => setSelectedVideoDetails(null)}
                className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedVideoDetails.title}</h2>
                  <div className="flex gap-2 mt-2">
                    {selectedVideoDetails.difficulty && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-1 rounded">
                        {selectedVideoDetails.difficulty}
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded">
                      {categories.find(c => c.id === selectedVideoDetails.category_id)?.name}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRoutineModal(true)}
                  className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                  title="Añadir a rutina personalizada"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4 text-primary" /> Descripción
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {selectedVideoDetails.description}
                  </p>
                </div>

                {selectedVideoDetails.instructions && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-2 flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-emerald-500" /> Instrucciones
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {selectedVideoDetails.instructions}
                    </p>
                  </div>
                )}

                {selectedVideoDetails.common_errors && (
                  <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20">
                    <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Errores Comunes
                    </h3>
                    <p className="text-red-700 dark:text-red-300/80 leading-relaxed whitespace-pre-wrap text-sm">
                      {selectedVideoDetails.common_errors}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button 
                onClick={() => setSelectedVideoDetails(null)}
                className="flex-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-white py-4 rounded-2xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cerrar
              </button>
              {selectedVideoDetails.video_url && (
                <button 
                  onClick={() => setFullScreenVideoUrl(selectedVideoDetails.video_url!)}
                  className="flex-[2] bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" /> Ver en Pantalla Completa
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showRoutineModal && selectedVideoDetails && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Añadir a Rutina</h3>
              <button onClick={() => setShowRoutineModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              {userRoutines.length === 0 ? (
                <p className="text-center text-slate-500 py-4 text-sm italic">No tienes rutinas creadas.</p>
              ) : (
                userRoutines.map(routine => (
                  <button
                    key={routine.id}
                    onClick={async () => {
                      try {
                        const updatedExercises = [...routine.exercises, selectedVideoDetails.id];
                        await updateDoc(doc(db, 'custom_routines', routine.id), { exercises: updatedExercises });
                        setUserRoutines(userRoutines.map(r => r.id === routine.id ? { ...r, exercises: updatedExercises } : r));
                        setShowRoutineModal(false);
                        alert(`Añadido a ${routine.name}`);
                      } catch (error) {
                        console.error("Error updating routine:", error);
                      }
                    }}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all group"
                  >
                    <span className="font-bold">{routine.name}</span>
                    <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-full group-hover:bg-primary/20">{routine.exercises.length} ej.</span>
                  </button>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">O crea una nueva</p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Nombre de la rutina" 
                  value={newRoutineName}
                  onChange={e => setNewRoutineName(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-primary"
                />
                <button 
                  onClick={async () => {
                    if (!newRoutineName.trim()) return;
                    try {
                      const routineData = {
                        user_id: String(user?.id),
                        name: newRoutineName,
                        exercises: [selectedVideoDetails.id],
                        createdAt: new Date().toISOString()
                      };
                      const docRef = await addDoc(collection(db, 'custom_routines'), routineData);
                      setUserRoutines([...userRoutines, { id: docRef.id, ...routineData } as CustomRoutine]);
                      setNewRoutineName('');
                      setShowRoutineModal(false);
                      alert(`Rutina ${newRoutineName} creada.`);
                    } catch (error) {
                      console.error("Error creating routine:", error);
                    }
                  }}
                  className="bg-primary text-white p-2 rounded-xl"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {fullScreenVideoUrl && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="p-4 flex justify-end bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
            <button 
              onClick={() => setFullScreenVideoUrl(null)}
              className="bg-slate-800/80 text-white p-2 rounded-full hover:bg-slate-700 transition-colors backdrop-blur-sm"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            {fullScreenVideoUrl.toLowerCase().endsWith('.gif') ? (
              <img 
                src={fullScreenVideoUrl} 
                alt="Fullscreen animation"
                className="w-full h-full max-h-screen object-contain"
                referrerPolicy="no-referrer"
              />
            ) : fullScreenVideoUrl.includes('youtube.com') || fullScreenVideoUrl.includes('youtu.be') ? (
              <iframe 
                src={getYouTubeEmbedUrl(fullScreenVideoUrl).replace('controls=0', 'controls=1').replace('mute=1', 'mute=0')} 
                className="w-full h-full max-h-screen"
                allowFullScreen
                allow="autoplay; fullscreen"
              ></iframe>
            ) : (
              <video 
                src={fullScreenVideoUrl} 
                className="w-full h-full max-h-screen object-contain"
                controls
                autoPlay
                playsInline
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
