// LifeFlow — home dashboard
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
