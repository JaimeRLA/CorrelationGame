// src/main.js
import { initGame, startAfterAuth } from './game.js';
import { els, openModal, closeModal, showMsg } from './ui.js';
import { registerUsername, loginUsername, getCurrentProfile, signOutUser } from './firebase.js';

window.addEventListener('DOMContentLoaded', async () => {
  // Botones header
  els.btnLogin    && (els.btnLogin.onclick    = ()=> openModal('login'));
  els.btnRegister && (els.btnRegister.onclick = ()=> openModal('register'));

  // Submit del modal
  els.authSubmitBtn && (els.authSubmitBtn.onclick = async ()=>{
    try{
      const mode = els.modal?.dataset?.mode || 'login';
      const name = els.userInput?.value || '';
      const pass = els.passInput?.value || '';
      if (mode === 'register') await registerUsername(name, pass);
      else                     await loginUsername(name, pass);
      closeModal();
      await startAfterAuth();
    }catch(e){
      els.userError && (els.userError.textContent = e.message || 'Error de acceso');
    }
  });

  // Enter en password = submit
  els.passInput && els.passInput.addEventListener('keydown', e=>{
    if (e.key === 'Enter') els.authSubmitBtn?.click();
  });

  // Arranque del juego (si hay sesión la reanudará)
  await initGame();

  // Si no hay perfil, abrimos modal de login por defecto
  try {
    const p = await getCurrentProfile();
    if (!p) openModal('login');
  } catch {}
});
