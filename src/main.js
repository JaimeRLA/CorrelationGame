// src/main.js
// Arranque minimal: solo inicia el juego. (El juego gestiona el modal y login)
import { initGame } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  initGame().catch(err => console.error('Init error:', err));
});
