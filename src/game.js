// src/game.js?v=43
import { NODES, ANSWERS } from './config/levels.js?v=43';
import {
  ensureAuth, getCurrentProfile, createOrLoginUsername,
  addScoreDaily, loadTop, getCooldownMs
} from './firebase.js?v=43';
import { els, showMsg, renderEndpoint, openModal, closeModal, renderBoard } from './ui.js?v=43';

let edgeIndex = 0;
let attemptsThisStep = 0;
let sessionPoints = 0;

function normalize(s){ return (s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function correctPoints(){ return attemptsThisStep === 0 ? 100 : 50; }

function loadStep(){
  renderEndpoint(els.startBox, NODES[edgeIndex]);
  renderEndpoint(els.endBox, NODES[edgeIndex+1]);
  els.middleInput.value='';
  showMsg('', '');
  attemptsThisStep = 0;
  els.middleInput.focus();
}

async function refreshProfileUI(){
  const p = await getCurrentProfile();
  if (p){
    els.userTag.textContent = p.display;
    els.scoreTag.textContent = String(p.score || 0);
  }
}

async function refreshBoardSafe(){
  try {
    const rows = await loadTop(8);
    renderBoard(rows);
  } catch (e) {
    console.warn('Leaderboard error:', e);
  }
}

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
        await addScoreDaily(sessionPoints);
        await refreshProfileUI();
        await refreshBoardSafe();
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

async function reveal(){
  els.middleInput.value = (ANSWERS[edgeIndex]||[])[0] || '';
  if (edgeIndex < NODES.length-2) {
    showMsg('Solución mostrada (0 puntos).','warn');
    setTimeout(()=>{ edgeIndex++; loadStep(); }, 900);
  } else {
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

function endGame(){
  els.gameRow.style.display='none';
  els.checkBtn.style.display='none';
  els.revealBtn.style.display='none';
}

export async function initGame(){
  console.log('GAME v43 loaded');

  els.checkBtn.onclick = ()=>{ check().catch(err=>showMsg(err.message,'bad')); };
  els.revealBtn.onclick = ()=>{ reveal().catch(err=>showMsg(err.message,'bad')); };
  els.middleInput.addEventListener('keydown', e=>{ if(e.key==='Enter') check(); });

  els.switchBtn.onclick = ()=> openModal();
  els.createUserBtn.onclick = async ()=>{
    try{
      await createOrLoginUsername(els.userInput.value);
      closeModal();
      await refreshProfileUI();
      await refreshBoardSafe();
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
    // el modal lo abre main.js con los botones del header
  } else {
    await refreshProfileUI();
    edgeIndex = 0;
    sessionPoints = 0;
    loadStep();
  }
  await refreshBoardSafe();
  await enforceDailyLock();
}
