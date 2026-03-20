import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('boxing.db', { verbose: console.log });

// Initialize Firebase Admin
let adminDb: any;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount)
      });
    }
    adminDb = getFirestore();
  }
} catch (err) {
  console.error("Firebase Admin Init Error:", err);
}

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    weight REAL,
    dominant_hand TEXT,
    goal TEXT,
    lives INTEGER DEFAULT 5,
    streak INTEGER DEFAULT 0,
    role TEXT DEFAULT 'student',
    license_level INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    duration INTEGER,
    material TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    class_id INTEGER,
    date TEXT,
    time TEXT,
    status TEXT DEFAULT 'active',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tutorials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    duration TEXT,
    level INTEGER,
    category TEXT,
    video_url TEXT
  );

  CREATE TABLE IF NOT EXISTS combos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT,
    level INTEGER
  );

  CREATE TABLE IF NOT EXISTS combo_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    combo_id INTEGER,
    golpeo_approved BOOLEAN DEFAULT 0,
    saco_approved BOOLEAN DEFAULT 0,
    manillas_approved BOOLEAN DEFAULT 0,
    video_url TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(combo_id) REFERENCES combos(id)
  );

  CREATE TABLE IF NOT EXISTS reels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    location TEXT,
    video_url TEXT,
    teacher_id INTEGER,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    content TEXT,
    type TEXT DEFAULT 'text',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    duration INTEGER,
    exercises TEXT
  );

  CREATE TABLE IF NOT EXISTS workout_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workout_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    FOREIGN KEY(category_id) REFERENCES workout_categories(id)
  );

  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    ingredients TEXT,
    instructions TEXT
  );
  CREATE TABLE IF NOT EXISTS availabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    title TEXT,
    description TEXT,
    rules TEXT
  );

  CREATE TABLE IF NOT EXISTS password_reset_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

try { db.exec("ALTER TABLE users ADD COLUMN age INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN height REAL"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN boxing_goal TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN fitness_goal TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN available_schedules TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN profile_pic TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN before_pic TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN after_pic TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN username TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN is_new_user BOOLEAN DEFAULT 1"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN mood TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN mood_updated_at TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE meals ADD COLUMN image_url TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE messages ADD COLUMN reactions TEXT DEFAULT '{}'"); } catch (e) {}

