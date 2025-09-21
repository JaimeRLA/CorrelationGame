// src/game.js
import { NODES, ANSWERS } from './config/levels.js';
import {
  ensureAuth, getCurrentProfile, createOrLoginUsername,
  addScoreDaily, loadTop, getCooldownMs
} from './firebase.js';
import { els, showMsg, renderEndpoint, openModal, closeModal, renderBoard } from './ui.js';

let edgeIndex = 0;
let attemptsThisStep = 0;
let sessionPoints = 0;   // puntos de esta cadena (local)
let baseScore = 0;       // puntos de BD al entrar

const normalize = (s)=> (s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const correctPoints = ()=> attemptsThisStep === 0 ? 100 : 50;

function updateHeaderScoreUI(){
  if (els.scoreTag) els.scoreTag.textContent = String((baseScore||0) + (sessionPoints||0));
}

function loadStep(){
  renderEndpoint(els.startBox, NODES[edgeIndex]);
  renderEndpoint(els.endBox, NODES[edgeIndex+1]);
  if (els.middleInput) els.middleInput.value='';
  showMsg('', '');
  attemptsThisStep = 0;
  els.middleInput && els.middleInput.focus();
}

async function refreshProfileUI(){
  const p = await getCurrentProfile();
  if (p){
    if (els.userTag) els.userTag.textContent = p.display;
    baseScore = Number(p.score||0);
    updateHeaderScoreUI();
  }
}

async function refreshBoard(){
  try{
    const rows = await loadTop(8);
    renderBoard(rows);
  }catch(e){ console.warn('Leaderboard error:', e); }
}

async function enforceDailyLock(){
  const remaining = await getCooldownMs();
  const locked = remaining > 0;

  if (els.checkBtn)  { els.checkBtn.disabled = locked;  els.checkBtn.style.opacity  = locked? .6 : ''; }
  if (els.revealBtn) { els.revealBtn.disabled = locked; els.revealBtn.style.opacity = locked? .6 : ''; }

  if (locked){
    const h = Math.floor(remaining/3600000);
    const m = Math.floor((remaining%3600000)/60000);
    const s = Math.floor((remaining%60000)/1000);
    showMsg(`⏳ Ya jugaste hoy. Vuelve en ${h}h ${m}m ${s}s`, 'warn');
  }
  return locked;
}

async function check(){
  const val = normalize(els.middleInput?.value);
  if(!val){ showMsg('Escribe algo.','warn'); return; }
  if (await enforceDailyLock()) return;

  attemptsThisStep++;
  const ok = (ANSWERS[edgeIndex]||[]).map(normalize).includes(val);
  if (!ok){ showMsg('No es correcto.','bad'); return; }

  const pts = correctPoints();
  sessionPoints += pts;
  updateHeaderScoreUI(); // 🔹 sube marcador ya
  showMsg(`¡Correcto! +${pts} puntos 🎉`, 'ok');

  if (edgeIndex < NODES.length - 2){
    setTimeout(()=>{ edgeIndex++; loadStep(); }, 900);
    return;
  }

  // fin de cadena -> persistir y bloquear el día
  try{
    await addScoreDaily(sessionPoints);
    baseScore += sessionPoints;
    sessionPoints = 0;
    updateHeaderScoreUI();
    await refreshBoard();
    await enforceDailyLock();
    showMsg('🎉 ¡Cadena completa!', 'ok');
  }catch(e){
    const msg = String(e?.message || e);
    if (msg.includes('Ya jugaste hoy')){
      showMsg('⏳ Ya jugaste hoy. Vuelve mañana.', 'warn');
      await enforceDailyLock();
    } else {
      showMsg('Error al guardar la puntuación.', 'bad');
      console.warn(e);
    }
  }
  endGame();
}

async function reveal(){
  const ans = (ANSWERS[edgeIndex]||[])[0] || '';
  if (els.middleInput) els.middleInput.value = ans;

  if (edgeIndex < NODES.length-2){
    showMsg('Solución mostrada (0 puntos).','warn');
    setTimeout(()=>{ edgeIndex++; loadStep(); }, 900);
    return;
  }

  try{
    await addScoreDaily(0);
    await enforceDailyLock();
    showMsg('Solución mostrada (0 puntos). 🎉 Cadena completa','warn');
  }catch(e){
    const msg = String(e?.message || e);
    if (msg.includes('Ya jugaste hoy')){
      showMsg('⏳ Ya jugaste hoy. Vuelve mañana.', 'warn');
      await enforceDailyLock();
    } else {
      showMsg('Error al registrar la partida.', 'bad');
      console.warn(e);
    }
  }
  endGame();
}

function endGame(){
  if (els.gameRow) els.gameRow.style.display='none';
  if (els.checkBtn) els.checkBtn.style.display='none';
  if (els.revealBtn) els.revealBtn.style.display='none';
}

export async function startAfterAuth(){
  await refreshProfileUI();
  await refreshBoard();
  edgeIndex = 0;
  sessionPoints = 0;
  loadStep();
  await enforceDailyLock();
}

export async function initGame(){
  if (els.checkBtn)  els.checkBtn.onclick  = ()=>{ check().catch(err=>showMsg(err.message,'bad')); };
  if (els.revealBtn) els.revealBtn.onclick = ()=>{ reveal().catch(err=>showMsg(err.message,'bad')); };
  els.middleInput && els.middleInput.addEventListener('keydown', e=>{ if(e.key==='Enter') check(); });

  // compat botón oculto del modal
  if (els.createUserBtn) els.createUserBtn.onclick = async ()=>{
    try{
      await createOrLoginUsername(els.userInput?.value);
      closeModal();
      await startAfterAuth();
    }catch(e){ if (els.userError) els.userError.textContent = e.message || 'Error creando usuario'; }
  };

  await ensureAuth();
  const p = await getCurrentProfile();
  if (p) await startAfterAuth(); // si ya hay sesión
}
