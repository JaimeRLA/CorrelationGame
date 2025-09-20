// src/firebase.js
// Auth Email/Password (email sintético), puntuación y bloqueo diario (plays/{canon}/{YYYY-MM-DD})

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, fetchSignInMethodsForEmail, signOut
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

/* ===== Helpers username / claves RTDB ===== */
export const toCanon = (s) =>
  (s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");

export const canonFromDisplay = (display) => {
  const c = toCanon(display).slice(0, 24);
  if (!/^[a-z0-9_-]{3,24}$/.test(c)) {
    throw new Error("Nombre inválido. Usa 3–24: letras, números, _ o -.");
  }
  return c;
};

// Email SÓLO para Auth (nunca en rutas de DB)
const emailFor = (canon) => `${canon}@correlationsgame.local`;

// Guardar/leer username activo local
const setLocalCanon = (canon) => localStorage.setItem("canon", canon);
export const getCurrentCanon = () => localStorage.getItem("canon") || null;

/* ===== Auth ===== */
export function ensureAuth() {
  return new Promise((resolve) => onAuthStateChanged(auth, (u) => resolve(u || null)));
}

/* ===== Alta/Login por usuario + contraseña ===== */
export async function createOrLoginUsername(display, passwordOptional) {
  const canon = canonFromDisplay(display);

  let password = passwordOptional;
  if (!password && typeof document !== "undefined") {
    const p = document.getElementById("passInput");
    password = p?.value || "";
  }
  if (!password || password.length < 6) {
    throw new Error("Contraseña mínima de 6 caracteres.");
  }

  const email = emailFor(canon);

  // ¿Existe cuenta? → login; si no → crear
  const methods = await fetchSignInMethodsForEmail(auth, email); // [] si no existe
  let userCred;
  if (methods.includes("password")) {
    userCred = await signInWithEmailAndPassword(auth, email, password); // lanza si pass mala
  } else {
    userCred = await createUserWithEmailAndPassword(auth, email, password);
  }
  const uid = userCred.user.uid;

  // Reservar/confirmar username -> uid (atómico)
  const unameRef = ref(db, `usernames/${canon}`);
  const txn = await runTransaction(unameRef, (curr) => {
    if (curr === null) return { uid, display: display.trim() };
    if (curr && curr.uid === uid) return { ...curr, display: display.trim() };
    return; // ya lo tiene otro uid → abort
  });
  if (!txn.committed && txn.snapshot.exists() && txn.snapshot.val().uid !== uid) {
    await signOut(auth).catch(()=>{});
    throw new Error("Ese nombre ya está en uso por otra cuenta.");
  }

  // Perfil por canon
  const profRef = ref(db, `profiles/${canon}`);
  const snap = await get(profRef);
  if (!snap.exists()) {
    await set(profRef, { display: display.trim(), score: 0, created: Date.now() });
  } else {
    await update(profRef, { display: display.trim() });
  }

  // (opcional) map uid -> canon
  await set(ref(db, `accounts/${uid}`), { canon, display: display.trim() });

  setLocalCanon(canon);
  return { uid, canon, display: display.trim() };
}

/* ===== Perfil actual verificado ===== */
export async function getCurrentProfile() {
  const user = auth.currentUser;
  const canon = getCurrentCanon();
  if (!user || !canon) return null;

  const owner = await get(ref(db, `usernames/${canon}/uid`));
  if (!owner.exists() || owner.val() !== user.uid) {
    localStorage.removeItem("canon");
    return null;
  }

  const snap = await get(ref(db, `profiles/${canon}`));
  return snap.exists() ? { canon, ...snap.val() } : null;
}

/* ===== Puntuación (usada por el leaderboard si hiciera falta) ===== */
export async function addScore(delta) {
  const canon = getCurrentCanon();
  if (!canon) throw new Error("No hay usuario activo.");
  const profRef = ref(db, `profiles/${canon}`);
  await runTransaction(profRef, (curr) => {
    if (!curr) return curr;
    return { ...curr, score: (curr.score || 0) + (Number(delta) || 0) };
  });
}

/* ===== Leaderboard ===== */
export async function loadTop(n = 10) {
  const q = query(ref(db, "profiles"), orderByChild("score"), limitToLast(n));
  const snap = await get(q);
  const rows = [];
  snap.forEach((ch) => { const v = ch.val(); rows.push({ display: v.display, score: v.score || 0 }); });
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

/* ===== Bloqueo diario (plays/{canon}/{YYYY-MM-DD}) ===== */
function todayKeyUTC(){
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2,'0');
  const dd = String(d.getUTCDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function msUntilNextUtcMidnight(){
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0,0,0,0
  ));
  return next - now;
}

// Lee si hoy ya jugó
export async function getCooldownMs(){
  const canon = getCurrentCanon();
  if (!canon) return 0;
  const snap = await get(ref(db, `plays/${canon}/${todayKeyUTC()}`));
  return snap.exists() ? msUntilNextUtcMidnight() : 0;
}

// Suma puntos SOLO si no jugó hoy; crea marca de “hoy”
export async function addScoreDaily(delta){
  const canon = getCurrentCanon();
  if (!canon) throw new Error('No hay usuario activo.');

  const playRef = ref(db, `plays/${canon}/${todayKeyUTC()}`);
  const already = await get(playRef);
  if (already.exists()) throw new Error('⏳ Ya jugaste hoy. Vuelve mañana.');

  await set(playRef, serverTimestamp()); // marca del día (hora servidor)

  const profRef = ref(db, `profiles/${canon}`);
  await runTransaction(profRef, (curr)=>{
    if (!curr) return curr;
    return { ...curr, score: (curr.score||0) + (Number(delta)||0) };
  });
}

/* ===== Cerrar sesión ===== */
export async function signOutUser() {
  localStorage.removeItem("canon");
  await signOut(auth);
}
