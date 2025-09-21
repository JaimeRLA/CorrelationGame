// src/ui.js?v=43
const $ = (id) => document.getElementById(id);

export const els = {
  // juego
  startBox: $('startBox'),
  endBox: $('endBox'),
  middleInput: $('middleInput'),
  msgEl: $('message'),
  gameRow: $('gameRow'),
  checkBtn: $('checkBtn'),
  revealBtn: $('revealBtn'),

  // header
  userTag: $('userTag'),
  scoreTag: $('scoreTag'),
  loginHeaderBtn: $('loginHeaderBtn'),
  registerHeaderBtn: $('registerHeaderBtn'),
  switchBtn: $('switchBtn'),

  // modal
  modal: $('userModal'),
  authModeTitle: $('authModeTitle'),
  authHelper: $('authHelper'),
  userInput: $('userInput'),
  passInput: $('passInput'),
  loginBtn: $('loginBtn'),
  registerBtn: $('registerBtn'),
  createUserBtn: $('createUserBtn'),
  userError: $('userError'),

  // leaderboard
  boardBody: $('boardBody'),
};

export function showMsg(text, kind='') {
  els.msgEl.textContent = text;
  els.msgEl.className = 'msg ' + kind;
}

export function renderEndpoint(container, node){
  container.innerHTML = '';
  if(node.type==='text'){
    const span=document.createElement('strong');
    span.textContent=node.value;
    container.appendChild(span);
  } else if(node.type==='image'){
    const img=document.createElement('img');
    img.src=node.src; img.alt=node.alt||'Imagen';
    img.style.maxWidth='100%'; img.style.maxHeight='100px';
    container.appendChild(img);
  }
}

export function setAuthMode(mode){
  if (mode === 'register') {
    els.authModeTitle.textContent = 'Crear cuenta';
    els.loginBtn.style.display = 'none';
    els.registerBtn.style.display = '';
    els.authHelper.textContent = 'El usuario debe ser único. Contraseña mínima de 6 caracteres.';
  } else {
    els.authModeTitle.textContent = 'Iniciar sesión';
    els.loginBtn.style.display = '';
    els.registerBtn.style.display = 'none';
    els.authHelper.textContent = 'Introduce tu usuario y contraseña para entrar.';
  }
}

export function openModal(){
  els.modal.style.display='flex';
  setTimeout(()=> els.userInput?.focus(), 0);
}
export function closeModal(){
  els.modal.style.display='none';
  if (els.userInput) els.userInput.value='';
  if (els.passInput) els.passInput.value='';
  if (els.userError) els.userError.textContent='';
}

export function renderBoard(rows){
  els.boardBody.innerHTML = rows.map(r=>`<tr><td>${r.display}</td><td>${r.score}</td></tr>`).join('')
    || '<tr><td colspan="2">Aún no hay puntuaciones</td></tr>';
}
