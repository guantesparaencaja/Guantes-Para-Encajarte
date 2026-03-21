import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Calendar as CalendarIcon, Clock, ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, Globe, XCircle, Plus, Trash2, AlertCircle, ShieldCheck, CreditCard, Upload, User, Star, CheckCircle2, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek, addMonths, subMonths, isSameDay, isSameMonth, differenceInHours, isBefore, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, setDoc, onSnapshot, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { sendPushNotification } from '../lib/fcmService';
import { Modal } from '../components/Modal';
// import { sendEmail } from '../lib/email';

interface Availability {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  title: string;
  description: string;
  rules: string;
  max_students?: number;
}

interface Class {
  id: number;
  method: string;
  description: string;
  date: string;
  time: string;
  duration: number;
  material: string;
  capacity?: number;
}

interface Booking {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  class_id: string;
  date: string;
  time: string;
  status: string;
  rating?: number;
  feedback?: string;
  created_at?: string;
}

export function Calendar() {
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const [classes, setClasses] = useState<Class[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<Availability | null>(null);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [ratingModal, setRatingModal] = useState<{isOpen: boolean, bookingId: string | null, rating: number, feedback: string}>({isOpen: false, bookingId: null, rating: 0, feedback: ''});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalBookingId, setPaymentModalBookingId] = useState<string | null>(null);
  const [isWaitlistBooking, setIsWaitlistBooking] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [adminConfirmPaymentId, setAdminConfirmPaymentId] = useState<string | null>(null);
  const [showAdminConfirmModal, setShowAdminConfirmModal] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'info';
    bookingId?: string;
  }>({ show: false, message: '', type: 'info' });

  // Check for unrated past classes
  useEffect(() => {
    if (user && user.role !== 'admin' && bookings.length > 0) {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const unrated = bookings.find(b => {
        if (b.status !== 'active' || b.rating) return false;
        try {
          const bookingDate = parse(b.date, 'yyyy-MM-dd', new Date());
          return isBefore(bookingDate, today);
        } catch (e) {
          return false;
        }
      });
      
      if (unrated && !ratingModal.isOpen && ratingModal.bookingId !== unrated.id) {
        setRatingModal({
          isOpen: true,
          bookingId: unrated.id,
          rating: 0,
          feedback: ''
        });
      }
    }
  }, [bookings, user, ratingModal.isOpen, ratingModal.bookingId]);

  const handleRateClass = async () => {
    if (!ratingModal.bookingId || ratingModal.rating === 0) return;
    
    try {
      await setDoc(doc(db, 'bookings', ratingModal.bookingId), {
        rating: ratingModal.rating,
        feedback: ratingModal.feedback
      }, { merge: true });
      setRatingModal({ isOpen: false, bookingId: null, rating: 0, feedback: '' });
      fetchBookings();
    } catch (err) {
      console.error("Error rating class:", err);
    }
  };
  const [showAddAvailability, setShowAddAvailability] = useState(false);
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<string | null>(null);
  const [newAvailability, setNewAvailability] = useState<Partial<Availability>>({
    day_of_week: 'Lunes',
    start_time: '08:00',
    end_time: '10:00',
    title: 'Clase Personalizada',
    description: 'Entrenamiento enfocado en técnica y cardio.',
    rules: 'Qué llevar: Guantes, vendas, hidratación. Máximo para cancelar clase ya pagada es de 3 horas. Si desea colocar una ubicación diferente, informar con dos días de anterioridad.',
    max_students: 4
  });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const fetchBookings = () => {
    if (!user) {
      console.log("Calendar: No user found, skipping fetchBookings");
      return () => {};
    }
    
    console.log("Calendar: Fetching bookings for user", user.id, "role", user.role);
    let q;
    if (user.role === 'admin') {
      q = query(collection(db, 'bookings'));
    } else {
      q = query(collection(db, 'bookings'), where('user_id', '==', String(user.id)));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("Calendar: Bookings snapshot received, count:", snapshot.size);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      setBookings(data);
      if (user.role === 'admin') {
        setAllBookings(data);
      }
    }, (err) => {
      console.error("Calendar: Error fetching bookings:", err);
    });

    // Also fetch all bookings for students to see availability
    if (user.role !== 'admin') {
      const allQ = query(collection(db, 'bookings'));
      const unsubscribeAll = onSnapshot(allQ, (snapshot) => {
        console.log("Calendar: All bookings snapshot received, count:", snapshot.size);
        const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
        setAllBookings(allData);
      }, (err) => {
        console.error("Calendar: Error fetching all bookings:", err);
      });
      return () => {
        unsubscribe();
        unsubscribeAll();
      };
    }

    return () => unsubscribe();
  };

  const fetchAvailabilities = () => {
    if (!user) {
      console.log("Calendar: No user found, skipping fetchAvailabilities");
      return () => {};
    }
    
    console.log("Calendar: Fetching availabilities");
    const unsubscribe = onSnapshot(collection(db, 'availabilities'), (snapshot) => {
      console.log("Calendar: Availabilities snapshot received, count:", snapshot.size);
      if (snapshot.empty) {
        console.log("Calendar: Availabilities collection is empty");
        // Seed default availabilities if empty (only if admin)
        if (user?.role === 'admin') {
          console.log("Calendar: Admin detected, seeding default availabilities");
          seedDefaultAvailabilities();
        }
      } else {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Availability));
        setAvailabilities(data);
      }
    }, (err) => {
      console.error("Calendar: Error fetching availabilities:", err);
    });
    return () => unsubscribe();
  };

  const seedDefaultAvailabilities = async () => {
    const defaultAvailabilities = [
      ...['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map(day => ({
        day_of_week: day,
        start_time: '18:00',
        end_time: '20:00',
        title: 'Clase Grupal',
        description: 'Entrenamiento funcional y boxeo',
        rules: 'Llegar 10 min antes',
        max_students: 4
      })),
      ...['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map(day => ({
        day_of_week: day,
        start_time: '20:00',
        end_time: '22:00',
        title: 'Clase Grupal',
        description: 'Entrenamiento funcional y boxeo',
        rules: 'Llegar 10 min antes',
        max_students: 4
      })),
      {
        day_of_week: 'Domingo',
        start_time: '19:00',
        end_time: '21:00',
        title: 'Clase Abierta',
        description: 'Entrenamiento libre',
        rules: 'Traer guantes',
        max_students: 999
      }
    ];
    
    for (const avail of defaultAvailabilities) {
      await addDoc(collection(db, 'availabilities'), avail);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    const unsubAvail = fetchAvailabilities();
    const unsubBookings = fetchBookings();
    return () => {
      if (typeof unsubAvail === 'function') unsubAvail();
      if (typeof unsubBookings === 'function') unsubBookings();
    };
  }, [user]);

  const handleAddAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAvailabilityId) {
        const docRef = doc(db, 'availabilities', editingAvailabilityId);
        await setDoc(docRef, newAvailability, { merge: true });
        setAvailabilities(availabilities.map(a => a.id === editingAvailabilityId ? { ...a, ...newAvailability } as Availability : a));
        setShowAddAvailability(false);
        setEditingAvailabilityId(null);
      } else {
        const docRef = await addDoc(collection(db, 'availabilities'), newAvailability);
        setAvailabilities([...availabilities, { id: docRef.id, ...newAvailability } as Availability]);
        setShowAddAvailability(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditAvailabilityClick = (avail: Availability) => {
    setNewAvailability(avail);
    setEditingAvailabilityId(avail.id);
    setShowAddAvailability(true);
  };

  const handleDeleteAvailability = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'availabilities', id));
      setAvailabilities(availabilities.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleBook = async (isWaitlist: boolean = false) => {
    if (!user || !selectedTime) return;
    setIsWaitlistBooking(isWaitlist);
    setShowConfirmModal(true);
  };

  const confirmBooking = async () => {
    if (!user || !selectedTime) return;
    
    // Check if user has classes remaining
    if (user.role === 'student' && (user.classes_remaining || 0) <= 0 && !isWaitlistBooking) {
      setAlertModal({
        show: true,
        message: "No tienes clases restantes en tu plan. Por favor, compra una clase individual o renueva tu plan.",
        type: 'info'
      });
      setShowConfirmModal(false);
      return;
    }

    setShowConfirmModal(false);
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const timeStr = `${selectedTime.start_time} - ${selectedTime.end_time}`;
      
      // If student has classes, it's active immediately. If not (and somehow they got here), it's pending_payment.
      const status = isWaitlistBooking ? 'waitlist' : ((user.classes_remaining || 0) > 0 ? 'active' : 'pending_payment');

      const newBooking = {
        user_id: String(user.id),
        user_name: user.name,
        user_email: user.email,
        class_id: selectedTime.id,
        date: dateStr,
        time: timeStr,
        status: status,
        created_at: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'bookings'), newBooking);
      
      // Deduct class from user quota if it's an active booking
      if (status === 'active' && !isWaitlistBooking) {
        const newRemaining = Math.max(0, (user.classes_remaining || 0) - 1);
        await updateDoc(doc(db, 'users', String(user.id)), {
          classes_remaining: newRemaining
        });
        // Update local state too
        setUser({ ...user, classes_remaining: newRemaining });
      }

      await fetchBookings();
      
      if (isWaitlistBooking) {
        setAlertModal({
          show: true,
          message: `Te has unido a la lista de espera para el ${format(selectedDate, 'dd/MM/yyyy')} a las ${timeStr}.`,
          type: 'success'
        });
        setSelectedTime(null);
        setShowMyBookings(true);
      } else if (status === 'active') {
        setAlertModal({
          show: true,
          message: `Tu clase ha sido reservada para el ${format(selectedDate, 'dd/MM/yyyy')} a las ${timeStr}. Se ha descontado 1 clase de tu plan.`,
          type: 'success'
        });
        setSelectedTime(null);
        setShowMyBookings(true);
      } else {
        setPaymentModalBookingId(docRef.id);
        setShowPaymentModal(true);
      }
    } catch (err: any) {
      console.error(err);
      setAlertModal({
        show: true,
        message: 'Error al procesar la reserva: ' + err.message,
        type: 'info'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateICS = (booking: Booking) => {
    const [year, month, day] = booking.date.split('-').map(Number);
    const [startStr, endStr] = booking.time.split(' - ');
    
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);
    
    // Create dates in local time, then convert to UTC string for ICS
    const startDate = new Date(year, month - 1, day, startH, startM);
    const endDate = new Date(year, month - 1, day, endH, endM);
    
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '').substring(0, 15) + 'Z';
    };

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//GUANTES//ES
BEGIN:VEVENT
UID:${booking.id}@guantes.app
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:Clase de Boxeo - GUANTES
DESCRIPTION:Clase personalizada de boxeo
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `clase_guantes_${booking.date}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateGoogleCalendarUrl = (booking: Booking) => {
    const [year, month, day] = booking.date.split('-').map(Number);
    const [startStr, endStr] = booking.time.split(' - ');
    
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);
    
    const startDate = new Date(year, month - 1, day, startH, startM);
    const endDate = new Date(year, month - 1, day, endH, endM);
    
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '').substring(0, 15) + 'Z';
    };

    const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
    const text = encodeURIComponent('Clase de Boxeo - GUANTES');
    const dates = `${formatDate(startDate)}/${formatDate(endDate)}`;
    const details = encodeURIComponent('Clase personalizada de boxeo en GUANTES.');
    const location = encodeURIComponent('GUANTES Boxing Club');

    return `${baseUrl}&text=${text}&dates=${dates}&details=${details}&location=${location}`;
  };

  const handleCancelBooking = async (bookingId: string, dateStr: string, timeStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [startTime] = timeStr.split(' - ');
    const [hours, minutes] = startTime.split(':').map(Number);
    const classDate = new Date(year, month - 1, day, hours, minutes);
    const now = new Date();

    if (classDate < now) {
      setAlertModal({ show: true, message: 'No puedes cancelar una clase que ya pasó.', type: 'info' });
      return;
    }

    const hoursDifference = differenceInHours(classDate, now);

    if (hoursDifference < 2) {
      setAlertModal({ show: true, message: 'No puedes cancelar una clase con menos de 2 horas de anticipación. No se retornará el dinero.', type: 'info' });
      return;
    }

    setCancelBookingId(bookingId);
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!cancelBookingId || !user) return;
    try {
      const bookingRef = doc(db, 'bookings', cancelBookingId);
      const bookingSnap = await getDoc(bookingRef);
      
      if (bookingSnap.exists()) {
        const bookingData = bookingSnap.data();
        await setDoc(bookingRef, { status: 'cancelled' }, { merge: true });
        
        // Return class to user quota if it was an active booking
        if (bookingData.status === 'active') {
          const newRemaining = (user.classes_remaining || 0) + 1;
          await updateDoc(doc(db, 'users', String(user.id)), {
            classes_remaining: newRemaining
          });
          setUser({ ...user, classes_remaining: newRemaining });
        }
      }

      setAlertModal({ show: true, message: 'Reserva cancelada exitosamente. Se ha devuelto la clase a tu plan.', type: 'success' });
      setShowCancelModal(false);
      setCancelBookingId(null);
    } catch (err: any) {
      console.error(err);
      setAlertModal({ show: true, message: 'Error al cancelar la reserva: ' + err.message, type: 'info' });
    }
  };

  const confirmAdminPayment = async () => {
    if (!adminConfirmPaymentId) return;
    try {
      const bookingRef = doc(db, 'bookings', adminConfirmPaymentId);
      const bookingSnap = await getDoc(bookingRef);
      
      if (bookingSnap.exists()) {
        const bookingData = bookingSnap.data();
        await updateDoc(bookingRef, { status: 'active' });
        
        // Send push notification to user
        await sendPushNotification(
          bookingData.user_id,
          '¡Clase Confirmada!',
          `Tu pago para la clase del ${new Date(bookingData.date).toLocaleDateString()} ha sido aprobado. ¡Te esperamos!`
        );
      }

      setAlertModal({ show: true, message: 'Reserva confirmada exitosamente', type: 'success' });
      setShowAdminConfirmModal(false);
      setAdminConfirmPaymentId(null);
    } catch (err: any) {
      console.error(err);
      setAlertModal({ show: true, message: 'Error al confirmar el pago: ' + err.message, type: 'info' });
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Memoized calendar days
  const calendarDays = React.useMemo(() => {
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    return Array.from({ length: 42 }).map((_, i) => addDays(startDate, i));
  }, [currentMonth]);

  const daysOfWeekMap: Record<string, string> = {
    '0': 'Domingo', '1': 'Lunes', '2': 'Martes', '3': 'Miércoles', '4': 'Jueves', '5': 'Viernes', '6': 'Sábado'
  };
  const selectedDayOfWeek = daysOfWeekMap[selectedDate.getDay().toString()];
  
  // Memoized days with classes
  const daysWithClasses = React.useMemo(() => {
    const days = new Set<string>();
    availabilities.forEach(a => {
      if (a && a.day_of_week) {
        days.add(a.day_of_week);
      }
    });
    return days;
  }, [availabilities]);

  // Memoized available slots with counts
  const availableSlotsWithCounts = React.useMemo(() => {
    const now = new Date();
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const isToday = isSameDay(selectedDate, now);
    
    return availabilities
      .filter(a => {
        if (!a) return false;
        if (a.day_of_week !== selectedDayOfWeek) return false;
        
        const userAlreadyBooked = allBookings.some(b => b && b.date === selectedDateStr && b.class_id === a.id && b.user_id === String(user?.id) && b.status === 'active');
        if (userAlreadyBooked) return false;
        
        if (isToday) {
          try {
            const [hours, minutes] = (a.start_time || '00:00').split(':').map(Number);
            const slotTime = new Date(selectedDate);
            slotTime.setHours(hours, minutes, 0, 0);
            
            const minAdvanceTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
            if (isBefore(slotTime, minAdvanceTime)) {
              return false;
            }
          } catch (e) {
            return false;
          }
        }
        
        return true;
      })
      .map(slot => {
        const activeBookingsCount = allBookings.filter(b => b.date === selectedDateStr && b.class_id === slot.id && b.status === 'active').length;
        const spotsLeft = slot.max_students ? slot.max_students - activeBookingsCount : null;
        return { ...slot, activeBookingsCount, spotsLeft };
      })
      .sort((a, b) => (a?.start_time || '').localeCompare(b?.start_time || ''));
  }, [availabilities, selectedDayOfWeek, allBookings, selectedDate, user?.id]);

  // Memoized active and past bookings
  const { activeBookings, pastBookings } = React.useMemo(() => {
    const now = new Date();
    return {
      activeBookings: bookings.filter(b => {
        if (!b || !b.date || !b.time) return false;
        if (b.status !== 'active' && b.status !== 'pending_payment' && b.status !== 'waitlist') return false;
        try {
          const [startTime] = b.time.split(' - ');
          const [hours, minutes] = startTime.split(':').map(Number);
          const [year, month, day] = b.date.split('-').map(Number);
          const bookingDate = new Date(year, month - 1, day, hours, minutes);
          return bookingDate >= now;
        } catch (e) {
          return false;
        }
      }),
      pastBookings: bookings.filter(b => {
        if (!b || !b.date || !b.time) return true;
        if (b.status === 'cancelled') return true;
        try {
          const [startTime] = b.time.split(' - ');
          const [hours, minutes] = startTime.split(':').map(Number);
          const [year, month, day] = b.date.split('-').map(Number);
          const bookingDate = new Date(year, month - 1, day, hours, minutes);
          return bookingDate < now;
        } catch (e) {
          return true;
        }
      })
    };
  }, [bookings]);

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display p-4 pb-24">
      <header className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="text-primary p-2 hover:bg-primary/10 rounded-full transition-colors">
          <ArrowLeft className="w-8 h-8" />
        </button>
        <h1 className="text-2xl font-black uppercase tracking-tight italic">Calendario</h1>
        <div className="w-12"></div>
      </header>

      {user?.role === 'student' && (
        <div className="mb-6 space-y-4">
          <div className="glass-card p-6 rounded-3xl border-white/10 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Plan Actual</p>
              <h3 className="text-xl font-black uppercase italic text-white">{user.plan_name || 'Sin Plan'}</h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Clases Restantes</p>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-3xl font-black italic text-primary">{user.classes_remaining ?? 0}</span>
                <span className="text-xs font-bold text-slate-500 uppercase">/ {user.classes_per_month ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800">
            <button 
              onClick={() => setShowMyBookings(false)}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!showMyBookings ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500'}`}
            >
              Reservar Clase
            </button>
            <button 
              onClick={() => setShowMyBookings(true)}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showMyBookings ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500'}`}
            >
              Mis Reservas
            </button>
          </div>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="mb-6 bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-blue-400 mb-1">Google Calendar Sync</h3>
            <p className="text-xs text-slate-300">
              Las reservas ahora se pueden sincronizar con Google Calendar usando los botones de "Google" o "ICS" en tus reservas.
            </p>
          </div>
        </div>
      )}

      {user?.role === 'admin' ? (
        <div className="space-y-8">
          {/* Admin: Booking Management */}
          <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black uppercase italic text-primary tracking-tight">Gestión de Reservas</h2>
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">En Vivo</span>
              </div>
            </div>
            
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {bookings.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold italic uppercase tracking-widest text-xs">No hay reservas registradas</p>
                </div>
              ) : (
                bookings.sort((a, b) => (b?.created_at || '').localeCompare(a?.created_at || '')).map(booking => (
                  <div key={booking.id} className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800 hover:border-primary/30 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800 group-hover:border-primary/20 transition-colors">
                          <User className="w-6 h-6 text-slate-600 group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase italic tracking-tight">{booking.user_name}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{booking.user_email}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border
                        ${booking.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                          booking.status === 'pending_payment' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          booking.status === 'waitlist' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                          'bg-slate-800 text-slate-500 border-slate-700'}
                      `}>
                        {booking.status === 'active' ? 'Confirmada' : 
                         booking.status === 'pending_payment' ? 'Pendiente' : 
                         booking.status === 'waitlist' ? 'Espera' : 'Cancelada'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-slate-900/50 rounded-xl border border-slate-800/50">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <CalendarIcon className="w-3.5 h-3.5 text-primary" /> {booking.date}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Clock className="w-3.5 h-3.5 text-primary" /> {booking.time}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {booking.status === 'pending_payment' && (
                        <button 
                          onClick={() => {
                            setAdminConfirmPaymentId(booking.id);
                            setShowAdminConfirmModal(true);
                          }}
                          className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                        >
                          Confirmar Pago
                        </button>
                      )}
                      <button 
                        onClick={() => handleCancelBooking(booking.id, booking.date, booking.time)}
                        className="flex-1 py-3 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 active:scale-95 transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden shadow-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Disponibilidad Semanal</h2>
            <button 
              onClick={() => setShowAddAvailability(!showAddAvailability)}
              className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nueva Disponibilidad
            </button>
          </div>
          <p className="text-slate-400 mb-6">Esta es la disponibilidad que verán los estudiantes para reservar (Clases de 2 horas).</p>
          
          {showAddAvailability && (
            <form onSubmit={handleAddAvailability} className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6 flex flex-col gap-3">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">{editingAvailabilityId ? 'Editar Horario' : 'Agregar Horario'}</h3>
                <button type="button" onClick={() => {
                  setShowAddAvailability(false);
                  setEditingAvailabilityId(null);
                  setNewAvailability({
                    day_of_week: 'Lunes',
                    start_time: '08:00',
                    end_time: '10:00',
                    title: 'Clase Personalizada',
                    description: 'Entrenamiento enfocado en técnica y cardio.',
                    rules: 'Qué llevar: Guantes, vendas, hidratación. Máximo para cancelar clase ya pagada es de 3 horas. Si desea colocar una ubicación diferente, informar con dos días de anterioridad.',
                    max_students: 4
                  });
                }} className="text-slate-400 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select 
                  value={newAvailability.day_of_week}
                  onChange={e => setNewAvailability({...newAvailability, day_of_week: e.target.value})}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="flex gap-2">
                  <input type="time" value={newAvailability.start_time} onChange={e => setNewAvailability({...newAvailability, start_time: e.target.value})} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" required />
                  <input type="time" value={newAvailability.end_time} onChange={e => setNewAvailability({...newAvailability, end_time: e.target.value})} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" required />
                </div>
              </div>
              <input type="text" placeholder="Título de la clase" value={newAvailability.title} onChange={e => setNewAvailability({...newAvailability, title: e.target.value})} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" required />
              <textarea placeholder="Descripción" value={newAvailability.description} onChange={e => setNewAvailability({...newAvailability, description: e.target.value})} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none h-20" required />
              <textarea placeholder="Reglas (Qué llevar, cancelación, etc)" value={newAvailability.rules} onChange={e => setNewAvailability({...newAvailability, rules: e.target.value})} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none h-20" required />
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400">Máximo de estudiantes (0 = sin límite):</label>
                <input type="number" min="0" value={newAvailability.max_students ?? 4} onChange={e => setNewAvailability({...newAvailability, max_students: parseInt(e.target.value) || 0})} className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <button type="submit" className="bg-primary text-white font-bold py-2 rounded-lg mt-2">{editingAvailabilityId ? 'Guardar Cambios' : 'Guardar Disponibilidad'}</button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(day => {
              const dayAvailabilities = availabilities.filter(a => a && a.day_of_week === day).sort((a, b) => (a?.start_time || '').localeCompare(b?.start_time || ''));
              return (
                <div key={day} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <h3 className="font-bold text-primary text-center mb-4 border-b border-slate-700 pb-2">{day}</h3>
                  <div className="flex flex-col gap-2">
                    {dayAvailabilities.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center">Sin horarios</p>
                    ) : (
                      dayAvailabilities.map(avail => (
                        <div key={avail.id} className="bg-slate-900/50 p-2 rounded border border-slate-700 group relative cursor-pointer" onClick={() => handleEditAvailabilityClick(avail)}>
                          <p className="text-slate-300 text-xs font-bold text-center">{avail.start_time} - {avail.end_time}</p>
                          <p className="text-[10px] text-slate-400 text-center truncate mt-1">{avail.title}</p>
                          <p className="text-[9px] text-primary text-center mt-1">
                            {avail.max_students ? `Máx: ${avail.max_students}` : 'Sin límite'}
                          </p>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteAvailability(avail.id); }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      ) : !showMyBookings ? (
        <div className="bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
          {/* Header Info */}
          <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-primary/10 to-transparent">
            <h2 className="text-xl font-black uppercase italic mb-1">Clase Personalizada</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-primary" /> 120 min
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5 text-primary" /> Colombia
              </div>
            </div>
          </div>

        <div className="p-5">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 italic">Selecciona fecha y hora</h3>
          
          <div className="flex flex-col gap-6">
            {/* Calendar */}
            <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-primary">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <p className="text-sm font-black uppercase tracking-widest italic">{format(currentMonth, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())}</p>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-primary">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((day, i) => (
                  <p key={i} className="text-slate-600 text-[10px] font-black flex h-8 w-full items-center justify-center uppercase">{day}</p>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isPast = day < new Date(new Date().setHours(0,0,0,0));
                  
                  return (
                    <button 
                      key={i}
                      onClick={() => !isPast && isCurrentMonth && setSelectedDate(day)}
                      disabled={isPast || !isCurrentMonth}
                      className={`h-10 w-full text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center relative
                        ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : ''}
                        ${isPast && isCurrentMonth ? 'opacity-25 cursor-not-allowed text-slate-600' : ''}
                        ${!isPast && isCurrentMonth ? 'hover:bg-primary/10 text-slate-300' : ''}
                        ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/40 scale-110 z-10' : ''}
                        ${isSameDay(day, new Date()) && !isSelected && isCurrentMonth ? 'border border-primary/50 text-primary' : ''}
                      `}
                    >
                      {format(day, 'd')}
                      {(() => {
                        const dayName = daysOfWeekMap[day.getDay().toString()];
                        const hasClasses = daysWithClasses.has(dayName);
                        return hasClasses && isCurrentMonth && !isPast && !isSelected ? (
                          <div className="absolute bottom-1.5 w-1 h-1 bg-primary rounded-full shadow-sm shadow-primary/50"></div>
                        ) : null;
                      })()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-center gap-6 border-t border-slate-800/50 pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-sm shadow-primary/50"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Con clases</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border border-primary/50 rounded-lg flex items-center justify-center">
                    <span className="text-[8px] font-black text-primary">H</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Hoy</span>
                </div>
              </div>
            </div>

            {/* Time Slots */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary italic">
                {format(selectedDate, 'EEEE, d MMMM', { locale: es })}
              </p>
              
              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {availableSlotsWithCounts.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No hay clases disponibles para este día.</p>
                ) : (
                  availableSlotsWithCounts.map((slot) => (
                    <div key={slot.id} className="flex flex-col gap-2 mb-4">
                      <button
                        onClick={() => setSelectedTime(slot)}
                        className={`flex flex-col p-4 rounded-xl text-sm border transition-all text-left
                          ${selectedTime?.id === slot.id 
                            ? 'bg-slate-700 border-primary' 
                            : 'bg-transparent border-primary/30 hover:border-primary hover:bg-primary/5'
                          }
                        `}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className={`font-bold text-lg ${selectedTime?.id === slot.id ? 'text-white' : 'text-primary'}`}>
                            {slot.start_time} - {slot.end_time}
                          </span>
                          <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">120 min</span>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                          <h4 className={`font-bold ${selectedTime?.id === slot.id ? 'text-white' : 'text-slate-200'}`}>{slot.title}</h4>
                          {slot.max_students && (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${slot.spotsLeft !== null && slot.spotsLeft <= 1 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {slot.activeBookingsCount}/{slot.max_students}
                              </span>
                              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${slot.spotsLeft !== null && slot.spotsLeft <= 1 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${Math.min(100, (slot.activeBookingsCount / slot.max_students) * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{slot.description}</p>
                        <p className="text-[10px] text-slate-500 italic border-t border-slate-700 pt-2 mt-1">{slot.rules}</p>
                      </button>
                      {selectedTime?.id === slot.id && (
                        <button 
                          onClick={() => handleBook(slot.spotsLeft !== null && slot.spotsLeft <= 0)}
                          className={`w-full text-white rounded-lg py-3 text-sm font-bold shadow-lg transition-all ${
                            slot.spotsLeft !== null && slot.spotsLeft <= 0 
                              ? 'bg-amber-500 hover:bg-amber-600' 
                              : 'bg-primary hover:bg-primary/90 neon-glow'
                          }`}
                        >
                          {slot.spotsLeft !== null && slot.spotsLeft <= 0 ? 'Unirse a Lista de Espera' : 'Confirmar Reserva'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-black uppercase italic text-primary">Mis Reservas</h2>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
              {bookings.filter(b => b.status !== 'cancelled').length} Activas
            </span>
          </div>
          
          {bookings.length === 0 ? (
            <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-12 text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                <CalendarIcon className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-bold">No tienes reservas aún</p>
              <button 
                onClick={() => setShowMyBookings(false)}
                className="mt-4 text-primary text-xs font-black uppercase tracking-widest"
              >
                Comenzar a entrenar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {bookings.sort((a, b) => (b?.date || '').localeCompare(a?.date || '')).map((booking) => (
                <div 
                  key={booking.id} 
                  className={`bg-slate-900/80 border rounded-3xl p-5 transition-all
                    ${booking.status === 'cancelled' ? 'opacity-50 border-slate-800' : 'border-slate-800 hover:border-primary/30'}
                  `}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl ${booking.status === 'cancelled' ? 'bg-slate-800' : 'bg-primary/20 text-primary'}`}>
                        <CalendarIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 italic">{booking.date}</p>
                        <p className="text-lg font-black uppercase italic">{booking.time}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border
                      ${booking.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                        booking.status === 'pending_payment' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-slate-800 text-slate-500 border-slate-700'}
                    `}>
                      {booking.status === 'active' ? 'Confirmada' : 
                       booking.status === 'pending_payment' ? 'Pendiente Pago' : 
                       booking.status === 'waitlist' ? 'Lista Espera' :
                       'Cancelada'}
                    </span>
                  </div>

                  {booking.status !== 'cancelled' && (
                    <div className="flex flex-col gap-3">
                      {booking.status === 'pending_payment' && (
                        <button
                          onClick={() => navigate('/payments', { state: { bookingId: booking.id } })}
                          className="w-full py-3 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20"
                        >
                          Subir Comprobante de Pago
                        </button>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={generateGoogleCalendarUrl(booking)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 hover:border-primary/30 transition-all"
                        >
                          <CalendarIcon className="w-3.5 h-3.5" /> Google
                        </a>
                        <button
                          onClick={() => generateICS(booking)}
                          className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 hover:border-primary/30 transition-all"
                        >
                          <CalendarIcon className="w-3.5 h-3.5" /> ICS
                        </button>
                      </div>

                      <button
                        onClick={() => handleCancelBooking(booking.id, booking.date, booking.time)}
                        className="w-full py-3 text-red-500/50 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors"
                      >
                        Cancelar Reserva
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rating Modal */}
      {ratingModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <Star className="w-8 h-8 fill-primary" />
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight mb-2">¿Cómo estuvo la clase?</h3>
              <p className="text-sm text-slate-400">Califica tu última sesión para ayudarnos a mejorar.</p>
            </div>
            
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRatingModal(prev => ({ ...prev, rating: star }))}
                  className={`p-2 transition-transform hover:scale-110 ${ratingModal.rating >= star ? 'text-primary' : 'text-slate-700'}`}
                >
                  <Star className={`w-8 h-8 ${ratingModal.rating >= star ? 'fill-primary' : ''}`} />
                </button>
              ))}
            </div>

            <textarea
              placeholder="¿Algún comentario adicional? (Opcional)"
              value={ratingModal.feedback}
              onChange={(e) => setRatingModal(prev => ({ ...prev, feedback: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white mb-6 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none h-24"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setRatingModal({ isOpen: false, bookingId: null, rating: 0, feedback: '' })}
                className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-colors"
              >
                Omitir
              </button>
              <button
                onClick={handleRateClass}
                disabled={ratingModal.rating === 0}
                className="flex-1 py-3 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals for Booking Flow */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirmar Reserva"
        footer={
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest"
            >
              Cancelar
            </button>
            <button
              onClick={confirmBooking}
              className="flex-1 py-3 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-widest"
            >
              Confirmar
            </button>
          </div>
        }
      >
        <div className="text-center py-4">
          <CalendarIcon className="w-12 h-12 text-primary mx-auto mb-4" />
          <p className="text-slate-300 text-sm">
            {isWaitlistBooking 
              ? "¿Deseas unirte a la lista de espera para esta clase? Te notificaremos si se libera un cupo."
              : "¿Estás seguro de que deseas reservar esta clase?"}
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Pago Requerido"
        footer={
          <button
            onClick={() => {
              setShowPaymentModal(false);
              navigate('/payments', { state: { bookingId: paymentModalBookingId } });
            }}
            className="w-full py-3 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-widest"
          >
            Ir a Pagos
          </button>
        }
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <p className="text-slate-300 text-sm mb-4">
            Tu reserva ha sido registrada, pero está pendiente de pago.
          </p>
          <p className="text-xs text-slate-500 italic">
            Tienes un tiempo limitado para confirmar tu pago antes de que la reserva sea cancelada.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={alertModal.show}
        onClose={() => setAlertModal(prev => ({ ...prev, show: false }))}
        title={alertModal.type === 'success' ? '¡Éxito!' : 'Aviso'}
        footer={
          <button
            onClick={() => setAlertModal(prev => ({ ...prev, show: false }))}
            className="w-full py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest"
          >
            Entendido
          </button>
        }
      >
        <div className="text-center py-4">
          {alertModal.type === 'success' ? (
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info className="w-8 h-8 text-blue-500" />
            </div>
          )}
          <p className="text-slate-300 text-sm">{alertModal.message}</p>
        </div>
      </Modal>

      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancelar Reserva"
        footer={
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setShowCancelModal(false)}
              className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest"
            >
              Volver
            </button>
            <button
              onClick={confirmCancel}
              className="flex-1 py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest"
            >
              Confirmar Cancelación
            </button>
          </div>
        }
      >
        <div className="text-center py-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-300 text-sm">
            ¿Estás seguro de que deseas cancelar esta reserva? Esta acción no se puede deshacer.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={showAdminConfirmModal}
        onClose={() => setShowAdminConfirmModal(false)}
        title="Confirmar Pago"
        footer={
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setShowAdminConfirmModal(false)}
              className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest"
            >
              Cancelar
            </button>
            <button
              onClick={confirmAdminPayment}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest"
            >
              Confirmar
            </button>
          </div>
        }
      >
        <div className="text-center py-4">
          <CreditCard className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <p className="text-slate-300 text-sm">
            ¿Confirmas que has recibido el pago para esta reserva?
          </p>
        </div>
      </Modal>
    </div>
  );
}
