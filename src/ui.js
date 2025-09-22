export const els = {
  // Juego
  startBox:   document.getElementById('startBox'),
  endBox:     document.getElementById('endBox'),
  middleInput:document.getElementById('middleInput'),
  msgEl:      document.getElementById('message'),
  gameRow:    document.getElementById('gameRow'),
  checkBtn:   document.getElementById('checkBtn'),
  revealBtn:  document.getElementById('revealBtn'),
  // Header
  userTag:    document.getElementById('userTag'),
  scoreTag:   document.getElementById('scoreTag'),
  btnLogin:   document.getElementById('btnLogin'),
  btnRegister:document.getElementById('btnRegister'),
  // Compat (no se usa, pero lo dejamos)
  switchBtn:  document.getElementById('switchBtn'),
  // Leaderboard
  boardBody:  document.getElementById('boardBody'),
  // Modal
  modal:        document.getElementById('userModal'),
  modeTitle:    document.getElementById('modeTitle'),
  modeHelper:   document.getElementById('modeHelper'),
  userInput:    document.getElementById('userInput'),
  passInput:    document.getElementById('passInput'),
  authSubmitBtn:document.getElementById('authSubmitBtn'),
  userError:    document.getElementById('userError'),
  // Compat con código viejo (si existiera)
  createUserBtn:document.getElementById('createUserBtn'),
};

export function showMsg(text, kind='') {
  if (!els.msgEl) return;
  els.msgEl.textContent = text;
  els.msgEl.className = 'msg ' + kind;
}

export function renderEndpoint(container, node){
  if (!container) return;
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

export function openModal(mode='login'){
  if (!els.modal) return;
  els.modal.dataset.mode = mode; // 'login' | 'register'
  if (els.modeTitle)  els.modeTitle.textContent = mode === 'register' ? 'Crear usuario' : 'Iniciar sesión';
  if (els.authSubmitBtn) els.authSubmitBtn.textContent = mode === 'register' ? 'Crear' : 'Entrar';
  if (els.modeHelper) els.modeHelper.textContent =
    mode === 'register' ? 'Si ya tienes cuenta, usa “Iniciar sesión”.'
                        : '¿No tienes cuenta? Elige “Crear usuario”.';
  els.userError && (els.userError.textContent = '');
  els.modal.style.display='flex';
  setTimeout(()=> els.userInput && els.userInput.focus(), 0);
}
export function closeModal(){
  if (!els.modal) return;
  els.modal.style.display='none';
  els.userInput && (els.userInput.value='');
  els.passInput && (els.passInput.value='');
  els.userError && (els.userError.textContent='');
}

export function renderBoard(rows){
  if (!els.boardBody) return;
  els.boardBody.innerHTML = rows && rows.length
    ? rows.map(r=>`<tr><td>${r.display}</td><td>${r.score}</td></tr>`).join('')
    : '<tr><td colspan="2">Aún no hay puntuaciones</td></tr>';
}
