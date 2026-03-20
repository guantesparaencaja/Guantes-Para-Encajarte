import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, CreditCard, Image as ImageIcon, Loader2 } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export function Payments() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const [bookingId, setBookingId] = useState<string | null>(location.state?.bookingId || null);
  const [booking, setBooking] = useState<any>(null);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bookingId) {
      const fetchBooking = async () => {
        const docRef = doc(db, 'bookings', bookingId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setBooking({ id: docSnap.id, ...docSnap.data() });
        }
      };
      fetchBooking();
    } else if (user?.id) {
      // Fetch pending bookings for the user
      const q = query(
        collection(db, 'bookings'),
        where('user_id', '==', user.id),
        where('payment_status', '==', 'pending')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const pending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPendingBookings(pending);
        if (pending.length === 1) {
          setBookingId(pending[0].id);
        }
      });
      return () => unsubscribe();
    }
  }, [bookingId, user?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !bookingId || !user) return;

    setUploading(true);
    setError(null);

    try {
      const storageRef = ref(storage, `payments/${bookingId}_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
        },
        (err) => {
          console.error(err);
          setError('Error al subir el archivo. Inténtalo de nuevo.');
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Update booking with payment info
          await updateDoc(doc(db, 'bookings', bookingId), {
            payment_proof_url: downloadURL,
            payment_status: 'submitted',
            payment_submitted_at: new Date().toISOString()
          });

          // Create a notification for admin (optional, but good practice)
          await addDoc(collection(db, 'notifications'), {
            user_id: 'admin', // Or specific admin ID
            type: 'payment_submitted',
            message: `Nuevo comprobante de pago de ${user.name} para la clase del ${booking.date}`,
            booking_id: bookingId,
            created_at: new Date().toISOString(),
            read: false
          });

          setSuccess(true);
          setUploading(false);
          
          setTimeout(() => {
            navigate('/calendar');
          }, 3000);
        }
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setUploading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display p-4 pb-24">
      <header className="flex items-center justify-between mb-8">
        <button onClick={() => navigate(-1)} className="text-primary p-2 hover:bg-primary/10 rounded-full transition-colors">
          <ArrowLeft className="w-8 h-8" />
        </button>
        <h1 className="text-2xl font-black uppercase tracking-tight italic">Confirmar Pago</h1>
        <div className="w-12"></div>
      </header>

      <div className="max-w-md mx-auto w-full">
        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-3xl text-center flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/40">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-emerald-500 uppercase">¡Enviado con éxito!</h2>
            <p className="text-slate-400 font-medium">
              Tu comprobante ha sido recibido. El profesor confirmará tu clase en breve. 
              Si no hay respuesta en 3 horas, se confirmará automáticamente.
            </p>
            <p className="text-xs text-slate-500 mt-4">Redirigiendo al calendario...</p>
          </div>
        ) : !bookingId && pendingBookings.length > 0 ? (
          <div className="bg-slate-800/50 rounded-3xl border border-slate-700 p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white uppercase italic mb-4">Selecciona una Reserva</h2>
            <div className="space-y-3">
              {pendingBookings.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBookingId(b.id)}
                  className="w-full bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-left hover:border-primary transition-all"
                >
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Clase del {b.date}</p>
                  <p className="text-sm font-black text-white uppercase italic">{b.time}</p>
                </button>
              ))}
            </div>
          </div>
        ) : !bookingId ? (
          <div className="bg-slate-800/50 rounded-3xl border border-slate-700 p-8 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-slate-500">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white uppercase italic">No hay reservas pendientes</h2>
            <p className="text-slate-400 text-sm">Primero debes reservar una clase en el calendario.</p>
            <button onClick={() => navigate('/calendar')} className="mt-4 bg-primary text-white font-bold py-3 px-8 rounded-xl">
              Ir al Calendario
            </button>
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-3xl border border-slate-700 p-6 shadow-2xl">
            <div className="flex items-center gap-4 mb-6 p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Reserva Seleccionada</p>
                <p className="text-sm font-black text-white uppercase italic">
                  {booking ? `${booking.date} • ${booking.time}` : 'Cargando...'}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest italic">
                  Enlaces Directos a Bancos
                </label>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <a 
                    href="https://recarga.nequi.com.co/bdigitalpsl/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-[#1a1a2e] border border-[#2a2a4a] hover:border-[#4a4a8a] transition-colors rounded-xl p-3 flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-10 h-10 bg-[#E80054] rounded-full flex items-center justify-center text-white font-black italic text-xl">N</div>
                    <span className="text-xs font-bold text-slate-300">Nequi</span>
                  </a>
                  <a 
                    href="https://www.bancolombia.com/personas" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-[#1a1a2e] border border-[#2a2a4a] hover:border-[#4a4a8a] transition-colors rounded-xl p-3 flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-10 h-10 bg-[#FDDA24] rounded-full flex items-center justify-center text-black font-black italic text-xl">B</div>
                    <span className="text-xs font-bold text-slate-300">Bancolombia</span>
                  </a>
                  <a 
                    href="https://www.daviplata.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-[#1a1a2e] border border-[#2a2a4a] hover:border-[#4a4a8a] transition-colors rounded-xl p-3 flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-10 h-10 bg-[#ED1C24] rounded-full flex items-center justify-center text-white font-black italic text-xl">D</div>
                    <span className="text-xs font-bold text-slate-300">Daviplata</span>
                  </a>
                  <a 
                    href="https://www.pse.com.co/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-[#1a1a2e] border border-[#2a2a4a] hover:border-[#4a4a8a] transition-colors rounded-xl p-3 flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-10 h-10 bg-[#00A4E4] rounded-full flex items-center justify-center text-white font-black italic text-xl">P</div>
                    <span className="text-xs font-bold text-slate-300">PSE</span>
                  </a>
                </div>

                <label className="block text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest italic">
                  Instrucciones de Pago
                </label>
                <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 text-sm space-y-3">
                  <p className="flex items-center gap-3 text-slate-300 font-bold">
                    <span className="w-6 h-6 bg-primary/20 text-primary rounded-lg flex items-center justify-center text-[10px] font-black italic">1</span>
                    Transferencia Nequi: <strong className="text-white">302 202 8477</strong>
                  </p>
                  <p className="flex items-center gap-3 text-slate-300 font-bold">
                    <span className="w-6 h-6 bg-primary/20 text-primary rounded-lg flex items-center justify-center text-[10px] font-black italic">2</span>
                    Captura de pantalla del comprobante.
                  </p>
                  <p className="flex items-center gap-3 text-slate-300 font-bold">
                    <span className="w-6 h-6 bg-primary/20 text-primary rounded-lg flex items-center justify-center text-[10px] font-black italic">3</span>
                    Sube la imagen para validar.
                  </p>
                </div>
              </div>

              <div className="relative">
                <input
                  type="file"
                  id="payment-file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="payment-file"
                  className={`w-full aspect-video rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden relative
                    ${file ? 'border-primary bg-primary/5' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-800'}
                  `}
                >
                  {file ? (
                    <>
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="Preview" 
                        className="absolute inset-0 w-full h-full object-cover opacity-40"
                      />
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <ImageIcon className="w-10 h-10 text-primary" />
                        <span className="text-sm font-bold text-white">{file.name}</span>
                        <span className="text-[10px] text-primary uppercase font-black">Click para cambiar</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-slate-500" />
                      <span className="text-sm font-bold text-slate-400">Seleccionar Comprobante</span>
                      <span className="text-[10px] text-slate-600 uppercase font-black">JPG, PNG (Máx 5MB)</span>
                    </>
                  )}
                </label>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl
                  ${!file || uploading 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : 'bg-primary text-white hover:scale-[1.02] active:scale-[0.98] shadow-primary/20'
                  }
                `}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Subiendo ({Math.round(progress)}%)
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-6 h-6" />
                    Confirmar Envío
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
