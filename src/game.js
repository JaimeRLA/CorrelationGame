// src/game.js
// Lógica del juego + UI con bloqueo diario al completar la cadena.

import { NODES, ANSWERS } from './config/levels.js';
import {
  ensureAuth, getCurrentProfile, createOrLoginUsername,
  addScoreDaily, loadTop, getCooldownMs
} from './firebase.js';
import { els, showMsg, renderEndpoint, openModal, closeModal, renderBoard } from './ui.js';

let edgeIndex = 0;
let attemptsThisStep = 0;
let sessionPoints = 0;

// Utils
function normalize(s){ return (s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function correctPoints(){ return attemptsThisStep === 0 ? 100 : 50; }

// Render del paso
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

// Leaderboard
async function refreshBoard(){
  try {
    const rows = await loadTop(8);
    renderBoard(rows);
  } catch (e) {
    console.warn('Leaderboard error:', e);
  }
}

// Bloqueo diario
async function enforceDailyLock(){
  const remaining = await getCooldownMs();
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

// Comprobar
async function check(){
  const val = normalize(els.middleInput.value);
  if(!val){ showMsg('Escribe algo.','warn'); return; }

  if (await enforceDailyLock()) return;

  attemptsThisStep++;
  if ((ANSWERS[edgeIndex] || []).map(normalize).includes(val)) {
    const pts = correctPoints();
    sessionPoints += pts;
    showMsg(`¡Correcto! +${pts} puntos 🎉`, 'ok');

    if (edgeIndex < NODES.length - 2) {
      setTimeout(()=>{ edgeIndex++; loadStep(); }, 900);
    } else {
      try {
        await addScoreDaily(sessionPoints);  // ✔️ Marca el día + suma puntos
        await refreshProfileUI();
        await refreshBoard();
        await enforceDailyLock();
        showMsg('🎉 ¡Cadena completa!', 'ok');
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg.includes('Ya jugaste hoy')) {
          showMsg('⏳ Ya jugaste hoy. Vuelve mañana.', 'warn');
          await enforceDailyLock();
        } else {
          showMsg('Error al guardar la puntuación.', 'bad');
          console.warn(e);
        }
      }
      endGame();
    }
  } else {
    showMsg('No es correcto.','bad');
  }
}

// Mostrar solución y avanzar
async function reveal(){
  els.middleInput.value = (ANSWERS[edgeIndex]||[])[0] || '';
  if (edgeIndex < NODES.length-2) {
    showMsg('Solución mostrada (0 puntos).','warn');
    setTimeout(()=>{ edgeIndex++; loadStep(); }, 900);
  } else {
    // Consumes el día aunque reveles al final con 0 puntos
    try {
      await addScoreDaily(0);
      await enforceDailyLock();
      showMsg('Solución mostrada (0 puntos). 🎉 Cadena completa','warn');
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('Ya jugaste hoy')) {
        showMsg('⏳ Ya jugaste hoy. Vuelve mañana.', 'warn');
        await enforceDailyLock();
      } else {
        showMsg('Error al registrar la partida.', 'bad');
        console.warn(e);
      }
    }
    endGame();
  }
}

// Fin
function endGame(){
  els.gameRow.style.display='none';
  els.checkBtn.style.display='none';
  els.revealBtn.style.display='none';
}

// Init
export async function initGame(){
  // Listeners
  els.checkBtn.onclick = ()=>{ check().catch(err=>showMsg(err.message,'bad')); };
  els.revealBtn.onclick = ()=>{ reveal().catch(err=>showMsg(err.message,'bad')); };
  els.middleInput.addEventListener('keydown', e=>{ if(e.key==='Enter') check(); });

  els.switchBtn.onclick = ()=> openModal();
  els.createUserBtn.onclick = async ()=>{
    try{
      await createOrLoginUsername(els.userInput.value);
      closeModal();
      await refreshProfileUI();
      await refreshBoard();
      edgeIndex = 0;
      sessionPoints = 0;
      loadStep();
      await enforceDailyLock();
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
    sessionPoints = 0;
    loadStep();
  }
  await refreshBoard();
  await enforceDailyLock();
}