try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT UNIQUE"); } catch (e) {}
try { db.exec("ALTER TABLE combos ADD COLUMN video_url TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE combos ADD COLUMN golpeo_approved BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE combos ADD COLUMN saco_approved BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE combos ADD COLUMN manillas_approved BOOLEAN DEFAULT 0"); } catch (e) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Google Calendar Setup
  const calendar = google.calendar('v3');
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  if (process.env.GOOGLE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
  }

  // API Routes
  app.post('/api/calendar/event', async (req, res) => {
    const { bookingId, userEmail, userName, date, startTime, endTime, title } = req.body;
    
    try {
      if (!process.env.GOOGLE_REFRESH_TOKEN) {
        console.log("Mocking Calendar Event (No credentials):", { bookingId, date, startTime });
        return res.json({ status: "mocked" });
      }

      const event = {
        summary: `Clase: ${title} - ${userName}`,
        description: `Reserva de clase para ${userName} (${userEmail}). ID: ${bookingId}`,
        start: {
          dateTime: `${date}T${startTime}:00`,
          timeZone: 'America/Bogota',
        },
        end: {
          dateTime: `${date}T${endTime}:00`,
          timeZone: 'America/Bogota',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 180 }, // 3 hours before
            { method: 'popup', minutes: 180 },
          ],
        },
        attendees: [{ email: userEmail }, { email: 'hernandezkevin001998@gmail.com' }],
      };

      const response = await calendar.events.insert({
        auth: oauth2Client,
        calendarId: 'primary',
        requestBody: event,
      });

      res.json({ status: "ok", eventId: response.data.id });
    } catch (error) {
      console.error("Calendar API Error:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  // Auto-confirmation logic (runs every 15 minutes)
  if (adminDb) {
    setInterval(async () => {
      try {
        const now = new Date();
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        
        const bookingsRef = adminDb.collection('bookings');
        const snapshot = await bookingsRef
          .where('status', '==', 'pending_payment')
          .where('payment_status', '==', 'submitted')
          .get();

        for (const doc of snapshot.docs) {
          const data = doc.data();
          const submittedAt = new Date(data.payment_submitted_at);
          
          if (submittedAt < threeHoursAgo) {
            console.log(`Auto-confirming booking ${doc.id}`);
            await doc.ref.update({
              status: 'active',
              confirmed_at: now.toISOString(),
              confirmation_type: 'auto'
            });
          }
        }
      } catch (err) {
        console.error("Auto-confirmation Error:", err);
      }
    }, 15 * 60 * 1000);
  }

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, phone, password, weight, height, age, dominant_hand, boxing_goal, fitness_goal, goal } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO users (name, email, phone, password, weight, height, age, dominant_hand, boxing_goal, fitness_goal, goal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const info = stmt.run(name, email, phone || null, password, weight, height, age, dominant_hand, boxing_goal, fitness_goal, goal);
      res.json({ id: info.lastInsertRowid, name, email, phone, role: 'student', lives: 5, streak: 0, license_level: 1, weight, height, age, dominant_hand, boxing_goal, fitness_goal, goal });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, phone, password } = req.body;
    let user;
    if (email) {
      user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password);
    } else if (phone) {
      user = db.prepare('SELECT * FROM users WHERE phone = ? AND password = ?').get(phone, password);
    }
    
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.post('/api/auth/social', (req, res) => {
    const { name, email, provider } = req.body;
    try {
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        const stmt = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
        const info = stmt.run(name, email, 'social_login_placeholder', 'student');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      }
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/reset-request', (req, res) => {
    const { identifier } = req.body;
    try {
      const user = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(identifier, identifier) as any;
      if (user) {
        db.prepare('INSERT INTO password_reset_requests (user_id) VALUES (?)').run(user.id);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/password-reset-requests', (req, res) => {
    const requests = db.prepare(`
      SELECT p.*, u.name as user_name, u.email as user_email, u.phone as user_phone 
      FROM password_reset_requests p 
      JOIN users u ON p.user_id = u.id 
      WHERE p.status = 'pending'
      ORDER BY p.created_at DESC
    `).all();
    res.json(requests);
  });

  app.put('/api/password-reset-requests/:id/approve', (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(req.params.id) as any;
      if (request) {
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run('12345678', request.user_id);
        db.prepare('UPDATE password_reset_requests SET status = ? WHERE id = ?').run('approved', req.params.id);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/users/:id/onboarding', (req, res) => {
    const { name, username, age, weight, height, password, boxing_goal, fitness_goal, goal_timeframe, dominant_hand } = req.body;
    try {
      const stmt = db.prepare(`
        UPDATE users 
        SET name = ?, username = ?, age = ?, weight = ?, height = ?, password = ?, boxing_goal = ?, fitness_goal = ?, goal = ?, dominant_hand = ?, is_new_user = 0
        WHERE id = ?
      `);
      stmt.run(name, username, age, weight, height, password, boxing_goal, fitness_goal, goal_timeframe, dominant_hand, req.params.id);
      
      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/users/:id/profile', (req, res) => {
    const { weight, height, dominant_hand, password, profile_pic, before_pic, after_pic } = req.body;
    try {
      const stmt = db.prepare(`
        UPDATE users 
        SET weight = ?, height = ?, dominant_hand = ?, password = ?, profile_pic = ?, before_pic = ?, after_pic = ?
        WHERE id = ?
      `);
      stmt.run(weight, height, dominant_hand, password, profile_pic, before_pic, after_pic, req.params.id);
      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  app.put('/api/users/:id/mood', (req, res) => {
    const { mood } = req.body;
    try {
      const stmt = db.prepare('UPDATE users SET mood = ?, mood_updated_at = ? WHERE id = ?');
      stmt.run(mood, new Date().toISOString(), req.params.id);
      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/users/:id', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.get('/api/classes', (req, res) => {
    const classes = db.prepare('SELECT * FROM classes').all();
    res.json(classes);
  });

  app.post('/api/bookings', async (req, res) => {
    const { user_id, class_id, date, time } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO bookings (user_id, class_id, date, time) VALUES (?, ?, ?, ?)');
      const info = stmt.run(user_id, class_id, date, time);
      
      // Email confirmation removed as per user request (only Google Calendar sync used)
      res.json({ id: info.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/bookings/:user_id', (req, res) => {
    const bookings = db.prepare(`
      SELECT * FROM bookings WHERE user_id = ?
    `).all(req.params.user_id);
    res.json(bookings);
  });

  app.delete('/api/bookings/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/workout-categories', (req, res) => {
    const categories = db.prepare('SELECT * FROM workout_categories').all();
    res.json(categories);
  });

  app.post('/api/workout-categories', (req, res) => {
    const { name } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO workout_categories (name) VALUES (?)');
      const info = stmt.run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/workout-categories/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM workout_videos WHERE category_id = ?').run(req.params.id);
      db.prepare('DELETE FROM workout_categories WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/workout-videos', (req, res) => {
    const videos = db.prepare('SELECT * FROM workout_videos').all();
    res.json(videos);
  });

  app.post('/api/workout-videos', (req, res) => {
    const { category_id, title, description, video_url } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO workout_videos (category_id, title, description, video_url) VALUES (?, ?, ?, ?)');
      const info = stmt.run(category_id, title, description, video_url);
      res.json({ id: info.lastInsertRowid, category_id, title, description, video_url });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/workout-videos/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM workout_videos WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/tutorials', (req, res) => {
    const tutorials = db.prepare('SELECT * FROM tutorials').all();
    res.json(tutorials);
  });

  app.post('/api/tutorials', (req, res) => {
    const { title, duration, level, category, video_url } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO tutorials (title, duration, level, category, video_url) VALUES (?, ?, ?, ?, ?)');
      const info = stmt.run(title, duration, level, category, video_url);
      res.json({ id: info.lastInsertRowid, title, duration, level, category, video_url });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/tutorials/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM tutorials WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/combos', (req, res) => {
    const combos = db.prepare('SELECT * FROM combos').all();
    res.json(combos);
  });

  app.post('/api/combos', (req, res) => {
    const { name, level } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO combos (name, level) VALUES (?, ?)');
      const info = stmt.run(name, level);
      res.json({ id: info.lastInsertRowid, name, level });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/combos/:id', (req, res) => {
    const { video_url } = req.body;
    try {
      const stmt = db.prepare('UPDATE combos SET video_url = ? WHERE id = ?');
      stmt.run(video_url, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/combos/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM combo_progress WHERE combo_id = ?').run(req.params.id);
      db.prepare('DELETE FROM combos WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/combo-progress/:combo_id', (req, res) => {
    const { video_url, user_id } = req.body;
    try {
      const existing = db.prepare('SELECT * FROM combo_progress WHERE combo_id = ? AND user_id = ?').get(req.params.combo_id, user_id);
      if (existing) {
        const stmt = db.prepare('UPDATE combo_progress SET video_url = ? WHERE combo_id = ? AND user_id = ?');
        stmt.run(video_url, req.params.combo_id, user_id);
      } else {
        const stmt = db.prepare('INSERT INTO combo_progress (combo_id, user_id, video_url) VALUES (?, ?, ?)');
        stmt.run(req.params.combo_id, user_id, video_url);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/combos/:id/approve', (req, res) => {
    const { type } = req.body;
    try {
      let field = '';
      if (type === 'golpeo') field = 'golpeo_approved';
      else if (type === 'saco') field = 'saco_approved';
      else if (type === 'manillas') field = 'manillas_approved';
      else return res.status(400).json({ error: 'Invalid approval type' });

      const stmt = db.prepare(`UPDATE combos SET ${field} = 1 WHERE id = ?`);
      stmt.run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/messages', (req, res) => {
    const messages = db.prepare(`
      SELECT m.*, u.name as user_name, u.role as user_role 
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      ORDER BY m.created_at ASC
    `).all();
    res.json(messages);
  });

  app.post('/api/messages', (req, res) => {
    const { user_id, content, type } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO messages (user_id, content, type) VALUES (?, ?, ?)');
      const info = stmt.run(user_id, content, type);
      const newMessage = db.prepare(`
        SELECT m.*, u.name as user_name, u.role as user_role 
        FROM messages m 
        JOIN users u ON m.user_id = u.id 
        WHERE m.id = ?
      `).get(info.lastInsertRowid);
      res.json(newMessage);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/messages/:id/reactions', (req, res) => {
    const { reactions } = req.body;
    try {
      const stmt = db.prepare('UPDATE messages SET reactions = ? WHERE id = ?');
      stmt.run(JSON.stringify(reactions), req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/meals', (req, res) => {
    const meals = db.prepare('SELECT * FROM meals').all();
    res.json(meals);
  });

  app.post('/api/meals', (req, res) => {
    const { name, category, ingredients, instructions, image_url } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO meals (name, category, ingredients, instructions, image_url) VALUES (?, ?, ?, ?, ?)');
      const info = stmt.run(name, category, ingredients, instructions, image_url);
      res.json({ id: info.lastInsertRowid, name, category, ingredients, instructions, image_url });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/meals/:id', (req, res) => {
    const { name, category, ingredients, instructions, image_url } = req.body;
    try {
      const stmt = db.prepare('UPDATE meals SET name = ?, category = ?, ingredients = ?, instructions = ?, image_url = ? WHERE id = ?');
      stmt.run(name, category, ingredients, instructions, image_url, req.params.id);
      res.json({ id: req.params.id, name, category, ingredients, instructions, image_url });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/meals/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM meals WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/availabilities', (req, res) => {
    const availabilities = db.prepare('SELECT * FROM availabilities').all();
    res.json(availabilities);
  });

  app.post('/api/availabilities', (req, res) => {
    const { day_of_week, start_time, end_time, title, description, rules } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO availabilities (day_of_week, start_time, end_time, title, description, rules) VALUES (?, ?, ?, ?, ?, ?)');
      const info = stmt.run(day_of_week, start_time, end_time, title, description, rules);
      res.json({ id: info.lastInsertRowid, day_of_week, start_time, end_time, title, description, rules });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/availabilities/:id', (req, res) => {
    const { day_of_week, start_time, end_time, title, description, rules } = req.body;
    try {
      const stmt = db.prepare('UPDATE availabilities SET day_of_week = ?, start_time = ?, end_time = ?, title = ?, description = ?, rules = ? WHERE id = ?');
      stmt.run(day_of_week, start_time, end_time, title, description, rules, req.params.id);
      res.json({ id: req.params.id, day_of_week, start_time, end_time, title, description, rules });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/availabilities/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM availabilities WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const workoutCatCount = db.prepare('SELECT COUNT(*) as count FROM workout_categories').get() as { count: number };
  if (workoutCatCount.count === 0) {
    const insertCat = db.prepare('INSERT INTO workout_categories (name) VALUES (?)');
    ['Pecho', 'Pierna', 'Glúteos', 'Velocidad', 'Potencia', 'Resistencia'].forEach(cat => insertCat.run(cat));
  }
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = db.prepare('INSERT INTO users (name, email, password, weight, dominant_hand, goal, role) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertUser.run('Kevin Hernandez', 'hernandezkevin001998@gmail.com', 'Celeste2020*', 75, 'Derecha', 'Mantener peso', 'admin');
  }

  const classCount = db.prepare('SELECT COUNT(*) as count FROM classes').get() as { count: number };
  if (classCount.count === 0) {
    const insertClass = db.prepare('INSERT INTO classes (method, description, date, time, duration, material) VALUES (?, ?, ?, ?, ?, ?)');
    insertClass.run('Boxeo Skills', 'Técnica básica y desplazamientos', '2023-11-01', '08:00', 60, 'Guantes, Vendas');
    insertClass.run('Boxeo HIT', 'Alta intensidad y cardio', '2023-11-01', '10:00', 45, 'Guantes, Toalla');
    insertClass.run('Sparring Day', 'Práctica en ring', '2023-11-02', '18:00', 90, 'Guantes 16oz, Protector bucal, Casco');
  }

  const tutorialCount = db.prepare('SELECT COUNT(*) as count FROM tutorials').get() as { count: number };
  if (tutorialCount.count === 0) {
    const insertTutorial = db.prepare('INSERT INTO tutorials (title, duration, level, category, video_url) VALUES (?, ?, ?, ?, ?)');
    insertTutorial.run('Jab y Cross Básico', '05:30', 1, 'Golpes básicos', 'https://example.com/vid1.mp4');
    insertTutorial.run('Desplazamientos en Guardia', '08:15', 1, 'Movimientos', 'https://example.com/vid2.mp4');
    insertTutorial.run('Esquivas: Slip y Roll', '10:00', 2, 'Defensa', 'https://example.com/vid3.mp4');
  }

  const availCount = db.prepare('SELECT COUNT(*) as count FROM availabilities').get() as { count: number };
  if (availCount.count === 0) {
    const insertAvail = db.prepare('INSERT INTO availabilities (day_of_week, start_time, end_time, title, description, rules) VALUES (?, ?, ?, ?, ?, ?)');
    const defaultRules = 'Qué llevar: Guantes, vendas, hidratación. Máximo para cancelar clase ya pagada es de 3 horas. Si desea colocar una ubicación diferente, informar con dos días de anterioridad.';
    
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    days.forEach(day => {
      insertAvail.run(day, '08:00', '10:00', 'Clase Personalizada Mañana', 'Entrenamiento enfocado en técnica y cardio.', defaultRules);
      insertAvail.run(day, '14:00', '16:00', 'Clase Personalizada Tarde', 'Entrenamiento enfocado en técnica y cardio.', defaultRules);
      insertAvail.run(day, '16:00', '18:00', 'Clase Personalizada Tarde 2', 'Entrenamiento enfocado en técnica y cardio.', defaultRules);
      insertAvail.run(day, '19:00', '21:00', 'Clase Personalizada Noche', 'Entrenamiento enfocado en técnica y cardio.', defaultRules);
      insertAvail.run(day, '21:00', '23:00', 'Clase Personalizada Nocturna Extra', 'Entrenamiento enfocado en técnica y cardio.', defaultRules);
    });
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
