// LifeFlow — navigation, renderPage, app init, PWA, pull-to-refresh
// NAV
// ─────────────────────────────────────────────
let currentPage='home';
function navigate(page,btn){
  // Lock journal whenever leaving it
  if(currentPage==='journal' && page!=='journal') journalUnlocked=false;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  // Remove active from ALL nav items and tree parents
  document.querySelectorAll('.nav-item,.nav-tree-parent').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  if(btn) btn.classList.add('active');
  currentPage=page;
  // Persist current page so refresh returns to same place
  try { sessionStorage.setItem('lf_last_page', page); } catch{}
  renderPage(page);
  closeSidebar();
  // FAB visibility
  updateFab();
  // Spending tree sync
  if(page==='spending'){
    spendTreeOpen=true;
    const ch=document.getElementById('spend-tree-children');
    const cv=document.getElementById('spend-tree-chevron');
    if(ch)ch.className='nav-tree-children open';
    if(cv)cv.className='nav-tree-chevron open';
    document.getElementById('nav-spending-parent')?.classList.add('active');
    document.querySelectorAll('.nav-sub-item').forEach(x=>x.classList.remove('active'));
    document.getElementById('nav-sub-'+spendTab)?.classList.add('active');
  } else {
    // Clear spending sub highlights
    document.querySelectorAll('.nav-sub-item').forEach(x=>x.classList.remove('active'));
    // Highlight the correct regular nav item when not spending
    const navId='nav-'+page;
    document.getElementById(navId)?.classList.add('active');
  }
}
function openSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('overlay').classList.add('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').classList.remove('show');}
function renderPage(p){
  if(p==='home')renderHome();
  if(p==='habits')renderHabits();
  if(p==='goals')renderGoals();
  if(p==='todos')renderTodos();
  if(p==='spending')renderSpending();
  if(p==='journal')renderJournalPage();
}
function renderAll(){renderPage(currentPage);}

// ─────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────
function renderHome(){
  const today=todayKey();
  const doneH=habits.filter(h=>h.history.includes(today)).length;
  const pend=todos.filter(t=>!t.done).length;
  const daySpend=spends.filter(s=>s.date===today).reduce((a,b)=>a+b.amount,0);
  const monthSpend=spends.reduce((a,b)=>a+b.amount,0);
  document.getElementById('home-stats').innerHTML=`
    <div class="stat-card"><div class="stat-label">Habits today</div><div class="stat-value">${doneH}<span style="font-size:18px;color:var(--text3)">/${habits.length}</span></div><div class="stat-sub">${doneH===habits.length?'🌿 All done!':`${habits.length-doneH} remaining`}</div></div>
    <div class="stat-card"><div class="stat-label">Tasks pending</div><div class="stat-value">${pend}</div><div class="stat-sub">${todos.filter(t=>t.done).length} completed</div></div>
    <div class="stat-card"><div class="stat-label">Spent today</div><div class="stat-value" style="font-size:24px">₹${fmt(daySpend)}</div><div class="stat-sub">₹${fmt(monthSpend)} this month</div></div>`;

  document.getElementById('home-habits-card').innerHTML=`
    <div class="card-title">Today's habits</div>
    ${habits.length===0?'<div class="empty"><div class="empty-icon">🔁</div>No habits yet</div>':''}
    ${habits.slice(0,4).map(h=>{const done=h.history.includes(today);return `<div class="row"><div class="check ${done?'done':''}" onclick="toggleHabit(${h.id})"></div><span class="row-text ${done?'done':''}">${h.emoji} ${h.name}</span><span class="streak">🔥 ${h.streak}</span></div>`;}).join('')}`;

  const overdueToday=sortTodos(todos.filter(t=>!t.done&&['overdue','today'].includes(getDueCategory(t)))).slice(0,4);
  document.getElementById('home-todos-card').innerHTML=`
    <div class="card-title">Due today</div>
    ${overdueToday.length===0?'<div class="empty"><div class="empty-icon">✅</div>Nothing due today!</div>':''}
    ${overdueToday.map(t=>`<div class="row"><span class="row-text">${t.text}</span><span class="badge ${t.priority}">${t.priority}</span>${formatDue(t)||''}</div>`).join('')}`;

  document.getElementById('home-goals-card').innerHTML=`
    <div class="card-title">Goals overview</div>
    ${goals.length===0?'<div class="empty"><div class="empty-icon">🎯</div>No goals yet</div>':''}
    ${goals.slice(0,3).map((g,i)=>{const pct=Math.min(100,Math.round(g.current/g.target*100));return `<div style="margin-bottom:${i<goals.length-1?'14px':'0'}"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px"><span style="font-size:14px;font-weight:${i===0?'500':'400'}">${g.emoji} ${g.name}</span><span style="font-size:13px;font-weight:600;color:var(--sage)">${pct}%</span></div><div class="progress-wrap"><div class="progress-fill ${pct<30?'amber':''}" style="width:${pct}%"></div></div><div style="font-size:11px;color:var(--text3);margin-top:2px">${g.unit==='₹'?`₹${fmt(g.current)} of ₹${fmt(g.target)}`:`${g.current} of ${g.target} ${g.unit}`}</div></div>`;}).join('')}`;

  const catTotals={};
  rangeSpends.forEach(s=>{catTotals[s.cat]=(catTotals[s.cat]||0)+s.amount;});
  document.getElementById('home-spend-card').innerHTML=`
    <div class="card-title">Today's spending</div>
    ${Object.keys(catTotals).length===0?'<div class="empty"><div class="empty-icon">₹</div>No spends today</div>':''}
    ${Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`<div class="cat-bar"><div style="width:28px;height:28px;border-radius:7px;background:${CAT_BG[cat]||'#F0F0F0'};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${CAT_EMJ[cat]||'📦'}</div><span style="font-size:13px;flex:1">${cat}</span><span style="font-size:14px;font-weight:600">₹${fmt(amt)}</span></div>`).join('')}`;
}

// ─────────────────────────────────────────────
// HABITS
// ─────────────────────────────────────────────
let showHabitForm = false;
let habitSuggestions = [];       // [{name, emoji, why}]
let suggestionsLoaded = false;
let suggestionsLoading = false;

function renderHabits() {
  const today = todayKey();
  const last7 = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i);
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  });

  document.getElementById('habits-list').innerHTML = habits.length === 0
    ? '<div class="empty"><div class="empty-icon">🔁</div>No habits yet. Start one!</div>'
    : habits.map(h => {
        const done = h.history.includes(today);
        return `<div style="padding:12px 0;border-bottom:1px solid var(--warm2)">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="check ${done?'done':''}" onclick="toggleHabit(${h.id})"></div>
            <span style="font-size:18px">${h.emoji}</span>
            <span class="row-text ${done?'done':''}" style="font-size:14px">${h.name}</span>
            <span class="streak">🔥 ${h.streak}</span>
            <button class="del" onclick="deleteHabit(${h.id})">×</button>
          </div>
          <div class="habit-dots">${last7.map(d=>`<div class="habit-dot ${h.history.includes(d)?'on':''}"></div>`).join('')}</div>
        </div>`;
      }).join('');

  if (showHabitForm) {
    // Filter out already-added habits from suggestions
    const existingNames = habits.map(h => h.name.toLowerCase());
    const filtered = habitSuggestions.filter(s => !existingNames.includes(s.name.toLowerCase()));

    let suggestionsHtml = '';
    if (suggestionsLoading) {
      suggestionsHtml = `<div class="suggestions-loading"><span class="spin">🌀</span> Finding trending habits for you...</div>`;
    } else if (filtered.length > 0) {
      suggestionsHtml = `
        <div class="suggestions-wrap">
          <div class="suggestions-label">
            ✨ Suggested for you
            <span class="ai-badge">AI · Trending</span>
            <button class="refresh-suggestions" onclick="loadHabitSuggestions(true)">refresh</button>
          </div>
          <div class="suggestion-cards">
            ${filtered.slice(0,5).map(s => `
              <button class="suggestion-card" onclick="selectSuggestion('${s.name.replace(/'/g,"\\'")}','${s.emoji}')">
                <span class="suggestion-card-emoji">${s.emoji}</span>
                <div class="suggestion-card-info">
                  <div class="suggestion-card-name">${s.name}</div>
                  <div class="suggestion-card-why">${s.why}</div>
                </div>
                <span class="suggestion-card-add">+ Add</span>
              </button>`).join('')}
          </div>
        </div>`;
    } else if (suggestionsLoaded) {
      suggestionsHtml = `<div class="suggestions-error">No new suggestions — you've already added all trending habits! 🎉</div>`;
    }

    document.getElementById('habits-form').innerHTML = `
      <div class="form-box">
        ${suggestionsHtml}
        <div style="margin-top:${suggestionsHtml?'12px':'0'};padding-top:${suggestionsHtml?'12px':'0'};border-top:${suggestionsHtml?'1px solid var(--warm3)':'none'}">
          <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Or type your own</div>
          <div class="input-row" style="margin-bottom:8px">
            <input class="input" id="habit-emoji-in" value="⭐" style="width:64px;text-align:center;flex-shrink:0">
            <input class="input" id="habit-name-in" placeholder="Habit name...">
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" onclick="addHabit()">Add Habit</button>
            <button class="btn btn-ghost" onclick="setHabitForm(false)">Cancel</button>
          </div>
        </div>
      </div>`;
  } else {
    document.getElementById('habits-form').innerHTML =
      `<button class="add-btn" onclick="setHabitForm(true)">+ Add habit</button>`;
  }
}

function setHabitForm(v) {
  showHabitForm = v;
  renderHabits();
  if (v) {
    setTimeout(() => document.getElementById('habit-name-in')?.focus(), 50);
    if (!suggestionsLoaded) loadHabitSuggestions(false);
  }
}

function selectSuggestion(name, emoji) {
  const nameInput = document.getElementById('habit-name-in');
  const emojiInput = document.getElementById('habit-emoji-in');
  if (nameInput) nameInput.value = name;
  if (emojiInput) emojiInput.value = emoji;
  // Directly add it
  habits.push({id:uid(), name, emoji, streak:0, history:[]});
  persist(); showHabitForm=false; renderAll();
  showToast && showToast('Added: ' + name + ' ' + emoji);
}

async function loadHabitSuggestions(forceRefresh) {
  if (suggestionsLoading) return;
  if (suggestionsLoaded && !forceRefresh) return;

  suggestionsLoading = true;
  suggestionsLoaded = false;
  renderHabits(); // show spinner

  try {
    const existingList = habits.map(h => h.name).join(', ') || 'none';
    const prompt = `You are a wellness coach. Search the web for the most trending, popular daily habits in 2025 — including morning routines, health, mindfulness, productivity, fitness, and wellbeing trends from platforms like Reddit, TikTok, YouTube, and wellness blogs.

The user already tracks these habits: ${existingList}

Based on trending 2025 habits, suggest exactly 8 NEW habits they don't already have. For each habit, return:
- name: short, actionable name (max 5 words)
- emoji: single relevant emoji
- why: one short sentence (max 10 words) saying why it's trending

Return ONLY a JSON array, no markdown, no explanation, like:
[{"name":"Cold shower","emoji":"🚿","why":"Boosts alertness and mood — viral on TikTok"},...]`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    // Extract the final text block (after tool use)
    const textBlock = data.content && data.content.filter(b => b.type === 'text').pop();
    if (textBlock && textBlock.text) {
      const raw = textBlock.text.replace(/```json|```/g, '').trim();
      // Find JSON array in the response
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          habitSuggestions = parsed;
          suggestionsLoaded = true;
        }
      }
    }
  } catch(e) {
    console.warn('Habit suggestions error:', e);
    // Fallback to curated list if API fails
    habitSuggestions = [
      {name:'5-minute journaling',   emoji:'📓', why:'Top mindfulness trend — boosts self-awareness'},
      {name:'10-min morning walk',   emoji:'🌅', why:'#1 habit of high performers in 2025'},
      {name:'No phone first hour',   emoji:'📵', why:'Trending for focus & mental clarity'},
      {name:'Daily cold exposure',   emoji:'🧊', why:'Viral Huberman Protocol for energy'},
      {name:'Gratitude practice',    emoji:'🙏', why:'Proven to improve happiness by 25%'},
      {name:'2-minute deep breathing',emoji:'🌬️',why:'Reduces cortisol — trending on wellness apps'},
      {name:'Digital sunset (9pm)',  emoji:'🌙', why:'Sleep quality improves within days'},
      {name:'One healthy meal prep', emoji:'🥗', why:'Most-searched habit on Google 2025'},
    ];
    suggestionsLoaded = true;
  }

  suggestionsLoading = false;
  if (showHabitForm) renderHabits();
}

function toggleHabit(id) {
  const h = habits.find(x=>x.id===id); if(!h) return;
  const today = todayKey();
  if (h.history.includes(today)) { h.history=h.history.filter(d=>d!==today); h.streak=Math.max(0,h.streak-1); }
  else { h.history.push(today); h.streak++; }
  persist(); renderAll();
}
function addHabit() {
  const name  = document.getElementById('habit-name-in').value.trim();
  const emoji = document.getElementById('habit-emoji-in').value.trim() || '⭐';
  if (!name) return;
  habits.push({id:uid(), name, emoji, streak:0, history:[]});
  persist(); showHabitForm=false; renderAll();
}
function deleteHabit(id) { habits=habits.filter(h=>h.id!==id); persist(); renderAll(); }

// ─────────────────────────────────────────────
// GOALS
// ─────────────────────────────────────────────
let showGoalForm=false,editingGoalId=null;
function renderGoals(){
  document.getElementById('goals-list').innerHTML=goals.length===0
    ?'<div class="empty"><div class="empty-icon">🎯</div>No goals yet. Dream big!</div>'
    :goals.map(g=>{const pct=Math.min(100,Math.round(g.current/g.target*100));const fv=v=>g.unit==='₹'?`₹${fmt(v)}`:`${v} ${g.unit}`;return `<div class="goal-block"><div class="goal-header"><span style="font-size:20px">${g.emoji}</span><span class="goal-name">${g.name}</span><span class="goal-pct">${pct}%</span><button class="del" onclick="deleteGoal(${g.id})">×</button></div><div class="progress-wrap"><div class="progress-fill ${pct<30?'amber':''}" style="width:${pct}%"></div></div><div class="goal-footer"><span class="goal-meta">${fv(g.current)} of ${fv(g.target)}</span>${editingGoalId===g.id?`<div class="edit-row"><input class="input" id="goal-edit-val" type="number" value="${g.current}"><button class="btn btn-primary btn-sm" onclick="saveGoalProgress(${g.id})">Save</button><button class="btn btn-ghost btn-sm" onclick="editGoal(null)">✕</button></div>`:`<button style="font-size:12px;color:var(--sage);background:none;border:none;cursor:pointer;font-family:inherit" onclick="editGoal(${g.id})">Update</button>`}</div></div>`;}).join('');
  document.getElementById('goals-form').innerHTML=showGoalForm?`
    <div class="form-box"><div class="input-row" style="margin-bottom:8px"><input class="input" id="goal-emoji-in" value="🎯" style="width:64px;text-align:center;flex-shrink:0"><input class="input" id="goal-name-in" placeholder="Goal name..."></div><div class="input-row" style="margin-bottom:8px"><input class="input" id="goal-current-in" type="number" placeholder="Current" value="0"><input class="input" id="goal-target-in" type="number" placeholder="Target"><select class="input" id="goal-unit-in" style="width:auto;flex-shrink:0"><option value="books">books</option><option value="₹">₹ Rupees</option><option value="km">km</option><option value="hrs">hours</option><option value="times">times</option><option value="units">units</option></select></div><div style="display:flex;gap:8px"><button class="btn btn-primary" onclick="addGoal()">Add Goal</button><button class="btn btn-ghost" onclick="setGoalForm(false)">Cancel</button></div></div>`
    :`<button class="add-btn" onclick="setGoalForm(true)">+ Add goal</button>`;
}
function setGoalForm(v){showGoalForm=v;renderGoals();if(v)setTimeout(()=>document.getElementById('goal-name-in')?.focus(),50);}
function editGoal(id){editingGoalId=id;renderGoals();if(id)setTimeout(()=>document.getElementById('goal-edit-val')?.focus(),50);}
function addGoal(){
  const name=document.getElementById('goal-name-in').value.trim();
  const emoji=document.getElementById('goal-emoji-in').value.trim()||'🎯';
  const current=parseFloat(document.getElementById('goal-current-in').value)||0;
  const target=parseFloat(document.getElementById('goal-target-in').value);
  const unit=document.getElementById('goal-unit-in').value;
  if(!name||!target)return;
  goals.push({id:uid(),name,emoji,current,target,unit});
  persist();showGoalForm=false;renderAll();
}
function saveGoalProgress(id){
  const v=parseFloat(document.getElementById('goal-edit-val').value);
  if(!isNaN(v)){const g=goals.find(x=>x.id===id);if(g)g.current=v;}
  persist();editingGoalId=null;renderAll();
}
function deleteGoal(id){goals=goals.filter(g=>g.id!==id);persist();renderAll();}

// ─────────────────────────────────────────────
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
// SPENDING — categories, friends, groups, splits, settle
// ─────────────────────────────────────────────
const XKEYS={customCats:'lf3_custom_cats',friends:'lf3_friends',friendReqs:'lf3_friend_reqs',groups:'lf3_groups',splits:'lf3_splits'};
const BUILTIN_CATS={Food:{emoji:'🍽️',color:'#6B8F71',bg:'#EAF0EB'},Travel:{emoji:'🚗',color:'#B8845A',bg:'#F5EAE0'},Shopping:{emoji:'🛍️',color:'#5A78B8',bg:'#E5EAF5'},Health:{emoji:'💊',color:'#B85A4A',bg:'#F5E8E5'},Bills:{emoji:'📄',color:'#8A6BC4',bg:'#EDE5F5'},Entertainment:{emoji:'🎬',color:'#5A9898',bg:'#E5F0F0'},Other:{emoji:'📦',color:'#9C9C98',bg:'#F0F0F0'}};
let _customCats=load(XKEYS.customCats,[]);
let sharedExpenseLists = load('lf3_shared_expense_lists', []); // [{id,name,emoji,memberIds,memberUids,expenses:[]}]
let _friends=load(XKEYS.friends,[]);
let _friendReqs=load(XKEYS.friendReqs,[]);
let _groups=load(XKEYS.groups,[]);
let _splits=load(XKEYS.splits,[]);
let customCats=_customCats,friends=_friends,friendReqs=_friendReqs,groups=_groups,splits=_splits;

function allCats(){const m={...BUILTIN_CATS};customCats.forEach(c=>{m[c.name]={emoji:c.emoji,color:c.color,bg:c.bg};});return m;}
function catEmoji(n){return(allCats()[n]||{emoji:'📦'}).emoji;}
function catColor(n){return(allCats()[n]||{color:'#9C9C98'}).color;}
function catBg(n){return(allCats()[n]||{bg:'#F0F0F0'}).bg;}

// persistSpend delegates to persist() — one unified save path
function persistSpend(){ persist(); }

let spendTab='personal',showSpendForm=false,showCatForm=false,showFriendForm=false,showGroupForm=false,openGroupId=null;

