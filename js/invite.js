// LifeFlow — invite links, QR codes, friend codes
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


