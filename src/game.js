import { NODES, ANSWERS } from './config/levels.js';
import {
  ensureAuth, getCurrentProfile, addScoreDaily, loadTop, getCooldownMs, getStreakInfo
} from './firebase.js';
import { els, showMsg, renderEndpoint, renderBoard, renderStreak } from './ui.js';

let edgeIndex = 0;
let attemptsThisStep = 0;
let sessionPoints = 0;
let baseScore = 0;

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
    els.userTag && (els.userTag.textContent = p.display);
    baseScore = Number(p.score||0);
    updateHeaderScoreUI();
    try{
      const info = await getStreakInfo();
      renderStreak(info);
    }catch{}
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
    showMsg(` Ya jugaste hoy. Vuelve en ${h}h ${m}m ${s}s`, 'warn');
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
  updateHeaderScoreUI();
  showMsg(`¡Correcto! +${pts} puntos 🎉`, 'ok');

  if (edgeIndex < NODES.length - 2){
    setTimeout(()=>{ edgeIndex++; loadStep(); }, 900);
    return;
  }

  try{
    const newScore = await addScoreDaily(sessionPoints);
    baseScore = newScore;
    sessionPoints = 0;
    updateHeaderScoreUI();
    await new Promise(r=>setTimeout(r, 120));
    await refreshBoard();
    await enforceDailyLock();
    const info = await getStreakInfo();
    renderStreak(info);
    showMsg(' ¡Cadena completa!', 'ok');
  }catch(e){
    const msg = String(e?.message || e);
    if (msg.includes('Ya jugaste hoy')){
      showMsg(' Ya jugaste hoy. Vuelve mañana.', 'warn');
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
  els.middleInput && (els.middleInput.value = ans);

  if (edgeIndex < NODES.length - 2){
    showMsg('Solución mostrada (0 puntos en este paso).','warn');
    setTimeout(()=>{ edgeIndex++; loadStep(); }, 900);
    return;
  }

  try{
    const newScore = await addScoreDaily(sessionPoints);
    baseScore = newScore;
    sessionPoints = 0;
    updateHeaderScoreUI();
    await new Promise(r=>setTimeout(r, 120));
    await refreshBoard();
    await enforceDailyLock();
    const info = await getStreakInfo();
    renderStreak(info);
    showMsg('Solución mostrada (0 en este paso). Puntos anteriores guardados y cadena completa','warn');
  }catch(e){
    const msg = String(e?.message || e);
    if (msg.includes('Ya jugaste hoy')){
      showMsg(' Ya jugaste hoy. Vuelve mañana.', 'warn');
      await enforceDailyLock();
    } else {
      showMsg('Error al registrar la partida.', 'bad');
      console.warn(e);
    }
  }
  endGame();
}

function endGame(){
  els.gameRow   && (els.gameRow.style.display='none');
  els.checkBtn  && (els.checkBtn.style.display='none');
  els.revealBtn && (els.revealBtn.style.display='none');
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
  els.checkBtn  && (els.checkBtn.onclick  = ()=>{ check().catch(err=>showMsg(err.message,'bad')); });
  els.revealBtn && (els.revealBtn.onclick = ()=>{ reveal().catch(err=>showMsg(err.message,'bad')); });
  els.middleInput && els.middleInput.addEventListener('keydown', e=>{ if(e.key==='Enter') check(); });

  await ensureAuth();
  const p = await getCurrentProfile();
  if (p) await startAfterAuth();
}