function setSpendTab(tab,btn){
  spendTab=tab;
  document.querySelectorAll('.spend-tab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.querySelectorAll('.spend-panel').forEach(p=>p.classList.remove('active'));
  const panel=document.getElementById('spend-panel-'+tab);
  if(panel)panel.classList.add('active');
  // Persist spend tab
  try { sessionStorage.setItem('lf_last_spend_tab', tab); } catch{}
  // Update section title
  const titles={personal:'Personal Spending',friends:'Friends',groups:'Groups',settle:'Settle Up'};
  const stEl=document.getElementById('spend-section-title');
  if(stEl) stEl.textContent=titles[tab]||'Spending';
  // Sync sidebar sub-items
  document.querySelectorAll('.nav-sub-item').forEach(x=>x.classList.remove('active'));
  document.getElementById('nav-sub-'+tab)?.classList.add('active');
  renderSpending();
  updateFab();
}

function renderSpending(){
  if(spendTab==='personal')renderPersonal();
  if(spendTab==='friends')renderFriends();
  if(spendTab==='groups')renderGroups();
  if(spendTab==='settle')renderSettle();
}

// ── PERSONAL ────────────────────────────────
function renderPersonal(){
  renderDateRangeBar();
  const rangeSpends = spendsInRange();
  const rangeTotal  = rangeSpends.reduce((a,b)=>a+b.amount,0);
  const monthTotal  = spends.reduce((a,b)=>a+b.amount,0);
  const rangeLabel  = spendDateMode==='today'?'Today':
                      spendDateMode==='week'?'This Week':
                      spendDateMode==='last_week'?'Last Week':
                      spendDateMode==='month'?'This Month':
                      spendDateMode==='last_month'?'Last Month':'Selected Range';
  const ltEl=document.getElementById('spend-list-title');
  if(ltEl) ltEl.textContent='Transactions — '+rangeLabel;

  // Compute owe/owed balances
  const netBalances=computeNet?computeNet():{};
  const iOwe=Object.entries(netBalances).filter(([,v])=>v<-0.01);
  const owedToMe=Object.entries(netBalances).filter(([,v])=>v>0.01);
  const totalIOwe=iOwe.reduce((a,[,v])=>a+Math.abs(v),0);
  const totalOwedToMe=owedToMe.reduce((a,[,v])=>a+v,0);

  const bannerEl=document.getElementById('spend-banner');
  if(bannerEl)bannerEl.innerHTML=`
    <div class="spend-banner" style="cursor:pointer" onclick="openMonthlyCatsModal()" title="Click for monthly breakdown">
      <div>
        <div class="spend-banner-label">${rangeLabel}</div>
        <div class="spend-banner-amount">₹${fmt(Math.round(rangeTotal))}</div>
        <div style="font-size:11px;opacity:.65;margin-top:2px">${rangeSpends.length} transactions · tap for monthly view</div>
      </div>
      <div class="spend-banner-right">
        <div class="spend-banner-label">This month</div>
        <div class="spend-banner-month">₹${fmt(Math.round(monthTotal))}</div>
      </div>
    </div>
    ${(totalIOwe>0||totalOwedToMe>0)?`
    <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
      ${totalIOwe>0?`<div style="flex:1;min-width:140px;background:var(--red-l);border-radius:var(--r2);padding:12px 14px;border:1px solid rgba(184,90,74,.15)">
        <div style="font-size:11px;color:var(--red);font-weight:600;margin-bottom:2px">YOU OWE</div>
        <div style="font-size:20px;font-weight:700;color:var(--red);font-family:'Cormorant Garamond',serif">₹${fmt(Math.round(totalIOwe))}</div>
        <div style="font-size:11px;color:var(--red);opacity:.7">to ${iOwe.length} friend${iOwe.length>1?'s':''}</div>
      </div>`:''}
      ${totalOwedToMe>0?`<div style="flex:1;min-width:140px;background:var(--sage-light);border-radius:var(--r2);padding:12px 14px;border:1px solid rgba(61,92,66,.12)">
        <div style="font-size:11px;color:var(--sage-dark);font-weight:600;margin-bottom:2px">OWED TO YOU</div>
        <div style="font-size:20px;font-weight:700;color:var(--sage-dark);font-family:'Cormorant Garamond',serif">₹${fmt(Math.round(totalOwedToMe))}</div>
        <div style="font-size:11px;color:var(--sage);opacity:.8">from ${owedToMe.length} friend${owedToMe.length>1?'s':''}</div>
      </div>`:''}
    </div>`:''}`;

  const catTotals={};
  rangeSpends.forEach(s=>{catTotals[s.cat]=(catTotals[s.cat]||0)+s.amount;});
  const sorted=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
  const catsEl=document.getElementById('spend-cats');
  if(catsEl)catsEl.innerHTML=sorted.length===0
    ?'<div class="empty"><div class="empty-icon">📊</div>No data for this period</div>'
    :sorted.map(([cat,amt])=>`<div class="cat-bar"><div style="width:34px;height:34px;border-radius:9px;background:${catBg(cat)};display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${catEmoji(cat)}</div><span style="font-size:13px;flex:1;color:var(--text)">${cat}</span><span style="font-size:14px;font-weight:600">₹${fmt(amt)}</span></div>`).join('');


  const cclEl=document.getElementById('custom-cats-list');
  if(cclEl)cclEl.innerHTML=customCats.length===0
    ?'<div style="font-size:12px;color:var(--text3);margin-bottom:8px">No custom categories yet.</div>'
    :`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${customCats.map(c=>`<span class="cat-chip" style="background:${c.bg};color:${c.color}">${c.emoji} ${c.name}<button class="del-chip" onclick="deleteCustomCat('${c.name}')">×</button></span>`).join('')}</div>`;

  const ccfEl=document.getElementById('custom-cat-form');
  if(ccfEl)ccfEl.innerHTML=showCatForm?`
    <div class="form-box" style="padding:10px">
      <div class="input-row" style="margin-bottom:8px">
        <input class="input" id="ccat-emoji" value="🏷️" style="width:56px;text-align:center;flex-shrink:0;margin-bottom:0">
        <input class="input" id="ccat-name" placeholder="Category name" style="margin-bottom:0">
        <input class="input" id="ccat-color" type="color" value="#6B8F71" style="width:42px;padding:4px;flex-shrink:0;margin-bottom:0">
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="addCustomCat()">Add</button>
        <button class="btn btn-ghost btn-sm" onclick="setCatForm(false)">Cancel</button>
      </div>
    </div>`:`<button class="add-btn" style="margin-top:0" onclick="setCatForm(true)">+ Add custom category</button>`;

  const todayEntries=[...rangeSpends].reverse();
  const slEl=document.getElementById('spend-list');
  if(slEl)slEl.innerHTML=todayEntries.length===0&&!showSpendForm
    ?'<div class="empty"><div class="empty-icon">₹</div>No transactions today</div>'
    :todayEntries.map(s=>`<div class="spend-row"><div class="cat-emoji" style="background:${catBg(s.cat)}">${catEmoji(s.cat)}</div><div class="spend-desc"><div class="spend-desc-name">${s.desc}</div><div class="spend-desc-cat">${s.cat}</div></div><span class="spend-amount">₹${fmt(s.amount)}</span><button class="del" onclick="deleteSpend(${s.id})">×</button></div>`).join('');

  const allCatNames=Object.keys(allCats());
  const sfEl=document.getElementById('spend-form');
  const todayDateVal=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
  if(sfEl)sfEl.innerHTML=showSpendForm?`
    <div class="form-box">
      <select class="input" id="spend-cat-in">${allCatNames.map(c=>`<option value="${c}">${catEmoji(c)} ${c}</option>`).join('')}</select>
      <input class="input" id="spend-desc-in" placeholder="Description...">
      <div style="margin-bottom:8px">
        <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Date</label>
        <input class="input" id="spend-date-in" type="date" value="${todayDateVal}" style="margin-bottom:0">
      </div>
      <div class="input-row">
        <input class="input" id="spend-amount-in" type="number" placeholder="Amount (₹)" min="0" style="margin-bottom:0">
        <button class="btn btn-primary" onclick="addSpend()">Log</button>
        <button class="btn btn-ghost" onclick="setSpendForm(false)">✕</button>
      </div>
    </div>`:`<button class="add-btn" onclick="setSpendForm(true)">+ Log spend</button>`;
}

function setCatForm(v){showCatForm=v;renderPersonal();if(v)setTimeout(()=>document.getElementById('ccat-name')?.focus(),50);}
function setSpendForm(v){showSpendForm=v;renderPersonal();if(v)setTimeout(()=>document.getElementById('spend-desc-in')?.focus(),50);}
function addCustomCat(){
  const name=(document.getElementById('ccat-name').value||'').trim();
  const emoji=(document.getElementById('ccat-emoji').value||'').trim()||'🏷️';
  const color=document.getElementById('ccat-color').value||'#6B8F71';
  if(!name)return;
  if(allCats()[name]){alert('Category already exists!');return;}
  customCats.push({name,emoji,color,bg:color+'22'});
  persistSpend();showCatForm=false;renderPersonal();
}
function deleteCustomCat(name){customCats=customCats.filter(c=>c.name!==name);persistSpend();renderPersonal();}
function addSpend(){
  const cat    = document.getElementById('spend-cat-in').value;
  const desc   = document.getElementById('spend-desc-in').value.trim();
  const amount = parseFloat(document.getElementById('spend-amount-in').value);
  if(!desc||isNaN(amount)||amount<=0) return;
  const dateRaw = document.getElementById('spend-date-in')?.value || '';
  let dateKey = todayKey();
  if(dateRaw){
    const parts = dateRaw.split('-');
    dateKey = parseInt(parts[0])+'-'+parseInt(parts[1])+'-'+parseInt(parts[2]);
  }
  spends.push({id:uid(), cat, desc, amount, date:dateKey});
  persistSpend(); showSpendForm=false; renderPersonal();
}
function deleteSpend(id){spends=spends.filter(s=>s.id!==id);persistSpend();renderPersonal();}

// ── FRIENDS ─────────────────────────────────
function mName(id){if(String(id)==='me')return currentUser&&!currentUser.isGuest?currentUser.firstName||'Me':'Me';const f=friends.find(x=>String(x.id)===String(id));return f?f.name:'?';}

function renderFriends(){
  // Compute balances
  const balances={};
  splits.forEach(sp=>{
    sp.members.forEach(m=>{
      const fid=String(m.friendId);
      if(fid==='me')return;
      if(!balances[fid])balances[fid]=0;
      if(String(sp.paidBy)==='me'&&!m.paid)balances[fid]+=m.share;
      else if(String(sp.paidBy)===fid){
        const myM=sp.members.find(x=>String(x.friendId)==='me');
        if(myM&&!myM.paid)balances[fid]-=myM.share;
      }
    });
  });

  const activeFriends=friends.filter(f=>f.status==='active');
  const flEl=document.getElementById('friends-list');
  if(!flEl)return;
  flEl.innerHTML=activeFriends.length===0
    ?'<div class="empty"><div class="empty-icon">👥</div>No friends yet. Add one!</div>'
    :activeFriends.map(f=>{
      const bal=Math.round((balances[f.id]||0)*100)/100;
      const bc=bal>0?'owed':bal<0?'owes':'clear';
      const bt=bal===0?'Settled':bal>0?`Owes you ₹${fmt(Math.abs(bal))}`:`You owe ₹${fmt(Math.abs(bal))}`;
      return `<div class="friend-card"><div class="friend-avatar">${f.name[0].toUpperCase()}</div><div class="friend-info"><div class="friend-name">${f.name}</div><div class="friend-contact">${f.contact}</div></div><span class="friend-balance ${bc}">${bt}</span><button class="del" onclick="deleteFriend(${f.id})">×</button></div>`;
    }).join('');

  const pending=friends.filter(f=>f.status==='pending_sent');
  if(pending.length>0)flEl.innerHTML+=`<div style="margin-top:12px;border-top:1px solid var(--warm2);padding-top:12px"><div class="card-title">Pending (sent)</div>${pending.map(f=>`<div class="friend-card"><div class="friend-avatar" style="background:var(--warm3);color:var(--text3)">${f.name[0].toUpperCase()}</div><div class="friend-info"><div class="friend-name">${f.name}</div><div class="friend-contact">${f.contact} · awaiting</div></div><button class="del" onclick="deleteFriend(${f.id})">×</button></div>`).join('')}</div>`;

  const ffEl=document.getElementById('friends-form');
  if(ffEl)ffEl.innerHTML=`<button class="add-btn" onclick="openInviteModal()">+ Add friend via Link or QR</button>`;

  const frEl=document.getElementById('friend-requests-list');
  if(frEl){
    // Show badge count on Friends nav sub-item
    const navFriends=document.getElementById('nav-sub-friends');
    if(navFriends){
      const badge=navFriends.querySelector('.req-badge');
      if(friendReqs.length>0){
        if(!badge){
          const b=document.createElement('span');
          b.className='req-badge';
          b.style.cssText='background:var(--red);color:white;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:auto';
          b.textContent=friendReqs.length;
          navFriends.appendChild(b);
        } else {
          badge.textContent=friendReqs.length;
        }
      } else if(badge){
        badge.remove();
      }
    }

    frEl.innerHTML=friendReqs.length===0
      ?`<div class="empty" style="padding:16px 0">
          <div style="font-size:28px;margin-bottom:6px">📬</div>
          <div style="font-size:13px;color:var(--text3)">No pending friend requests</div>
        </div>`
      :friendReqs.map(r=>{
          const avatar=r.fromPicture
            ?`<img src="${r.fromPicture}" class="user-avatar" style="width:38px;height:38px;border-radius:50%;flex-shrink:0">`
            :`<div class="friend-avatar" style="width:38px;height:38px;font-size:15px;flex-shrink:0">${(r.from||'?')[0].toUpperCase()}</div>`;
          const when=r.date?new Date(r.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'';
          return `<div class="req-card" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--warm2)">
            ${avatar}
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:500;color:var(--text)">${r.from||'Unknown'}</div>
              <div style="font-size:11px;color:var(--text3)">${r.contact||''}${when?' · '+when:''}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn-primary btn-sm" onclick="acceptFriendReq('${r.id}')">✓ Accept</button>
              <button class="btn btn-ghost btn-sm" onclick="declineFriendReq('${r.id}')">✕</button>
            </div>
          </div>`;
        }).join('');
  }
}

function setFriendForm(v){showFriendForm=v;renderFriends();}

// ── Generate a 6-char friend code from user's UID ──────────────────────────
function getMyFriendCode(){
  const u=window.currentUser||currentUser;
  if(!u||!u.uid)return'NOAUTH';
  return u.uid.slice(-6).toUpperCase();
}

// ── Build invite URL with token stored in Firestore ───────────────────────
async function generateInviteLink(){
  const u=window.currentUser||currentUser;
  const appUrl=window.location.origin+window.location.pathname;
  const token=Math.random().toString(36).slice(2,10).toUpperCase();
  const link=appUrl+'?invite='+token;
  if(u&&!u.isGuest&&window._fb){
    const {db,doc,setDoc}=window._fb;
    try{
      await setDoc(doc(db,'invite_tokens',token),{
        fromUid:u.uid, fromName:u.name||'A LifeFlow user',
        fromEmail:u.email||'', fromPic:u.picture||'',
        createdAt:Date.now(), expiresAt:Date.now()+7*24*60*60*1000
      });
    }catch(e){console.warn('storeToken:',e);}
  }
  return link;
}

// ── Invite modal ─────────────────────────────────────────────────────────────
async function openInviteModal(){
  const u=window.currentUser||currentUser;
  if(!u||u.isGuest){showToast('Please sign in with Google to invite friends.');return;}
  document.getElementById('invite-modal')?.remove();
  const modal=document.createElement('div');
  modal.className='modal-overlay'; modal.id='invite-modal';
  modal.innerHTML=`<div class="modal invite-modal-wrap">
    <button class="modal-close" onclick="document.getElementById('invite-modal').remove()">x</button>
    <div class="modal-title">Invite a Friend</div>
    <p style="font-size:13px;color:var(--text3);margin-bottom:14px">When your friend opens the link and signs in, you are connected automatically — no email needed.</p>
    <div class="invite-tabs">
      <button class="invite-tab active" id="itab-link" onclick="switchInviteTab('link')">Link</button>
      <button class="invite-tab" id="itab-qr" onclick="switchInviteTab('qr')">QR Code</button>
      <button class="invite-tab" id="itab-code" onclick="switchInviteTab('code')">Friend Code</button>
    </div>
    <div class="invite-section active" id="isec-link">
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Generating your unique invite link...</div>
      <div class="invite-link-box" id="invite-link-box" style="display:none">
        <span class="invite-link-text" id="invite-link-text"></span>
        <button class="copy-btn" id="invite-copy-btn" onclick="copyInviteLink()">Copy</button>
      </div>
      <div class="share-buttons" id="invite-share-btns" style="display:none">
        <button class="share-btn whatsapp" onclick="shareWhatsApp()">WhatsApp</button>
        <button class="share-btn copy-link" onclick="copyInviteLink()">Copy Link</button>
        <button class="share-btn native" id="native-share-btn" onclick="nativeShare()" style="display:none">Share</button>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:10px">Link expires in 7 days.</div>
    </div>
    <div class="invite-section" id="isec-qr">
      <div class="qr-wrap">
        <div id="qr-canvas-wrap" style="min-height:160px;display:flex;align-items:center;justify-content:center">
          <span style="color:var(--text3);font-size:13px">Generating QR...</span>
        </div>
        <div style="font-size:12px;color:var(--text3);text-align:center">Ask your friend to scan this</div>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:4px" onclick="downloadQR()">Download QR Image</button>
    </div>
    <div class="invite-section" id="isec-code">
      <div style="font-size:13px;color:var(--text2);margin-bottom:4px">Your friend code:</div>
      <div class="friend-code-display" id="my-friend-code">${getMyFriendCode()}</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:14px">Share this code over chat or verbally. Your friend enters it below.</div>
      <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:6px">Enter a friend's code:</div>
      <div class="enter-code-wrap">
        <input class="input" id="enter-code-in" placeholder="e.g. AB12CD" maxlength="6"
          style="text-transform:uppercase;letter-spacing:4px;font-size:16px;text-align:center;margin-bottom:0">
        <button class="btn btn-primary" onclick="connectByCode()" style="flex-shrink:0">Connect</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  // Generate link async
  generateInviteLink().then(link=>{
    window._currentInviteLink=link;
    const linkEl=document.getElementById('invite-link-text');
    const boxEl=document.getElementById('invite-link-box');
    const btnsEl=document.getElementById('invite-share-btns');
    if(linkEl)linkEl.textContent=link;
    if(boxEl)boxEl.style.display='flex';
    if(btnsEl)btnsEl.style.display='flex';
    if(navigator.share){const nb=document.getElementById('native-share-btn');if(nb)nb.style.display='flex';}
    window._buildQR=function(){
      const wrap=document.getElementById('qr-canvas-wrap');
      if(!wrap||wrap.querySelector('canvas,img'))return;
      wrap.innerHTML='';
      if(typeof QRCode!=='undefined'){
        new QRCode(wrap,{text:link,width:180,height:180,colorDark:'#3D5C42',colorLight:'#FFFFFF',correctLevel:QRCode.CorrectLevel.M});
      } else {
        const img=document.createElement('img');
        img.src='https://chart.googleapis.com/chart?chs=180x180&cht=qr&chl='+encodeURIComponent(link)+'&choe=UTF-8';
        img.style.borderRadius='8px'; wrap.appendChild(img);
      }
    };
  });
}

function switchInviteTab(tab){
  ['link','qr','code'].forEach(t=>{
    const btn=document.getElementById('itab-'+t);
    const sec=document.getElementById('isec-'+t);
    if(btn)btn.className='invite-tab'+(t===tab?' active':'');
    if(sec)sec.className='invite-section'+(t===tab?' active':'');
  });
  if(tab==='qr'&&window._buildQR)window._buildQR();
}

function copyInviteLink(){
  const link=window._currentInviteLink; if(!link)return;
  navigator.clipboard.writeText(link).then(()=>{
    const btn=document.getElementById('invite-copy-btn');
    if(btn){btn.textContent='Copied!';btn.classList.add('copied');setTimeout(()=>{btn.textContent='Copy';btn.classList.remove('copied');},2000);}
    showToast('Link copied to clipboard!');
  }).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=link;ta.style.cssText='position:fixed;opacity:0';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    showToast('Link copied!');
  });
}

function shareWhatsApp(){
  const link=window._currentInviteLink; if(!link)return;
  const u=window.currentUser||currentUser;
  const msg=(u?u.name:'Someone')+' wants to connect with you on LifeFlow! Open this link to accept: '+link;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

async function nativeShare(){
  const link=window._currentInviteLink; if(!link||!navigator.share)return;
  const u=window.currentUser||currentUser;
  try{await navigator.share({title:'Join me on LifeFlow',text:(u?u.name:'Someone')+' wants to connect with you on LifeFlow!',url:link});}
  catch(e){if(e.name!=='AbortError')console.warn('share error',e);}
}

function downloadQR(){
  const wrap=document.getElementById('qr-canvas-wrap'); if(!wrap)return;
  const canvas=wrap.querySelector('canvas');
  if(canvas){const a=document.createElement('a');a.download='lifeflow-invite-qr.png';a.href=canvas.toDataURL('image/png');a.click();showToast('QR downloaded!');}
  else{const img=wrap.querySelector('img');if(img)window.open(img.src,'_blank');}
}

async function connectByCode(){
  const code=(document.getElementById('enter-code-in')?.value||'').trim().toUpperCase();
  if(code.length!==6){showToast('Please enter a 6-character code.');return;}
  const u=window.currentUser||currentUser;
  if(!u||u.isGuest){showToast('Please sign in with Google first.');return;}
  if(!window._fb){showToast('Not connected to cloud. Try again.');return;}
  const {db,collection,getDocs,addDoc}=window._fb;
  showToast('Looking up code...');
  try{
    const snap=await getDocs(collection(db,'users_by_email'));
    let found=null;
    snap.forEach(d=>{const data=d.data();if(data.uid&&data.uid.slice(-6).toUpperCase()===code&&data.uid!==u.uid)found=data;});
    if(!found){showToast('Code not found. Ask your friend to share their code from the app.');return;}
    const already=friends.some(f=>f.contact===found.email||f.fromUid===found.uid);
    if(already){showToast('Already connected with this person!');return;}
    friends.push({id:uid(),name:found.name||'Friend',contact:found.email||'',status:'active',fromUid:found.uid});
    persistSpend();renderFriends();
    await addDoc(collection(db,'users',found.uid,'friendRequests'),{
      fromUid:u.uid,fromName:u.name,fromEmail:u.email,fromPicture:u.picture||'',sentAt:Date.now(),status:'pending'
    });
    document.getElementById('invite-modal')?.remove();
    showToast('Connected with '+(found.name||'your friend')+'!');
  }catch(e){console.warn('connectByCode error:',e);showToast('Error looking up code. Please try again.');}
}

async function handleInviteToken(){
  const params=new URLSearchParams(window.location.search);
  const token=params.get('invite');
  if(!token||token==='guest')return;
  const u=window.currentUser||currentUser;
  if(!u||!u.uid||u.isGuest)return;
  if(!window._fb)return;
  const {db,doc,getDoc,addDoc,collection,deleteDoc}=window._fb;
  try{
    const snap=await getDoc(doc(db,'invite_tokens',token));
    if(!snap.exists())return;
    const data=snap.data();
    if(data.fromUid===u.uid){history.replaceState({},'',window.location.pathname);return;}
    const already=friends.some(f=>f.fromUid===data.fromUid||f.contact===data.fromEmail);
    if(already){showToast('Already connected with '+data.fromName+'!');history.replaceState({},'',window.location.pathname);return;}
    // Add sender to my friends
    friends.push({id:uid(),name:data.fromName,contact:data.fromEmail||'',
                  status:'active',fromUid:data.fromUid});
    persist(); renderFriends();

    // Write me into the sender's friends list in Firestore (mutual)
    try{
      const senderSnap = await getDoc(doc(db,'users',data.fromUid));
      const senderData = senderSnap.exists() ? senderSnap.data() : {};
      const senderFriends = senderData.friends || [];
      const alreadyThere = senderFriends.some(f =>
        String(f.fromUid)===String(u.uid) || f.contact===u.email
      );
      if(!alreadyThere){
        senderFriends.push({id:uid(),name:u.name,contact:u.email||'',
                            status:'active',fromUid:u.uid,picture:u.picture||''});
        await setDoc(doc(db,'users',data.fromUid),{friends:senderFriends},{merge:true});
      }
      // Notify sender via sub-collection so their listener fires
      await addDoc(collection(db,'users',data.fromUid,'notifications'),{
        type:'friend_accepted',fromUid:u.uid,fromName:u.name,
        fromEmail:u.email,fromPicture:u.picture||'',at:Date.now()
      });
    }catch(e){console.warn('invite token mutual write:',e);}

    await deleteDoc(doc(db,'invite_tokens',token));
    showToast('Connected with '+data.fromName+' via invite link!');
    history.replaceState({},'',window.location.pathname);
  }catch(e){console.warn('handleInviteToken error:',e);}
}


// ══════════════════════════════════════════════════════════════════════════════
// CSV IMPORT / EXPORT
// ══════════════════════════════════════════════════════════════════════════════

// ── CSV Template definition ─────────────────────────────────────────────────
const CSV_HEADERS = ['Date','Description','Category','Amount','Notes'];
const CSV_DATE_FORMATS = ['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD','D/M/YY','DD-MM-YYYY'];

const CSV_TEMPLATE_ROWS = [
  ['15/01/2025','Grocery shopping','Food','450','Weekly groceries'],
  ['15/01/2025','Uber ride','Travel','180','Office commute'],
  ['16/01/2025','Amazon order','Shopping','1299','Phone cover'],
  ['16/01/2025','Gym membership','Health','999','Monthly fee'],
  ['17/01/2025','Electricity bill','Bills','2100','January bill'],
  ['17/01/2025','Movie tickets','Entertainment','600','Friday night'],
  ['18/01/2025','Lunch with team','Food','350','Team lunch'],
];

// ── Download blank template ──────────────────────────────────────────────────
function downloadCsvTemplate(){
  const lines = [
    '# LifeFlow Spending CSV Template',
    '# Format: ' + CSV_DATE_FORMATS.join(' | '),
    '# Amount: numbers only, no currency symbols (e.g. 450 not ₹450)',
    '# Category: use any name — new ones are created automatically',
    '# Notes column is optional',
    '',
    CSV_HEADERS.join(','),
    ...CSV_TEMPLATE_ROWS.map(r => r.map(cell =>
      cell.includes(',') ? '"' + cell + '"' : cell
    ).join(','))
  ];
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'lifeflow-spending-template.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('✅ Template downloaded! Fill it in and import it back.');
}

// ── Export all spends to CSV ─────────────────────────────────────────────────
function exportSpendCsv(){
  if(spends.length === 0){
    showToast('No transactions to export yet.');
    return;
  }
  const rows = [CSV_HEADERS.join(',')];
  const sorted = [...spends].sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  sorted.forEach(s => {
    const d = s.date ? new Date(s.date) : new Date();
    const dateStr = d.getDate().toString().padStart(2,'0') + '/' +
                    (d.getMonth()+1).toString().padStart(2,'0') + '/' +
                    d.getFullYear();
    const cells = [
      dateStr,
      '"' + (s.desc||'').replace(/"/g,'""') + '"',
      s.cat||'Other',
      s.amount.toString(),
      '"' + (s.notes||'').replace(/"/g,'""') + '"'
    ];
    rows.push(cells.join(','));
  });
  const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'lifeflow-spending-export-' + todayKey() + '.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📤 Exported ' + spends.length + ' transactions!');
}

// ── File input handler ──────────────────────────────────────────────────────
function handleCsvFile(e){
  const file = e.target.files[0];
  if(!file){ return; }
  if(!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv'){
    renderCsvError('Invalid file type. Please upload a .csv file.');
    e.target.value='';
    return;
  }
  if(file.size > 2 * 1024 * 1024){
    renderCsvError('File too large. Maximum size is 2 MB.');
    e.target.value='';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt){
    parseCsvAndPreview(evt.target.result, file.name);
    e.target.value=''; // reset so same file can be re-selected
  };
  reader.onerror = function(){
    renderCsvError('Could not read the file. Please try again.');
  };
  reader.readAsText(file, 'UTF-8');
}

// ── Parse CSV text ──────────────────────────────────────────────────────────
function parseCsvText(text){
  // Strip BOM if present
  if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
  const lines = text.split(/\r?\n/);
  const rows = [];
  let inQuote = false;
  let current = [];
  let cell = '';

  for(let li=0; li<lines.length; li++){
    const line = lines[li];
    // Skip comment lines (start with #) and empty lines
    if(line.trim().startsWith('#') || line.trim()==='') continue;

    for(let i=0; i<line.length; i++){
      const ch = line[i];
      if(inQuote){
        if(ch==='"'){
          if(line[i+1]==='"'){ cell+='"'; i++; }
          else inQuote=false;
        } else { cell+=ch; }
      } else {
        if(ch==='"'){ inQuote=true; }
        else if(ch===','){current.push(cell.trim());cell='';}
        else { cell+=ch; }
      }
    }
    if(!inQuote){
      current.push(cell.trim());
      cell='';
      if(current.some(c=>c!=='')) rows.push(current);
      current=[];
    } else {
      // Multi-line quoted field
      cell+='\n';
    }
  }
  return rows;
}

// ── Parse a date string in multiple formats ──────────────────────────────────
function parseCsvDate(str){
  if(!str) return null;
  str = str.trim();
  let d;

  // Try DD/MM/YYYY or DD-MM-YYYY
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if(m){
    const day=parseInt(m[1]), mon=parseInt(m[2]), yr=parseInt(m[3]);
    const year = yr < 100 ? 2000+yr : yr;
    // Heuristic: if day>12, definitely DD/MM; else assume DD/MM
    d = new Date(year, mon-1, day);
    if(!isNaN(d.getTime())) return d;
  }
  // Try YYYY-MM-DD
  m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if(m){
    d = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
    if(!isNaN(d.getTime())) return d;
  }
  // Try native parse as last resort
  d = new Date(str);
  if(!isNaN(d.getTime())) return d;
  return null;
}

// ── Normalise column header ──────────────────────────────────────────────────
function normaliseHeader(h){
  return h.toLowerCase().replace(/[^a-z]/g,'');
}

// ── Main: parse and show preview ─────────────────────────────────────────────
function parseCsvAndPreview(text, fileName){
  const el = document.getElementById('csv-import-area');
  if(!el) return;

  const allRows = parseCsvText(text);
  if(allRows.length < 2){
    renderCsvError('The file appears to be empty or has no data rows. Make sure it has a header row followed by data.');
    return;
  }

  // Identify header row
  const rawHeaders = allRows[0].map(h=>h.trim());
  const headerMap  = {};
  rawHeaders.forEach((h,i)=>{
    const norm = normaliseHeader(h);
    if(['date','dt'].includes(norm))           headerMap.date=i;
    if(['description','desc','details','name','narration','transaction','particulars'].includes(norm)) headerMap.desc=i;
    if(['category','cat','type','head'].includes(norm)) headerMap.cat=i;
    if(['amount','amt','debit','credit','sum','value','rs','inr','rupees'].includes(norm)) headerMap.amount=i;
    if(['notes','note','remarks','memo','comment'].includes(norm)) headerMap.notes=i;
  });

  // Check required headers
  // Date is now optional — if missing, all rows default to today
  const missing = [];
  if(headerMap.desc   === undefined) missing.push('Description');
  if(headerMap.amount === undefined) missing.push('Amount');

  if(missing.length > 0){
    renderCsvError(
      'Required columns not found: <strong>' + missing.join(', ') + '</strong>.<br>' +
      'Your file has columns: <em>' + rawHeaders.join(', ') + '</em>.<br>' +
      'Expected column names (case-insensitive): Date, Description, Amount. Category and Notes are optional.'
    );
    return;
  }

  // Parse data rows
  const dataRows = allRows.slice(1);
  const parsed   = [];
  const newCats  = new Set();
  const cats     = allCats();

  dataRows.forEach((row, i) => {
    const rowNum = i + 2; // 1-indexed, account for header
    const result = { rowNum, raw: row, errors: [], warnings: [], status: 'ok' };

    // Date — default to today if missing or invalid
    const dateRaw = row[headerMap.date] || '';
    const dateObj = parseCsvDate(dateRaw);
    if(!dateObj && dateRaw.trim() !== ''){
      result.warnings.push('Date "' + dateRaw + '" could not be parsed — defaulting to today.');
      result.date    = new Date();
      result.dateKey = todayKey();
    } else if(!dateObj){
      result.warnings.push('No date provided — defaulting to today.');
      result.date    = new Date();
      result.dateKey = todayKey();
    } else {
      result.date    = dateObj;
      result.dateKey = dateObj.getFullYear()+'-'+(dateObj.getMonth()+1)+'-'+dateObj.getDate();
    }

    // Description
    const desc = (row[headerMap.desc]||'').trim();
    if(!desc) result.errors.push('Description is empty.');
    result.desc = desc;

    // Amount
    const amtRaw = (row[headerMap.amount]||'').replace(/[₹$€£,\s]/g,'').trim();
    const amt    = parseFloat(amtRaw);
    if(isNaN(amt) || amt <= 0){
      result.errors.push('Amount "' + (row[headerMap.amount]||'') + '" is invalid. Use a positive number like 450.');
    } else if(amt > 10000000){
      result.warnings.push('Amount ₹' + amt.toLocaleString('en-IN') + ' is unusually large. Please verify.');
    }
    result.amount = isNaN(amt) ? 0 : Math.abs(amt);

    // Category — auto-create if new
    const catRaw = headerMap.cat !== undefined ? (row[headerMap.cat]||'').trim() : 'Other';
    const cat    = catRaw || 'Other';
    result.cat   = cat;
    if(!cats[cat]){
      newCats.add(cat);
      result.catIsNew = true;
      result.warnings.push('New category "' + cat + '" will be created automatically.');
    }

    // Notes (optional)
    result.notes = headerMap.notes !== undefined ? (row[headerMap.notes]||'').trim() : '';

    // Final status
    if(result.errors.length > 0)   result.status = 'error';
    else if(result.warnings.length > 0) result.status = 'warn';

    parsed.push(result);
  });

  const validRows   = parsed.filter(r=>r.status !== 'error');
  const errorRows   = parsed.filter(r=>r.status === 'error');
  const warnRows    = parsed.filter(r=>r.status === 'warn');
  const totalOk     = validRows.length;

  // Build preview HTML
  const previewRows = parsed.slice(0, 50); // show up to 50 rows
  const tableHtml = `
    <div class="csv-preview-scroll">
      <table class="csv-preview-table">
        <thead><tr>
          <th>Row</th><th>Date</th><th>Description</th><th>Category</th>
          <th>Amount</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${previewRows.map(r=>{
            const statusLabel = r.status==='error'
              ? '<span class="csv-row-status error">Error</span>'
              : r.catIsNew
              ? '<span class="csv-row-status new-cat">New cat</span>'
              : r.status==='warn'
              ? '<span class="csv-row-status warn">Warning</span>'
              : '<span class="csv-row-status ok">OK</span>';
            const issues = [...(r.errors||[]),...(r.warnings||[])].join(' | ');
            const dateStr = r.date
              ? r.date.getDate()+'/'+(r.date.getMonth()+1)+'/'+r.date.getFullYear()
              : '<span style="color:var(--red)">'+( r.raw[0]||'—')+'</span>';
            return `<tr class="row-${r.status}" title="${issues}">
              <td style="color:var(--text3)">${r.rowNum}</td>
              <td>${dateStr}</td>
              <td>${r.desc||'<span style="color:var(--red)">Empty</span>'}</td>
              <td>${r.catIsNew?'<span style="color:var(--blue)">'+r.cat+' ✦</span>':r.cat}</td>
              <td>${r.amount>0?'₹'+r.amount.toLocaleString('en-IN'):'<span style="color:var(--red)">Invalid</span>'}</td>
              <td>${statusLabel}${issues?'<div style="font-size:10px;color:var(--text3);margin-top:2px">'+issues+'</div>':''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  // Summary bar
  let summaryHtml = '';
  if(errorRows.length === 0 && warnRows.length === 0){
    summaryHtml = `<div class="csv-summary-bar success">
      ✅ <strong>All ${totalOk} rows are valid</strong> and ready to import.
      ${newCats.size>0?'<br>✦ '+newCats.size+' new categor'+(newCats.size>1?'ies':'y')+' will be created: <strong>'+[...newCats].join(', ')+'</strong>':''}
    </div>`;
  } else if(totalOk > 0){
    summaryHtml = `<div class="csv-summary-bar partial">
      ⚠️ <strong>${totalOk} of ${parsed.length} rows</strong> will be imported.
      ${errorRows.length>0?'<strong>'+errorRows.length+' row'+(errorRows.length>1?'s have':'has')+' errors</strong> (shown in red) and will be skipped. ':''}
      ${warnRows.length>0?warnRows.length+' row'+(warnRows.length>1?'s have':'has')+' warnings (shown in yellow). ':''}
      ${newCats.size>0?'<br>✦ New categories will be created: <strong>'+[...newCats].join(', ')+'</strong>':''}
    </div>`;
  } else {
    summaryHtml = `<div class="csv-summary-bar error">
      ❌ <strong>All ${parsed.length} rows have errors</strong> — nothing can be imported.
      Please fix the errors and try again, or download the template to see the correct format.
    </div>`;
  }

  el.innerHTML = `
    <div style="margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:13px;font-weight:500;color:var(--text)">
          Preview: <em style="color:var(--text3)">${fileName}</em>
          <span style="color:var(--text3);font-weight:400"> — ${parsed.length} row${parsed.length!==1?'s':''}</span>
        </div>
        <button class="del" onclick="clearCsvPreview()" title="Clear preview">×</button>
      </div>
      ${summaryHtml}
      ${tableHtml}
      ${parsed.length>50?'<div style="font-size:11px;color:var(--text3);margin-top:6px">Showing first 50 rows. All '+ parsed.length +' rows will be processed on import.</div>':''}
      <div class="csv-field-hint">
        ✦ = new category &nbsp;|&nbsp; Hover over rows to see details &nbsp;|&nbsp;
        Dates accepted: ${CSV_DATE_FORMATS.join(', ')}
      </div>
      ${totalOk>0?`
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" onclick="confirmCsvImport()" id="csv-confirm-btn">
          Import ${totalOk} transaction${totalOk!==1?'s':''}
        </button>
        <button class="btn btn-ghost" onclick="clearCsvPreview()">Cancel</button>
      </div>`:'<div style="margin-top:10px"><button class="btn btn-ghost" onclick="clearCsvPreview()">Close</button></div>'}
    </div>`;

  // Store parsed data for confirm
  window._csvParsed = parsed;
  window._csvNewCats = [...newCats];
}

// ── Confirm and execute import ───────────────────────────────────────────────
function confirmCsvImport(){
  const btn = document.getElementById('csv-confirm-btn');
  if(btn){ btn.textContent='Importing...'; btn.disabled=true; }

  const parsed   = window._csvParsed || [];
  const newCatNames = window._csvNewCats || [];
  const cats     = allCats();

  // 1. Auto-create missing categories
  const palette = ['#6B8F71','#B8845A','#5A78B8','#B85A4A','#8A6BC4','#5A9898','#9E6B9E','#9E8A6B'];
  newCatNames.forEach((name, i) => {
    if(!cats[name]){
      const color = palette[i % palette.length];
      customCats.push({name, emoji:'🏷️', color, bg: color+'22'});
    }
  });

  // 2. Import valid rows
  let imported = 0;
  parsed.forEach(r => {
    if(r.status === 'error') return;
    spends.push({
      id:    uid(),
      cat:   r.cat || 'Other',
      desc:  r.desc,
      amount:r.amount,
      date:  r.dateKey || todayKey(),
      notes: r.notes || ''
    });
    imported++;
  });

  persistSpend();
  clearCsvPreview();
  renderPersonal();

  const newCatMsg = newCatNames.length > 0
    ? ' Created ' + newCatNames.length + ' new categor' + (newCatNames.length>1?'ies':'y') + ': ' + newCatNames.join(', ') + '.'
    : '';
  showToast('✅ Imported ' + imported + ' transaction' + (imported!==1?'s':'')+'.'+newCatMsg);
}

function clearCsvPreview(){
  const el = document.getElementById('csv-import-area');
  if(el) el.innerHTML='';
  window._csvParsed  = null;
  window._csvNewCats = null;
}

function renderCsvError(msg){
  const el = document.getElementById('csv-import-area');
  if(!el) return;
  el.innerHTML = `
    <div class="csv-summary-bar error" style="margin-top:10px">
      ❌ <strong>Import failed</strong><br>${msg}
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="csv-btn download" onclick="downloadCsvTemplate()">⬇ Download Template</button>
      <button class="btn btn-ghost btn-sm" onclick="clearCsvPreview()">Close</button>
    </div>`;
}


// ════════════════════════════════════════════════════════════════════════════
// SPENDING — sidebar tree, FAB, date range, monthly cats modal
// ════════════════════════════════════════════════════════════════════════════

// ── Date range state ────────────────────────────────────────────────────────
let spendDateMode  = 'today';    // 'today'|'week'|'month'|'last_month'|'custom'
let spendDateFrom  = null;       // Date object
let spendDateTo    = null;       // Date object
let quickAddCat    = 'Food';

// ── Sidebar tree ─────────────────────────────────────────────────────────────
let spendTreeOpen = true;

function toggleSpendingTree(btn){
  spendTreeOpen = !spendTreeOpen;
  const children = document.getElementById('spend-tree-children');
  const chevron  = document.getElementById('spend-tree-chevron');
  if(children) children.className = 'nav-tree-children' + (spendTreeOpen?' open':'');
  if(chevron)  chevron.className  = 'nav-tree-chevron'  + (spendTreeOpen?' open':'');
  // If clicking when already on spending, just toggle tree
  if(currentPage !== 'spending'){
    navigate('spending', null);
    // Activate personal sub-item
    document.querySelectorAll('.nav-sub-item').forEach(x=>x.classList.remove('active'));
    document.getElementById('nav-sub-personal')?.classList.add('active');
  }
}

function navToSpend(panel, btn){
  // Navigate to spending page and switch sub-panel
  const wasOnSpending = currentPage === 'spending';
  if(!wasOnSpending){
    // Navigate without activating a nav-item (parent handles that)
    currentPage = 'spending';
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-spending')?.classList.add('active');
  }
  // Update sub-item active state
  document.querySelectorAll('.nav-sub-item').forEach(x=>x.classList.remove('active'));
  if(btn) btn.classList.add('active');
  // Remove active from main nav items when spending sub-selected
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  document.getElementById('nav-spending-parent')?.classList.add('active');
  // Switch panel
  setSpendTab(panel, null);
  closeSidebar();
  // Show/hide FAB
  updateFab();
}

function updateFab(){
  const fab = document.getElementById('fab-quick-add');
  if(!fab) return;
  const show = currentPage === 'spending' && spendTab === 'personal';
  fab.className = 'fab-quick-add' + (show?' visible':'');
}

// navigate tree sync is handled inside the base navigate() function

// ── Quick Add FAB ────────────────────────────────────────────────────────────
function openQuickAdd(){
  const sheet   = document.getElementById('quick-add-sheet');
  const overlay = document.getElementById('qa-overlay');
  if(!sheet||!overlay) return;
  // Populate category chips
  const cats = Object.keys(allCats()).slice(0,8);
  quickAddCat = cats[0];
  const catsEl = document.getElementById('qa-cats');
  if(catsEl) catsEl.innerHTML = cats.map(cat=>
    `<button class="quick-cat-chip ${cat===quickAddCat?'sel':''}"
      onclick="setQaCat('${cat}',this)">${catEmoji(cat)} ${cat}</button>`
  ).join('');
  // Reset form with today's date
  const amtEl = document.getElementById('qa-amount');
  const descEl = document.getElementById('qa-desc');
  const dateEl = document.getElementById('qa-date');
  if(amtEl)  amtEl.value  = '';
  if(descEl) descEl.value = '';
  if(dateEl){
    const today = new Date();
    dateEl.value = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  }
  overlay.className = 'sheet-overlay show';
  sheet.className   = 'quick-add-sheet open';
  setTimeout(()=>amtEl?.focus(), 200);
}

function closeQuickAdd(){
  document.getElementById('quick-add-sheet').className = 'quick-add-sheet';
  document.getElementById('qa-overlay').className      = 'sheet-overlay';
}

function setQaCat(cat, btn){
  quickAddCat = cat;
  document.querySelectorAll('.quick-cat-chip').forEach(x=>x.classList.remove('sel'));
  if(btn) btn.classList.add('sel');
}

function submitQuickAdd(){
  const amount = parseFloat(document.getElementById('qa-amount')?.value||0);
  if(isNaN(amount)||amount<=0){ showToast('Please enter a valid amount.'); return; }
  const desc    = (document.getElementById('qa-desc')?.value||'').trim() || quickAddCat;
  const dateRaw = document.getElementById('qa-date')?.value || '';
  // Convert YYYY-MM-DD to our dateKey format (YYYY-M-D)
  let dateKey = todayKey();
  if(dateRaw){
    const parts = dateRaw.split('-');
    dateKey = parseInt(parts[0])+'-'+parseInt(parts[1])+'-'+parseInt(parts[2]);
  }
  spends.push({id:uid(), cat:quickAddCat, desc, amount, date:dateKey});
  persistSpend();
  closeQuickAdd();
  renderPersonal();
  showToast('✅ Added ₹' + fmt(amount) + ' to ' + quickAddCat);
}

// ── Date range filter ────────────────────────────────────────────────────────
function getDateRange(){
  const now  = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch(spendDateMode){
    case 'today':
      return {from: today, to: new Date(today.getTime()+86399999)};
    case 'week':{
      const day = today.getDay();
      const mon = new Date(today); mon.setDate(today.getDate()-(day===0?6:day-1));
      return {from: mon, to: new Date(today.getTime()+86399999)};
    }
    case 'month':
      return {from: new Date(now.getFullYear(),now.getMonth(),1), to: new Date(today.getTime()+86399999)};
    case 'last_month':{
      const lm1 = new Date(now.getFullYear(),now.getMonth()-1,1);
      const lm2 = new Date(now.getFullYear(),now.getMonth(),0,23,59,59,999);
      return {from: lm1, to: lm2};
    }
    case 'last_week':{
      const day2 = today.getDay();
      const thisMon = new Date(today); thisMon.setDate(today.getDate()-(day2===0?6:day2-1));
      const prevMon = new Date(thisMon); prevMon.setDate(thisMon.getDate()-7);
      const prevSun = new Date(prevMon); prevSun.setDate(prevMon.getDate()+6); prevSun.setHours(23,59,59,999);
      return {from: prevMon, to: prevSun};
    }
    case 'custom':
      return {
        from: spendDateFrom ? new Date(spendDateFrom) : new Date(now.getFullYear(),now.getMonth(),1),
        to:   spendDateTo   ? new Date(new Date(spendDateTo).getTime()+86399999) : new Date(today.getTime()+86399999)
      };
    default:
      return {from: today, to: new Date(today.getTime()+86399999)};
  }
}

function spendsInRange(){
  const {from, to} = getDateRange();
  return spends.filter(s=>{
    const d = new Date(s.date.includes('-') ? s.date.split('-').join('/') : s.date);
    return d >= from && d <= to;
  });
}

function renderDateRangeBar(){
  const el = document.getElementById('spend-date-range-bar');
  if(!el) return;
  const modes = [
    {id:'today',     label:'Today'},
    {id:'week',      label:'This Week'},
    {id:'last_week', label:'Last Week'},
    {id:'month',     label:'This Month'},
    {id:'last_month',label:'Last Month'},
    {id:'custom',    label:'Custom'},
  ];
  el.innerHTML = modes.map(m=>
    `<button class="dr-chip ${spendDateMode===m.id?'active':''}" onclick="setSpendDateMode('${m.id}')">${m.label}</button>`
  ).join('') +
  `<div class="dr-custom" id="dr-custom-inputs" style="display:${spendDateMode==='custom'?'flex':'none'}">
    <input class="dr-date-input" type="date" id="dr-from" value="${spendDateFrom||''}" onchange="setCustomRange()">
    <span style="font-size:12px;color:var(--text3)">to</span>
    <input class="dr-date-input" type="date" id="dr-to" value="${spendDateTo||''}" onchange="setCustomRange()">
  </div>`;
}

function setSpendDateMode(mode){
  spendDateMode = mode;
  if(mode !== 'custom'){ spendDateFrom=null; spendDateTo=null; }
  renderDateRangeBar();
  renderPersonal();
}

function setCustomRange(){
  spendDateFrom = document.getElementById('dr-from')?.value || null;
  spendDateTo   = document.getElementById('dr-to')?.value   || null;
  renderPersonal();
}

// ── Monthly categories modal ─────────────────────────────────────────────────
function openMonthlyCatsModal(){
  // Always show monthly breakdown regardless of current date range
  const now   = new Date();
  const mFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const mTo   = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);
  const monthSpends = spends.filter(s=>{
    const d = new Date(s.date.includes('-') ? s.date.split('-').join('/') : s.date);
    return d >= mFrom && d <= mTo;
  });
  const total = monthSpends.reduce((a,b)=>a+b.amount,0);
  const cats  = {};
  monthSpends.forEach(s=>{ cats[s.cat]=(cats[s.cat]||0)+s.amount; });
  const sorted = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const monthName = now.toLocaleString('en-IN',{month:'long',year:'numeric'});

  const modal = document.createElement('div');
  modal.className='modal-overlay'; modal.id='monthly-cats-modal';
  modal.innerHTML=`<div class="modal" style="max-width:520px">
    <button class="modal-close" onclick="document.getElementById('monthly-cats-modal').remove()">×</button>
    <div class="modal-title">Spending — ${monthName}</div>
    <div style="font-size:28px;font-family:'Cormorant Garamond',serif;color:var(--sage-dark);margin-bottom:4px">₹${fmt(Math.round(total))}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Total this month · ${monthSpends.length} transactions</div>
    ${sorted.length===0?'<div class="empty"><div class="empty-icon">₹</div>No transactions this month</div>':''}
    <div class="month-cat-grid">
      ${sorted.map(([cat,amt])=>{
        const pct = total>0 ? Math.round(amt/total*100) : 0;
        return `<div class="month-cat-card">
          <div class="month-cat-card-emoji">${catEmoji(cat)}</div>
          <div class="month-cat-card-name">${cat}</div>
          <div class="month-cat-card-amt">₹${fmt(Math.round(amt))}</div>
          <div class="month-cat-card-pct">${pct}% of total</div>
          <div class="month-cat-bar-fill" style="width:${pct}%"></div>
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:16px;display:flex;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="document.getElementById('monthly-cats-modal').remove()">Close</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}


async function refreshAppData(){
  const btn = document.getElementById('refresh-btn');

  // Animate button
  if(btn){
    btn.disabled = true;
    btn.textContent = '↻';
    btn.style.transform = 'rotate(0deg)';
    btn.style.transition = 'transform 0.6s ease';
    setTimeout(()=>{ if(btn) btn.style.transform = 'rotate(360deg)'; }, 10);
  }

  function done(msg){
    if(btn){
      btn.disabled = false;
      btn.style.transform = '';
      btn.style.transition = '';
    }
    showToast(msg);
  }

  try {
    // Step 1: Clear ALL SW caches so fresh HTML/JS is fetched from server
    if('caches' in window){
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // Step 2: Pull latest data from Firestore (without reloading page)
    // Wait for Firebase to be ready (up to 3s)
    let waited = 0;
    while((!window._fb || !window.currentUser) && waited < 3000){
      await new Promise(r=>setTimeout(r,100));
      waited += 100;
    }

    if(window._fb && window.currentUser && window.currentUser.uid){
      // Direct Firestore fetch — doesn't restart listener
      const {db, doc, getDoc} = window._fb;
      const snap = await getDoc(doc(db, 'users', window.currentUser.uid));
      if(snap.exists() && window._applySync) window._applySync(snap.data());
      renderPage(currentPage);
      renderHome();
      done('✅ Data refreshed!');
    } else {
      // Not logged in — just re-render from local state
      renderPage(currentPage);
      renderHome();
      done('✅ Done');
    }
  } catch(e) {
    console.warn('refresh error:', e);
    // On any error, hard reload to recover
    done('Reloading...');
    setTimeout(()=> window.location.reload(true), 400);
  }
}


// ══════════════════════════════════════════════════════════════════════════
// SHARED EXPENSE LISTS — track together, no splitting
// ══════════════════════════════════════════════════════════════════════════

function renderSharedExpenseLists(){
  const el = document.getElementById('shared-expense-lists');
  if(!el) return;
  if(sharedExpenseLists.length === 0){
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">
      No shared lists yet. Create one to track expenses with family or friends together.
    </div>`;
    return;
  }
  el.innerHTML = sharedExpenseLists.map(lst => {
    const total = (lst.expenses||[]).reduce((a,e) => a+e.amount, 0);
    const memberNames = (lst.memberIds||[]).map(mid => {
      if(mid === 'me') return (window.currentUser||currentUser)?.name||'Me';
      const f = friends.find(x => x.id === mid);
      return f ? f.name : 'Member';
    });
    return `<div class="shared-list-card" onclick="openSharedListDetail(${lst.id})">
      <div class="shared-list-header">
        <span class="shared-list-emoji">${lst.emoji||'📋'}</span>
        <div class="shared-list-info">
          <div class="shared-list-name">${lst.name}</div>
          <div class="shared-list-meta">${(lst.expenses||[]).length} expenses · ${memberNames.join(', ')}</div>
        </div>
        <div class="shared-list-total">₹${fmt(Math.round(total))}</div>
      </div>
      <div class="shared-list-members">
        ${memberNames.map(n => `<div class="shared-list-member-avatar" title="${n}">${n[0].toUpperCase()}</div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function openNewSharedListModal(){
  const activeFriends = friends.filter(f => f.status === 'active');
  document.getElementById('new-shared-list-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay'; modal.id = 'new-shared-list-modal';
  modal.innerHTML = `<div class="modal" style="max-width:400px">
    <button class="modal-close" onclick="document.getElementById('new-shared-list-modal').remove()">x</button>
    <div class="modal-title">New Shared Expense List</div>
    <div class="input-row" style="margin-bottom:12px">
      <input class="input" id="sl-emoji" value="🏠" style="width:56px;text-align:center;flex-shrink:0;margin-bottom:0;font-size:22px">
      <input class="input" id="sl-name" placeholder="e.g. Home, Family Trip, Vacation" style="margin-bottom:0">
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px;font-weight:500">Add members</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
      <div style="padding:8px;background:var(--warm);border-radius:var(--r2);font-size:13px;color:var(--text2)">
        ✓ ${(window.currentUser||currentUser)?.name||'You'} (you)
      </div>
      ${activeFriends.length === 0
        ? `<div style="font-size:12px;color:var(--text3);padding:8px">No accepted friends yet.</div>`
        : activeFriends.map(f => `<label style="display:flex;align-items:center;gap:8px;padding:8px;border:1.5px solid var(--warm2);border-radius:var(--r2);cursor:pointer">
            <input type="checkbox" class="sl-member-cb" value="${f.id}">
            <div class="friend-avatar" style="width:26px;height:26px;font-size:11px">${f.name[0].toUpperCase()}</div>
            <span style="font-size:13px">${f.name}</span>
          </label>`).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="createSharedExpenseList()">Create List</button>
      <button class="btn btn-ghost" onclick="document.getElementById('new-shared-list-modal').remove()">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('sl-name')?.focus(), 100);
}

async function createSharedExpenseList(){
  const name  = (document.getElementById('sl-name')?.value||'').trim();
  const emoji = (document.getElementById('sl-emoji')?.value||'').trim() || '📋';
  if(!name){ showToast('Please enter a list name.'); return; }
  const cbs = document.querySelectorAll('.sl-member-cb:checked');
  const selectedIds = Array.from(cbs).map(cb => Number(cb.value));
  const memberIds   = ['me', ...selectedIds];
  const u = window.currentUser || currentUser;
  const memberUids  = [u?.uid||''];
  selectedIds.forEach(fid => {
    const f = friends.find(x => x.id === fid);
    if(f?.fromUid) memberUids.push(f.fromUid);
  });

  const newList = {
    id: uid(), name, emoji, memberIds, memberUids,
    createdBy: u?.uid||'', createdAt: Date.now(), expenses: []
  };
  sharedExpenseLists.push(newList);
  persist();
  document.getElementById('new-shared-list-modal')?.remove();
  renderSharedExpenseLists();
  showToast('List "' + name + '" created!');

  // Push to all member Firestore docs
  if(window._fb){
    const {db, doc, getDoc, setDoc} = window._fb;
    for(const memberUid of memberUids){
      if(memberUid === u?.uid) continue;
      try{
        const snap = await getDoc(doc(db,'users',memberUid));
        const data = snap.exists() ? snap.data() : {};
        const theirLists = (data.sharedExpenseLists||[]).filter(l => String(l.id) !== String(newList.id));
        theirLists.push(newList);
        await setDoc(doc(db,'users',memberUid), {sharedExpenseLists: theirLists}, {merge:true});
      }catch(e){ console.warn('createSharedList push:', e); }
    }
  }
}

function openSharedListDetail(listId){
  const lst = sharedExpenseLists.find(l => l.id === listId);
  if(!lst) return;
  document.getElementById('groups-list-view').style.display = 'none';
  const detail = document.getElementById('shared-list-detail');
  if(!detail) return;
  detail.style.display = 'block';

  const byCat = {};
  (lst.expenses||[]).forEach(e => { byCat[e.cat] = (byCat[e.cat]||0) + e.amount; });
  const catSorted = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
  const total = (lst.expenses||[]).reduce((a,e) => a+e.amount, 0);
  const memberNames = (lst.memberIds||[]).map(mid => {
    if(mid === 'me') return (window.currentUser||currentUser)?.name||'Me';
    const f = friends.find(x => x.id === mid);
    return f ? f.name : '?';
  });

  detail.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <button class="btn btn-ghost btn-sm" onclick="closeSharedListDetail()">← Back</button>
        <span style="font-size:22px">${lst.emoji}</span>
        <div style="flex:1">
          <div style="font-size:17px;font-weight:500;color:var(--sage-dark)">${lst.name}</div>
          <div style="font-size:11px;color:var(--text3)">${memberNames.join(', ')}</div>
        </div>
        <div style="font-size:22px;font-weight:700;color:var(--sage-dark);font-family:'Cormorant Garamond',serif">₹${fmt(Math.round(total))}</div>
      </div>
      ${catSorted.length > 0 ? `
        <div style="margin-bottom:14px">
          <div class="card-title" style="margin-bottom:8px">By Category</div>
          ${catSorted.map(([cat,amt]) => `
            <div class="cat-bar">
              <div style="width:32px;height:32px;border-radius:8px;background:${catBg(cat)};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${catEmoji(cat)}</div>
              <span style="flex:1;font-size:13px">${cat}</span>
              <span style="font-size:13px;font-weight:600">₹${fmt(amt)}</span>
            </div>`).join('')}
        </div>` : ''}
      <div>
        <div class="card-title" style="margin-bottom:8px">Expenses</div>
        ${(lst.expenses||[]).length === 0
          ? '<div class="empty"><div style="font-size:24px">📋</div><div>No expenses yet</div></div>'
          : [...(lst.expenses||[])].reverse().map(e => `
            <div class="shared-expense-row">
              <div style="width:30px;height:30px;border-radius:8px;background:${catBg(e.cat)};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">${catEmoji(e.cat)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;color:var(--text)">${e.desc}</div>
                <div style="font-size:10px;color:var(--text3)">${e.date} · ${e.cat}</div>
              </div>
              <span class="shared-expense-who">${e.addedBy||'Me'}</span>
              <span style="font-size:14px;font-weight:600;color:var(--text)">₹${fmt(e.amount)}</span>
              <button class="del" onclick="deleteSharedExpense(${lst.id},${e.id})">x</button>
            </div>`).join('')}
      </div>
      <button class="add-btn" style="margin-top:12px" onclick="openAddSharedExpenseForm(${lst.id})">+ Add Expense</button>
      <div id="shared-expense-form-${lst.id}" style="margin-top:8px"></div>
    </div>`;
}

function closeSharedListDetail(){
  document.getElementById('shared-list-detail').style.display = 'none';
  document.getElementById('groups-list-view').style.display = 'block';
  renderSharedExpenseLists();
}

function openAddSharedExpenseForm(listId){
  const el = document.getElementById('shared-expense-form-'+listId);
  if(!el) return;
  const catNames = Object.keys(allCats()).slice(0,8);
  const todayVal = (()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
  el.innerHTML = `<div class="form-box">
    <select class="input" id="sl-cat-${listId}">
      ${catNames.map(cat => `<option value="${cat}">${catEmoji(cat)} ${cat}</option>`).join('')}
    </select>
    <input class="input" id="sl-desc-${listId}" placeholder="Description">
    <div style="margin-bottom:8px">
      <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Date</label>
      <input class="input" id="sl-date-${listId}" type="date" value="${todayVal}" style="margin-bottom:0">
    </div>
    <div class="input-row">
      <input class="input" id="sl-amount-${listId}" type="number" placeholder="₹ Amount" min="0" style="margin-bottom:0">
      <button class="btn btn-primary" onclick="addSharedExpense(${listId})">Add</button>
      <button class="btn btn-ghost" onclick="document.getElementById('shared-expense-form-${listId}').innerHTML=''">✕</button>
    </div>
  </div>`;
}

async function addSharedExpense(listId){
  const lst = sharedExpenseLists.find(l => l.id === listId);
  if(!lst) return;
  const cat    = document.getElementById('sl-cat-'+listId)?.value || 'Other';
  const desc   = (document.getElementById('sl-desc-'+listId)?.value||'').trim();
  const amt    = parseFloat(document.getElementById('sl-amount-'+listId)?.value||0);
  const dateRaw= document.getElementById('sl-date-'+listId)?.value || '';
  if(!desc || isNaN(amt) || amt <= 0){ showToast('Please enter a description and amount.'); return; }

  let dateKey = todayKey();
  if(dateRaw){ const p=dateRaw.split('-'); dateKey=parseInt(p[0])+'-'+parseInt(p[1])+'-'+parseInt(p[2]); }

  const u = window.currentUser || currentUser;
  const newExp = {id:uid(), cat, desc, amount:amt, date:dateKey, addedBy: u?.name||'Me', addedByUid: u?.uid||''};
  if(!lst.expenses) lst.expenses = [];
  lst.expenses.push(newExp);
  persist();
  openSharedListDetail(listId);
  showToast('Expense added!');

  // Push updated list to all member docs
  if(window._fb){
    const {db, doc, getDoc, setDoc} = window._fb;
    const memberUids = lst.memberUids || [];
    for(const memberUid of memberUids){
      if(memberUid === u?.uid) continue;
      try{
        const snap = await getDoc(doc(db,'users',memberUid));
        const data = snap.exists() ? snap.data() : {};
        const theirLists = (data.sharedExpenseLists||[]).map(l =>
          String(l.id) === String(listId) ? lst : l
        );
        if(!theirLists.some(l => String(l.id) === String(listId))) theirLists.push(lst);
        await setDoc(doc(db,'users',memberUid), {sharedExpenseLists: theirLists}, {merge:true});
      }catch(e){ console.warn('addSharedExpense push:', e); }
    }
  }
}

async function deleteSharedExpense(listId, expId){
  const lst = sharedExpenseLists.find(l => l.id === listId);
  if(!lst) return;
  lst.expenses = (lst.expenses||[]).filter(e => e.id !== expId);
  persist();
  openSharedListDetail(listId);
}

function showToast(msg){
  const t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#3D5C42;color:white;padding:10px 20px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:opacity .4s';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),400);},3000);
}
async function acceptFriendReq(id){
  const r = friendReqs.find(x => String(x.id) === String(id));
  if(!r) return;
  const u = window.currentUser || currentUser;

  // 1. Add friend to MY local list as active
  const myNewFriend = {id:uid(), name:r.from, contact:r.contact||r.fromEmail||'',
                       status:'active', fromUid:r.fromUid||null};
  friends.push(myNewFriend);
  friendReqs = friendReqs.filter(x => x.id !== id);
  persist();        // saves my updated friends list to Firestore immediately
  renderFriends();
  showToast('✅ ' + r.from + ' added as a friend!');

  if(!u?.uid || !window._fb) return;
  try {
    const {db, doc, setDoc, getDoc, collection, addDoc, deleteDoc} = window._fb;

    // 2. Delete the processed request from my sub-collection
    if(r.firestoreDocId){
      await deleteDoc(doc(db,'users',u.uid,'friendRequests',r.firestoreDocId));
    }

    // 3. Write ME as an active friend into the SENDER's Firestore document
    //    so they see me as active without needing to accept anything
    if(r.fromUid){
      const senderSnap = await getDoc(doc(db,'users',r.fromUid));
      const senderData = senderSnap.exists() ? senderSnap.data() : {};
      const senderFriends = senderData.friends || [];

      // Check if they already have me
      const alreadyThere = senderFriends.some(f =>
        String(f.fromUid) === String(u.uid) || f.contact === u.email
      );
      if(!alreadyThere){
        senderFriends.push({
          id: uid(), name: u.name, contact: u.email||'',
          status: 'active', fromUid: u.uid,
          picture: u.picture||''
        });
        await setDoc(doc(db,'users',r.fromUid), { friends: senderFriends }, {merge:true});
      }

      // 4. Write a notification so sender's real-time listener fires and they see us
      await addDoc(collection(db,'users',r.fromUid,'notifications'),{
        type:'friend_accepted', fromUid:u.uid,
        fromName:u.name, fromEmail:u.email,
        fromPicture:u.picture||'', at:Date.now()
      });
    }
  } catch(e){ console.warn('acceptFriendReq Firestore:', e); }
}
function declineFriendReq(id){
  friendReqs=friendReqs.filter(x=>String(x.id)!==String(id));
  _friendReqs=friendReqs;
  persist(); renderFriends();
}
function computeNet(){
  const net={};
  splits.forEach(sp=>{
    sp.members.forEach(m=>{
      if(m.paid)return;
      const fid=String(m.friendId);
      if(fid==='me')return;
      if(!net[fid])net[fid]=0;
      if(String(sp.paidBy)==='me')net[fid]+=m.share;
      else if(String(sp.paidBy)===fid){
        const myM=sp.members.find(x=>String(x.friendId)==='me');
        if(myM&&!myM.paid)net[fid]-=myM.share;
      }
    });
  });
  return net;
}
function deleteFriend(id){
  const net=computeNet();
  const bal=Math.round((net[String(id)]||0)*100)/100;
  if(Math.abs(bal)>0.01){
    const fname=friends.find(f=>f.id===id)?.name||'Friend';
    const dir=bal>0?`${fname} still owes you ₹${fmt(Math.abs(bal))}`:`You still owe ${fname} ₹${fmt(Math.abs(bal))}`;
    alert('Cannot remove friend — '+dir+'. Please settle up first.');
    return;
  }
  friends=friends.filter(f=>f.id!==id);
  persistSpend();renderFriends();
}

// (demo seed removed)

// ── GROUPS ──────────────────────────────────
function renderGroups(){
  renderSharedExpenseLists();
  if(openGroupId){renderGroupDetail(openGroupId);return;}
  document.getElementById('group-detail-view').style.display='none';
  document.getElementById('groups-list-view').style.display='block';

  const glEl=document.getElementById('groups-list');
  if(!glEl)return;
  glEl.innerHTML=groups.length===0
    ?'<div class="empty"><div class="empty-icon">🏕️</div>No groups yet. Create a trip!</div>'
    :groups.map(g=>{
      const memberNames=g.members.map(mid=>mName(mid));
      const total=splits.filter(s=>s.groupId===g.id).reduce((a,b)=>a+b.totalAmount,0);
      return `<div class="group-card" onclick="openGroup(${g.id})">
        <div class="group-card-head"><span class="group-emoji">${g.emoji}</span><div><div class="group-name">${g.name}</div><div class="group-meta">${g.members.length} members · ₹${fmt(total)} total</div></div><button class="del" style="margin-left:auto" onclick="event.stopPropagation();deleteGroup(${g.id})">×</button></div>
        <div class="group-members">${memberNames.map(n=>`<span class="member-chip">${n}</span>`).join('')}</div>
      </div>`;
    }).join('');

  const activeFriends=friends.filter(f=>f.status==='active');
  const gfEl=document.getElementById('groups-form');
  if(gfEl)gfEl.innerHTML=showGroupForm?`
    <div class="form-box">
      <div class="input-row" style="margin-bottom:8px">
        <input class="input" id="grp-emoji" value="🏕️" style="width:56px;text-align:center;flex-shrink:0;margin-bottom:0">
        <input class="input" id="grp-name" placeholder="Group / trip name" style="margin-bottom:0">
      </div>
      <div style="margin-bottom:8px">
        <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:6px">Select members</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${activeFriends.length===0
            ?`<div style="font-size:12px;color:var(--text3);padding:8px;background:var(--warm2);border-radius:8px;width:100%">
                No accepted friends yet. Friends appear here once they accept your request.
              </div>`
            :activeFriends.map(f=>`<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:6px 10px;background:var(--warm);border:1.5px solid var(--warm3);border-radius:8px">
              <input type="checkbox" class="grp-member-cb" value="${f.id}">
              <div class="friend-avatar" style="width:22px;height:22px;font-size:10px;flex-shrink:0">${f.name[0].toUpperCase()}</div>
              ${f.name}
            </label>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="createGroup()">Create Group</button>
        <button class="btn btn-ghost" onclick="setGroupForm(false)">Cancel</button>
      </div>
    </div>`:`<button class="add-btn" onclick="setGroupForm(true)">+ Create group / trip</button>`;
}

function setGroupForm(v){showGroupForm=v;renderGroups();if(v)setTimeout(()=>document.getElementById('grp-name')?.focus(),50);}
async function createGroup(){
  const name  = (document.getElementById('grp-name').value||'').trim();
  const emoji = (document.getElementById('grp-emoji').value||'').trim() || '🏕️';
  if(!name) return;

  const cbs = document.querySelectorAll('.grp-member-cb:checked');
  const selectedIds = Array.from(cbs).map(cb=>Number(cb.value));
  const memberIds   = ['me', ...selectedIds];
  const u = window.currentUser || currentUser;

  // Build memberUids: map local friend IDs to their real Firebase UIDs
  const memberUids  = [u?.uid||''];
  const memberEmails= [u?.email||''];
  selectedIds.forEach(fid=>{
    const f = friends.find(x=>x.id===fid);
    if(f){
      if(f.fromUid)  memberUids.push(f.fromUid);
      if(f.contact && /^[^@]+@[^@]+/.test(f.contact)) memberEmails.push(f.contact);
    }
  });

  const newGroup = {
    id: uid(), name, emoji,
    members: memberIds,
    memberUids, memberEmails,
    createdBy: u?.uid||'', createdAt: Date.now()
  };

  groups.push(newGroup);
  persist(); showGroupForm=false; renderGroups();

  // Push group into each member's Firestore document directly
  if(window._fb){
    const {db, doc, getDoc, setDoc} = window._fb;
    for(const memberUid of memberUids){
      if(memberUid === u?.uid) continue; // skip self
      try{
        const snap = await getDoc(doc(db,'users',memberUid));
        const data = snap.exists() ? snap.data() : {};
        const theirGroups = data.groups || [];
        // Add group if not already there
        if(!theirGroups.some(g=>String(g.id)===String(newGroup.id))){
          theirGroups.push(newGroup);
          await setDoc(doc(db,'users',memberUid), {groups:theirGroups}, {merge:true});
        }
      }catch(e){console.warn('createGroup push to member',memberUid,e);}
    }
  }
  showToast('Group created! All members can now see it.');
}
function isGroupSettled(gid){
  return splits.filter(s=>s.groupId===gid).every(sp=>sp.members.every(m=>m.paid));
}
function deleteGroup(id){
  if(!isGroupSettled(id)){
    alert('Cannot delete group — there are unsettled expenses. Please mark all as paid or settle up first.');
    return;
  }
  groups=groups.filter(g=>g.id!==id);
  splits=splits.filter(s=>s.groupId!==id);
  persistSpend();renderGroups();
}
function openGroup(id){openGroupId=id;renderGroupDetail(id);}
function closeGroup(){openGroupId=null;renderGroups();}

function renderGroupDetail(gid){
  const g=groups.find(x=>x.id===gid);if(!g)return;
  document.getElementById('group-detail-view').style.display='block';
  document.getElementById('groups-list-view').style.display='none';
  const groupSplits=splits.filter(s=>s.groupId===gid);
  const splitsHtml=groupSplits.length===0
    ?'<div class="empty"><div class="empty-icon">💸</div>No expenses yet</div>'
    :groupSplits.map(sp=>{
      const allPaid=sp.members.every(m=>m.paid);
      const paidCount=sp.members.filter(m=>m.paid).length;
      const expandedKey='exp_'+sp.id;
      const isOpen=!!(window._expandedSplits&&window._expandedSplits[expandedKey]);
      return `<div style="border:1px solid ${allPaid?'var(--sage-mid)':'var(--warm2)'};border-radius:var(--r2);margin-bottom:8px;overflow:hidden;background:${allPaid?'rgba(168,196,172,.08)':'var(--card)'}">
        <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none" onclick="toggleExpense('${expandedKey}','exp-body-${sp.id}')">
          <span style="font-size:16px">${allPaid?'✅':'💸'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sp.desc}</div>
            <div style="font-size:11px;color:var(--text3)">₹${fmt(sp.totalAmount)} · ${mName(sp.paidBy)} paid · ${paidCount}/${sp.members.length} paid</div>
          </div>
          <span style="font-size:11px;color:var(--text3);margin-right:4px">${isOpen?'▲':'▼'}</span>
          <button class="del" onclick="event.stopPropagation();deleteSplit(${sp.id})">×</button>
        </div>
        <div id="exp-body-${sp.id}" style="display:${isOpen?'block':'none'};padding:0 14px 12px">
          <div style="font-size:11px;color:var(--text3);margin-bottom:8px">${sp.splitType==='percent'?'Percentage split':'Equal split'} · ${sp.date}</div>
          ${sp.members.map(m=>`<div class="split-row"><div class="friend-avatar" style="width:28px;height:28px;font-size:11px">${mName(m.friendId)[0]}</div><span style="flex:1;font-size:13px">${mName(m.friendId)}</span><span class="split-amount">₹${fmt(m.share)}</span><button class="split-paid-btn ${m.paid?'paid':'unpaid'}" onclick="toggleSplitPaid(${sp.id},'${m.friendId}')">${m.paid?'✓ Paid':'Mark Paid'}</button></div>`).join('')}
        </div>
      </div>`;
    }).join('');
  const memberEmails = g.memberEmails || [];
  const visibleBadge = memberEmails.length > 0
    ? `<div style="font-size:11px;color:var(--sage);background:var(--sage-light);padding:7px 12px;border-radius:8px;margin-bottom:14px;line-height:1.5">
        👁️ <strong>Shared with:</strong> ${memberEmails.join(' · ')}
       </div>` : '';
  document.getElementById('group-detail-view').innerHTML=`
    <div class="card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <button class="btn btn-ghost btn-sm" onclick="closeGroup()">← Back</button>
        <span style="font-size:20px">${g.emoji}</span>
        <span style="font-size:18px;font-weight:500;color:var(--sage-dark)">${g.name}</span>
      </div>
      ${visibleBadge}
      <div class="card-title">Expenses</div>
      <div class="card-title">Expenses</div>
      ${splitsHtml}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
        <button class="add-btn" style="flex:1" onclick="openSplitModal(${gid})">+ Add expense &amp; split</button>
        <button class="btn btn-ghost btn-sm" onclick="openEditGroupModal(${gid})" style="flex-shrink:0;white-space:nowrap">✏️ Edit Group</button>
      </div>
    </div>`;
}

async function openEditGroupModal(gid){
  const g = groups.find(x=>x.id===gid); if(!g)return;
  document.getElementById('edit-group-modal')?.remove();
  const activeFriends = friends.filter(f=>f.status==='active');
  const currentMemberIds = g.members.filter(m=>m!=='me').map(m=>String(m));

  const modal = document.createElement('div');
  modal.className='modal-overlay'; modal.id='edit-group-modal';
  modal.innerHTML=`<div class="modal" style="max-width:400px">
    <button class="modal-close" onclick="document.getElementById('edit-group-modal').remove()">x</button>
    <div class="modal-title">Edit Group</div>
    <div class="input-row" style="margin-bottom:12px">
      <input class="input" id="eg-emoji" value="${g.emoji}" style="width:56px;text-align:center;flex-shrink:0;margin-bottom:0">
      <input class="input" id="eg-name" value="${g.name}" style="margin-bottom:0">
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px;font-weight:500">Members</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--warm);border-radius:var(--r2)">
        <div class="friend-avatar" style="width:28px;height:28px;font-size:11px">
          ${(window.currentUser?.name||'Me')[0].toUpperCase()}
        </div>
        <span style="font-size:13px;flex:1">${window.currentUser?.name||'Me'} (you)</span>
        <span style="font-size:11px;color:var(--sage-dark);background:var(--sage-light);padding:2px 8px;border-radius:6px">Owner</span>
      </div>
      ${activeFriends.length===0
        ?'<div style="font-size:12px;color:var(--text3)">Add friends first to include them in groups.</div>'
        :activeFriends.map(f=>{
          const checked = currentMemberIds.includes(String(f.id));
          return `<label style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:var(--r2);cursor:pointer;border:1.5px solid var(--warm2)">
            <input type="checkbox" class="eg-member-cb" value="${f.id}" ${checked?'checked':''}>
            <div class="friend-avatar" style="width:28px;height:28px;font-size:11px">${f.name[0].toUpperCase()}</div>
            <span style="font-size:13px;flex:1">${f.name}</span>
            ${checked?'<span style="font-size:10px;color:var(--sage-dark);background:var(--sage-light);padding:2px 6px;border-radius:5px">In group</span>':''}
          </label>`;
        }).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="saveGroupEdit(${gid})">Save Changes</button>
      <button class="btn btn-ghost" onclick="document.getElementById('edit-group-modal').remove()">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function saveGroupEdit(gid){
  const g = groups.find(x=>x.id===gid); if(!g)return;
  const name  = (document.getElementById('eg-name')?.value||'').trim() || g.name;
  const emoji = (document.getElementById('eg-emoji')?.value||'').trim() || g.emoji;
  const cbs   = document.querySelectorAll('.eg-member-cb:checked');
  const selectedIds = Array.from(cbs).map(cb=>Number(cb.value));
  const u = window.currentUser||currentUser;

  // Build new member lists
  const newMemberIds  = ['me', ...selectedIds];
  const newMemberUids = [u?.uid||''];
  const newMemberEmails=[u?.email||''];
  selectedIds.forEach(fid=>{
    const f=friends.find(x=>x.id===fid);
    if(f){
      if(f.fromUid) newMemberUids.push(f.fromUid);
      if(f.contact) newMemberEmails.push(f.contact);
    }
  });

  // Update the group
  const idx = groups.findIndex(x=>x.id===gid);
  if(idx>=0){
    groups[idx] = {...groups[idx], name, emoji,
      members:newMemberIds, memberUids:newMemberUids, memberEmails:newMemberEmails};
  }
  persist(); renderGroupDetail(gid);
  document.getElementById('edit-group-modal')?.remove();

  // Push updated group to all (new) member docs
  if(window._fb){
    const {db, doc, getDoc, setDoc} = window._fb;
    const updatedGroup = groups[groups.findIndex(x=>x.id===gid)];
    for(const memberUid of newMemberUids){
      if(memberUid===u?.uid) continue;
      try{
        const snap = await getDoc(doc(db,'users',memberUid));
        const data = snap.exists() ? snap.data() : {};
        const theirGroups = (data.groups||[]).filter(g=>String(g.id)!==String(gid));
        theirGroups.push(updatedGroup);
        await setDoc(doc(db,'users',memberUid),{groups:theirGroups},{merge:true});
      }catch(e){console.warn('saveGroupEdit push',memberUid,e);}
    }
  }
  showToast('Group updated! All members will see the changes.');
}

function toggleExpense(key,bodyId){
  if(!window._expandedSplits)window._expandedSplits={};
  window._expandedSplits[key]=!window._expandedSplits[key];
  const el=document.getElementById(bodyId);
  if(el)el.style.display=window._expandedSplits[key]?'block':'none';
  // update arrow
  const row=el?.previousElementSibling;
  if(row){const arrow=row.querySelector('span:nth-last-child(2)');if(arrow)arrow.textContent=window._expandedSplits[key]?'▲':'▼';}
}
function deleteSplit(id){splits=splits.filter(s=>s.id!==id);persistSpend();if(openGroupId)renderGroupDetail(openGroupId);else renderSettle();}
function toggleSplitPaid(splitId,friendId){
  const sp=splits.find(x=>x.id===splitId);if(!sp)return;
  const m=sp.members.find(x=>String(x.friendId)===String(friendId));if(m)m.paid=!m.paid;
  persistSpend();if(openGroupId)renderGroupDetail(openGroupId);else renderSettle();
}

function openSplitModal(gid){
  const g=groups.find(x=>x.id===gid);if(!g)return;
  const existing=document.getElementById('split-modal');if(existing)existing.remove();
  const modal=document.createElement('div');
  modal.className='modal-overlay';modal.id='split-modal';
  modal.innerHTML=`<div class="modal">
    <button class="modal-close" onclick="closeSplitModal()">×</button>
    <div class="modal-title">Add Expense</div>
    <input class="input" id="sp-desc" placeholder="What was this for?">
    <input class="input" id="sp-amount" type="number" placeholder="Total amount (₹)" min="0" oninput="renderSplitRows(${gid})">
    <div style="margin-bottom:8px"><label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Paid by</label>
      <select class="input" id="sp-paidby" style="margin-bottom:0">${g.members.map(mid=>`<option value="${mid}">${mName(mid)}</option>`).join('')}</select></div>
    <div style="margin-bottom:10px"><label style="font-size:12px;color:var(--text3);display:block;margin-bottom:6px">Split type</label>
      <div style="display:flex;gap:12px">
        <label style="font-size:13px;cursor:pointer;display:flex;align-items:center;gap:5px"><input type="radio" name="sp-split" value="equal" checked onchange="renderSplitRows(${gid})"> Equal</label>
        <label style="font-size:13px;cursor:pointer;display:flex;align-items:center;gap:5px"><input type="radio" name="sp-split" value="percent" onchange="renderSplitRows(${gid})"> Percentage</label>
      </div></div>
    <div id="sp-rows"></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-primary" onclick="addSplit(${gid})">Add Expense</button>
      <button class="btn btn-ghost" onclick="closeSplitModal()">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  renderSplitRows(gid);
}
function closeSplitModal(){document.getElementById('split-modal')?.remove();}

function renderSplitRows(gid){
  const g=groups.find(x=>x.id===gid);if(!g)return;
  const total=parseFloat(document.getElementById('sp-amount')?.value)||0;
  const type=document.querySelector('input[name="sp-split"]:checked')?.value||'equal';
  const perHead=g.members.length>0?Math.round(total/g.members.length*100)/100:0;
  const rows=document.getElementById('sp-rows');if(!rows)return;
  rows.innerHTML=`<div class="card-title" style="margin-top:4px">Split breakdown</div>`+
    g.members.map(mid=>`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--warm2)">
      <span style="flex:1;font-size:13px">${mName(mid)}</span>
      ${type==='equal'
        ?`<span style="font-size:13px;font-weight:600">₹${fmt(perHead)}</span><input type="hidden" class="sp-share" data-mid="${mid}" value="${perHead}">`
        :`<input class="input sp-share" data-mid="${mid}" type="number" placeholder="%" style="width:80px;margin-bottom:0;padding:6px 8px;font-size:13px">`}
    </div>`).join('');
}

async function addSplit(gid){
  const g=groups.find(x=>x.id===gid);if(!g)return;
  const desc=(document.getElementById('sp-desc').value||'').trim();
  const total=parseFloat(document.getElementById('sp-amount').value);
  const paidByRaw=document.getElementById('sp-paidby').value;
  const paidBy=isNaN(Number(paidByRaw))?paidByRaw:Number(paidByRaw);
  const type=document.querySelector('input[name="sp-split"]:checked')?.value||'equal';
  if(!desc||isNaN(total)||total<=0){alert('Please fill in description and amount.');return;}
  const shareInputs=document.querySelectorAll('.sp-share');
  let members=[];
  if(type==='equal'){
    const share=Math.round(total/g.members.length*100)/100;
    members=g.members.map(mid=>{const fid=isNaN(Number(mid))?mid:Number(mid);return{friendId:fid,share,paid:String(fid)===String(paidBy)};});
  } else {
    let totalPct=0;
    shareInputs.forEach(inp=>{totalPct+=parseFloat(inp.value)||0;});
    if(Math.abs(totalPct-100)>1){alert('Percentages must add up to 100%.');return;}
    shareInputs.forEach(inp=>{
      const pct=parseFloat(inp.value)||0;
      const mid=inp.dataset.mid;
      const fid=isNaN(Number(mid))?mid:Number(mid);
      members.push({friendId:fid,share:Math.round(total*pct/100*100)/100,paid:String(fid)===String(paidBy)});
    });
  }
  const newSplit={id:uid(),groupId:gid,desc,totalAmount:total,paidBy,date:todayKey(),members,splitType:type};
  splits.push(newSplit);
  persist(); closeSplitModal(); renderGroupDetail(gid);

  // Push updated splits to every group member's Firestore document
  const grp = groups.find(x=>x.id===gid);
  if(grp && window._fb){
    const {db, doc, getDoc, setDoc} = window._fb;
    const u = window.currentUser||currentUser;
    const groupSplits = splits.filter(s=>s.groupId===gid);
    const memberUids  = grp.memberUids || [];
    for(const memberUid of memberUids){
      if(memberUid===u?.uid) continue;
      try{
        const snap = await getDoc(doc(db,'users',memberUid));
        const data = snap.exists() ? snap.data() : {};
        // Replace or add splits for this group
        const otherSplits = (data.splits||[]).filter(s=>String(s.groupId)!==String(gid));
        await setDoc(doc(db,'users',memberUid),{splits:[...otherSplits,...groupSplits]},{merge:true});
      }catch(e){console.warn('addSplit push to member',memberUid,e);}
    }
  }
}

// ── SETTLE UP ───────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
// UPI SETTLE UP SYSTEM
// ════════════════════════════════════════════════════════════════════════════

// ── State ──────────────────────────────────────────────────────────────────
let myUpiId       = load('lf3_my_upi', '');
let friendUpiIds  = load('lf3_friend_upi_ids', {});  // { friendId: upiId }
let paymentReqs   = load('lf3_payment_reqs', []);    // [{id,friendId,amount,sentAt,status,upiRef}]
let openSettleId  = null;  // which friend card is expanded

const UPI_COLORS = ['#4285F4','#5f259f','#002970','#3D5C42','#B8845A','#B85A4A'];

function saveMyUpiId(){
  const val = (document.getElementById('my-upi-id-input')?.value||'').trim();
  if(!val){ showToast('Please enter your UPI ID.'); return; }
  if(!isValidUpiId(val)){
    showToast('Invalid UPI ID. Format: name@bank (e.g. vivek@okicici)');
    return;
  }
  myUpiId = val;
  save('lf3_my_upi', myUpiId);
  // Sync to Firestore so friends can see your UPI ID
  syncMyUpiToFirestore();
  showToast('UPI ID saved: ' + myUpiId);
}

function isValidUpiId(id){
  return /^[a-zA-Z0-9.\-_]{3,}@[a-zA-Z]{3,}$/.test(id);
}

async function syncMyUpiToFirestore(){
  const u = window.currentUser||currentUser;
  if(!u||!u.uid||!window._fb) return;
  const {db,doc,setDoc} = window._fb;
  try{
    await setDoc(doc(db,'user_upi',u.uid), {upiId:myUpiId, name:u.name, uid:u.uid, updatedAt:Date.now()}, {merge:true});
  }catch(e){console.warn('syncUpi error:',e);}
}

async function fetchFriendUpiId(friendId){
  const f = friends.find(x=>String(x.id)===String(friendId));
  if(!f) return null;
  // Already cached?
  if(friendUpiIds[String(friendId)]) return friendUpiIds[String(friendId)];
  // Try Firestore lookup by fromUid
  if(f.fromUid && window._fb){
    const {db,doc,getDoc} = window._fb;
    try{
      const snap = await getDoc(doc(db,'user_upi',f.fromUid));
      if(snap.exists()){
        const upiId = snap.data().upiId;
        friendUpiIds[String(friendId)] = upiId;
        save('lf3_friend_upi_ids', friendUpiIds);
        return upiId;
      }
    }catch(e){console.warn('fetchFriendUpi:',e);}
  }
  return null;
}

// ── Compute net balances ─────────────────────────────────────────────────────
function computeSettleNet(){
  const net={};
  splits.forEach(sp=>{
    sp.members.forEach(m=>{
      if(m.paid) return;
      const fid=String(m.friendId);
      if(fid==='me') return;
      if(!net[fid]) net[fid]=0;
      if(String(sp.paidBy)==='me') net[fid]+=m.share;
      else if(String(sp.paidBy)===fid){
        const myM=sp.members.find(x=>String(x.friendId)==='me');
        if(myM&&!myM.paid) net[fid]-=myM.share;
      }
    });
  });
  return net;
}

// ── Init: pre-fill saved UPI ID ─────────────────────────────────────────────
function initSettlePanel(){
  const inp = document.getElementById('my-upi-id-input');
  if(inp && myUpiId) inp.value = myUpiId;
}

// ── Main render ──────────────────────────────────────────────────────────────
function renderSettle(){
  initSettlePanel();
  const net     = computeSettleNet();
  const entries = Object.entries(net).filter(([,v])=>Math.abs(v)>0.01);
  const ssEl    = document.getElementById('settle-summary');
  if(!ssEl) return;

  if(entries.length===0){
    ssEl.innerHTML='<div class="empty"><div class="empty-icon">🎉</div><div style="font-size:16px;font-weight:500;color:var(--sage-dark);margin-bottom:4px">All settled up!</div><div>No outstanding balances with any friend.</div></div>';
    return;
  }

  ssEl.innerHTML = entries.map(([fid,bal])=>{
    const name     = mName(Number(fid));
    const isOwed   = bal > 0;  // friend owes me
    const absBal   = Math.round(Math.abs(bal)*100)/100;
    const colorIdx = parseInt(fid) % UPI_COLORS.length;
    const color    = UPI_COLORS[Math.abs(colorIdx)||0];
    const isOpen   = openSettleId === fid;
    const pendingReqs = paymentReqs.filter(r=>String(r.friendId)===fid && r.status==='pending');
    const hasReq   = pendingReqs.length > 0;

    return `<div class="settle-card" id="settle-card-${fid}">
      <div class="settle-card-head" onclick="toggleSettleCard('${fid}')">
        <div class="settle-avatar" style="background:${color}">${name[0].toUpperCase()}</div>
        <div class="settle-info">
          <div class="settle-name">${name}</div>
          <div class="settle-subtitle">
            ${isOwed ? 'Owes you' : 'You owe'}
            ${hasReq ? ' · <span style="color:#DEB300;font-weight:500">⏳ Payment requested</span>' : ''}
          </div>
        </div>
        <span class="settle-amount-badge ${isOwed?'owed':'owes'}">
          ${isOwed?'+':'-'}₹${fmt(absBal)}
        </span>
        <span class="settle-chevron ${isOpen?'open':''}">▼</span>
      </div>

      <div class="settle-body ${isOpen?'open':''}" id="settle-body-${fid}">

        ${isOwed
          ? renderRequestMoneyPanel(fid, name, absBal)
          : renderPayPanel(fid, name, absBal)
        }

        ${renderPaymentHistory(fid)}

        <div style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--warm2)">
          <button class="btn btn-primary btn-sm" onclick="markFullySettled('${fid}')">✓ Mark as Fully Settled</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Request money panel (when friend owes you) ───────────────────────────────
function renderRequestMoneyPanel(fid, name, owedAmt){
  const savedUpi = friendUpiIds[String(fid)] || '';
  return `<div class="upi-panel">
    <div class="upi-panel-title">Request ₹${fmt(owedAmt)} from ${name}</div>
    <div class="upi-id-row">
      <input class="upi-id-input" id="friend-upi-${fid}" value="${savedUpi}"
        placeholder="${name}'s UPI ID (e.g. friend@okicici)"
        oninput="saveFriendUpiCache('${fid}',this.value)">
    </div>
    <div class="upi-amount-row">
      <span style="font-size:15px;color:var(--text3);padding:0 4px">₹</span>
      <input class="upi-amount-input" id="req-amount-${fid}" type="number" value="${owedAmt}" min="1" max="1000000" placeholder="Amount">
      <button class="upi-full-btn" onclick="document.getElementById('req-amount-${fid}').value='${owedAmt}'">Full amount</button>
    </div>
    <div class="upi-action-btns">
      <button class="upi-pay-btn gpay" onclick="sendUpiRequest('${fid}','${name}',false,'gpay')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm-1.1 16.9H8.8V7.2h2.1v9.7zm4.4 0h-2.1V7.2h2.1v9.7z"/></svg>
        GPay Request
      </button>
      <button class="upi-pay-btn phonepe" onclick="sendUpiRequest('${fid}','${name}',false,'phonepe')">PhonePe</button>
      <button class="upi-pay-btn upi" onclick="sendUpiRequest('${fid}','${name}',false,'upi')">Any UPI App</button>
    </div>
    <div class="upi-note">
      A UPI deep link will open for ${name} to pay you. Once they pay, click "Mark Paid" or it auto-settles when you confirm receipt.
    </div>
  </div>`;
}

// ── Pay panel (when you owe friend) ─────────────────────────────────────────
function renderPayPanel(fid, name, oweAmt){
  const savedUpi = friendUpiIds[String(fid)] || '';
  return `<div class="upi-panel">
    <div class="upi-panel-title">Pay ₹${fmt(oweAmt)} to ${name}</div>
    <div class="upi-id-row">
      <input class="upi-id-input" id="friend-upi-${fid}" value="${savedUpi}"
        placeholder="${name}'s UPI ID (e.g. friend@okicici)"
        oninput="saveFriendUpiCache('${fid}',this.value)">
    </div>
    <div class="upi-amount-row">
      <span style="font-size:15px;color:var(--text3);padding:0 4px">₹</span>
      <input class="upi-amount-input" id="req-amount-${fid}" type="number" value="${oweAmt}" min="1" placeholder="Amount">
      <button class="upi-full-btn" onclick="document.getElementById('req-amount-${fid}').value='${oweAmt}'">Full amount</button>
    </div>
    <div class="upi-action-btns">
      <button class="upi-pay-btn gpay" onclick="openUpiPayment('${fid}','${name}','gpay')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Pay via GPay
      </button>
      <button class="upi-pay-btn phonepe" onclick="openUpiPayment('${fid}','${name}','phonepe')">PhonePe</button>
      <button class="upi-pay-btn paytm"   onclick="openUpiPayment('${fid}','${name}','paytm')">Paytm</button>
      <button class="upi-pay-btn upi"     onclick="openUpiPayment('${fid}','${name}','upi')">Any UPI</button>
    </div>
    <div class="upi-note">Opens your UPI app to pay ${name}. After paying, come back and click "Mark Paid" or your friend can confirm receipt.</div>
  </div>`;
}

// ── Payment history for a friend ─────────────────────────────────────────────
function renderPaymentHistory(fid){
  const reqs = paymentReqs.filter(r=>String(r.friendId)===fid).slice().reverse();
  if(reqs.length===0) return '';
  return `<div style="margin-top:10px">
    <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Payment Requests</div>
    ${reqs.slice(0,5).map(r=>{
      const d=new Date(r.sentAt);
      const timeStr=d.toLocaleDateString('en-IN',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
      const statusDot = `<div class="req-status-dot ${r.status}"></div>`;
      const statusLabel = r.status==='paid'
        ?'<span style="font-size:11px;color:var(--sage-dark);font-weight:500">✓ Paid</span>'
        :r.status==='cancelled'
        ?'<span style="font-size:11px;color:var(--text3)">Cancelled</span>'
        :`<div style="display:flex;gap:6px">
            <button class="req-mark-btn mark-paid" onclick="markReqPaid('${r.id}','${fid}')">Mark Paid</button>
            <button class="req-mark-btn cancel" onclick="cancelReq('${r.id}')">Cancel</button>
          </div>`;
      return `<div class="payment-req-row">
        ${statusDot}
        <div style="flex:1">
          <div class="req-amount">₹${fmt(r.amount)}</div>
          <div class="req-time">${timeStr} · ${r.app||'UPI'} · ${r.type==='request'?'Requested':'Paid'}</div>
        </div>
        ${statusLabel}
      </div>`;
    }).join('')}
  </div>`;
}

// ── Toggle card expand ────────────────────────────────────────────────────────
function toggleSettleCard(fid){
  openSettleId = openSettleId===fid ? null : fid;
  renderSettle();
  // Fetch friend's UPI ID from Firestore asynchronously when card opens
  if(openSettleId===fid) fetchFriendUpiId(fid).then(upiId=>{
    if(upiId){
      const inp=document.getElementById('friend-upi-'+fid);
      if(inp && !inp.value) inp.value=upiId;
    }
  });
}

function saveFriendUpiCache(fid, val){
  friendUpiIds[String(fid)] = val.trim();
  save('lf3_friend_upi_ids', friendUpiIds);
}

// ── Build UPI deep links ──────────────────────────────────────────────────────
function buildUpiUrl(upiId, amount, name, note, app){
  const base = 'upi://pay?pa=' + encodeURIComponent(upiId)
    + '&pn=' + encodeURIComponent(name)
    + '&am=' + encodeURIComponent(amount)
    + '&cu=INR'
    + '&tn=' + encodeURIComponent(note || 'LifeFlow settle up');
  if(app==='gpay')    return 'tez://upi/pay?pa='+encodeURIComponent(upiId)+'&pn='+encodeURIComponent(name)+'&am='+amount+'&cu=INR&tn='+encodeURIComponent(note||'LifeFlow');
  if(app==='phonepe') return 'phonepe://pay?pa='+encodeURIComponent(upiId)+'&pn='+encodeURIComponent(name)+'&am='+amount+'&cu=INR&tn='+encodeURIComponent(note||'LifeFlow');
  if(app==='paytm')   return 'paytmmp://pay?pa='+encodeURIComponent(upiId)+'&pn='+encodeURIComponent(name)+'&am='+amount+'&cu=INR&tn='+encodeURIComponent(note||'LifeFlow');
  return base;
}

// ── Open UPI payment (you pay friend) ────────────────────────────────────────
function openUpiPayment(fid, friendName, app){
  const upiId = (document.getElementById('friend-upi-'+fid)?.value||'').trim();
  const amtRaw = parseFloat(document.getElementById('req-amount-'+fid)?.value||0);
  if(!upiId){ showToast('Please enter ' + friendName + "'s UPI ID first."); return; }
  if(!isValidUpiId(upiId)){ showToast('Invalid UPI ID format. Use: name@bank'); return; }
  if(isNaN(amtRaw)||amtRaw<=0){ showToast('Please enter a valid amount.'); return; }
  saveFriendUpiCache(fid, upiId);

  const amount = Math.round(amtRaw*100)/100;
  const u = window.currentUser||currentUser;
  const note = 'LifeFlow: ' + (u?u.name:'You') + ' paying ' + friendName;
  const deepLink = buildUpiUrl(upiId, amount, friendName, note, app);

  // Log payment attempt
  const reqId = String(uid());
  paymentReqs.push({id:reqId, friendId:String(fid), amount, sentAt:Date.now(), status:'pending', app, type:'payment', upiId});
  save('lf3_payment_reqs', paymentReqs);
  syncPaymentReqToFirestore(reqId, fid, amount, 'payment', app);

  // Open UPI deep link
  const opened = tryOpenUpiDeepLink(deepLink, amount, friendName, app);
  if(opened){
    showToast('Opening ' + getAppName(app) + '... After paying, mark as paid here.');
    renderSettle();
  }
}

// ── Send money request (friend owes you) ─────────────────────────────────────
function sendUpiRequest(fid, friendName, isOwed, app){
  const friendUpi = (document.getElementById('friend-upi-'+fid)?.value||'').trim();
  const amtRaw    = parseFloat(document.getElementById('req-amount-'+fid)?.value||0);
  if(isNaN(amtRaw)||amtRaw<=0){ showToast('Please enter a valid amount.'); return; }

  const amount = Math.round(amtRaw*100)/100;
  const u = window.currentUser||currentUser;
  const myUpi = myUpiId;

  if(!myUpi){ showToast('Please save your UPI ID at the top of this page first.'); return; }

  saveFriendUpiCache(fid, friendUpi);

  // Log request
  const reqId = String(uid());
  paymentReqs.push({id:reqId, friendId:String(fid), amount, sentAt:Date.now(), status:'pending', app, type:'request', upiId:myUpi});
  save('lf3_payment_reqs', paymentReqs);
  syncPaymentReqToFirestore(reqId, fid, amount, 'request', app);

  // Build collect request link (payer opens this to pay you)
  const note = 'LifeFlow: ' + friendName + ' owes ' + (u?u.name:'You');
  // UPI collect: pa = YOUR UPI (you receive), amount, note
  const deepLink = buildUpiUrl(myUpi, amount, u?u.name:'Me', note, app);

  const opened = tryOpenUpiDeepLink(deepLink, amount, friendName, app);
  renderSettle();

  if(opened){
    showToast('Payment request sent to ' + friendName + ' via ' + getAppName(app) + '! Mark paid once received.');
  } else {
    // Show manual instructions
    showUpiManualModal(fid, friendName, amount, myUpi, reqId);
  }
}

function getAppName(app){
  return {gpay:'Google Pay', phonepe:'PhonePe', paytm:'Paytm', upi:'UPI'}[app]||'UPI';
}

function tryOpenUpiDeepLink(url, amount, name, app){
  try {
    // Try iframe trigger (works on Android browsers)
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'display:none;width:1px;height:1px;';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(()=>document.body.removeChild(iframe), 3000);
    // Also try window.location for direct app launch
    window.location.href = url;
    return true;
  } catch(e){ return false; }
}

// ── Manual UPI instructions modal ────────────────────────────────────────────
function showUpiManualModal(fid, friendName, amount, myUpiId, reqId){
  document.getElementById('upi-manual-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay'; modal.id = 'upi-manual-modal';
  modal.innerHTML = `<div class="modal" style="max-width:380px">
    <button class="modal-close" onclick="document.getElementById('upi-manual-modal').remove()">×</button>
    <div class="modal-title">Request ₹${fmt(amount)} from ${friendName}</div>
    <div style="background:var(--sage-light);border-radius:var(--r2);padding:14px;margin:12px 0;text-align:center">
      <div style="font-size:11px;color:var(--sage);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Your UPI ID</div>
      <div style="font-size:22px;font-weight:700;color:var(--sage-dark);letter-spacing:1px">${myUpiId}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">Amount: ₹${fmt(amount)}</div>
    </div>
    <div id="upi-qr-container" style="display:flex;justify-content:center;margin:8px 0;min-height:160px;align-items:center">
      <span style="color:var(--text3);font-size:13px">Generating QR...</span>
    </div>
    <div style="font-size:12px;color:var(--text3);line-height:1.5;margin-bottom:14px">
      Share your UPI ID or show this QR code to ${friendName}. Once they pay, click Mark Paid below.
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="markReqPaid('${reqId}','${fid}');document.getElementById('upi-manual-modal')?.remove()">✓ Mark as Paid</button>
      <button class="btn btn-ghost" onclick="document.getElementById('upi-manual-modal')?.remove()">Close</button>
    </div>
  </div>`;
  document.body.appendChild(modal);

  // Render QR code for the UPI ID
  setTimeout(()=>{
    const qrWrap = document.getElementById('upi-qr-container');
    if(!qrWrap) return;
    qrWrap.innerHTML = '';
    const upiUrl = 'upi://pay?pa='+encodeURIComponent(myUpiId)+'&pn=LifeFlow&am='+amount+'&cu=INR&tn='+encodeURIComponent('LifeFlow settle up');
    if(typeof QRCode !== 'undefined'){
      new QRCode(qrWrap,{text:upiUrl,width:160,height:160,colorDark:'#3D5C42',colorLight:'#FFFFFF',correctLevel:QRCode.CorrectLevel.M});
    } else {
      const img = document.createElement('img');
      img.src='https://chart.googleapis.com/chart?chs=160x160&cht=qr&chl='+encodeURIComponent(upiUrl)+'&choe=UTF-8';
      img.style.borderRadius='8px'; qrWrap.appendChild(img);
    }
  }, 100);
}

// ── Mark a payment request as paid ───────────────────────────────────────────
function markReqPaid(reqId, friendId){
  const req = paymentReqs.find(r=>r.id===String(reqId));
  if(req) req.status='paid';
  save('lf3_payment_reqs', paymentReqs);
  // Notify Firestore
  if(window._fb && window.currentUser){
    const {db,doc,setDoc} = window._fb;
    setDoc(doc(db,'payment_requests',String(reqId)),{status:'paid',paidAt:Date.now()},{merge:true}).catch(()=>{});
  }
  // Auto-settle the balance in splits
  autoSettleSplits(friendId);
  renderSettle();
  showToast('✅ Payment marked as received! Balance settled.');
}

function cancelReq(reqId){
  const req = paymentReqs.find(r=>r.id===String(reqId));
  if(req) req.status='cancelled';
  save('lf3_payment_reqs', paymentReqs);
  renderSettle();
  showToast('Request cancelled.');
}

// ── Auto-settle splits once payment is confirmed ──────────────────────────────
function autoSettleSplits(friendId){
  splits.forEach(sp=>{
    sp.members.forEach(m=>{
      if(String(m.friendId)===String(friendId) && String(sp.paidBy)==='me') m.paid=true;
      if(String(m.friendId)==='me' && String(sp.paidBy)===String(friendId)) m.paid=true;
    });
  });
  persistSpend();
}

// ── Mark fully settled (manual) ────────────────────────────────────────────
function markFullySettled(friendId){
  autoSettleSplits(friendId);
  renderSettle();
  const fname = mName(Number(friendId));
  showToast('✓ Settled up with ' + fname + '! Balance is now ₹0.');
}

// ── Sync payment request to Firestore for real-time status ──────────────────
function syncPaymentReqToFirestore(reqId, fid, amount, type, app){
  const u = window.currentUser||currentUser;
  if(!u||!window._fb) return;
  const {db,doc,setDoc} = window._fb;
  const f = friends.find(x=>String(x.id)===String(fid));
  setDoc(doc(db,'payment_requests',String(reqId)),{
    id:reqId, fromUid:u.uid, fromName:u.name,
    friendId:fid, friendUid:f?.fromUid||'',
    amount, type, app,
    status:'pending', sentAt:Date.now()
  }).catch(()=>{});
}

// ── Listen for payment status updates from Firestore ─────────────────────────
function startPaymentReqListener(){
  const u = window.currentUser||currentUser;
  if(!u||!u.uid||!window._fb) return;
  const {db,collection,query,where,onSnapshot} = window._fb;
  // Listen for requests where this user is the recipient (friend's payment to us)
  try {
    const q = query(collection(db,'payment_requests'),where('friendUid','==',u.uid),where('status','==','pending'));
    onSnapshot(q, snap=>{
      snap.docChanges().forEach(change=>{
        if(change.type==='modified'||change.type==='added'){
          const data = change.doc.data();
          if(data.status==='paid'){
            // Auto-settle
            const localReq = paymentReqs.find(r=>r.id===data.id);
            if(localReq && localReq.status!=='paid'){
              localReq.status='paid';
              save('lf3_payment_reqs',paymentReqs);
              autoSettleSplits(data.friendId);
              showToast('💸 ' + (data.fromName||'Friend') + ' paid you ₹' + fmt(data.amount) + '! Auto-settled.');
              if(currentPage==='spending' && spendTab==='settle') renderSettle();
            }
          }
        }
      });
    });
  }catch(e){console.warn('startPaymentReqListener:',e);}
}

// ── Legacy settleUp (kept for compatibility) ──────────────────────────────────
function settleUp(friendId){ markFullySettled(friendId); }



// ═══════════════════════════════════════════════════════════════════════════
// JOURNAL — PIN lock, editor, moods, tags, prompts, templates, search, streak
// ═══════════════════════════════════════════════════════════════════════════

// ── State ──────────────────────────────────────────────────────────────────
let journalEntries    = load('lf3_journal', []);
let journalPin        = load('lf3_jpin', null);       // hashed PIN or null
let journalUnlocked   = false;
let journalBiometric  = false;
let currentEntryId    = null;
let editorAutoSaveTimer = null;
let editorCurrentMood = '';
let editorCurrentTags = [];
let currentJournalFilter = 'all';
let pinInputBuffer    = '';
let pinSetupStage     = 0;    // 0=not setting, 1=enter new, 2=confirm
let pinSetupFirst     = '';

// ── Simple PIN hash (XOR fold, good enough for local storage) ─────────────
function hashPin(pin){
  let h=0;
  for(let i=0;i<pin.length;i++) h=(h*31+pin.charCodeAt(i))>>>0;
  return h.toString(36);
}

// ── Writing prompts ─────────────────────────────────────────────────────────
const PROMPTS = [
  'What made you smile today?',
  'What is one thing you are grateful for right now?',
  'Describe a challenge you faced and what you learned from it.',
  'What is something you want to remember about today?',
  'What would make tomorrow even better?',
  'Write about someone who inspired you recently.',
  'What fear did you face or want to face?',
  'What does your ideal day look like?',
  'What habit are you most proud of building?',
  'If today were the last page of a chapter, what would the title be?',
  'What is weighing on your mind? Write it out.',
  'Three things that went well today and why.',
  'What are you looking forward to this week?',
  'Describe a moment of peace you experienced recently.',
  'What does success mean to you right now?',
  'Write a letter to your future self.',
  'What boundary do you need to set or honour?',
  'What did you learn about yourself this week?',
  'Describe where you want to be in one year.',
  'What small act of kindness can you do tomorrow?',
];

// ── Templates ───────────────────────────────────────────────────────────────
const TEMPLATES = {
  'Morning Pages': '## Morning Pages\n\n**Date:** \n\n**How I feel right now:**\n\n**Three things on my mind:**\n1. \n2. \n3. \n\n**Intention for today:**\n\n',
  'Gratitude Log': '## Gratitude Log\n\nI am grateful for...\n1. \n2. \n3. \n\n**Something beautiful I noticed today:**\n\n**A person I appreciate:**\n\n',
  'Daily Reflection': '## Daily Reflection\n\n**What went well today:**\n\n**What was challenging:**\n\n**What I learned:**\n\n**Tomorrow I will:**\n\n',
  'Brain Dump': '## Brain Dump\n\nEverything on my mind right now...\n\n',
  'Weekly Review': '## Weekly Review\n\n**Wins this week:**\n\n**What I am proud of:**\n\n**What I want to improve:**\n\n**Focus for next week:**\n\n',
  'Travel Notes': '## Travel Notes\n\n**Location:**\n**Date:**\n\n**What I saw:**\n\n**What I ate:**\n\n**A memorable moment:**\n\n**How it made me feel:**\n\n',
};

const MOODS = [
  {emoji:'😄',label:'Happy'},
  {emoji:'😊',label:'Content'},
  {emoji:'😐',label:'Neutral'},
  {emoji:'😔',label:'Sad'},
  {emoji:'😤',label:'Frustrated'},
  {emoji:'😰',label:'Anxious'},
  {emoji:'🤩',label:'Excited'},
  {emoji:'😴',label:'Tired'},
  {emoji:'🥰',label:'Grateful'},
  {emoji:'💪',label:'Motivated'},
];

// ── Streak calculation ───────────────────────────────────────────────────────
function calcJournalStreak(){
  if(!journalEntries.length) return 0;
  const days = [...new Set(journalEntries.map(e=>e.dateKey))].sort().reverse();
  let streak=0, prev=null;
  for(const d of days){
    if(!prev){
      const today=todayKey();
      const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
      const yKey=yesterday.getFullYear()+'-'+(yesterday.getMonth()+1)+'-'+yesterday.getDate();
      if(d!==today&&d!==yKey) break;
      streak=1; prev=d;
    } else {
      const prevDate=new Date(prev.split('-').join('/'));
      prevDate.setDate(prevDate.getDate()-1);
      const expected=prevDate.getFullYear()+'-'+(prevDate.getMonth()+1)+'-'+prevDate.getDate();
      if(d===expected){streak++;prev=d;}
      else break;
    }
  }
  return streak;
}

// ── Main journal page render ─────────────────────────────────────────────────
function renderJournalPage(){
  const lockEl = document.getElementById('journal-lock-screen');
  const mainEl = document.getElementById('journal-main');
  if(!lockEl || !mainEl) return;
  if(!journalUnlocked){
    mainEl.style.display='none';
    renderJournalLock();
  } else {
    lockEl.innerHTML='';
    mainEl.style.display='block';
    renderJournalStats();
    renderJournalMoodFilters();
    renderJournalList();
  }
}

// ── Stats bar ────────────────────────────────────────────────────────────────
function renderJournalStats(){
  const streak=calcJournalStreak();
  const total=journalEntries.length;
  const thisMonth=journalEntries.filter(e=>{
    const d=new Date(e.date);
    const n=new Date();
    return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();
  }).length;
  const totalWords=journalEntries.reduce((a,e)=>a+countWords(e.body),0);
  const el=document.getElementById('journal-stats-row');
  if(el) el.innerHTML=`
    <div class="journal-stat"><div class="journal-stat-val">${total}</div><div class="journal-stat-lbl">Total Entries</div></div>
    <div class="journal-stat"><div class="journal-stat-val">${streak}</div><div class="journal-stat-lbl">Day Streak 🔥</div></div>
    <div class="journal-stat"><div class="journal-stat-val">${thisMonth}</div><div class="journal-stat-lbl">This Month</div></div>
    <div class="journal-stat"><div class="journal-stat-val">${totalWords>999?Math.round(totalWords/1000)+'k':totalWords}</div><div class="journal-stat-lbl">Words Written</div></div>`;
  const badge=document.getElementById('journal-streak-badge');
  if(badge){
    if(streak>0){badge.textContent='🔥 '+streak+' day streak';badge.style.display='inline';}
    else badge.style.display='none';
  }
}

// ── Mood filters ─────────────────────────────────────────────────────────────
function renderJournalMoodFilters(){
  const usedMoods=[...new Set(journalEntries.map(e=>e.mood).filter(Boolean))];
  const el=document.getElementById('journal-mood-filters');
  if(!el)return;
  el.innerHTML=['all',...usedMoods].map(m=>`
    <button class="journal-chip ${currentJournalFilter===m?'active':''}" onclick="setJournalFilter('${m}')">
      ${m==='all'?'All entries':m}
    </button>`).join('');
}

function setJournalFilter(f){currentJournalFilter=f;renderJournalList();renderJournalMoodFilters();}

// ── Entry list ────────────────────────────────────────────────────────────────
function renderJournalList(){
  const q=(document.getElementById('journal-search')?.value||'').toLowerCase();
  let entries=[...journalEntries].sort((a,b)=>b.date-a.date);
  if(currentJournalFilter!=='all') entries=entries.filter(e=>e.mood===currentJournalFilter);
  if(q) entries=entries.filter(e=>(e.title+e.body+(e.tags||[]).join(' ')).toLowerCase().includes(q));
  const el=document.getElementById('journal-list-grid');
  if(!el)return;
  if(entries.length===0){
    el.innerHTML=`<div class="journal-empty">
      <div class="journal-empty-icon">📔</div>
      <div class="journal-empty-title">${q?'No entries found':'Start your journey'}</div>
      <div style="font-size:13px;color:var(--text3);margin:6px 0 16px">${q?'Try a different search term':'Your first entry is waiting to be written'}</div>
      ${!q?'<button class="new-entry-btn" onclick="openJournalEditor(null)">✦ Write first entry</button>':''}
    </div>`;
    return;
  }
  el.innerHTML=`<div class="journal-grid">${entries.map(e=>{
    const d=new Date(e.date);
    const dateStr=d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
    const preview=e.body.replace(/^#{1,3}\s/gm,'').replace(/\*\*/g,'').replace(/\*/g,'').slice(0,120);
    return `<div class="journal-card" onclick="openJournalEditor(${e.id})">
      <button class="journal-card-del" onclick="event.stopPropagation();deleteJournalEntry(${e.id})" title="Delete">×</button>
      <div class="journal-card-date">
        ${e.mood?`<span>${e.mood}</span>`:''}
        <span>${dateStr}</span>
        ${e.category?`<span class="tag-pill">${e.category}</span>`:''}
      </div>
      <div class="journal-card-title">${e.title||'Untitled entry'}</div>
      <div class="journal-card-preview">${preview}</div>
      <div class="journal-card-footer">
        ${(e.tags||[]).slice(0,3).map(t=>`<span class="tag-pill">#${t}</span>`).join('')}
        <span class="word-count">${countWords(e.body)} words</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function countWords(text){ return (text||'').trim().split(/\s+/).filter(Boolean).length; }

// ── Open / close editor ───────────────────────────────────────────────────────
function openJournalEditor(id){
  currentEntryId=id;
  const existing=id?journalEntries.find(e=>e.id===id):null;
  const ed=document.getElementById('journal-editor');
  if(ed){ ed.style.display='flex'; ed.classList.add('visible'); }
  document.getElementById('editor-date-lbl').textContent=
    new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  document.getElementById('editor-title-in').value=existing?existing.title:'';
  document.getElementById('editor-title-in').placeholder=defaultEntryTitle();
  document.getElementById('editor-body-ta').value=existing?existing.body:'';
  document.getElementById('editor-tags-in').value=existing?(existing.tags||[]).join(', '):'';
  const catEl=document.getElementById('editor-cat-in');
  if(catEl) catEl.value=existing?existing.category||'Personal':'Personal';
  editorCurrentMood=existing?existing.mood||'':'';
  editorCurrentTags=existing?existing.tags||[]:[];
  renderEditorMoodSelect();
  updateWordCount();
  // Show prompt for new entries
  const pbar=document.getElementById('editor-prompt-bar');
  const trow=document.getElementById('editor-template-row');
  if(!existing){
    if(pbar){pbar.style.display='flex';refreshPrompt();}
    if(trow){trow.style.display='flex';renderTemplateRow();}
  } else {
    if(pbar)pbar.style.display='none';
    if(trow)trow.style.display='none';
  }
  setTimeout(()=>document.getElementById('editor-body-ta')?.focus(),100);
}

function closeJournalEditor(){
  // Save anything typed (even a single word) before going back
  // If body is empty, just closes silently — no entry created
  _doSave(true);         // silent=true — saves if content exists, no-ops if empty
  _hideEditor();         // always hides the editor
  renderJournalPage();   // always returns to list
}

// ── Mood select ─────────────────────────────────────────────────────────────
function renderEditorMoodSelect(){
  const el=document.getElementById('editor-mood-select');
  if(!el)return;
  el.innerHTML=MOODS.map(m=>`
    <span class="mood-opt ${editorCurrentMood===m.emoji?'selected':''}"
      title="${m.label}" onclick="selectMood('${m.emoji}')">${m.emoji}</span>`).join('');
}

function selectMood(emoji){
  editorCurrentMood=editorCurrentMood===emoji?'':emoji;
  renderEditorMoodSelect();
}

// ── Prompts & Templates ─────────────────────────────────────────────────────
function refreshPrompt(){
  const p=PROMPTS[Math.floor(Math.random()*PROMPTS.length)];
  const el=document.getElementById('editor-prompt-text');
  if(el)el.textContent=p;
}
function renderTemplateRow(){
  const el=document.getElementById('editor-template-row');
  if(!el)return;
  el.innerHTML=Object.keys(TEMPLATES).map(k=>
    `<button class="template-pill" onclick="applyTemplate('${k}')">${k}</button>`).join('');
}
function applyTemplate(name){
  const ta=document.getElementById('editor-body-ta');
  if(ta){ta.value=TEMPLATES[name];updateWordCount();}
  const pbar=document.getElementById('editor-prompt-bar');
  const trow=document.getElementById('editor-template-row');
  if(pbar)pbar.style.display='none';
  if(trow)trow.style.display='none';
  ta?.focus();
}

// ── Format bar ─────────────────────────────────────────────────────────────
function insertFmt(type){
  const ta=document.getElementById('editor-body-ta');
  if(!ta)return;
  const start=ta.selectionStart, end=ta.selectionEnd;
  const sel=ta.value.slice(start,end);
  const before=ta.value.slice(0,start), after=ta.value.slice(end);
  let insert='', cursorOffset=0;
  switch(type){
    case 'bold':    insert=sel?'**'+sel+'**':'**bold text**'; cursorOffset=sel?0:2; break;
    case 'italic':  insert=sel?'*'+sel+'*':'*italic text*';  cursorOffset=sel?0:1; break;
    case 'h1':      insert='\n# '+(sel||'Heading 1')+'\n'; break;
    case 'h2':      insert='\n## '+(sel||'Heading 2')+'\n'; break;
    case 'bullet':  insert='\n- '+(sel||'item')+'\n'; break;
    case 'divider': insert='\n\n---\n\n'; break;
    case 'quote':   insert='\n> '+(sel||'Quote here')+'\n'; break;
    case 'checkbox':insert='\n- [ ] '+(sel||'Task')+'\n'; break;
  }
  ta.value=before+insert+after;
  const pos=start+insert.length-cursorOffset;
  ta.setSelectionRange(pos,pos);
  ta.focus();
  updateWordCount();
}

// ── Word count + autosave ──────────────────────────────────────────────────
function updateWordCount(){
  const ta=document.getElementById('editor-body-ta');
  const wc=countWords(ta?ta.value:'');
  const el=document.getElementById('editor-wc');
  if(el)el.textContent=wc+' word'+(wc===1?'':'s');
}
function onEditorInput(){
  updateWordCount();
  clearTimeout(editorAutoSaveTimer);
  const lbl=document.getElementById('editor-autosave-lbl');
  if(lbl)lbl.textContent='';
  editorAutoSaveTimer=setTimeout(()=>{
    _doSave(true);
    const lbl2=document.getElementById('editor-autosave-lbl');
    if(lbl2)lbl2.textContent='Autosaved';
    setTimeout(()=>{const el=document.getElementById('editor-autosave-lbl');if(el)el.textContent='';},2000);
  },1500);
}

// ── Default title helper ────────────────────────────────────────────────────
function defaultEntryTitle(){
  return new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

// ── Core save — always updates existing entry if currentEntryId is set ──────
function _doSave(silent){
  const bodyEl = document.getElementById('editor-body-ta');
  const titleEl = document.getElementById('editor-title-in');
  const tagsEl  = document.getElementById('editor-tags-in');
  const catEl   = document.getElementById('editor-cat-in');

  const body     = (bodyEl  ? bodyEl.value  : '');
  const tagsRaw  = (tagsEl  ? tagsEl.value  : '');
  const category = (catEl   ? catEl.value   : 'Personal');
  const tags     = tagsRaw.split(',').map(t=>t.trim()).filter(Boolean);

  // Fix 2: Default title = today's date if left blank
  let title = (titleEl ? titleEl.value.trim() : '');
  if(!title) title = defaultEntryTitle();

  // Even if body is empty, still close — but only persist if there's content
  const hasContent = body.trim().length > 0;

  if(hasContent){
    // Fix 3: Use String comparison for ID matching — prevents type mismatch
    const existingIdx = currentEntryId !== null
      ? journalEntries.findIndex(e=>String(e.id)===String(currentEntryId))
      : -1;

    if(existingIdx >= 0){
      // UPDATE existing entry — never create a duplicate
      journalEntries[existingIdx] = {
        ...journalEntries[existingIdx],
        title, body, tags,
        mood: editorCurrentMood,
        category,
        updatedAt: Date.now()
      };
    } else {
      // CREATE new entry (only when currentEntryId is null, i.e. from "New Entry" button)
      const newId = uid();
      const newEntry = {
        id: newId, title, body, tags,
        mood: editorCurrentMood, category,
        date: Date.now(), dateKey: todayKey(),
        createdAt: Date.now(), updatedAt: Date.now()
      };
      journalEntries.unshift(newEntry);
      currentEntryId = newId; // track so autosave updates, not duplicates
    }
    saveJournalLocal();
  }

  if(!silent){
    _hideEditor();
    renderJournalPage();
    if(hasContent) showToast('Entry saved!');
  }
}

function _hideEditor(){
  clearTimeout(editorAutoSaveTimer);
  const ed = document.getElementById('journal-editor');
  if(ed){ ed.style.display='none'; ed.classList.remove('visible'); }
  currentEntryId = null;
}

function autoSaveJournalEntry(){ _doSave(true); }

// Public save — called by Save button
function saveJournalEntry(silent){ _doSave(silent===true); }

function saveJournalLocal(){
  save('lf3_journal',journalEntries);
  if(window._saveToFirestore) window._saveToFirestore();
}

function deleteJournalEntry(id){
  if(!confirm('Delete this entry? This cannot be undone.'))return;
  journalEntries=journalEntries.filter(e=>e.id!==id);
  saveJournalLocal();
  renderJournalPage();
}

// ═══════════════════════════════════════════════════════════════════════════
// PIN LOCK SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
function renderJournalLock(){
  const el=document.getElementById('journal-lock-screen');
  if(!el)return;
  if(!journalPin){
    // No PIN set — offer to set one or skip
    el.innerHTML=`<div class="journal-lock">
      <div class="lock-icon">📔</div>
      <div class="lock-title">Your Private Journal</div>
      <div class="lock-sub">Set a PIN to protect your entries, or skip to access directly.</div>
      <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;justify-content:center">
        <button class="btn btn-primary" onclick="startPinSetup()">Set PIN</button>
        <button class="btn btn-ghost" onclick="unlockJournalDirect()">Skip — Access directly</button>
      </div>
    </div>`;
  } else {
    // PIN is set — show keypad
    renderPinKeypad('');
  }
}

function unlockJournalDirect(){
  journalUnlocked=true;
  renderJournalPage();
}

// ── PIN Keypad ─────────────────────────────────────────────────────────────
function renderPinKeypad(errorMsg){
  pinInputBuffer='';
  const el=document.getElementById('journal-lock-screen');
  if(!el)return;
  el.innerHTML=`<div class="journal-lock">
    <div class="lock-icon">🔐</div>
    <div class="lock-title">Enter PIN</div>
    <div class="lock-sub">Enter your 4-digit PIN to access your journal</div>
    <div class="pin-dots" id="pin-dots">
      <div class="pin-dot" id="pd0"></div>
      <div class="pin-dot" id="pd1"></div>
      <div class="pin-dot" id="pd2"></div>
      <div class="pin-dot" id="pd3"></div>
    </div>
    ${errorMsg?`<div class="pin-error">${errorMsg}</div>`:'<div style="height:20px"></div>'}
    <div class="pin-keypad">
      ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>`
        <button class="pin-key ${k===''?'':''}${k==='⌫'?'del-key':''}"
          onclick="${k===''?'':k==='⌫'?'pinBackspace()':'pinPress('+k+')'}"
          ${k===''?'style="visibility:hidden"':''}>
          ${k}
        </button>`).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;justify-content:center">
      <button class="btn btn-ghost btn-sm" onclick="forgotPin()">Forgot PIN?</button>
    </div>
  </div>`;
}

function updatePinDots(){
  for(let i=0;i<4;i++){
    const dot=document.getElementById('pd'+i);
    if(dot)dot.className='pin-dot'+(i<pinInputBuffer.length?' filled':'');
  }
}

function pinPress(digit){
  if(pinInputBuffer.length>=4)return;
  pinInputBuffer+=digit;
  updatePinDots();
  if(pinInputBuffer.length===4){
    setTimeout(()=>{
      if(pinSetupStage===1){
        pinSetupFirst=pinInputBuffer;
        pinInputBuffer='';
        pinSetupStage=2;
        renderPinSetupConfirm();
      } else if(pinSetupStage===2){
        if(hashPin(pinInputBuffer)===hashPin(pinSetupFirst)){
          journalPin=hashPin(pinInputBuffer);
          save('lf3_jpin',journalPin);
          pinSetupStage=0;
          journalUnlocked=true;
          showToast('PIN set successfully!');
          renderJournalPage();
        } else {
          pinSetupStage=1;
          pinSetupFirst='';
          pinInputBuffer='';
          renderPinSetupFirst('PINs did not match. Try again.');
        }
      } else {
        // Normal unlock
        if(hashPin(pinInputBuffer)===journalPin){
          journalUnlocked=true;
          renderJournalPage();
        } else {
          renderPinKeypad('Incorrect PIN. Try again.');
        }
      }
    },120);
  }
}

function pinBackspace(){
  if(pinInputBuffer.length>0){
    pinInputBuffer=pinInputBuffer.slice(0,-1);
    updatePinDots();
  }
}

// ── PIN Setup flow ─────────────────────────────────────────────────────────
function startPinSetup(){
  pinSetupStage=1;
  pinInputBuffer='';
  pinSetupFirst='';
  renderPinSetupFirst('');
}

function renderPinSetupFirst(errorMsg){
  pinInputBuffer='';
  const el=document.getElementById('journal-lock-screen');
  if(!el)return;
  el.innerHTML=`<div class="journal-lock pin-setup-wrap">
    <div class="lock-icon">🔒</div>
    <div class="lock-title">Set a PIN</div>
    <div class="lock-sub">Choose a 4-digit PIN for your journal</div>
    <div class="pin-dots" id="pin-dots">
      <div class="pin-dot" id="pd0"></div><div class="pin-dot" id="pd1"></div>
      <div class="pin-dot" id="pd2"></div><div class="pin-dot" id="pd3"></div>
    </div>
    ${errorMsg?`<div class="pin-error">${errorMsg}</div>`:'<div style="height:20px"></div>'}
    <div class="pin-keypad">
      ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>`
        <button class="pin-key ${k==='⌫'?'del-key':''}"
          onclick="${k===''?'':k==='⌫'?'pinBackspace()':'pinPress('+k+')'}"
          ${k===''?'style="visibility:hidden"':''}>
          ${k}
        </button>`).join('')}
    </div>
    <button class="btn btn-ghost btn-sm" style="margin-top:16px" onclick="cancelPinSetup()">Cancel</button>
  </div>`;
}

function renderPinSetupConfirm(){
  pinInputBuffer='';
  const el=document.getElementById('journal-lock-screen');
  if(!el)return;
  el.innerHTML=`<div class="journal-lock pin-setup-wrap">
    <div class="lock-icon">✅</div>
    <div class="lock-title">Confirm PIN</div>
    <div class="lock-sub">Enter the same PIN again to confirm</div>
    <div class="pin-dots" id="pin-dots">
      <div class="pin-dot" id="pd0"></div><div class="pin-dot" id="pd1"></div>
      <div class="pin-dot" id="pd2"></div><div class="pin-dot" id="pd3"></div>
    </div>
    <div style="height:20px"></div>
    <div class="pin-keypad">
      ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>`
        <button class="pin-key ${k==='⌫'?'del-key':''}"
          onclick="${k===''?'':k==='⌫'?'pinBackspace()':'pinPress('+k+')'}"
          ${k===''?'style="visibility:hidden"':''}>
          ${k}
        </button>`).join('')}
    </div>
    <button class="btn btn-ghost btn-sm" style="margin-top:16px" onclick="cancelPinSetup()">Cancel</button>
  </div>`;
}

function cancelPinSetup(){
  pinSetupStage=0;pinSetupFirst='';pinInputBuffer='';
  unlockJournalDirect();
}

function forgotPin(){
  if(confirm('Reset your PIN? This will remove PIN protection from your journal.')){
    journalPin=null;
    save('lf3_jpin',null);
    unlockJournalDirect();
    showToast('PIN removed. You can set a new one from the journal.');
  }
}

// Journal locks when you navigate away — handled inside renderJournalPage()


// ─────────────────────────────────────────────

// INIT
// ─────────────────────────────────────────────

// ── Bridge: expose all mutable state and render functions to Firebase module ──
// The Firebase module calls window._applySync(data) on every Firestore update.
// This function writes into the _private vars and re-renders immediately.
window._applySync = function(data) {
  if (!data) return;
  let changed = false;
  // Update BOTH private vars AND public aliases so renders always see fresh data
  function syncVar(dataKey, setter){
    if(data[dataKey] !== undefined){
      setter(data[dataKey]);
      changed = true;
    }
  }
  syncVar('habits',      v=>{_habits=v;      habits=v;});
  syncVar('goals',       v=>{_goals=v;       goals=v;});
  syncVar('todos',       v=>{_todos=v;       todos=v;});
  syncVar('spends',      v=>{_spends=v;      spends=v;});
  syncVar('customCats',  v=>{_customCats=v;  customCats=v;});
  syncVar('friends',     v=>{_friends=v;     friends=v;});
  syncVar('friendReqs',  v=>{_friendReqs=v;  friendReqs=v;});
  syncVar('groups',      v=>{_groups=v;      groups=v;});
  syncVar('splits',      v=>{_splits=v;      splits=v;});
  syncVar('journalEntries', v=>{journalEntries=v;});
  if(data.paymentReqs     !== undefined){paymentReqs=data.paymentReqs; save('lf3_payment_reqs',paymentReqs); changed=true;}
  if(data.myUpiId         !== undefined && data.myUpiId){myUpiId=data.myUpiId; save('lf3_my_upi',myUpiId);}
  if(data.friendUpiIds    !== undefined){friendUpiIds=data.friendUpiIds; save('lf3_friend_upi_ids',friendUpiIds);}
  if(data.todoCategories  !== undefined){todoCategories=data.todoCategories; save('lf3_todo_cats',todoCategories);}
  if(data.sharedTodoLists    !== undefined){sharedTodoLists=data.sharedTodoLists; save('lf3_shared_todo_lists',sharedTodoLists);}
  if(data.sharedExpenseLists !== undefined){sharedExpenseLists=data.sharedExpenseLists; save('lf3_shared_expense_lists',sharedExpenseLists);}
  if(changed){
    // Keep localStorage cache fresh so it matches cloud state
    try{
      localStorage.setItem('lf3_habits',  JSON.stringify(habits));
      localStorage.setItem('lf3_goals',   JSON.stringify(goals));
      localStorage.setItem('lf3_todos',   JSON.stringify(todos));
      localStorage.setItem('lf3_spends',  JSON.stringify(spends));
      localStorage.setItem('lf3_custom_cats',  JSON.stringify(customCats));
      localStorage.setItem('lf3_friends',      JSON.stringify(friends));
      localStorage.setItem('lf3_friend_reqs',  JSON.stringify(friendReqs));
      localStorage.setItem('lf3_groups',       JSON.stringify(groups));
      localStorage.setItem('lf3_splits',       JSON.stringify(splits));
    }catch{}
    renderHome();
    renderPage(currentPage);
  }
};

// Expose read helpers so Firebase module can snapshot current state for saving
window._getState = function() {
  // Read from aliases (they are always up-to-date after persist() is called)
  return {
    habits:      habits,
    goals:       goals,
    todos:       todos,
    spends:      spends,
    customCats:  customCats,
    friends:     friends,
    friendReqs:  friendReqs,
    groups:      groups,
    splits:      splits,
    journalEntries: journalEntries,
    paymentReqs:    paymentReqs,
    myUpiId:        myUpiId,
    friendUpiIds:   friendUpiIds,
    todoCategories: todoCategories,
    sharedTodoLists: sharedTodoLists,
    sharedExpenseLists: sharedExpenseLists
  };
};

// Expose render and nav functions
window.renderPage  = renderPage;
window.renderHome  = renderHome;
window.launchApp   = launchApp;
window._lastSaveTime = 0;

// Show a loading spinner while Firebase initialises
document.addEventListener('DOMContentLoaded',()=>{
  const spinner=document.createElement('div');
  spinner.id='fb-loading';
  spinner.style.cssText='position:fixed;inset:0;background:var(--warm);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:12px';
  spinner.innerHTML='<div style="font-family:Cormorant Garamond,serif;font-size:32px;color:var(--sage-dark);font-style:italic">LifeFlow</div><div style="width:32px;height:32px;border:3px solid var(--warm2);border-top-color:var(--sage);border-radius:50%;animation:spin .7s linear infinite"></div><div style="font-size:13px;color:var(--text3)">Loading your sanctuary...</div>';
  document.body.appendChild(spinner);
  // Remove spinner after 5s max (fallback)
  setTimeout(()=>spinner.remove(), 5000);
});

function initSpendingTree(){
  // Open the spending tree by default
  const ch=document.getElementById('spend-tree-children');
  const cv=document.getElementById('spend-tree-chevron');
  if(ch)ch.className='nav-tree-children open';
  if(cv)cv.className='nav-tree-chevron open';
}

function initDateTime(){
  const now=new Date();
  const h=now.getHours();
  const greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  const firstName=currentUser?.firstName||currentUser?.name||'';
  const guestName=currentUser?.isGuest?'':firstName;
  document.getElementById('greeting').textContent=`${greet}${guestName?', '+guestName:''} 🌿`;
  const opts={weekday:'long',day:'numeric',month:'long',year:'numeric'};
  const ds=now.toLocaleDateString('en-IN',opts);
  document.getElementById('topbar-date').textContent=ds;
  document.getElementById('sidebar-date').textContent=ds;
  document.getElementById('today-chip').textContent=now.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
  // Remove loading spinner
  document.getElementById('fb-loading')?.remove();
}

document.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const a=document.activeElement?.id;
  if(a==='habit-name-in')addHabit();
  if(a==='goal-name-in'||a==='goal-target-in')addGoal();
  if(a==='todo-text-in')addTodo();
  if(a==='spend-desc-in'||a==='spend-amount-in')addSpend();
});
// Block negative numbers in ALL number inputs sitewide
document.addEventListener('input',e=>{
  if(e.target.type==='number'){
    const v=parseFloat(e.target.value);
    if(!isNaN(v)&&v<0)e.target.value=Math.abs(v);
  }
});
document.addEventListener('change',e=>{
  if(e.target.type==='number'){
    const v=parseFloat(e.target.value);
    if(!isNaN(v)&&v<0)e.target.value=Math.abs(v);
  }
});



// ═══════════════════════════════════════════════════════════════════════════
// PWA: Service Worker + Install Prompt + Update Banner + Deep Link Tabs
// ═══════════════════════════════════════════════════════════════════════════

// ── Register Service Worker ────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(reg => {
        console.log('SW registered:', reg.scope);

        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner(newWorker);
            }
          });
        });
      })
      .catch(err => console.warn('SW registration failed:', err));

    // Listen for controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });
}

// ── Update Banner ──────────────────────────────────────────────────────────
function showUpdateBanner(newWorker) {
  const banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.style.cssText = [
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%)',
    'background:#3D5C42;color:white;border-radius:12px',
    'padding:12px 20px;font-size:13px;display:flex;align-items:center',
    'gap:12px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)',
    'font-family:DM Sans,sans-serif;max-width:340px;width:90%'
  ].join(';');
  banner.innerHTML = `
    <span>🌿 New version available!</span>
    <button onclick="applyUpdate()" style="
      background:white;color:#3D5C42;border:none;border-radius:8px;
      padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;
      font-family:inherit;white-space:nowrap">Update now</button>
    <button onclick="this.parentElement.remove()" style="
      background:none;border:none;color:rgba(255,255,255,.7);
      font-size:18px;cursor:pointer;padding:0;line-height:1">×</button>`;
  document.body.appendChild(banner);
  window._pendingSwWorker = newWorker;
}

function applyUpdate() {
  if (window._pendingSwWorker) {
    window._pendingSwWorker.postMessage({ type: 'SKIP_WAITING' });
  }
  document.getElementById('pwa-update-banner')?.remove();
}

// ── Install Prompt (Android Chrome) ───────────────────────────────────────
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  // Show a subtle install hint after 30 seconds if not already installed
  setTimeout(showInstallHint, 30000);
});

function showInstallHint() {
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (document.getElementById('pwa-install-hint')) return;
  const hint = document.createElement('div');
  hint.id = 'pwa-install-hint';
  hint.style.cssText = [
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%)',
    'background:#3D5C42;color:white;border-radius:12px',
    'padding:12px 16px;font-size:13px;display:flex;align-items:center',
    'gap:10px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)',
    'font-family:DM Sans,sans-serif;max-width:340px;width:90%'
  ].join(';');
  hint.innerHTML = `
    <span>📱 Install LifeFlow as an app</span>
    <button onclick="triggerInstall()" style="
      background:white;color:#3D5C42;border:none;border-radius:8px;
      padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;
      font-family:inherit">Install</button>
    <button onclick="this.parentElement.remove()" style="
      background:none;border:none;color:rgba(255,255,255,.7);
      font-size:18px;cursor:pointer;padding:0;line-height:1">×</button>`;
  document.body.appendChild(hint);
}

async function triggerInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    showToast && showToast('🎉 LifeFlow installed as an app!');
  }
  deferredInstallPrompt = null;
  document.getElementById('pwa-install-hint')?.remove();
}

// Mark installed
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  showToast && showToast('🎉 LifeFlow is now installed on your home screen!');
});

