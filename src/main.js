// src/main.js?v=43
import { initGame } from './game.js?v=43';
import { els, setAuthMode, openModal, closeModal, renderBoard } from './ui.js?v=43';
import { loginUsername, registerUsername, getCurrentProfile, loadTop } from './firebase.js?v=43';

window.addEventListener('DOMContentLoaded', async () => {
  await initGame().catch(err => console.error('Init error:', err));

  // Header → abrir modal en cada modo
  els.loginHeaderBtn?.addEventListener('click', () => { setAuthMode('login'); openModal(); });
  els.registerHeaderBtn?.addEventListener('click', () => { setAuthMode('register'); openModal(); });

  // Modal → acciones
  els.loginBtn?.addEventListener('click', async () => {
    try {
      await loginUsername(els.userInput?.value || '', els.passInput?.value || '');
      closeModal();
      location.reload();
    } catch (e) {
      if (els.userError) els.userError.textContent = e.message || 'No se pudo iniciar sesión';
    }
  });
  els.registerBtn?.addEventListener('click', async () => {
    try {
      await registerUsername(els.userInput?.value || '', els.passInput?.value || '');
      closeModal();
      location.reload();
    } catch (e) {
      if (els.userError) els.userError.textContent = e.message || 'No se pudo crear la cuenta';
    }
  });

  // Enter = acción visible
  els.passInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const loginVisible = els.loginBtn && els.loginBtn.style.display !== 'none';
      (loginVisible ? els.loginBtn : els.registerBtn)?.click();
    }
  });

  // Si ya hay perfil, cierra modal
  try {
    const p = await getCurrentProfile();
    if (p) closeModal();
  } catch {}

  // Carga leaderboard (defensivo)
  try {
    const rows = await loadTop(8);
    renderBoard(rows);
  } catch {}
});
