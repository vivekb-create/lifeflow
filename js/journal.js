// LifeFlow — journal, PIN lock
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
