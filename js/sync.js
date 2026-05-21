/**
 * sync.js — Firebase module (authentication + real-time sync)
 *
 * NOTE: This file uses ES module syntax (import/export) and top-level await.
 * It MUST be included as an INLINE <script type="module"> in index.html,
 * not as an external src="js/sync.js" reference.
 * Edit this file, then paste the content into the <script type="module"> block in index.html.
 */

import { initializeApp }      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
         getRedirectResult, signInAnonymously,
         signOut as fbSignOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot,
         collection, addDoc, query, where, getDocs, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyCDdVqYg8HXFftvRDDH6KD6Qvcvr3pXDXA",
  authDomain:        "lifeflow-2f5eb.firebaseapp.com",
  projectId:         "lifeflow-2f5eb",
  storageBucket:     "lifeflow-2f5eb.firebasestorage.app",
  messagingSenderId: "334050349685",
  appId:             "1:334050349685:web:61c740a65781be7b30de3c"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Unique device ID so we don't re-apply our own saves
const DEVICE_ID = Math.random().toString(36).slice(2);
let unsubscribeSnapshot = null;

// Expose auth + firestore helpers to the main script
window._fb = {
  auth, db,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInAnonymously, fbSignOut,
  doc, setDoc, getDoc, onSnapshot,
  collection, addDoc, query, where, getDocs, deleteDoc
};

// ── Backend email sender via Cloudflare Worker + Resend ──
// IMPORTANT: Replace this URL with your deployed Cloudflare Worker URL
// after you deploy the worker (see SETUP.md for instructions).
const WORKER_URL = 'https://lifeflow-email-worker.YOUR-SUBDOMAIN.workers.dev';

window._sendInviteEmail = async function(toEmail, toName) {
  const u = window.currentUser;
  const appUrl = window.location.origin + window.location.pathname.replace('index.html','');
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail:   toEmail,
        toName:    toName,
        fromName:  (u && u.name)  ? u.name  : 'A LifeFlow user',
        fromEmail: (u && u.email) ? u.email : '',
        appUrl:    appUrl
      })
    });
    const data = await res.json();
    if (data.success) {
      return { ok: true };
    } else {
      console.warn('Email worker error:', data);
      return { ok: false, error: data.error || 'Unknown error' };
    }
  } catch(e) {
    console.warn('Email send failed:', e);
    return { ok: false, error: e.message };
  }
};

window._writeFriendRequestToRecipient = async function(toEmail, fromUser) {
  if (!toEmail || !fromUser?.uid) return;
  try {
    // Look up recipient by email in the users_by_email collection
    const q = query(collection(db,'users_by_email'), where('email','==',toEmail));
    const snap = await getDocs(q);
    if (snap.empty) {
      await setDoc(doc(db,'pending_invites',toEmail.split('.').join('_')), {
        toEmail, fromUid: fromUser.uid,
        fromName:    fromUser.name    || '',
        fromEmail:   fromUser.email   || '',
        fromPicture: fromUser.picture || '',
        sentAt: Date.now()
      });
    } else {
      const recipientUid = snap.docs[0].data().uid;
      await addDoc(collection(db,'users',recipientUid,'friendRequests'), {
        fromUid:     fromUser.uid,
        fromName:    fromUser.name    || '',   // Full name from Google account
        fromEmail:   fromUser.email   || '',
        fromPicture: fromUser.picture || '',
        sentAt:      Date.now(),
        status:      'pending'
      });
    }
  } catch(e) { console.warn('writeFriendRequest error:', e); }
};

// ── Register current user's email for lookup ──
window._registerUserEmail = async function(user) {
  if (!user?.uid || !user?.email) return;
  try {
    await setDoc(doc(db,'users_by_email', user.email.split('.').join('_')), {
      uid: user.uid, email: user.email, name: user.name, updatedAt: Date.now()
    });
  } catch(e) { console.warn('registerEmail error:', e); }
};

