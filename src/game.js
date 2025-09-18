// src/game.js
import { NODES, ANSWERS } from './config/levels.js';
import { ensureAuth, getCurrentPlayer, createOrLoginUsername, addScore, loadTop } from './firebase.js';
import { els, showMsg, renderEndpoint, openModal, closeModal, renderBoard } from './ui.js';

let edgeIndex = 0;
let attemptsThisStep = 0;

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

async function refreshPlayerUI(){
  const p = await getCurrentPlayer();
  if(p){ els.userTag.textContent = p.display; els.scoreTag.textContent = String(p.score||0); }
}

async function refreshBoard(){
  const rows = await loadTop(8);
  renderBoard(rows);
}

async function check(){
  const val = normalize(els.middleInput.value);
  if(!val){ showMsg('Escribe algo.','warn'); return; }
  attemptsThisStep++;
  if((ANSWERS[edgeIndex]||[]).map(normalize).includes(val)){
    const pts = correctPoints();
    showMsg(`¡Correcto! +${pts} puntos 🎉`, 'ok');
    try {
        await addScore(pts);  // en game.js dentro de check()
    } catch (e) {
      showMsg('DB error: ' + (e.code || e.message), 'bad');
      return;
    }
    await refreshPlayerUI();
    await refreshBoard();
    if(edgeIndex < NODES.length-2){
      setTimeout(()=>{ edgeIndex++; loadStep(); }, 900);
    } else {
      showMsg('🎉 ¡Cadena completa!', 'ok');
      endGame();
    }
  } else {
    showMsg('No es correcto.','bad');
  }
}

function reveal(){
  els.middleInput.value = (ANSWERS[edgeIndex]||[])[0] || '';
  if(edgeIndex < NODES.length-2){
    showMsg('Solución mostrada (0 puntos).','warn');
    setTimeout(()=>{ edgeIndex++; loadStep(); }, 900);
  } else {
    showMsg('Solución mostrada (0 puntos). 🎉 Cadena completa', 'warn');
    endGame();
  }
}

function endGame(){
  els.gameRow.style.display='none';
  els.checkBtn.style.display='none';
  els.revealBtn.style.display='none';
}

export async function initGame(){
  // eventos
  els.checkBtn.onclick = ()=>{ check().catch(err=>showMsg(err.message,'bad')); };
  els.revealBtn.onclick = reveal;
  els.middleInput.addEventListener('keydown', e=>{ if(e.key==='Enter') check(); });
  els.switchBtn.onclick = ()=> openModal();
  els.createUserBtn.onclick = async ()=>{
    try {
      await createOrLoginUsername(els.userInput.value);
      closeModal();
      await refreshPlayerUI();
      await refreshBoard();
      loadStep();
    } catch(err){
      els.userError.textContent = err.message || 'Error creando usuario';
    }
  };

  await ensureAuth();
  const player = await getCurrentPlayer();
  if(!player){ openModal(); } else { await refreshPlayerUI(); loadStep(); }
  await refreshBoard();
}
