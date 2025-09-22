import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail, signOut
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, runTransaction,
  query, orderByChild, limitToLast
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

/* ===== auth ===== */
export function ensureAuth(){
  return new Promise(resolve => onAuthStateChanged(auth, u=> resolve(u || null)));
}

export async function registerUsername(display, password){
  const canon = canonFromDisplay(display);
  if (!password || password.length < 6) throw new Error("Contraseña mínima de 6 caracteres.");
  const email = emailFor(canon);

  const methods = await fetchSignInMethodsForEmail(auth, email);
  if (methods.includes("password")) throw new Error("Ese usuario ya existe. Inicia sesión.");

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const unameRef = ref(db, `usernames/${canon}`);
  const txn = await runTransaction(unameRef, curr=>{
    if (curr === null) return { uid, display: display.trim() };
    if (curr.uid === uid) return { ...curr, display: display.trim() };
    return;
  });
  if (!txn.committed && txn.snapshot.exists() && txn.snapshot.val().uid !== uid) {
    await signOut(auth).catch(()=>{});
    throw new Error("Ese nombre ya está en uso.");
  }

  const profRef = ref(db, `profiles/${canon}`);
  await set(profRef, { display: display.trim(), score: 0, created: Date.now(), streak: 0, lastPlay: "" });

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

  const owner = await get(ref(db, `usernames/${canon}/uid`));
  if (!owner.exists() || owner.val() !== uid){
    await signOut(auth).catch(()=>{});
    throw new Error("Ese usuario no pertenece a esta cuenta.");
  }
  setLocalCanon(canon);
  return { uid, canon };
}

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
export async function loadTop(n = 10) {
  try {
    const q = query(ref(db, "profiles"), orderByChild("score"), limitToLast(n));
    const snap = await get(q);
    if (snap.exists()) {
      const rows = [];
      snap.forEach(ch => { const v = ch.val(); rows.push({ display: v.display, score: v.score || 0 }); });
      rows.sort((a,b)=> b.score - a.score);
      return rows;
    }
  } catch (e) {
    console.warn('loadTop index query failed, falling back:', e);
  }
  const all = await get(ref(db, "profiles"));
  const rows = [];
  all.forEach(ch => { const v = ch.val(); rows.push({ display: v.display, score: v.score || 0 }); });
  rows.sort((a,b)=> b.score - a.score);
  return rows.slice(0, n);
}

/* ===== streak / multipliers ===== */
export function calcMultiplier(days){
  const extra = Math.min(Math.max(days - 1, 0) * 0.1, 1.0);
  return 1.0 + extra;
}
function todayKeyUTC(){
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2,'0');
  const dd = String(d.getUTCDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function yesterdayKeyUTC(){
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()-1, 0,0,0,0));
  const yyyy = y.getUTCFullYear();
  const mm = String(y.getUTCMonth()+1).padStart(2,'0');
  const dd = String(y.getUTCDate()).padStart(2,'0');
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

export async function getStreakInfo(){
  const canon = getCurrentCanon();
  if (!canon) return { days: 0, mult: 1.0 };
  const profSnap = await get(ref(db, `profiles/${canon}`));
  const days = Number(profSnap.val()?.streak || 0);
  const mult = calcMultiplier(days || 0);
  return { days, mult };
}

/* ===== suma diaria con racha ===== */
export async function addScoreDaily(delta){
  const canon = getCurrentCanon();
  if (!canon) throw new Error('No hay usuario activo.');

  const today = todayKeyUTC();
  const yday  = yesterdayKeyUTC();

  const playRef = ref(db, `plays/${canon}/${today}`);
  const already = await get(playRef);
  if (already.exists()) throw new Error(' Ya jugaste hoy. Vuelve mañana.');

  await set(playRef, Date.now());

  const profRef = ref(db, `profiles/${canon}`);
  let newScore = 0;

  const res = await runTransaction(profRef, curr => {
    if (!curr) return curr;

    const hadYesterday = !!(curr.lastPlay === yday);
    const lastPlay = today;
    const prevStreak = Number(curr.streak || 0);
    const nextStreak = hadYesterday ? Math.min(prevStreak + 1, 365) : 1;

    const mult = calcMultiplier(nextStreak);
    const deltaNum = Number(delta) || 0;
    const awarded = Math.round(deltaNum * mult);

    const s = (Number(curr.score || 0)) + awarded;

    return { ...curr, score: s, streak: nextStreak, lastPlay };
  });

  if (res.committed && res.snapshot.exists()) {
    newScore = Number(res.snapshot.val().score || 0);
  } else {
    const snap = await get(profRef);
    newScore = Number((snap.val()?.score) || 0);
  }
  return newScore;
}

/* ===== salir ===== */
export async function signOutUser(){
  localStorage.removeItem("canon");
  await signOut(auth);
}
