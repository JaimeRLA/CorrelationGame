# Asocia — Juego de asociaciones (Firebase)

## Estructura
- `index.html` (carga módulos ES y estilos)
- `public/styles.css` (estilos)
- `src/config/levels.js` (NODES/ANSWERS)
- `src/ui.js` (UI, DOM y helpers)
- `src/firebase.js` (SDK + helpers de auth/db)
- `src/firebase-config.example.js` (copia a `firebase-config.js` y pega tus credenciales)
- `src/game.js` (lógica del juego)
- `src/main.js` (bootstrap)
- `.gitignore` (ignora `src/firebase-config.js`)

## Primeros pasos
1. Copia `src/firebase-config.example.js` a `src/firebase-config.js` y pega tu configuración de Firebase.
2. En Firebase Console, habilita **Authentication → Anonymous**.
3. En **Realtime Database**, crea la base de datos y define reglas adecuadas.
4. Sirve localmente (p.ej. `npx serve .`) o sube a GitHub Pages.

