// LifeFlow — ALL state variables and localStorage helpers
// This file MUST load first. All other JS files read/write these globals.

// ── Storage helpers ────────────────────────────────────────────────────────
const KEYS  = {habits:'lf3_habits', goals:'lf3_goals', todos:'lf3_todos', spends:'lf3_spends'};
const XKEYS = {customCats:'lf3_custom_cats', friends:'lf3_friends',
               friendReqs:'lf3_friend_reqs', groups:'lf3_groups', splits:'lf3_splits'};

function load(k,d){try{const s=localStorage.getItem(k);return s?JSON.parse(s):d;}catch{return d;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

// ── Utility ────────────────────────────────────────────────────────────────
function todayKey(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function uid(){return Date.now()+Math.floor(Math.random()*10000);}
function fmt(n){return Number(n).toLocaleString('en-IN');}
function nowDatetimeLocal(){const d=new Date();d.setSeconds(0,0);return d.toISOString().slice(0,16);}
function todayDatetimeLocal(){const d=new Date();d.setHours(23,59,0,0);return d.toISOString().slice(0,16);}

// ── Core state ─────────────────────────────────────────────────────────────
let _habits = load(KEYS.habits, []);
let _goals  = load(KEYS.goals,  []);
let _todos  = load(KEYS.todos,  []);
let _spends = load(KEYS.spends, []);
let habits=_habits, goals=_goals, todos=_todos, spends=_spends;

// ── Spending state ─────────────────────────────────────────────────────────
let _customCats  = load(XKEYS.customCats, []);
let _friends     = load(XKEYS.friends,    []);
let _friendReqs  = load(XKEYS.friendReqs, []);
let _groups      = load(XKEYS.groups,     []);
let _splits      = load(XKEYS.splits,     []);
let customCats=_customCats, friends=_friends, friendReqs=_friendReqs,
    groups=_groups, splits=_splits;

// ── Extended state ─────────────────────────────────────────────────────────
let sharedExpenseLists = load('lf3_shared_expense_lists', []);
let myUpiId            = load('lf3_my_upi', '');
let friendUpiIds       = load('lf3_friend_upi_ids', {});
let paymentReqs        = load('lf3_payment_reqs', []);
let journalEntries     = load('lf3_journal', []);
let journalPin         = load('lf3_jpin', null);
let todoCategories     = load('lf3_todo_cats', ['General','Home','Work','Shopping','Personal']);
let sharedTodoLists    = load('lf3_shared_todo_lists', []);

// ── Category helpers ───────────────────────────────────────────────────────
const CAT_COLORS={Food:'#6B8F71',Travel:'#B8845A',Shopping:'#5A78B8',Health:'#B85A4A',Bills:'#8A6BC4',Entertainment:'#5A9898',Other:'#9C9C98'};
const CAT_BG={Food:'#EAF0EB',Travel:'#F5EAE0',Shopping:'#E5EAF5',Health:'#F5E8E5',Bills:'#EDE5F5',Entertainment:'#E5F0F0',Other:'#F0F0F0'};
const CAT_EMJ={Food:'🍽️',Travel:'🚗',Shopping:'🛍️',Health:'💊',Bills:'📄',Entertainment:'🎬',Other:'📦'};

function allCats(){
  const base={...CAT_COLORS};
  customCats.forEach(c=>{if(c.name)base[c.name]=c.color||'#9C9C98';});
  return base;
}
function allCatNames(){return Object.keys(allCats());}
function catEmoji(cat){
  const cc=customCats.find(c=>c.name===cat);
  return (cc&&cc.emoji)?cc.emoji:(CAT_EMJ[cat]||'🏷️');
}
function catBg(cat){
  const cc=customCats.find(c=>c.name===cat);
  return (cc&&cc.bg)?cc.bg:(CAT_BG[cat]||'#F0F0F0');
}

// ── Persist — unified save (localStorage + Firestore) ─────────────────────
let _saveQueue = false;

function persist(){
  // Sync private vars from aliases
  _habits=habits; _goals=goals; _todos=todos; _spends=spends;
  _customCats=customCats; _friends=friends; _friendReqs=friendReqs;
  _groups=groups; _splits=splits;
  // Write localStorage immediately (survives refresh)
  save(KEYS.habits,habits);           save(KEYS.goals,goals);
  save(KEYS.todos,todos);             save(KEYS.spends,spends);
  save(XKEYS.customCats,customCats);  save(XKEYS.friends,friends);
  save(XKEYS.friendReqs,friendReqs);  save(XKEYS.groups,groups);
  save(XKEYS.splits,splits);
  save('lf3_todo_cats', todoCategories);
  save('lf3_shared_todo_lists', sharedTodoLists);
  save('lf3_shared_expense_lists', sharedExpenseLists);
  save('lf3_journal', journalEntries);
  save('lf3_payment_reqs', paymentReqs);
  save('lf3_my_upi', myUpiId);
  save('lf3_friend_upi_ids', friendUpiIds);
  // Write to Firestore — queue if module not ready yet
  if (window._saveToFirestore) {
    window._saveToFirestore();
    _saveQueue = false;
  } else {
    _saveQueue = true;
    _waitAndFlushSave();
  }
}

function persistSpend(){ persist(); }

function _waitAndFlushSave(){
  if (!_saveQueue) return;
  if (window._saveToFirestore) {
    window._saveToFirestore();
    _saveQueue = false;
    return;
  }
  let attempts = 0;
  const timer = setInterval(()=>{
    attempts++;
    if (window._saveToFirestore) {
      window._saveToFirestore();
      _saveQueue = false;
      clearInterval(timer);
    } else if (attempts > 50) {
      clearInterval(timer);
      console.warn('LifeFlow: Firebase not ready after 10s');
    }
  }, 200);
}

// ── TODO helpers ───────────────────────────────────────────────────────────
const PRIORITY_ORDER={high:0,medium:1,low:2};
function getDueDateObj(t){return t.dueDate?new Date(t.dueDate):null;}
function getDueCategory(t){
  if(t.done)return'done';
  const due=getDueDateObj(t);if(!due)return'all';
  const now=new Date();
  const te=new Date();te.setHours(23,59,59,999);
  const we=new Date();we.setDate(we.getDate()+7);we.setHours(23,59,59,999);
  const me=new Date();me.setMonth(me.getMonth()+1);me.setHours(23,59,59,999);
  if(due<now)return'overdue';
  if(due<=te)return'today';
  if(due<=we)return'week';
  if(due<=me)return'month';
  return'later';
}
function sortTodos(arr){
  return[...arr].sort((a,b)=>{
    const pd=PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority];
    if(pd!==0)return pd;
    const da=getDueDateObj(a),db=getDueDateObj(b);
    if(da&&db)return da-db;
    if(da)return-1;if(db)return 1;return 0;
  });
}
function formatDue(t){
  const due=getDueDateObj(t);if(!due)return null;
  const now=new Date();const diff=due-now;
  const te=new Date();te.setHours(23,59,59,999);
  let cls='later',label='';
  if(due<now){cls='overdue';label='Overdue';}
  else if(due<=te){
    cls='today';const mins=Math.round(diff/60000);
    if(mins<60)label=`in ${mins}m`;
    else label=`Today ${due.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`;
  }else{
    const days=Math.ceil((due-te)/86400000);
    if(days<=7){cls='soon';label=due.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});}
    else{cls='later';label=due.toLocaleDateString('en-IN',{day:'numeric',month:'short'});}
  }
  return `<span class="due-chip ${cls}">🕐 ${label}</span>`;
}
