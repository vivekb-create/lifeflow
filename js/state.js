// LifeFlow — state, localStorage helpers, utility functions
// STATE  (Firebase-backed — localStorage used only as fast local cache)
// ─────────────────────────────────────────────
const KEYS={habits:'lf3_habits',goals:'lf3_goals',todos:'lf3_todos',spends:'lf3_spends'};
// Keep localStorage as offline cache fallback
function load(k,d){try{const s=localStorage.getItem(k);return s?JSON.parse(s):d;}catch{return d;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

function todayKey(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function uid(){return Date.now()+Math.floor(Math.random()*10000);}
function fmt(n){return Number(n).toLocaleString('en-IN');}

// Today's date as YYYY-MM-DD for <input type="datetime-local">
function nowDatetimeLocal(){
  const d=new Date();
  d.setSeconds(0,0);
  return d.toISOString().slice(0,16);
}
function todayDatetimeLocal(){
  const d=new Date();
  d.setHours(23,59,0,0);
  return d.toISOString().slice(0,16);
}

// Private backing variables — EMPTY by default for new users
// Data is loaded from Firestore on login; localStorage used only as offline cache
let _habits = load(KEYS.habits, []);
let _goals  = load(KEYS.goals,  []);
let _todos  = load(KEYS.todos,  []);
let _spends = load(KEYS.spends, []);
// Shorthand aliases
let habits=_habits, goals=_goals, todos=_todos, spends=_spends;
// ── Single unified save function ──────────────────────────────────────────
// Always writes localStorage immediately AND fires Firestore save.
// No debounce — debounce was causing data loss on refresh.
function persist(){
  // Sync ALL private vars from their aliases
  _habits=habits; _goals=goals; _todos=todos; _spends=spends;
  _customCats=customCats; _friends=friends; _friendReqs=friendReqs;
  _groups=groups; _splits=splits;
  // Write to localStorage (instant, survives refresh)
  save(KEYS.habits,habits);      save(KEYS.goals,goals);
  save(KEYS.todos,todos);        save(KEYS.spends,spends);
  save(XKEYS.customCats,customCats); save(XKEYS.friends,friends);
  save(XKEYS.friendReqs,friendReqs); save(XKEYS.groups,groups);
  save(XKEYS.splits,splits);
  save('lf3_todo_cats', todoCategories);
  save('lf3_shared_todo_lists', sharedTodoLists);
  // Write to Firestore immediately — no debounce
  if (window._saveToFirestore) window._saveToFirestore();
}

const CAT_COLORS={Food:'#6B8F71',Travel:'#B8845A',Shopping:'#5A78B8',Health:'#B85A4A',Bills:'#8A6BC4',Entertainment:'#5A9898',Other:'#9C9C98'};
const CAT_BG={Food:'#EAF0EB',Travel:'#F5EAE0',Shopping:'#E5EAF5',Health:'#F5E8E5',Bills:'#EDE5F5',Entertainment:'#E5F0F0',Other:'#F0F0F0'};
const CAT_EMJ={Food:'🍽️',Travel:'🚗',Shopping:'🛍️',Health:'💊',Bills:'📄',Entertainment:'🎬',Other:'📦'};

// ─────────────────────────────────────────────
// TODO HELPERS
// ─────────────────────────────────────────────
const PRIORITY_ORDER={high:0,medium:1,low:2};

function getDueDateObj(t){ return t.dueDate ? new Date(t.dueDate) : null; }

function getDueCategory(t){
  if(t.done) return 'done';
  const due=getDueDateObj(t);
  if(!due) return 'all';
  const now=new Date();
  const todayEnd=new Date(); todayEnd.setHours(23,59,59,999);
  const weekEnd=new Date(); weekEnd.setDate(weekEnd.getDate()+7); weekEnd.setHours(23,59,59,999);
  const monthEnd=new Date(); monthEnd.setMonth(monthEnd.getMonth()+1); monthEnd.setHours(23,59,59,999);
  if(due < now) return 'overdue';
  if(due <= todayEnd) return 'today';
  if(due <= weekEnd) return 'week';
  if(due <= monthEnd) return 'month';
  return 'later';
}

function sortTodos(arr){
  return [...arr].sort((a,b)=>{
    // Priority first
    const pd=PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority];
    if(pd!==0) return pd;
    // Then due date
    const da=getDueDateObj(a), db=getDueDateObj(b);
    if(da&&db) return da-db;
    if(da) return -1;
    if(db) return 1;
    return 0;
  });
}

function formatDue(t){
  const due=getDueDateObj(t);
  if(!due) return null;
  const now=new Date();
  const diff=due-now;
  const todayEnd=new Date(); todayEnd.setHours(23,59,59,999);
  let cls='later', label='';
  if(due < now){ cls='overdue'; label='Overdue'; }
  else if(due<=todayEnd){
    cls='today';
    const mins=Math.round(diff/60000);
    if(mins<60) label=`in ${mins}m`;
    else label=`Today ${due.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`;
  } else {
    const days=Math.ceil((due-todayEnd)/86400000);
    if(days<=7){ cls='soon'; label=due.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'}); }
    else { cls='later'; label=due.toLocaleDateString('en-IN',{day:'numeric',month:'short'}); }
  }
  return `<span class="due-chip ${cls}">🕐 ${label}</span>`;
}

// ─────────────────────────────────────────────
