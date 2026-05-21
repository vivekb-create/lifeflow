// LifeFlow — to-dos (categories, drag, share)
// TODOS — edit, radio priority, categories, drag, share
// ─────────────────────────────────────────────
let showTodoForm  = false;
let todoTab       = 'all';
let todoCat       = 'General';
let editingTodoId = null;
let selectedPriority = 'low';
let dragSrcId     = null;
let sharedTodoLists = [];
let todoCategories = ['General','Home','Work','Shopping','Personal'];

function renderTodoCatBar(){
  const catBar=document.getElementById('todo-cat-bar');
  if(!catBar)return;
  catBar.innerHTML=todoCategories.map(cat=>
    `<button class="todo-cat-chip ${todoCat===cat?'active':''}" onclick="setTodoCat('${cat}')">${cat}</button>`
  ).join('')+
  `<button class="todo-cat-chip add-cat" onclick="promptAddTodoCat()">+ Category</button>`;
}

function setTodoCat(cat){todoCat=cat;renderTodos();}

function promptAddTodoCat(){
  const name=(prompt('New category name:','')||'').trim();
  if(!name)return;
  if(todoCategories.includes(name)){showToast('Category already exists.');return;}
  todoCategories.push(name);
  persist();
  todoCat=name;
  renderTodos();
}

function renderSharedBanner(){
  const el=document.getElementById('todo-shared-banner');
  if(!el)return;
  const shared=sharedTodoLists.filter(s=>s.cat===todoCat);
  if(shared.length===0){el.innerHTML='';return;}
  el.innerHTML=`<div style="background:var(--blue-l);border:1px solid var(--blue);border-radius:var(--r2);padding:9px 14px;margin-bottom:12px;font-size:12px;color:var(--blue);display:flex;align-items:center;gap:8px">
    <span>&#128065;&#65039;</span>
    <span><strong>${todoCat}</strong> list shared with: ${shared.map(s=>s.sharedWith).join(', ')}</span>
  </div>`;
}

