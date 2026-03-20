import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { ArrowLeft, Send, Image as ImageIcon, Smile, Paperclip, X, Video, Heart, ThumbsUp, Flame, Laugh, Frown, Angry, CheckCheck, Pin, Hash, MessageSquare, Trophy, Apple, HelpCircle, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, where } from 'firebase/firestore';

interface Message {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  content: string;
  type: 'text' | 'image' | 'video';
  media_url?: string;
  created_at: any;
  reactions?: Record<string, string[]>; // emoji -> array of user_ids
  channel: string;
  is_pinned?: boolean;
}

const CHANNELS = [
  { id: 'general', name: 'General', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30' },
  { id: 'nutrition', name: 'Nutrición', icon: Apple, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  { id: 'achievements', name: 'Logros', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  { id: 'questions', name: 'Dudas', icon: HelpCircle, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
];

const MOODS = [
  { emoji: '🔥', label: 'Motivado' },
  { emoji: '💪', label: 'Fuerte' },
  { emoji: '😴', label: 'Cansado' },
  { emoji: '🥊', label: 'Listo para pelear' },
  { emoji: '🤕', label: 'Adolorido' }
];

// Helper to linkify text and highlight mentions
const formatMessageText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const mentionRegex = /(@\w+)/g;
  
  const parts = text.split(new RegExp(`(${urlRegex.source}|${mentionRegex.source})`, 'g')).filter(Boolean);
  
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{part}</a>;
    }
    if (part.match(mentionRegex)) {
      return <span key={i} className="text-primary font-bold bg-primary/10 px-1 rounded">{part}</span>;
    }
    return part;
  });
};

