// src/firebase.js?v=43
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, runTransaction,
  query, orderByChild, limitToLast, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

/* Config (tuya) */
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

/* Helpers */
export const toCanon = (s) =>
  (s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
export const canonFromDisplay = (display) => {
  const c = toCanon(display).slice(0, 24);
  if (!/^[a-z0-9_-]{3,24}$/.test(c)) throw new Error("Nombre inválido. Usa 3–24: letras, números, _ o -.");
  return c;
};
const emailFor = (canon) => `${canon}@correlationsgame.local`;
const setLocalCanon = (canon) => localStorage.setItem("canon", canon);
export const getCurrentCanon = () => localStorage.getItem("canon") || null;

export function ensureAuth() {
  return new Promise((resolve) => onAuthStateChanged(auth, (u) => resolve(u || null)));
}

async function ensureUsernameAndProfile({ uid, canon, display }) {
  const unameRef = ref(db, `usernames/${canon}`);
  const txn = await runTransaction(unameRef, (curr) => {
    if (curr === null) return { uid, display: display.trim() };
    if (curr && curr.uid === uid) return { ...curr, display: display.trim() };
    return;
  });
  if (!txn.committed && txn.snapshot.exists() && txn.snapshot.val().uid !== uid) {
    await signOut(auth).catch(()=>{});
    throw new Error("Ese nombre ya está en uso por otra cuenta.");
  }

  const profRef = ref(db, `profiles/${canon}`);
  const snap = await get(profRef);
  if (!snap.exists()) {
    await set(profRef, { display: display.trim(), score: 0, created: Date.now() });
  } else {
    await update(profRef, { display: display.trim() });
  }

  await set(ref(db, `accounts/${uid}`), { canon, display: display.trim() });
  setLocalCanon(canon);
  return { uid, canon, display: display.trim() };
}

/* Registro */
export async function registerUsername(display, password) {
  const canon = canonFromDisplay(display);
  if (!password || password.length < 6) throw new Error("Contraseña mínima de 6 caracteres.");
  const email = emailFor(canon);

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;
    return await ensureUsernameAndProfile({ uid, canon, display });
  } catch (e) {
    if (e.code === "auth/email-already-in-use") {
      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;
        return await ensureUsernameAndProfile({ uid, canon, display });
      } catch (e2) {
        if (e2.code === "auth/wrong-password" || e2.code === "auth/invalid-credential" || e2.code === "auth/invalid-login-credentials") {
          throw new Error("Esa cuenta ya existe, pero la contraseña es incorrecta.");
        }
        throw e2;
      }
    }
    if (e.code === "auth/operation-not-allowed") {
      throw new Error("Activa Email/Password en Firebase Authentication.");
    }
    throw e;
  }
}

/* Login */
export async function loginUsername(display, password) {
  const canon = canonFromDisplay(display);
  if (!password || password.length < 6) throw new Error("Contraseña mínima de 6 caracteres.");
  const email = emailFor(canon);

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;

    const owner = await get(ref(db, `usernames/${canon}/uid`));
    if (owner.exists() && owner.val() !== uid) {
      await signOut(auth).catch(()=>{});
      throw new Error("Este usuario está vinculado a otra cuenta.");
    }
    if (!owner.exists()) {
      await set(ref(db, `usernames/${canon}`), { uid, display: display.trim() });
    }

    await update(ref(db, `profiles/${canon}`), { display: display.trim() });
    await set(ref(db, `accounts/${uid}`), { canon, display: display.trim() });
    setLocalCanon(canon);
    return { uid, canon, display: display.trim() };
  } catch (e) {
    if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential" || e.code === "auth/invalid-login-credentials") {
      throw new Error("Contraseña incorrecta para este usuario.");
    }
    if (e.code === "auth/user-not-found") {
      throw new Error("Ese usuario no existe. Crea la cuenta.");
    }
    throw e;
  }
}

/* Compat con game.js antiguo */
export async function createOrLoginUsername(display, passwordOptional) {
  let password = passwordOptional;
  if (!password && typeof document !== "undefined") {
    const p = document.getElementById("passInput");
    password = p?.value || "";
  }
  return registerUsername(display, password);
}

/* Perfil / leaderboard */
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

export async function loadTop(n = 10) {
  const q = query(ref(db, "profiles"), orderByChild("score"), limitToLast(n));
  const snap = await get(q);
  const rows = [];
  snap.forEach((ch) => { const v = ch.val(); rows.push({ display: v.display, score: v.score || 0 }); });
  rows.sort((a,b)=> b.score - a.score);
  return rows;
}

/* Bloqueo diario */
function todayKeyUTC(){
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2,'0');
  const dd = String(d.getUTCDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function msUntilNextUtcMidnight(){
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1,0,0,0,0));
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

  await set(playRef, serverTimestamp());
  const profRef = ref(db, `profiles/${canon}`);
  await runTransaction(profRef, (curr)=>{
    if (!curr) return curr;
    return { ...curr, score: (curr.score||0) + (Number(delta)||0) };
  });
}

/* Sign out opcional */
export async function signOutUser() {
  localStorage.removeItem("canon");
  await signOut(auth);
}
