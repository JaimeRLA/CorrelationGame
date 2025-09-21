// src/main.js
import { initGame, startAfterAuth } from './game.js';
import { els, openModal, closeModal, setAuthMode, setHeaderAuthState } from './ui.js';
import {
  ensureAuth, getCurrentProfile,
  registerUsername, loginUsername, signOutUser
} from './firebase.js';

async function refreshHeaderAuth(){
  const u = await ensureAuth();
  const profile = await getCurrentProfile();
  setHeaderAuthState(!!(u && profile));
  if (profile && els.userTag) els.userTag.textContent = profile.display || '—';
}

function wireHeader(){
  if (els.loginHeaderBtn){
    els.loginHeaderBtn.onclick = ()=>{ setAuthMode('login'); openModal(); };
  }
  if (els.registerHeaderBtn){
    els.registerHeaderBtn.onclick = ()=>{ setAuthMode('register'); openModal(); };
  }
  if (els.switchBtn){
    els.switchBtn.onclick = async ()=>{
      await signOutUser().catch(()=>{});
      setHeaderAuthState(false);
      setAuthMode('login');
      openModal();
    };
  }
}

function wireModal(){
  if (els.loginBtn){
    els.loginBtn.onclick = async ()=>{
      try{
        const name = els.userInput?.value || '';
        const pass = els.passInput?.value || '';
        await loginUsername(name, pass);
        closeModal();
        await startAfterAuth();
        await refreshHeaderAuth();
      }catch(e){ if (els.userError) els.userError.textContent = e.message || 'Error al iniciar sesión'; }
    };
  }
  if (els.registerBtn){
    els.registerBtn.onclick = async ()=>{
      try{
        const name = els.userInput?.value || '';
        const pass = els.passInput?.value || '';
        await registerUsername(name, pass);
        closeModal();
        await startAfterAuth();
        await refreshHeaderAuth();
      }catch(e){ if (els.userError) els.userError.textContent = e.message || 'Error al crear cuenta'; }
    };
  }
}

window.addEventListener('DOMContentLoaded', async ()=>{
  wireHeader();
  wireModal();
  await initGame();          // arranca el juego (si ya hay sesión, entra solo)
  await refreshHeaderAuth(); // muestra/oculta botones de cabecera correctos
});
