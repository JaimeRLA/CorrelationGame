// src/firebase.js
// Carga tu config desde firebase-config.js (no lo subas públicamente)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getDatabase, ref, get, set, runTransaction, update, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const toCanon = (s)=> (s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

export const ensureAuth = ()=> new Promise((resolve, reject)=>{
  onAuthStateChanged(auth, (user)=>{ if(user) resolve(user); else signInAnonymously(auth).catch(reject); });
});

export async function getCurrentPlayer(){
  const user = await ensureAuth();
  const snap = await get(ref(db, `players/${user.uid}`));
  return snap.exists() ? { uid:user.uid, ...snap.val() } : null;
}

export async function createOrLoginUsername(display){
  const user = await ensureAuth();
  const uid = user.uid;
  const canon = toCanon(display);
  if(!canon) throw new Error('El nombre no puede estar vacío.');

  const unameRef = ref(db, `usernames/${canon}`);
  const txn = await runTransaction(unameRef, (curr)=>{
    if(curr === null) return { uid, display: display.trim() };
    if(curr && curr.uid === uid) return curr;
    return; // abortar si es de otro
  });
  if(!txn.committed && txn.snapshot.exists() && txn.snapshot.val().uid !== uid){
    throw new Error('Ese nombre ya está en uso.');
  }

  const playerRef = ref(db, `players/${uid}`);
  const snap = await get(playerRef);
  if(!snap.exists()) await set(playerRef, { display: display.trim(), score: 0, created: Date.now() });
  else await update(playerRef, { display: display.trim() });
  return { uid, display: display.trim(), canon };
}

export async function addScore(delta){
  const user = await ensureAuth();
  const playerRef = ref(db, `players/${user.uid}`);
  await runTransaction(playerRef, (curr)=>{ if(curr){ curr.score = (curr.score||0)+delta; } return curr; });
}

export async function loadTop(n=8){
  const q = query(ref(db, 'players'), orderByChild('score'), limitToLast(n));
  const snap = await get(q);
  const rows = []; snap.forEach(child=>{ const v = child.val(); rows.push({ uid: child.key, display:v.display, score:v.score||0 }); });
  rows.sort((a,b)=> b.score - a.score);
  return rows;
}
