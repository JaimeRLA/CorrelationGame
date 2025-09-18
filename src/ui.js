// src/ui.js
export const els = {
  startBox: document.getElementById('startBox'),
  endBox: document.getElementById('endBox'),
  middleInput: document.getElementById('middleInput'),
  msgEl: document.getElementById('message'),
  userTag: document.getElementById('userTag'),
  scoreTag: document.getElementById('scoreTag'),
  switchBtn: document.getElementById('switchBtn'),
  modal: document.getElementById('userModal'),
  userInput: document.getElementById('userInput'),
  createUserBtn: document.getElementById('createUserBtn'),
  userError: document.getElementById('userError'),
  boardBody: document.getElementById('boardBody'),
  gameRow: document.getElementById('gameRow'),
  checkBtn: document.getElementById('checkBtn'),
  revealBtn: document.getElementById('revealBtn'),
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

export function openModal(){
  els.modal.style.display='flex';
  setTimeout(()=> els.userInput.focus(), 0);
}
export function closeModal(){
  els.modal.style.display='none';
  els.userInput.value='';
  els.userError.textContent='';
}

export function renderBoard(rows){
  els.boardBody.innerHTML = rows.map(r=>`<tr><td>${r.display}</td><td>${r.score}</td></tr>`).join('')
    || '<tr><td colspan="2">Aún no hay puntuaciones</td></tr>';
}
