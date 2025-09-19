// src/game.js
// Lógica del juego + UI.
// Bloqueo 24h: se activa al TERMINAR la cadena (no en cada acierto).
// Cambia LOCK_ON_COMPLETE a false si quieres desactivar el bloqueo.

import { NODES, ANSWERS } from './config/levels.js';
import {
  ensureAuth, getCurrentProfile, createOrLoginUsername,
  addScore, loadTop, getLockInfo, markPlayedNow
} from './firebase.js';
import { els, showMsg, renderEndpoint, openModal, closeModal, renderBoard } from './ui.js';

let edgeIndex = 0;
let attemptsThisStep = 0;

// ⚙️ Ajustes
const LOCK_ON_COMPLETE = true; // bloquea tras completar la cadena (24h)

// Utils
function normalize(s){ return (s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function correctPoints(){ return attemptsThisStep === 0 ? 100 : 50; }

// Render paso
function loadStep(){
  renderEndpoint(els.startBox, NODES[edgeIndex]);
  renderEndpoint(els.endBox, NODES[edgeIndex+1]);
  els.middleInput.value='';
  showMsg('', '');
  attemptsThisStep = 0;
  els.middleInput.focus();
}

// UI perfil
async function refreshProfileUI(){
  const p = await getCurrentProfile();
  if (p){
    els.userTag.textContent = p.display;
    els.scoreTag.textContent = String(p.score || 0);
  }
}

// Leaderboard (no bloquea el juego si falla)
async function refreshBoard(){
  try {
    const rows = await loadTop(8);
    renderBoard(rows);
  } catch (e) {
    console.warn('Leaderboard error:', e);
  }
}

// Bloqueo diario (24h)
async function enforceDailyLock(){
  const { remaining } = await getLockInfo();
  const locked = remaining > 0;

  els.checkBtn.disabled = locked;
  els.revealBtn.disabled = locked;
  els.checkBtn.style.opacity = locked ? 0.6 : '';
  els.revealBtn.style.opacity = locked ? 0.6 : '';

  if (locked) {
    const h = Math.floor(remaining/3600000);
    const m = Math.floor((remaining%3600000)/60000);
    const s = Math.floor((remaining%60000)/1000);
    showMsg(`⏳ Ya jugaste hoy. Vuelve en ${h}h ${m}m ${s}s`, 'warn');
  }
  return locked;
}

// Comprobar respuesta
async function check(){
  const val = normalize(els.middleInput.value);
  if(!val){ showMsg('Escribe algo.','warn'); return; }

  // Si quieres bloquear también al inicio del día, descomenta:
  if (await enforceDailyLock()) return;

  attemptsThisStep++;
  if ((ANSWERS[edgeIndex] || []).map(normalize).includes(val)) {
    const pts = correctPoints();
    showMsg(`¡Correcto! +${pts} puntos 🎉`, 'ok');

    try {
      await addScore(pts); // suma puntos por perfil (no toca lastPlayed)
      await refreshProfileUI();
      await refreshBoard();
    } catch (e) {
      showMsg('DB error: ' + (e.code || e.message), 'bad');
      return;
    }

    if (edgeIndex < NODES.length - 2) {
      setTimeout(()=>{ edgeIndex++; loadStep(); }, 900);
    } else {
      // Cadena completa
      showMsg('🎉 ¡Cadena completa!', 'ok');

      if (LOCK_ON_COMPLETE) {
        try {
          await markPlayedNow(); // lastPlayed = Date.now()
        } catch(e) {
          console.warn('No se pudo marcar lastPlayed:', e);
        }
        await enforceDailyLock(); // ahora sí bloquea botones
      }

      endGame();
    }
  } else {
    showMsg('No es correcto.','bad');
  }
}

// Mostrar solución y avanzar
function reveal(){
  els.middleInput.value = (ANSWERS[edgeIndex]||[])[0] || '';
  if (edgeIndex < NODES.length-2) {
    showMsg('Solución mostrada (0 puntos).','warn');
    setTimeout(()=>{ edgeIndex++; loadStep(); }, 900);
  } else {
    showMsg('Solución mostrada (0 puntos). 🎉 Cadena completa','warn');
    endGame();
  }
}

// Fin del juego (oculta cajas y botones)
function endGame(){
  els.gameRow.style.display='none';
  els.checkBtn.style.display='none';
  els.revealBtn.style.display='none';
}

// Bootstrap
export async function initGame(){
  // Listeners
  els.checkBtn.onclick = ()=>{ check().catch(err=>showMsg(err.message,'bad')); };
  els.revealBtn.onclick = reveal;
  els.middleInput.addEventListener('keydown', e=>{ if(e.key==='Enter') check(); });
  els.switchBtn.onclick = ()=> openModal();
  els.createUserBtn.onclick = async ()=>{
    try{
      await createOrLoginUsername(els.userInput.value);
      closeModal();
      await refreshProfileUI();
      await refreshBoard();
      edgeIndex = 0;
      loadStep();
      // No forzamos bloqueo aquí; solo al completar cadena
    } catch(e){
      els.userError.textContent = e.message || 'Error creando usuario';
    }
  };

  await ensureAuth();
  const profile = await getCurrentProfile();
  if (!profile) {
    openModal();
  } else {
    await refreshProfileUI();
    edgeIndex = 0;
    loadStep();
  }
  await refreshBoard();

  // Si quisieras bloquear desde el inicio del día, descomenta:
  await enforceDailyLock();
}
