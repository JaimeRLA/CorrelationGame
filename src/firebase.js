// src/firebase.js
// Email/Password + RTDB: usernames/{canon} -> {uid,display}, profiles/{canon}, plays/{canon}/{YYYY-MM-DD}
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail, signOut
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, runTransaction,
  query, orderByChild, limitToLast, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

/* ==== TU CONFIG ==== */
const firebaseConfig = {
  apiKey: "AIzaSyATQI5avb6a0NUKW4FQQmyEQut3fiH-XeE",
  authDomain: "correlationsgame.firebaseapp.com",
  databaseURL: "https://correlationsgame-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "correlationsgame",
  appId: "1:904382817908:web:5d6cc0a4d5314306289321"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

/* ===== helpers ===== */
export const toCanon = (s)=>
  (s||"").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g,"-").replace(/[^a-z0-9_-]/g,"");

export const canonFromDisplay = (display)=>{
  const c = toCanon(display).slice(0,24);
  if (!/^[a-z0-9_-]{3,24}$/.test(c)) throw new Error("Usuario inválido. Usa 3–24 (letras, números, _ o -).");
  return c;
};
const emailFor = (canon)=> `${canon}@correlationsgame.local`;
const setLocalCanon = (canon)=> localStorage.setItem("canon", canon);
export const getCurrentCanon = ()=> localStorage.getItem("canon") || null;

/* ===== auth base ===== */
export function ensureAuth(){
  return new Promise(resolve => onAuthStateChanged(auth, u=> resolve(u || null)));
}

/* ===== registro / login separados ===== */
export async function registerUsername(display, password){
  const canon = canonFromDisplay(display);
  if (!password || password.length < 6) throw new Error("Contraseña mínima de 6 caracteres.");
  const email = emailFor(canon);

  // si ya existe cuenta con ese email, error controlado
  const methods = await fetchSignInMethodsForEmail(auth, email);
  if (methods.includes("password")) throw new Error("Ese usuario ya existe. Inicia sesión.");

  // crea cuenta
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // reserva username
  const unameRef = ref(db, `usernames/${canon}`);
  const txn = await runTransaction(unameRef, curr=>{
    if (curr === null) return { uid, display: display.trim() };
    if (curr.uid === uid) return { ...curr, display: display.trim() };
    return; // ocupado por otro
  });
  if (!txn.committed && txn.snapshot.exists() && txn.snapshot.val().uid !== uid) {
    await signOut(auth).catch(()=>{});
    throw new Error("Ese nombre ya está en uso.");
  }

  // perfil
  const profRef = ref(db, `profiles/${canon}`);
  await set(profRef, { display: display.trim(), score: 0, created: Date.now() });

  // map uid -> canon
  await set(ref(db, `accounts/${uid}`), { canon, display: display.trim() });

  setLocalCanon(canon);
  return { uid, canon };
}

export async function loginUsername(display, password){
  const canon = canonFromDisplay(display);
  if (!password || password.length < 6) throw new Error("Contraseña mínima de 6 caracteres.");
  const email = emailFor(canon);

  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // verifica que el username pertenece a este uid
  const owner = await get(ref(db, `usernames/${canon}/uid`));
  if (!owner.exists() || owner.val() !== uid){
    await signOut(auth).catch(()=>{});
    throw new Error("Ese usuario no pertenece a esta cuenta.");
  }
  setLocalCanon(canon);
  return { uid, canon };
}

// compat: intento de crear o entrar
export async function createOrLoginUsername(display){
  const pass = (typeof document!=='undefined' && document.getElementById('passInput')?.value) || '';
  const canon = canonFromDisplay(display);
  const email = emailFor(canon);
  const methods = await fetchSignInMethodsForEmail(auth, email);
  return methods.includes('password')
    ? loginUsername(display, pass)
    : registerUsername(display, pass);
}

/* ===== perfil actual ===== */
export async function getCurrentProfile(){
  const user = auth.currentUser;
  const canon = getCurrentCanon();
  if (!user || !canon) return null;

  const owner = await get(ref(db, `usernames/${canon}/uid`));
  if (!owner.exists() || owner.val() !== user.uid){
    localStorage.removeItem("canon");
    return null;
  }
  const snap = await get(ref(db, `profiles/${canon}`));
  return snap.exists() ? { canon, ...snap.val() } : null;
}

/* ===== leaderboard ===== */
export async function loadTop(n=10){
  const q = query(ref(db, "profiles"), orderByChild("score"), limitToLast(n));
  const snap = await get(q);
  const rows = [];
  snap.forEach(ch => { const v = ch.val(); rows.push({ display: v.display, score: v.score||0 }); });
  rows.sort((a,b)=> b.score - a.score);
  return rows;
}

/* ===== bloqueo diario (UTC) ===== */
function todayKeyUTC(){
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2,'0');
  const dd = String(d.getUTCDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function msUntilNextUtcMidnight(){
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1, 0,0,0,0));
  return next - now;
}
export async function getCooldownMs(){
  const canon = getCurrentCanon();
  if (!canon) return 0;
  const snap = await get(ref(db, `plays/${canon}/${todayKeyUTC()}`));
  return snap.exists() ? msUntilNextUtcMidnight() : 0;
}
export async function addScoreDaily(delta){
  const canon = getCurrentCanon();
  if (!canon) throw new Error('No hay usuario activo.');

  const playRef = ref(db, `plays/${canon}/${todayKeyUTC()}`);
  const already = await get(playRef);
  if (already.exists()) throw new Error('⏳ Ya jugaste hoy. Vuelve mañana.');

  // marca el día
  await set(playRef, serverTimestamp());

  // suma puntos
  const profRef = ref(db, `profiles/${canon}`);
  await runTransaction(profRef, curr=>{
    if (!curr) return curr;
    return { ...curr, score: (curr.score||0) + (Number(delta)||0) };
  });
}

/* ===== salir ===== */
export async function signOutUser(){
  localStorage.removeItem("canon");
  await signOut(auth);
}