// ── Listen for incoming friend requests ──
window._listenFriendRequests = function(uid) {
  // Listen for new friend REQUESTS (pending)
  onSnapshot(collection(db,'users',uid,'friendRequests'), (snap) => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const r = change.doc.data();
        if (r.status === 'pending') {
          const existing = (_friendReqs||[]).find(x => x.fromEmail === r.fromEmail || x.fromUid === r.fromUid);
          if (!existing) {
            _friendReqs = [...(_friendReqs||[]), {
              id: change.doc.id, from: r.fromName, contact: r.fromEmail||'',
              fromUid: r.fromUid, fromPicture: r.fromPicture||'',
              date: new Date(r.sentAt||Date.now()).toISOString(),
              firestoreDocId: change.doc.id
            }];
            friendReqs = _friendReqs;
            // Save to localStorage so it survives page refresh
            try{ localStorage.setItem('lf3_friend_reqs', JSON.stringify(friendReqs)); }catch{}
            // Re-render regardless of which page is open
            if (window.renderPage) window.renderPage(window.currentPage || 'home');
            if (window.renderHome) window.renderHome();
            // Show a tappable toast that navigates to Friends tab
            if(window.showToast) window.showToast('📬 ' + r.fromName + ' sent you a friend request! Tap to view.');
            // Create a clickable banner if not already there
            const existingBanner = document.getElementById('friend-req-banner');
            if(!existingBanner){
              const banner = document.createElement('div');
              banner.id = 'friend-req-banner';
              banner.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);background:#3D5C42;color:white;border-radius:0 0 14px 14px;padding:10px 20px;font-size:13px;font-weight:500;z-index:400;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;gap:10px;max-width:380px;width:90%';
              banner.innerHTML = '<span style="font-size:13px">📬 Friend request from <strong>' + r.fromName + '</strong></span>'
              + '<button onclick="navToSpend(\"friends\",document.getElementById(\"nav-sub-friends\'));document.getElementById(\"friend-req-banner\")?.remove()" style="background:white;color:#3D5C42;border:none;border-radius:6px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;margin-left:8px">View</button>'
              + '<button onclick="document.getElementById(\"friend-req-banner\")?.remove()" style="background:none;border:none;color:rgba(255,255,255,.7);font-size:20px;cursor:pointer;padding:0;margin-left:6px">×</button>';
              document.body.appendChild(banner);
              setTimeout(()=>document.getElementById('friend-req-banner')?.remove(), 8000);
            }
          }
        }
      }
    });
  });

  // Listen for notifications (friend accepted, etc.)
  onSnapshot(collection(db,'users',uid,'notifications'), (snap) => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const n = change.doc.data();
        if (n.type === 'friend_accepted') {
          // They accepted our request — add them to our local friends as active
          const existing = (_friends||[]).find(f =>
            String(f.fromUid) === String(n.fromUid) || f.contact === n.fromEmail
          );
          if (!existing) {
            _friends = [...(_friends||[]), {
              id: String(Date.now()), name: n.fromName,
              contact: n.fromEmail||'', status: 'active',
              fromUid: n.fromUid, picture: n.fromPicture||''
            }];
            friends = _friends;
            persist();
            if (window.renderPage && window.currentPage === 'spending') window.renderPage('spending');
            window.showToast && window.showToast('🎉 ' + n.fromName + ' accepted your friend request!');
          }
        }
      }
    });
  });
};

// ── Shared group spending: write group expenses to shared collection ──
window._saveSharedGroup = async function(group, groupSplits) {
  if (!group?.id) return;
  try {
    await setDoc(doc(db,'shared_groups', String(group.id)), {
      ...group,
      splits: groupSplits,
      updatedAt: Date.now()
    });
  } catch(e) { console.warn('saveSharedGroup error:', e); }
};

// ── Load shared group data (for members who joined) ──
window._loadSharedGroups = async function(userEmail) {
  if (!userEmail) return [];
  try {
    const snap = await getDocs(collection(db,'shared_groups'));
    const results = [];
    snap.forEach(d => {
      const g = d.data();
      // Include group if user's email is in members (by contact)
      const isMember = (g.memberEmails||[]).includes(userEmail);
      if (isMember) results.push(g);
    });
    return results;
  } catch(e) { return []; }
};

// ── Save all data to Firestore ──
window._saveToFirestore = async function() {
  const u = window.currentUser;
  if (!u || !u.uid) return;
  try {
    const state = window._getState ? window._getState() : {};
    const ts = Date.now();
    window._lastSaveTime = ts;
    // NO merge:true — we always write the full document so arrays
    // are fully replaced, never merged. This is the correct pattern
    // for user-owned documents where we own the entire state.
    await setDoc(doc(db, 'users', u.uid), {
      ...state,
      updatedAt: ts,
      updatedBy: DEVICE_ID
    });
  } catch(e) {
    console.warn('Firestore save error:', e);
  }
};

