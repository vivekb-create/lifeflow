// LifeFlow — spending, groups, shared lists, UPI settle-up
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
