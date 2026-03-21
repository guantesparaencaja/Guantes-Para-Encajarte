import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { ArrowLeft, Plus, Utensils, Flame, Wheat, Beef, X, Image as ImageIcon, Edit2, Trash2, Droplet, Search, CheckCircle2, Calendar, RefreshCw, Play, ChevronDown, ChevronUp, Info, ShoppingCart, ScanLine, ChefHat, Coffee, Moon, Apple, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { generateLocalMeals, getYouTubeEmbedUrl } from '../services/geminiService';
import { AssessmentModal } from '../components/AssessmentModal';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { HEALTHY_RECIPES, HealthyRecipe } from '../data/healthyRecipes';
import { HEALTHY_TIPS } from '../data/healthyTips';
import { RecipeCard } from '../components/RecipeCard';
import { Lightbulb, Book, ChevronLeft } from 'lucide-react';

interface Meal {
  id: string;
  name: string;
  category: string;
  ingredients: string;
  instructions: string;
  image_url?: string;
  video_url?: string;
  calories?: number;
  carbs?: number;
  protein?: number;
  fats?: number;
  tags?: string[];
}

export function Meals() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editingNutritionId, setEditingNutritionId] = useState<string | null>(null);
  const [newMeal, setNewMeal] = useState<Partial<Meal>>({ name: '', category: 'desayuno', ingredients: '', instructions: '', video_url: '' });
  const [nutrition, setNutrition] = useState({ calories: '', carbs: '', protein: '', fats: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('todas');
  const [consumedMeals, setConsumedMeals] = useState<string[]>([]);
  const [showMealPlanner, setShowMealPlanner] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [activeSection, setActiveSection] = useState<'mis_recetas' | 'libro' | 'tips'>('mis_recetas');
  const [selectedHealthyRecipe, setSelectedHealthyRecipe] = useState<HealthyRecipe | null>(null);

  const handleScan = async (decodedText: string) => {
    setShowScanner(false);
    
    // In a real app, you would look up the barcode in a nutrition database (e.g., OpenFoodFacts)
    // For this demo, we'll simulate a found product
    alert(`Código escaneado: ${decodedText}\n\nEn una versión completa, esto buscaría la información nutricional del producto en una base de datos.`);
    
    // Simulate adding a scanned item
    setNewMeal({
      name: `Producto Escaneado (${decodedText.slice(-4)})`,
      category: 'snack',
      ingredients: 'Ingredientes del producto...',
      instructions: 'Listo para consumir'
    });
    setNutrition({
      calories: '250',
      carbs: '30',
      protein: '10',
      fats: '12'
    });
    setShowAddForm(true);
  };

  const handleGenerateMealPlan = async () => {
    if (!user?.assessment_completed) {
      setShowAssessment(true);
      return;
    }

    setIsGenerating(true);
    try {
      const plan = generateLocalMeals(
        user?.goal || 'mantener',
        user?.weight || 70,
        user?.activity_level || 'moderado',
        user?.dietary_restrictions || 'ninguna',
        meals
      );
      
      if (user?.id) {
        const userRef = doc(db, 'users', String(user.id));
        await updateDoc(userRef, {
          weekly_meal_plan: plan
        });
        
        useStore.getState().setUser({
          ...user,
          weekly_meal_plan: plan
        });
      }
      setShowMealPlanner(false);
    } catch (err) {
      console.error(err);
      alert('Error al generar el plan de comidas. Inténtalo de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate recommended macros based on user profile
  const weight = user?.weight || 70;
  const goal = user?.goal || 'mantener';
  
  let baseCalories = weight * 24 * 1.3; // BMR * light activity
  if (goal === 'bajar') baseCalories -= 500;
  if (goal === 'subir') baseCalories += 500;
  
  const targetProtein = Math.round(weight * 2.2);
  const targetFats = Math.round(weight * 1);
  const targetCarbs = Math.round((baseCalories - (targetProtein * 4) - (targetFats * 9)) / 4);
  const targetCalories = Math.round(baseCalories);

  // Calculate consumed macros
  const consumedMacros = consumedMeals.reduce((acc, mealId) => {
    const meal = meals.find(m => m.id === mealId);
    if (meal) {
      acc.calories += meal.calories || 0;
      acc.protein += meal.protein || 0;
      acc.carbs += meal.carbs || 0;
      acc.fats += meal.fats || 0;
    }
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const toggleConsumed = (mealId: string) => {
    if (consumedMeals.includes(mealId)) {
      setConsumedMeals(consumedMeals.filter(id => id !== mealId));
    } else {
      setConsumedMeals([...consumedMeals, mealId]);
    }
  };

  const filteredMeals = meals.filter(meal => {
    const matchesSearch = meal.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          meal.ingredients.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'todas' || meal.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'meals'));
      if (snapshot.empty) {
        // Seed from MEAL_CATALOG
        const { MEAL_CATALOG } = await import('../data/meals');
        for (const meal of MEAL_CATALOG) {
          const mealData = {
            name: meal.name,
            category: meal.category.toLowerCase(),
            image_url: meal.image_url,
            ingredients: meal.ingredients.map(i => `${i.amount} ${i.measure} ${i.name}`).join(', '),
            instructions: meal.preparation_steps.map(s => s.step).join('\n'),
            calories: meal.macros.calories,
            protein: meal.macros.protein,
            carbs: meal.macros.carbs,
            fats: meal.macros.fats,
            tags: meal.tags
          };
          await addDoc(collection(db, 'meals'), mealData);
        }
        // Fetch again
        const newSnapshot = await getDocs(collection(db, 'meals'));
        const data = newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal));
        setMeals(data);
      } else {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal));
        setMeals(data);
      }
    } catch (error) {
      console.error('Error fetching meals:', error);
    }
  };

  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMealId) {
        await updateDoc(doc(db, 'meals', editingMealId), newMeal);
        fetchMeals();
        setEditingMealId(null);
      } else {
        await addDoc(collection(db, 'meals'), { ...newMeal, created_by: String(user?.id) });
        fetchMeals();
      }
      setShowAddForm(false);
      setNewMeal({ name: '', category: 'desayuno', ingredients: '', instructions: '', video_url: '' });
    } catch (error) {
      console.error('Error saving meal:', error);
    }
  };

  const handleDeleteMeal = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'meals', id));
      fetchMeals();
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  };

  const handleEditMealClick = (meal: Meal) => {
    setNewMeal(meal);
    setEditingMealId(meal.id);
    setShowAddForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `meals/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        null,
        (error) => {
          console.error('Error uploading image:', error);
          setUploadingImage(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setNewMeal({ ...newMeal, image_url: downloadURL });
          setUploadingImage(false);
        }
      );
    } catch (error) {
      console.error('Error in image upload:', error);
      setUploadingImage(false);
    }
  };

  const handleAddNutrition = async (e: React.FormEvent, mealId: string) => {
    e.preventDefault();
    const mealToUpdate = meals.find(m => m.id === mealId);
    if (!mealToUpdate) return;

    const updatedMeal = {
      calories: parseInt(nutrition.calories),
      carbs: parseInt(nutrition.carbs),
      protein: parseInt(nutrition.protein),
      fats: parseInt(nutrition.fats)
    };

    try {
      await updateDoc(doc(db, 'meals', mealId), updatedMeal);
      fetchMeals();
      setEditingNutritionId(null);
      setNutrition({ calories: '', carbs: '', protein: '', fats: '' });
    } catch (error) {
      console.error('Error updating nutrition:', error);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display p-4 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div className="text-primary flex size-12 shrink-0 items-center justify-center cursor-pointer" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Comidas Saludables</h1>
        <div className="w-12">
          <button 
            onClick={() => setShowScanner(true)}
            className="text-primary flex size-12 shrink-0 items-center justify-center cursor-pointer hover:bg-primary/10 rounded-full transition-colors"
            title="Escanear Código de Barras"
          >
            <ScanLine className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Section Selector */}
      <div className="flex gap-2 mb-6 bg-slate-800/50 p-1 rounded-2xl border border-slate-700/50">
        <button 
          onClick={() => setActiveSection('mis_recetas')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeSection === 'mis_recetas' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          Mis Recetas
        </button>
        <button 
          onClick={() => setActiveSection('libro')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeSection === 'libro' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          Recetas del Libro
        </button>
        <button 
          onClick={() => setActiveSection('tips')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeSection === 'tips' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          Tips Nutrición
        </button>
      </div>

      {showScanner && (
        <BarcodeScanner 
          onScan={handleScan} 
          onClose={() => setShowScanner(false)} 
        />
      )}

      {/* Main Content Sections */}
      {activeSection === 'mis_recetas' && (
        <>
          {/* Weekly Meal Plan Section */}
          <section className="mb-8">
            {/* ... existing weekly meal plan code ... */}
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Plan de Comidas Semanal
            </h2>
            <div className="flex gap-2">
              {user?.weekly_meal_plan && (
                <button 
                  onClick={() => setShowShoppingList(true)}
                  className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
                >
                  <ShoppingCart className="w-3 h-3" /> Compras
                </button>
              )}
              <button 
                onClick={() => setShowMealPlanner(!showMealPlanner)}
                className="text-xs font-bold bg-primary/20 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/30 transition-colors"
              >
                {user?.weekly_meal_plan ? 'Ver Mi Plan' : 'Generar Plan'}
              </button>
            </div>
          </div>

          {showMealPlanner && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
              <p className="text-sm text-slate-400">
                Generaremos un plan de 7 días basado en tus objetivos de {user?.goal} y tu peso de {user?.weight}kg.
              </p>
              <button 
                onClick={handleGenerateMealPlan}
                disabled={isGenerating}
                className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Utensils className="w-5 h-5" />}
                {user?.weekly_meal_plan ? 'Regenerar Mi Plan' : 'Generar Mi Plan Semanal'}
              </button>

              {isGenerating && (
                <div className="space-y-4 mt-6">
                  <div className="h-6 bg-slate-700/50 rounded w-1/3 animate-pulse"></div>
                  <div className="space-y-3">
                    <div className="h-24 bg-slate-700/30 rounded-xl animate-pulse"></div>
                    <div className="h-24 bg-slate-700/30 rounded-xl animate-pulse"></div>
                    <div className="h-24 bg-slate-700/30 rounded-xl animate-pulse"></div>
                  </div>
                  <p className="text-center text-sm text-primary animate-pulse">La IA está diseñando tu menú ideal...</p>
                </div>
              )}
            </div>
          )}

          {!showMealPlanner && user?.weekly_meal_plan && !isGenerating && (
            <div className="space-y-3">
              {user.weekly_meal_plan.week.map((dayPlan: any) => (
                <div key={dayPlan.day} className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden">
                  <button 
                    onClick={() => setExpandedDay(expandedDay === dayPlan.day ? null : dayPlan.day)}
                    className="w-full p-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors"
                  >
                    <p className="font-bold text-slate-200">{dayPlan.day}</p>
                    {expandedDay === dayPlan.day ? <ChevronUp className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                  </button>
                  
                  {expandedDay === dayPlan.day && (
                    <div className="p-4 pt-0 space-y-6 animate-in fade-in zoom-in-95 duration-200">
                      {dayPlan.meals.map((meal: any, idx: number) => (
                        <div key={idx} className="space-y-3 pb-6 border-b border-slate-700/50 last:border-0 last:pb-0">
                          <div className="flex flex-col items-center text-center mb-6">
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">{meal.category}</span>
                            <h4 className="font-bold text-white text-2xl mb-2 break-words max-w-full">{meal.name}</h4>
                            <div className="flex flex-wrap justify-center gap-3 text-sm bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-700/50">
                              <span className="font-bold text-emerald-400">{meal.calories} kcal</span>
                              <span className="text-slate-500">|</span>
                              <span className="text-slate-400">P: <span className="text-white">{meal.macros.protein}g</span></span>
                              <span className="text-slate-400">C: <span className="text-white">{meal.macros.carbs}g</span></span>
                              <span className="text-slate-400">G: <span className="text-white">{meal.macros.fats}g</span></span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                            {/* Images and Ingredients Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Final Meal Image */}
                              {meal.image_keyword && (
                                <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-800 relative">
                                  <img 
                                    src={meal.image_keyword} 
                                    alt={meal.name} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = 'https://images.unsplash.com/photo-1495195134817-a1a280719e38?w=800&q=80';
                                    }}
                                  />
                                  <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1 border border-slate-700">
                                    <Flame className="w-3 h-3 text-orange-400" />
                                    <span className="text-xs font-bold text-white">{meal.macros?.calories || meal.calories} kcal</span>
                                  </div>
                                </div>
                              )}

                              {/* Ingredients List */}
                              <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30 flex flex-col justify-center">
                                <h5 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                  <ShoppingCart className="w-4 h-4 text-emerald-500" />
                                  Ingredientes
                                </h5>
                                {Array.isArray(meal.ingredients) ? (
                                  <ul className="space-y-2">
                                    {meal.ingredients.map((ing: any, i: number) => (
                                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                        <span className="text-emerald-500 mt-0.5">•</span>
                                        <span>
                                          <span className="font-bold text-white">{ing.amount}</span> {ing.name} {ing.icon || '🍽️'}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-slate-300 leading-relaxed">{meal.ingredients}</p>
                                )}
                              </div>
                            </div>

                            {/* Nutritional Info Grid */}
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                              <h5 className="text-xs font-bold text-slate-400 uppercase mb-3 text-center">Información Nutricional</h5>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/30">
                                  <p className="text-[10px] text-slate-400 mb-1">Proteínas</p>
                                  <p className="text-sm font-bold text-rose-400">{meal.macros?.protein}g</p>
                                </div>
                                <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/30">
                                  <p className="text-[10px] text-slate-400 mb-1">Carbohidratos</p>
                                  <p className="text-sm font-bold text-amber-400">{meal.macros?.carbs}g</p>
                                </div>
                                <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/30">
                                  <p className="text-[10px] text-slate-400 mb-1">Grasas</p>
                                  <p className="text-sm font-bold text-yellow-400">{meal.macros?.fats}g</p>
                                </div>
                                {meal.macros?.sugars !== undefined && (
                                  <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/30">
                                    <p className="text-[10px] text-slate-400 mb-1">Azúcares</p>
                                    <p className="text-sm font-bold text-blue-400">{meal.macros.sugars}g</p>
                                  </div>
                                )}
                                {meal.macros?.salt !== undefined && (
                                  <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/30">
                                    <p className="text-[10px] text-slate-400 mb-1">Sal</p>
                                    <p className="text-sm font-bold text-slate-300">{meal.macros.salt}g</p>
                                  </div>
                                )}
                                {meal.macros?.saturated_fats !== undefined && (
                                  <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/30">
                                    <p className="text-[10px] text-slate-400 mb-1">Grasas Sat.</p>
                                    <p className="text-sm font-bold text-orange-400">{meal.macros.saturated_fats}g</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Preparation */}
                            <div>
                              <h5 className="text-lg font-bold text-white mb-3 flex items-center gap-2 mt-2">
                                <ChefHat className="w-5 h-5 text-primary" />
                                Preparación de la receta
                              </h5>
                              {meal.preparation_steps && meal.preparation_steps.length > 0 ? (
                                <div className="space-y-4">
                                  {meal.preparation_steps.map((step: any, i: number) => (
                                    <div key={i} className="flex gap-4">
                                      <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0 border border-primary/30">
                                          {i + 1}
                                        </div>
                                        {i < meal.preparation_steps.length - 1 && (
                                          <div className="w-px h-full bg-slate-700 my-2"></div>
                                        )}
                                      </div>
                                      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/30 flex-1 mb-2">
                                        <p className="text-sm text-slate-300 leading-relaxed">{step.step}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/30">
                                  <p className="text-sm text-slate-300 leading-relaxed">{meal.preparation}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mb-6">
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 mb-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Utensils className="w-5 h-5 text-emerald-500" />
              Tus Macros Diarios
            </h2>
            <span className="text-xs font-bold bg-slate-700 px-2 py-1 rounded text-slate-300 uppercase">
              Objetivo: {goal}
            </span>
          </div>
          
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <Flame className="w-5 h-5 text-orange-400 mb-1" />
              <span className="text-xs text-slate-400">Kcal</span>
              <span className="font-bold text-sm">{consumedMacros.calories} / {targetCalories}</span>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <Beef className="w-5 h-5 text-rose-400 mb-1" />
              <span className="text-xs text-slate-400">Prot</span>
              <span className="font-bold text-sm">{consumedMacros.protein}g / {targetProtein}g</span>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <Wheat className="w-5 h-5 text-amber-400 mb-1" />
              <span className="text-xs text-slate-400">Carbs</span>
              <span className="font-bold text-sm">{consumedMacros.carbs}g / {targetCarbs}g</span>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <Droplet className="w-5 h-5 text-yellow-400 mb-1" />
              <span className="text-xs text-slate-400">Grasas</span>
              <span className="font-bold text-sm">{consumedMacros.fats}g / {targetFats}g</span>
            </div>
          </div>
          
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${consumedMacros.calories > targetCalories ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min((consumedMacros.calories / targetCalories) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar recetas o ingredientes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-white"
          />
        </div>

        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-2">
          {[
            { id: 'todas', label: 'Todas', icon: Utensils },
            { id: 'desayuno', label: 'Desayuno', icon: Coffee },
            { id: 'almuerzo', label: 'Almuerzo', icon: Beef },
            { id: 'cena', label: 'Cena', icon: Moon },
            { id: 'snack', label: 'Snack', icon: Apple }
          ].map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all capitalize ${activeCategory === cat.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>
        
        {!showAddForm && (
          <button 
            onClick={() => setShowAddForm(true)}
            className="w-full mb-6 flex items-center justify-center gap-2 bg-primary/20 text-primary border border-primary/50 py-3 rounded-xl font-bold hover:bg-primary/30 transition-all"
          >
            <Plus className="w-5 h-5" />
            Subir Nueva Receta
          </button>
        )}

        <AssessmentModal isOpen={showAssessment} onClose={() => setShowAssessment(false)} />

        {showAddForm && (
          <div className="bg-slate-800 p-4 rounded-xl mb-6 border border-slate-700 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">{editingMealId ? 'Editar Receta' : 'Nueva Receta'}</h3>
              <button onClick={() => {
                setShowAddForm(false);
                setEditingMealId(null);
                setNewMeal({ name: '', category: 'desayuno', ingredients: '', instructions: '', video_url: '' });
              }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddMeal} className="flex flex-col gap-3">
              <div 
                onClick={() => !uploadingImage && fileInputRef.current?.click()}
                className={`w-full min-h-[200px] bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden relative group ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {uploadingImage ? (
                  <div className="flex flex-col items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                    <span className="text-sm font-medium text-slate-400">Subiendo imagen...</span>
                  </div>
                ) : newMeal.image_url ? (
                  <div className="relative w-full group">
                    <img src={newMeal.image_url} alt="Preview" className="w-full h-auto object-contain max-h-[400px]" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-4">
                      <span className="text-white font-bold bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm">Cambiar Imagen</span>
                      {(user?.role === 'admin' || user?.email === 'guantesparaencajar@gmail.com' || user?.email === 'hernandezkevin001998@gmail.com') && (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('¿Estás seguro de que quieres eliminar esta imagen?')) {
                              setNewMeal({ ...newMeal, image_url: '' });
                            }
                          }}
                          className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-lg backdrop-blur-sm transition-colors"
                          title="Eliminar Imagen"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-12">
                    <ImageIcon className="w-12 h-12 text-slate-500 mb-3" />
                    <span className="text-sm font-medium text-slate-400">Haz clic para añadir foto del plato</span>
                    <span className="text-xs text-slate-500 mt-1">Se ajustará automáticamente para verse perfecta</span>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />

              <input 
                type="text" 
                placeholder="Nombre de la receta" 
                value={newMeal.name}
                onChange={(e) => setNewMeal({...newMeal, name: e.target.value})}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-white"
                required
              />
              <select 
                value={newMeal.category}
                onChange={(e) => setNewMeal({...newMeal, category: e.target.value})}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-white"
              >
                <option value="desayuno">Desayuno</option>
                <option value="almuerzo">Almuerzo</option>
                <option value="cena">Cena</option>
                <option value="snack">Snack</option>
              </select>
              <textarea 
                placeholder="Ingredientes (separados por coma)" 
                value={newMeal.ingredients}
                onChange={(e) => setNewMeal({...newMeal, ingredients: e.target.value})}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none h-20 text-white"
                required
              />
              <textarea 
                placeholder="Instrucciones de preparación" 
                value={newMeal.instructions}
                onChange={(e) => setNewMeal({...newMeal, instructions: e.target.value})}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none h-24 text-white"
                required
              />
              <input 
                type="url" 
                placeholder="URL del video de preparación (ej. YouTube, Vimeo)" 
                value={newMeal.video_url || ''}
                onChange={(e) => setNewMeal({...newMeal, video_url: e.target.value})}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-white"
              />
              <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-lg mt-2 hover:bg-primary/90 transition-colors">
                {editingMealId ? 'Guardar Cambios' : 'Guardar Receta'}
              </button>
            </form>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        {filteredMeals.length === 0 ? (
          <div className="text-center py-10 bg-slate-800/30 rounded-2xl border border-slate-700/50">
            <Utensils className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No se encontraron recetas.</p>
          </div>
        ) : (
          filteredMeals.map(meal => {
            const isConsumed = consumedMeals.includes(meal.id);
            return (
              <div key={meal.id} className={`bg-slate-800 rounded-xl border transition-colors overflow-hidden shadow-lg ${isConsumed ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-slate-700'}`}>
                {meal.video_url ? (
                  <div className="w-full aspect-video bg-slate-900 border-b border-slate-700">
                    {meal.video_url.includes('youtube.com') || meal.video_url.includes('youtu.be') ? (
                      <iframe 
                        src={`https://www.youtube.com/embed/${meal.video_url.split('v=')[1] || meal.video_url.split('youtu.be/')[1]}`} 
                        className="w-full h-full"
                        allowFullScreen
                      ></iframe>
                    ) : (
                      <video src={meal.video_url} controls className="w-full h-full object-cover" />
                    )}
                  </div>
                ) : meal.image_url ? (
                  <div className="w-full aspect-[16/10] bg-slate-900 flex items-center justify-center border-b border-slate-700 relative group/img overflow-hidden">
                    <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-700" />
                    
                    {/* Admin Image Actions */}
                    {(user?.role === 'admin' || user?.email === 'guantesparaencajar@gmail.com' || user?.email === 'hernandezkevin001998@gmail.com') && (
                      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditMealClick(meal);
                          }}
                          className="bg-blue-500 text-white p-2 rounded-lg shadow-lg hover:bg-blue-600 transition-colors"
                          title="Editar Receta"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('¿Estás seguro de que quieres eliminar la imagen de esta receta?')) {
                              try {
                                await updateDoc(doc(db, 'meals', meal.id), { image_url: '' });
                                fetchMeals();
                              } catch (error) {
                                console.error('Error deleting meal image:', error);
                              }
                            }
                          }}
                          className="bg-red-500 text-white p-2 rounded-lg shadow-lg hover:bg-red-600 transition-colors"
                          title="Eliminar Imagen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {isConsumed && (
                      <div className="absolute inset-0 bg-emerald-900/40 flex items-center justify-center backdrop-blur-[1px]">
                        <div className="bg-emerald-500 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-xl">
                          <CheckCircle2 className="w-5 h-5" /> Consumido Hoy
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 pr-4 min-w-0">
                      <h3 className="font-bold text-2xl text-white mb-1 break-words">
                        {meal.name.replace(/\s*[\(\[].*?(kcal|cal|prot|carb|gras|fat).*?[\)\]]/gi, '').trim()}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">
                        <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{meal.category}</span>
                        <span>•</span>
                        <span>{meal.ingredients.split(',').length} Ingredientes</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(user?.role === 'teacher' || user?.role === 'admin' || user?.email === 'guantesparaencajar@gmail.com' || user?.email === 'hernandezkevin001998@gmail.com') && editingNutritionId !== meal.id && (
                        <button 
                          onClick={() => setEditingNutritionId(meal.id)}
                          className="text-primary text-sm font-bold hover:underline"
                        >
                          + Añadir Macros
                        </button>
                      )}

                      {editingNutritionId === meal.id && (
                        <form onSubmit={(e) => handleAddNutrition(e, meal.id)} className="mt-3 flex flex-wrap gap-2 max-w-md">
                          <input 
                            type="number" 
                            placeholder="Kcal" 
                            value={nutrition.calories}
                            onChange={(e) => setNutrition({...nutrition, calories: e.target.value})}
                            className="flex-1 min-w-[60px] bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                            required
                          />
                          <input 
                            type="number" 
                            placeholder="Carbs (g)" 
                            value={nutrition.carbs}
                            onChange={(e) => setNutrition({...nutrition, carbs: e.target.value})}
                            className="flex-1 min-w-[60px] bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                            required
                          />
                          <input 
                            type="number" 
                            placeholder="Prot (g)" 
                            value={nutrition.protein}
                            onChange={(e) => setNutrition({...nutrition, protein: e.target.value})}
                            className="flex-1 min-w-[60px] bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                            required
                          />
                          <input 
                            type="number" 
                            placeholder="Grasas (g)" 
                            value={nutrition.fats}
                            onChange={(e) => setNutrition({...nutrition, fats: e.target.value})}
                            className="flex-1 min-w-[60px] bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                            required
                          />
                          <button type="submit" className="bg-primary text-white px-3 rounded-lg font-bold text-sm">
                            ✓
                          </button>
                        </form>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button 
                        onClick={() => toggleConsumed(meal.id)}
                        className={`p-2 rounded-lg transition-colors ${isConsumed ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        title={isConsumed ? "Quitar de consumidos" : "Marcar como consumido"}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      {(user?.role === 'admin' || user?.email === 'guantesparaencajar@gmail.com' || user?.email === 'hernandezkevin001998@gmail.com' || meal.created_by === String(user?.id)) && (
                        <>
                          <button onClick={() => handleEditMealClick(meal)} className="p-2 bg-slate-700/50 text-slate-400 hover:text-primary rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteMeal(meal.id)} className="p-2 bg-slate-700/50 text-slate-400 hover:text-red-400 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-6 mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-primary" />
                      Ingredientes
                    </h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-400">
                      {meal.ingredients.split(',').map((ing, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div>
                          {ing.trim()}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-primary" />
                      Preparación paso a paso
                    </h4>
                    <div className="text-sm text-slate-400 space-y-3">
                      {meal.instructions.split('\n').filter(step => step.trim() !== '').map((step, i) => (
                        <div key={i} className="flex gap-3 items-start">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs shrink-0 mt-0.5">{i + 1}</span>
                          <span className="leading-relaxed">{step.replace(/^\d+\.\s*/, '')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
      </>
      )}

      {activeSection === 'libro' && (
        <section className="space-y-6">
          <div className="bg-emerald-600/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-4 mb-6">
            <div className="bg-emerald-500 p-3 rounded-xl">
              <Book className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Recetario Saludable</h3>
              <p className="text-xs text-slate-400">Recetas extraídas del Compilado de Recetas Saludables.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {HEALTHY_RECIPES.map(recipe => (
              <RecipeCard 
                key={recipe.id} 
                recipe={recipe} 
                onViewDetails={setSelectedHealthyRecipe} 
              />
            ))}
          </div>

          {selectedHealthyRecipe && (
            <div className="fixed inset-0 z-[60] bg-slate-950/95 flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="relative h-48 md:h-64 shrink-0">
                  <img 
                    src={selectedHealthyRecipe.imagen_url} 
                    alt={selectedHealthyRecipe.titulo}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button 
                    onClick={() => setSelectedHealthyRecipe(null)}
                    className="absolute top-4 right-4 bg-black/50 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/70 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2 break-words">{selectedHealthyRecipe.titulo}</h2>
                    <div className="flex gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {selectedHealthyRecipe.tiempo}</span>
                      <span className="flex items-center gap-1"><Flame className="w-4 h-4" /> {selectedHealthyRecipe.calorias_aprox} kcal</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-bold text-emerald-400 uppercase text-xs tracking-widest mb-3">Ingredientes</h4>
                      <ul className="space-y-2">
                        {selectedHealthyRecipe.ingredientes.map((ing, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                            {ing}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-400 uppercase text-xs tracking-widest mb-3">Preparación</h4>
                      <div className="space-y-4">
                        {selectedHealthyRecipe.preparacion.map((step, i) => (
                          <div key={i} className="flex gap-3">
                            <span className="font-bold text-emerald-500 text-sm">{i + 1}.</span>
                            <p className="text-sm text-slate-300 leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Fuente: {selectedHealthyRecipe.fuente}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeSection === 'tips' && (
        <section className="space-y-4">
          <div className="bg-amber-600/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-4 mb-6">
            <div className="bg-amber-500 p-3 rounded-xl">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Tips de Nutrición</h3>
              <p className="text-xs text-slate-400">Consejos prácticos para una vida más saludable.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {HEALTHY_TIPS.map(tip => (
              <div key={tip.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                <div className="flex justify-between items-start mb-3 gap-4">
                  <h4 className="font-bold text-lg text-white break-words min-w-0">{tip.titulo}</h4>
                  <span className="bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-amber-500/30 shrink-0">
                    {tip.categoria}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{tip.contenido}</p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest">Fuente: {tip.fuente}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