// ── Start real-time listener ──
function startListener(uid) {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  let snapshotCount = 0;

  unsubscribeSnapshot = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) { snapshotCount++; return; }
      const d = snap.data();
      snapshotCount++;

      // Skip only if this is OUR OWN recent save echoing back
      const isOwnEcho = d.updatedBy === DEVICE_ID &&
                        (window._lastSaveTime) &&
                        Math.abs((d.updatedAt || 0) - window._lastSaveTime) < 2000;

      if (isOwnEcho) return;

      // Always apply data — this is the source of truth
      if (window._applySync) {
        window._applySync(d);
        // Show toast only after first snapshot (live cross-device update)
        if (snapshotCount > 1) {
          window.showToast && window.showToast('✨ Synced');
        }
      }
    },
    (err) => {
      console.warn('Snapshot error:', err.code);
      // Retry listener after 3s on permission errors (auth may not be ready)
      if (err.code === 'permission-denied') {
        setTimeout(() => startListener(uid), 3000);
      }
    }
  );
}

// ── Load user data once on login, then start listener ──
window._loadUserData = async function() {
  const u = window.currentUser;
  if (!u || !u.uid) return;
  try {
    const snap = await getDoc(doc(db, 'users', u.uid));
    if (snap.exists()) {
      // Firestore is source of truth — apply it directly.
      // Do NOT clear localStorage first; if Firestore write is in-flight
      // and user refreshes, localStorage is the safety net.
      if (window._applySync) window._applySync(snap.data());
    }
    // Start live listener for real-time cross-device updates
    startListener(u.uid);
  } catch(e) {
    console.warn('Firestore load error:', e);
  }
};

// ── Handle redirect result (fallback for popup-blocked desktop browsers) ──
const isPendingRedirect = sessionStorage.getItem('googleRedirectPending') === '1';
sessionStorage.removeItem('googleRedirectPending');

if (isPendingRedirect) {
  // Show spinner while redirect result processes
  const loadingEl = document.getElementById('auth-redirect-loading');
  const btnEl     = document.getElementById('google-signin-btn');
  if (loadingEl) loadingEl.style.display = 'flex';
  if (btnEl)     btnEl.style.display     = 'none';
}

// Always call getRedirectResult to handle any pending redirect
getRedirectResult(auth).then(result => {
  if (!result) {
    // No redirect in progress — show the sign-in button normally
    const loadingEl = document.getElementById('auth-redirect-loading');
    const btnEl     = document.getElementById('google-signin-btn');
    if (loadingEl) loadingEl.style.display = 'none';
    if (btnEl)     btnEl.style.display     = 'flex';
  }
  // onAuthStateChanged handles the rest
}).catch(e => {
  const loadingEl = document.getElementById('auth-redirect-loading');
  const btnEl     = document.getElementById('google-signin-btn');
  if (loadingEl) loadingEl.style.display = 'none';
  if (btnEl)     btnEl.style.display     = 'flex';
  if (e.code) console.warn('Redirect result error:', e.code);
});

// ── Auth state observer ──
onAuthStateChanged(auth, async (user) => {
  document.getElementById('fb-loading')?.remove();
  if (user) {
    window.currentUser = {
      uid:       user.uid,
      name:      user.displayName || (user.isAnonymous ? 'Guest' : 'User'),
      firstName: user.displayName ? user.displayName.split(' ')[0] : (user.isAnonymous ? 'there' : 'User'),
      email:     user.email    || '',
      picture:   user.photoURL || '',
      isGuest:   user.isAnonymous
    };
    // Always launch the app first — never block on Firestore side effects
    if (window.launchApp) window.launchApp();

    // Load data + start listeners in background (non-blocking)
    window._loadUserData().then(() => {
      // Re-render after data loads
      if (window.renderPage) window.renderPage(window.currentPage || 'home');
      if (window.renderHome) window.renderHome();
    }).catch(e => console.warn('loadUserData error:', e));

    // Register email and start listeners asynchronously (never block login)
    if (!user.isAnonymous && user.email) {
      window._registerUserEmail(window.currentUser).catch(()=>{});
      try { window._listenFriendRequests(user.uid); } catch(e) {}
    }
  } else {
    if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    document.getElementById('app').style.display  = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
  }