function renderTodos(){
  renderTodoCatBar();
  renderSharedBanner();

  const catTodos=todos.filter(t=>(t.cat||'General')===todoCat);
  const pending=sortTodos(catTodos.filter(t=>!t.done));
  const done=catTodos.filter(t=>t.done);

  const allPending=sortTodos(todos.filter(t=>!t.done));
  const counts={
    all:allPending.length,
    overdue:allPending.filter(t=>getDueCategory(t)==='overdue').length,
    today:allPending.filter(t=>getDueCategory(t)==='today').length,
    week:allPending.filter(t=>['today','week'].includes(getDueCategory(t))).length,
    month:allPending.filter(t=>['today','week','month'].includes(getDueCategory(t))).length,
  };

  const tabs=[
    {id:'all',label:'All'},
    {id:'today',label:'Today'},
    {id:'week',label:'This Week'},
    {id:'month',label:'This Month'},
    ...(counts.overdue>0?[{id:'overdue',label:'Overdue'}]:[]),
  ];
  document.getElementById('todo-tab-bar').innerHTML=tabs.map(tab=>{
    const cnt=counts[tab.id]||0;
    const isOverdue=tab.id==='overdue';
    const overdueStyle=isOverdue
      ?(todoTab===tab.id?'style="background:var(--red);color:white;border-color:var(--red)"':'style="background:var(--red-l);color:var(--red);border-color:var(--red-l)"')
      :'';
    return `<button class="todo-tab ${todoTab===tab.id?'active':''}" onclick="setTodoTab('${tab.id}')" ${overdueStyle}>${tab.label}${cnt>0?`<span class="todo-count-badge">${cnt}</span>`:''}</button>`;
  }).join('');

  let filtered;
  if(todoTab==='today')    filtered=pending.filter(t=>['today','overdue'].includes(getDueCategory(t)));
  else if(todoTab==='week')   filtered=pending.filter(t=>['overdue','today','week'].includes(getDueCategory(t)));
  else if(todoTab==='month')  filtered=pending.filter(t=>['overdue','today','week','month'].includes(getDueCategory(t)));
  else if(todoTab==='overdue')filtered=pending.filter(t=>getDueCategory(t)==='overdue');
  else filtered=pending;

  const groups={overdue:[],today:[],week:[],month:[],later:[]};
  filtered.forEach(t=>{
    const cat=getDueCategory(t);
    if(groups[cat])groups[cat].push(t);
    else groups.later.push(t);
  });
  const groupLabels={overdue:'Overdue',today:'Due Today',week:'This Week',month:'This Month',later:'Later'};
  const groupIcons={overdue:'',today:'',week:'',month:'',later:''};

  let html='';
  let hasAny=false;
  Object.entries(groups).forEach(([grp,items])=>{
    if(items.length===0)return;
    hasAny=true;
    const icon={overdue:'',today:'',week:'',month:'',later:''}[grp]||'';
    html+=`<div class="todo-section-label">${icon} ${groupLabels[grp]}</div>`;
    html+=items.map(t=>{
      if(editingTodoId===t.id){
        return `<div class="todo-row" id="todo-row-${t.id}">
          <span class="drag-handle">&#10243;</span>
          <div class="check ${t.done?'done':''}" onclick="toggleTodo(${t.id})"></div>
          <input class="todo-edit-input" id="todo-edit-${t.id}" value="${t.text.replace(/"/g,'&quot;').replace(/</g,'&lt;')}" onkeydown="handleEditKey(event,${t.id})">
          <button class="btn btn-primary btn-sm" onclick="saveEditTodo(${t.id})" style="flex-shrink:0">Save</button>
          <button class="btn btn-ghost btn-sm" onclick="cancelEditTodo()" style="flex-shrink:0">X</button>
        </div>`;
      }
      return `<div class="todo-row" id="todo-row-${t.id}"
          draggable="true"
          ondragstart="onDragStart(event,${t.id})"
          ondragover="onDragOver(event,${t.id})"
          ondragleave="onDragLeave(event,${t.id})"
          ondrop="onDrop(event,${t.id})"
          ondragend="onDragEnd()"
          style="${grp==='overdue'?'background:rgba(184,90,74,.03);':''}">
        <span class="drag-handle" title="Drag to reorder">&#10243;</span>
        <div class="check ${t.done?'done':''}" onclick="toggleTodo(${t.id})"></div>
        <div style="flex:1;min-width:0">
          <div class="row-text" style="margin-bottom:3px">${t.text}</div>
          <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
            <span class="badge ${t.priority}">${t.priority}</span>
            ${t.cat&&t.cat!=='General'?`<span style="font-size:10px;background:var(--warm2);color:var(--text3);padding:2px 6px;border-radius:6px">${t.cat}</span>`:''}
            ${formatDue(t)||''}
          </div>
        </div>
        <button class="del" title="Edit" onclick="startEditTodo(${t.id})" style="color:var(--text3);font-size:14px">&#9998;</button>
        <button class="del" onclick="deleteTodo(${t.id})">x</button>
      </div>`;
    }).join('');
  });
  if(!hasAny)html='<div class="empty"><div class="empty-icon"></div>Nothing here — all clear!</div>';
  document.getElementById('todos-main-content').innerHTML=html;

  const prioOptions=[{v:'high',emoji:'',label:'High'},{v:'medium',emoji:'',label:'Medium'},{v:'low',emoji:'',label:'Low'}];
  document.getElementById('todos-form').innerHTML=showTodoForm?`
    <div class="form-box">
      <input class="input" id="todo-text-in" placeholder="New task...">
      <div style="margin-bottom:8px">
        <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Priority</div>
        <div class="priority-radio-group">
          <label class="priority-radio-label ${selectedPriority==='high'?'selected-high':''}" id="prio-label-high">
            <input type="radio" name="todo-priority" value="high" ${selectedPriority==='high'?'checked':''} onchange="selectPriority('high')"> High
          </label>
          <label class="priority-radio-label ${selectedPriority==='medium'?'selected-medium':''}" id="prio-label-medium">
            <input type="radio" name="todo-priority" value="medium" ${selectedPriority==='medium'?'checked':''} onchange="selectPriority('medium')"> Medium
          </label>
          <label class="priority-radio-label ${selectedPriority==='low'?'selected-low':''}" id="prio-label-low">
            <input type="radio" name="todo-priority" value="low" ${selectedPriority==='low'?'checked':''} onchange="selectPriority('low')"> Low
          </label>
        </div>
      </div>
      <div style="margin-bottom:8px">
        <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Category</div>
        <select class="input" id="todo-cat-select" style="margin-bottom:0">
          ${todoCategories.map(cat=>`<option value="${cat}" ${cat===todoCat?'selected':''}>${cat}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:8px">
        <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Due date and time (optional)</label>
        <input class="input" id="todo-due-in" type="datetime-local" value="${todayDatetimeLocal()}" style="margin-bottom:0">
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="addTodo()">Add Task</button>
        <button class="btn btn-ghost" onclick="setTodoForm(false)">Cancel</button>
      </div>
    </div>`
    :`<button class="add-btn" onclick="setTodoForm(true)">+ Add task</button>`;

  const dc=document.getElementById('todos-done-card');
  if(done.length>0){
    dc.style.display='block';
    document.getElementById('todos-done-title').textContent='Completed - '+done.length;
    document.getElementById('todos-done-list').innerHTML=done.map(t=>`
      <div class="todo-row">
        <div class="check done" onclick="toggleTodo(${t.id})"></div>
        <span class="row-text done">${t.text}</span>
        <button class="del" onclick="deleteTodo(${t.id})">x</button>
      </div>`).join('');
  } else {dc.style.display='none';}
}

function selectPriority(v){
  selectedPriority=v;
  ['high','medium','low'].forEach(p=>{
    const el=document.getElementById('prio-label-'+p);
    if(el)el.className='priority-radio-label'+(p===v?' selected-'+p:'');
  });
}

function setTodoTab(tab){todoTab=tab;renderTodos();}
function setTodoForm(v){showTodoForm=v;renderTodos();if(v)setTimeout(()=>document.getElementById('todo-text-in')?.focus(),50);}

function toggleTodo(id){const t=todos.find(x=>x.id===id);if(t)t.done=!t.done;persist();renderAll();}

function addTodo(){
  const text=document.getElementById('todo-text-in').value.trim();
  const cat=document.getElementById('todo-cat-select')?.value||todoCat;
  const dueRaw=document.getElementById('todo-due-in').value;
  const dueDate=dueRaw||todayDatetimeLocal();
  if(!text)return;
  todos.unshift({id:uid(),text,done:false,priority:selectedPriority,dueDate,cat});
  persist();showTodoForm=false;renderAll();
}

function deleteTodo(id){todos=todos.filter(t=>t.id!==id);persist();renderAll();}

function startEditTodo(id){editingTodoId=id;renderTodos();setTimeout(()=>document.getElementById('todo-edit-'+id)?.focus(),50);}
function cancelEditTodo(){editingTodoId=null;renderTodos();}
function handleEditKey(e,id){if(e.key==='Enter')saveEditTodo(id);if(e.key==='Escape')cancelEditTodo();}
function saveEditTodo(id){
  const inp=document.getElementById('todo-edit-'+id);
  const newText=(inp?inp.value:'').trim();
  if(!newText){cancelEditTodo();return;}
  const t=todos.find(x=>x.id===id);
  if(t)t.text=newText;
  editingTodoId=null;persist();renderAll();
}

function onDragStart(e,id){
  dragSrcId=id;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',String(id));
  setTimeout(()=>{const el=document.getElementById('todo-row-'+id);if(el)el.classList.add('dragging');},0);
}
function onDragOver(e,id){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  if(id===dragSrcId)return;
  const el=document.getElementById('todo-row-'+id);
  if(el)el.classList.add('drag-over');
}
function onDragLeave(e,id){const el=document.getElementById('todo-row-'+id);if(el)el.classList.remove('drag-over');}
function onDrop(e,targetId){
  e.preventDefault();
  if(!dragSrcId||dragSrcId===targetId)return;
  const srcIdx=todos.findIndex(t=>t.id===dragSrcId);
  const tgtIdx=todos.findIndex(t=>t.id===targetId);
  if(srcIdx<0||tgtIdx<0)return;
  const [moved]=todos.splice(srcIdx,1);
  todos.splice(tgtIdx,0,moved);
  persist();renderTodos();
  showToast('Task moved!');
}
function onDragEnd(){
  dragSrcId=null;
  document.querySelectorAll('.todo-row').forEach(el=>el.classList.remove('dragging','drag-over'));
}

function openShareTodoModal(){
  const u=window.currentUser||currentUser;
  if(!u||u.isGuest){showToast('Please sign in with Google to share your list.');return;}
  const activeFriends=friends.filter(f=>f.status==='active');
  const existing=sharedTodoLists.filter(s=>s.cat===todoCat);
  const existingHtml=existing.length>0
    ?`<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Shared with</div>
      ${existing.map(s=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--warm2)">
        <span style="flex:1;font-size:13px">${s.sharedWith}</span>
        <button class="btn btn-ghost btn-sm" onclick="unshareList('${s.shareId}')">Remove</button>
      </div>`).join('')}</div>`:'';
  const modal=document.createElement('div');
  modal.className='modal-overlay';modal.id='share-todo-modal';
  modal.innerHTML=`<div class="modal">
    <button class="modal-close" onclick="document.getElementById('share-todo-modal').remove()">x</button>
    <div class="modal-title">Share "${todoCat}" list</div>
    ${existingHtml}
    ${activeFriends.length===0
      ?`<div class="empty"><div class="empty-icon"></div>Add friends first to share a list.</div>`
      :`<div style="font-size:12px;color:var(--text3);margin-bottom:10px">Select a friend — they will see all tasks in "${todoCat}" in real time.</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
          ${activeFriends.map(f=>{
            const alreadyShared=existing.some(s=>s.sharedWith===f.name);
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--warm2);border-radius:var(--r2)">
              <div class="friend-avatar">${f.name[0].toUpperCase()}</div>
              <span style="flex:1;font-size:13px">${f.name}</span>
              ${alreadyShared?`<span class="shared-badge">Shared</span>`:`<button class="btn btn-primary btn-sm" onclick="shareTodoWith(${f.id},'${f.name}','${f.contact}')">Share</button>`}
            </div>`;
          }).join('')}
        </div>`}
    <div style="display:flex;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="document.getElementById('share-todo-modal').remove()">Close</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function shareTodoWith(friendId,friendName,friendEmail){
  const shareId=uid();
  sharedTodoLists.push({shareId:String(shareId),cat:todoCat,sharedWith:friendName,friendId,friendEmail});
  persist();
  if(window._fb&&window.currentUser){
    const {db,setDoc,doc}=window._fb;
    try{
      const u=window.currentUser;
      await setDoc(doc(db,'shared_todo_lists',String(shareId)),{
        shareId:String(shareId),cat:todoCat,
        ownerUid:u.uid,ownerName:u.name,ownerEmail:u.email,
        sharedWithEmail:friendEmail,
        tasks:todos.filter(t=>(t.cat||'General')===todoCat),
        updatedAt:Date.now()
      });
      showToast('List shared with '+friendName+'!');
    }catch(e){console.warn('shareTodo error:',e);showToast('Shared locally.');}
  }else{showToast('List shared with '+friendName+'!');}
  document.getElementById('share-todo-modal')?.remove();
  renderTodos();
}

function unshareList(shareId){
  sharedTodoLists=sharedTodoLists.filter(s=>s.shareId!==String(shareId));
  persist();
  if(window._fb&&window.currentUser){
    const {db,deleteDoc,doc}=window._fb;
    deleteDoc(doc(db,'shared_todo_lists',String(shareId))).catch(()=>{});
  }
  renderTodos();
  document.getElementById('share-todo-modal')?.remove();
}



// ─────────────────────────────────────────────