export function Community() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const [activeChannel, setActiveChannel] = useState('general');
  const [showShareMenu, setShowShareMenu] = useState(false);
  
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'messages'), 
      orderBy('created_at', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs.filter(m => m.channel === activeChannel));
    }, (error) => {
      console.error("Error fetching messages:", error);
    });

    return () => unsubscribe();
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent, textOverride?: string) => {
    if (e) e.preventDefault();
    const textToSend = textOverride || newMessage;
    if ((!textToSend.trim() && !selectedMedia) || !user) return;

    try {
      await addDoc(collection(db, 'messages'), {
        user_id: String(user.id),
        user_name: user.name,
        user_role: user.role,
        content: textToSend,
        type: selectedMedia ? selectedMedia.type : 'text',
        media_url: selectedMedia?.url || null,
        created_at: serverTimestamp(),
        reactions: {},
        channel: activeChannel,
        is_pinned: false
      });
      
      setNewMessage('');
      setSelectedMedia(null);
      setShowEmojiPicker(false);
      setShowShareMenu(false);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !user) return;

    const currentReactions = message.reactions || {};
    const usersWhoReacted = currentReactions[emoji] || [];
    const userIdStr = String(user.id);
    
    let newUsers = [...usersWhoReacted];
    if (newUsers.includes(userIdStr)) {
      newUsers = newUsers.filter(id => id !== userIdStr);
    } else {
      newUsers.push(userIdStr);
    }

    const updatedReactions = {
      ...currentReactions,
      [emoji]: newUsers
    };

    if (newUsers.length === 0) {
      delete updatedReactions[emoji];
    }

    try {
      const msgRef = doc(db, 'messages', messageId);
      await updateDoc(msgRef, { reactions: updatedReactions });
      setShowReactionPicker(null);
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  };

  const handleTogglePin = async (messageId: string, currentPinned: boolean) => {
    if (user?.role !== 'admin') return;
    try {
      const msgRef = doc(db, 'messages', messageId);
      await updateDoc(msgRef, { is_pinned: !currentPinned });
    } catch (error) {
      console.error('Error pinning message:', error);
    }
  };

  const handleSetMood = async (mood: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', String(user.id));
      await updateDoc(userRef, { mood });
      setUser({ ...user, mood } as any);
      setShowMoodSelector(false);
    } catch (error) {
      console.error('Error setting mood:', error);
    }
  };

  const onEmojiClick = (emojiObject: any) => {
    setNewMessage(prev => prev + emojiObject.emoji);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedMedia({ url: reader.result as string, type });
      };
      reader.readAsDataURL(file);
    }
  };

  const pinnedMessages = messages.filter(m => m.is_pinned);

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display pb-24">
      <header className="flex flex-col p-4 bg-slate-800/80 backdrop-blur-md border-b border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-primary flex size-10 shrink-0 items-center justify-center cursor-pointer" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">Comunidad GUANTES</h1>
              <p className="text-xs text-slate-400">Conecta con otros estudiantes</p>
            </div>
          </div>
        </div>

        {/* Channel Selector Removed as per user request */}

        {user?.role === 'student' && (
          <div className="relative mt-2">
            <button 
              onClick={() => setShowMoodSelector(!showMoodSelector)}
              className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-700 text-sm hover:bg-slate-800 transition-colors"
            >
              <span className="text-slate-400">Estado de ánimo hoy:</span>
              <span className="font-bold">{user.mood || '¿Cómo te sientes?'}</span>
            </button>
            
            {showMoodSelector && (
              <div className="absolute top-full left-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl p-2 shadow-xl flex flex-wrap gap-2 w-64 z-20">
                {MOODS.map(m => (
                  <button 
                    key={m.label}
                    onClick={() => handleSetMood(`${m.emoji} ${m.label}`)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700 rounded-lg w-full text-left text-sm transition-colors"
                  >
                    <span className="text-lg">{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      <div 
        className="flex-1 p-4 flex flex-col gap-4 relative overflow-y-auto"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop")', 
          backgroundSize: 'cover', 
          backgroundPosition: 'center', 
          backgroundAttachment: 'fixed' 
        }}
      >
        <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-[2px]"></div>
        
        <div className="relative z-10 flex flex-col gap-4 w-full max-w-2xl mx-auto pb-6">
          
          {/* Pinned Messages Section */}
          {pinnedMessages.length > 0 && (
            <div className="bg-slate-800/80 border border-primary/30 rounded-xl p-3 mb-2 shadow-lg">
              <div className="flex items-center gap-2 mb-2 text-primary">
                <Pin className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Mensajes Fijados</span>
              </div>
              <div className="flex flex-col gap-2">
                {pinnedMessages.map(msg => (
                  <div key={`pinned-${msg.id}`} className="text-sm bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                    <span className="font-bold text-emerald-400 mr-2">{msg.user_name}:</span>
                    <span className="text-slate-300">{formatMessageText(msg.content)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.user_id === String(user?.id);
            const isAdmin = msg.user_role === 'admin';
            const parsedReactions = msg.reactions || {};

            return (
              <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'} group relative animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                {!isMe && (
                  <span className={`text-[11px] font-medium mb-1 ml-1 flex items-center gap-1 ${isAdmin ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {msg.user_name} {isAdmin && <CheckCheck className="w-3 h-3" />}
                  </span>
                )}
                <div className={`relative p-3.5 rounded-2xl shadow-sm ${
                  isMe 
                    ? 'bg-primary text-white rounded-tr-sm' 
                    : 'bg-slate-800 border border-slate-700/50 text-slate-100 rounded-tl-sm'
                } ${msg.is_pinned ? 'ring-2 ring-primary/50' : ''}`}>
                  
                  {msg.is_pinned && (
                    <div className="absolute -top-2 -right-2 bg-primary text-white p-1 rounded-full shadow-md">
                      <Pin className="w-3 h-3" />
                    </div>
                  )}

                  {msg.media_url && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-white/10">
                      {msg.type === 'image' ? (
                        <img src={msg.media_url} alt="Media" className="max-w-full h-auto max-h-64 object-cover" />
                      ) : (
                        <video src={msg.media_url} controls className="max-w-full h-auto max-h-64" />
                      )}
                    </div>
                  )}
                  {msg.content && <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{formatMessageText(msg.content)}</p>}
                  <span className={`text-[10px] mt-1.5 flex justify-end items-center gap-1 ${isMe ? 'text-primary-100/70' : 'text-slate-500'}`}>
                    {msg.created_at ? new Date(msg.created_at.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    {isMe && <CheckCheck className="w-3.5 h-3.5 text-blue-300" />}
                  </span>

                  {/* Message Actions (Hover) */}
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isMe ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                    {user?.role === 'admin' && (
                      <button 
                        onClick={() => handleTogglePin(msg.id, !!msg.is_pinned)} 
                        className={`bg-slate-800 p-2 rounded-full border border-slate-700 shadow-lg hover:bg-slate-700 transition-colors ${msg.is_pinned ? 'text-primary' : 'text-slate-400 hover:text-white'}`}
                        title={msg.is_pinned ? "Desfijar mensaje" : "Fijar mensaje"}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Reaction Picker Popover */}
                  {showReactionPicker === msg.id && (
                    <div className={`absolute top-0 ${isMe ? '-left-56' : '-right-56'} bg-slate-800 border border-slate-700 p-2 rounded-full shadow-xl flex gap-1 z-50 animate-in fade-in zoom-in duration-200`}>
                      {['👍', '❤️', '😂', '😮', '😢', '🔥', '🥊'].map(emoji => (
                        <button 
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="hover:scale-125 hover:-translate-y-1 transition-all text-xl px-1"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Display Reactions */}
                {Object.keys(parsedReactions).length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(parsedReactions).map(([emoji, users]) => {
                      const usersArray = Array.isArray(users) ? users : [];
                      return (
                        <button 
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className={`text-xs bg-slate-800/90 border ${usersArray.includes(String(user?.id)) ? 'border-primary text-primary' : 'border-slate-700 text-slate-300'} px-2.5 py-1 rounded-full flex items-center gap-1.5 hover:bg-slate-700 transition-colors shadow-sm`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px] font-medium">{usersArray.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-3 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 fixed bottom-20 left-0 right-0 z-20">
        {showEmojiPicker && (
          <div className="absolute bottom-full left-0 mb-2 shadow-2xl">
            <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} />
          </div>
        )}

        {showShareMenu && (
          <div className="absolute bottom-full left-4 mb-2 bg-slate-800 border border-slate-700 rounded-xl p-2 shadow-xl flex flex-col gap-1 z-30 animate-in fade-in slide-in-from-bottom-2">
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); handleSend(undefined, "🔥 ¡He completado mi rutina de hoy!"); }}
              className="text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-sm text-slate-200 transition-colors"
            >
              🔥 Compartir: Rutina completada
            </button>
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); handleSend(undefined, "🥗 ¡Miren mi comida saludable de hoy!"); }}
              className="text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-sm text-slate-200 transition-colors"
            >
              🥗 Compartir: Comida saludable
            </button>
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); handleSend(undefined, "💪 ¡Nuevo récord personal alcanzado!"); }}
              className="text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-sm text-slate-200 transition-colors"
            >
              💪 Compartir: Récord personal
            </button>
          </div>
        )}
        
        {selectedMedia && (
          <div className="absolute bottom-full left-4 mb-3 bg-slate-800 p-2 rounded-xl border border-slate-700 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="w-16 h-16 rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-700">
              {selectedMedia.type === 'image' ? (
                <img src={selectedMedia.url} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Video className="w-6 h-6 text-primary" />
              )}
            </div>
            <button onClick={() => setSelectedMedia(null)} className="p-1.5 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500/40 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-end gap-2 max-w-2xl mx-auto relative">
          <input 
            type="file" 
            accept="image/*,video/*" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <div className="flex bg-slate-800 rounded-full border border-slate-700 p-1">
            {/* Icons removed as per user request */}
          </div>
          
          <div className="flex-1 bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden shadow-inner focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
            <textarea 
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              placeholder={`Escribe en #${CHANNELS.find(c => c.id === activeChannel)?.name.toLowerCase()}... (Usa @ para mencionar)`}
              className="w-full bg-transparent px-4 py-3.5 text-[15px] resize-none focus:outline-none max-h-32 min-h-[52px] text-white overflow-y-auto placeholder:text-slate-500"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
                  handleSend(syntheticEvent);
                  e.currentTarget.style.height = 'auto';
                }
              }}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={!newMessage.trim() && !selectedMedia}
            className="p-3.5 bg-primary text-white rounded-full disabled:opacity-50 disabled:bg-slate-700 transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 flex-shrink-0"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
