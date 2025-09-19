// src/firebase.js
// Modelo por username: usernames/<canon> y profiles/<canon>
// - Los puntos se guardan en profiles/<canon>/score
// - El "dueño" del canon es usernames/<canon>.uid
// Asegúrate de tener las reglas RTDB publicadas y la indexación por "score".

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getDatabase, ref, get, set, runTransaction, update, query,
  orderByChild, limitToLast
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const toCanon = (s)=> (s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

// Guardamos el username activo en localStorage
const LS_KEY = 'asocia_current_canon';
export const getCurrentCanon = () => localStorage.getItem(LS_KEY) || null;
export const setCurrentCanon = (canon) => localStorage.setItem(LS_KEY, canon);
export const clearCurrentCanon = () => localStorage.removeItem(LS_KEY);

export const ensureAuth = ()=> new Promise((resolve, reject)=>{
  onAuthStateChanged(auth, (user)=>{
    if (user) resolve(user);
    else signInAnonymously(auth).catch(reject);
  });
});

// Crear o iniciar sesión con username (reserva atómica)
// - Si no existe usernames/<canon> → lo crea con uid actual
// - Si existe y es tuyo → actualiza display
// - Si existe y es de otro → error
export async function createOrLoginUsername(display){
  await ensureAuth();
  const uid = auth.currentUser.uid;
  const canon = toCanon(display);
  if (!canon) throw new Error('El nombre no puede estar vacío.');

  const unameRef = ref(db, `usernames/${canon}`);
  const txn = await runTransaction(unameRef, (curr)=>{
    if (curr === null) return { uid, display: display.trim() };
    if (curr && curr.uid === uid) return { uid, display: display.trim() }; // actualiza display propio
    return; // aborta si pertenece a otro uid
  });

  if (!txn.committed && txn.snapshot.exists() && txn.snapshot.val().uid !== uid) {
    throw new Error('Ese nombre ya está en uso.');
  }

  // Asegurar perfil por username
  const profRef = ref(db, `profiles/${canon}`);
  const snap = await get(profRef);
  if (!snap.exists()) {
    await set(profRef, { display: display.trim(), score: 0, created: Date.now() });
  } else {
    await update(profRef, { display: display.trim() });
  }

  setCurrentCanon(canon);
  return { canon, display: display.trim() };
}

// Perfil activo (según username actual)
export async function getCurrentProfile(){
  const canon = getCurrentCanon();
  if (!canon) return null;
  const snap = await get(ref(db, `profiles/${canon}`));
  return snap.exists() ? { canon, ...snap.val() } : null;
}

// Sumar puntos SOLO en el campo 'score' (transacción de hijo)
// ⚠️ No tocamos otros hijos para no chocar con validaciones por campo
export async function addScore(delta){
  const canon = getCurrentCanon();
  if (!canon) throw new Error('No hay usuario activo.');
  await runTransaction(ref(db, `profiles/${canon}/score`), (curr) => {
    return (typeof curr === 'number' ? curr : 0) + delta;
  });
}

// Marcar que se jugó ahora (para bloqueo 24h en el cliente)
export async function markPlayedNow(){
  const canon = getCurrentCanon();
  if (!canon) throw new Error('No hay usuario activo.');
  await update(ref(db, `profiles/${canon}`), { lastPlayed: Date.now() });
}

// Info de bloqueo (cuánto falta para 24h desde lastPlayed)
export async function getLockInfo(){
  const canon = getCurrentCanon();
  if (!canon) return { last: null, remaining: 0 };
  const snap = await get(ref(db, `profiles/${canon}/lastPlayed`));
  const last = snap.exists() ? snap.val() : null;
  const now = Date.now();
  const remaining = last ? Math.max(0, 86400000 - (now - last)) : 0;
  return { last, remaining };
}

// Top global por score
export async function loadTop(n=10){
  const q = query(ref(db, 'profiles'), orderByChild('score'), limitToLast(n));
  const snap = await get(q);
  const rows = [];
  snap.forEach(child => {
    const v = child.val();
    rows.push({ canon: child.key, display: v.display, score: v.score || 0 });
  });
  rows.sort((a,b)=> b.score - a.score);
  return rows;
}
