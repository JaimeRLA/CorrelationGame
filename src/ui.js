// src/ui.js
export const els = {
  get startBox(){ return document.getElementById('startBox'); },
  get endBox(){ return document.getElementById('endBox'); },
  get middleInput(){ return document.getElementById('middleInput'); },
  get msgEl(){ return document.getElementById('message'); },
  get userTag(){ return document.getElementById('userTag'); },
  get scoreTag(){ return document.getElementById('scoreTag'); },
  get switchBtn(){ return document.getElementById('switchBtn'); },
  get loginHeaderBtn(){ return document.getElementById('loginHeaderBtn'); },
  get registerHeaderBtn(){ return document.getElementById('registerHeaderBtn'); },

  get modal(){ return document.getElementById('userModal'); },
  get authModeTitle(){ return document.getElementById('authModeTitle'); },
  get authHelper(){ return document.getElementById('authHelper'); },
  get userInput(){ return document.getElementById('userInput'); },
  get passInput(){ return document.getElementById('passInput'); },
  get loginBtn(){ return document.getElementById('loginBtn'); },
  get registerBtn(){ return document.getElementById('registerBtn'); },

  // compat
  get createUserBtn(){ return document.getElementById('createUserBtn'); },
  get userError(){ return document.getElementById('userError'); },

  get boardBody(){ return document.getElementById('boardBody'); },
  get gameRow(){ return document.getElementById('gameRow'); },
  get checkBtn(){ return document.getElementById('checkBtn'); },
  get revealBtn(){ return document.getElementById('revealBtn'); },
};

export function showMsg(text, kind='') {
  const el = els.msgEl;
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + kind;
}

export function renderEndpoint(container, node){
  if (!container) return;
  container.innerHTML = '';
  if (node.type === 'text') {
    const span = document.createElement('strong');
    span.textContent = node.value;
    container.appendChild(span);
  } else if (node.type === 'image') {
    const img = document.createElement('img');
    img.src = node.src; img.alt = node.alt || 'Imagen';
    img.style.maxWidth = '100%'; img.style.maxHeight = '100px';
    container.appendChild(img);
  }
}

export function openModal(){
  const m = els.modal;
  if (!m) return;
  m.style.display='flex';
  setTimeout(()=> els.userInput && els.userInput.focus(), 0);
}
export function closeModal(){
  const m = els.modal;
  if (!m) return;
  m.style.display='none';
  if (els.userInput) els.userInput.value='';
  if (els.passInput) els.passInput.value='';
  if (els.userError) els.userError.textContent='';
}

export function renderBoard(rows){
  const body = els.boardBody;
  if (!body) return;
  body.innerHTML = rows.map(r=>`<tr><td>${r.display}</td><td>${r.score}</td></tr>`).join('')
    || '<tr><td colspan="2">Aún no hay puntuaciones</td></tr>';
}

export function setAuthMode(mode){
  // mode: 'login' | 'register'
  const t = els.authModeTitle, h = els.authHelper;
  if (!t || !h) return;
  if (mode === 'register'){
    t.textContent = 'Crear cuenta';
    h.textContent = 'Elige un nombre único (no distingue mayúsculas) y una contraseña de 6+ caracteres.';
  } else {
    t.textContent = 'Iniciar sesión';
    h.textContent = 'Introduce tu usuario y contraseña para entrar.';
  }
}

export function setHeaderAuthState(loggedIn){
  if (els.loginHeaderBtn)    els.loginHeaderBtn.style.display    = loggedIn ? 'none' : '';
  if (els.registerHeaderBtn) els.registerHeaderBtn.style.display = loggedIn ? 'none' : '';
  if (els.switchBtn)         els.switchBtn.style.display         = loggedIn ? '' : 'none';
}
