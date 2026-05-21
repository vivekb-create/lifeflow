// LifeFlow — habits and goals
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