// ── Deep link: handle ?tab= URL param to navigate on launch ──────────────
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab && ['home','habits','goals','todos','spending','journal'].includes(tab)) {
    // Wait for app to initialise, then navigate
    const tryNav = setInterval(() => {
      const btn = document.querySelector(`.nav-item[onclick*="'${tab}'"]`);
      if (btn && typeof navigate === 'function') {
        clearInterval(tryNav);
        setTimeout(() => navigate(tab, btn), 200);
        // Clean URL
        history.replaceState({}, '', window.location.pathname);
      }
    }, 300);
    // Give up after 5 seconds
    setTimeout(() => clearInterval(tryNav), 5000);
  }
});

// ── Standalone mode: hide install hints, add status-bar spacer ───────────
if (window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true) {
  document.documentElement.classList.add('pwa-standalone');
}



// ═══════════════════════════════════════════════════════════════════
// PULL-TO-REFRESH — data only, no page reload
// ═══════════════════════════════════════════════════════════════════
(function(){
  const THRESHOLD   = 80;   // px to pull before triggering
  const MAX_PULL    = 120;  // max px to track
  let startY        = 0;
  let pulling       = false;
  let triggered     = false;
  let isRefreshing  = false;

  const indicator   = document.getElementById('ptr-indicator');
  const spinner     = document.getElementById('ptr-spinner');
  const ptrText     = document.getElementById('ptr-text');

  function canPull(){
    // Only pull when at the very top of the main content
    const main = document.querySelector('.main');
    if(!main) return false;
    return main.scrollTop <= 0 || window.scrollY <= 0;
  }

  document.addEventListener('touchstart', e=>{
    if(isRefreshing) return;
    if(e.touches.length !== 1) return;
    if(canPull()){
      startY  = e.touches[0].clientY;
      pulling = true;
      triggered = false;
    }
  }, {passive:true});

  document.addEventListener('touchmove', e=>{
    if(!pulling || isRefreshing) return;
    const dy = Math.min(e.touches[0].clientY - startY, MAX_PULL);
    if(dy <= 0){ pulling=false; hideIndicator(); return; }
    // Show indicator
    if(!indicator.classList.contains('ptr-visible'))
      indicator.classList.add('ptr-visible');
    const progress = Math.min(dy / THRESHOLD, 1);
    indicator.style.opacity = progress.toString();
    if(dy >= THRESHOLD && !triggered){
      triggered = true;
      ptrText.textContent = 'Release to refresh';
      spinner.classList.add('spinning');
    } else if(dy < THRESHOLD) {
      ptrText.textContent = 'Pull down to refresh';
      spinner.classList.remove('spinning');
    }
  }, {passive:true});

  document.addEventListener('touchend', ()=>{
    if(!pulling) return;
    pulling = false;
    if(triggered){
      doRefresh();
    } else {
      hideIndicator();
    }
  });

  function hideIndicator(){
    indicator.classList.remove('ptr-visible','ptr-loading');
    indicator.style.opacity = '';
    spinner.classList.remove('spinning');
    ptrText.textContent = 'Pull down to refresh';
    triggered = false;
  }

  async function doRefresh(){
    isRefreshing = true;
    indicator.classList.add('ptr-loading');
    indicator.style.opacity = '1';
    spinner.classList.add('spinning');
    ptrText.textContent = 'Refreshing...';

    try {
      // Wait up to 5s for Firebase module to be ready
      let waited = 0;
      while((!window._fb || !window.currentUser) && waited < 5000){
        await new Promise(r=>setTimeout(r,100));
        waited += 100;
      }

      if(!window._fb || !window.currentUser || !window.currentUser.uid){
        // Not logged in — just re-render from memory
        if(window.renderPage && window.currentPage) window.renderPage(window.currentPage);
        if(window.renderHome) window.renderHome();
        ptrText.textContent = '✓ Done';
        spinner.classList.remove('spinning');
        setTimeout(hideIndicator, 800);
        isRefreshing = false;
        return;
      }

      // Directly fetch from Firestore without restarting the listener
      const {db, doc, getDoc} = window._fb;
      const snap = await getDoc(doc(db, 'users', window.currentUser.uid));
      if(snap.exists() && window._applySync){
        window._applySync(snap.data());
      }
      if(window.renderPage && window.currentPage) window.renderPage(window.currentPage);
      if(window.renderHome) window.renderHome();
      ptrText.textContent = '✓ Up to date';
      spinner.classList.remove('spinning');
      setTimeout(hideIndicator, 1000);
    } catch(e){
      console.warn('PTR error:', e.message);
      // On error just re-render from memory — don't show "failed"
      if(window.renderPage && window.currentPage) window.renderPage(window.currentPage);
      if(window.renderHome) window.renderHome();
      ptrText.textContent = '✓ Done';
      spinner.classList.remove('spinning');
      setTimeout(hideIndicator, 800);
    }
    isRefreshing = false;
  }
})();
