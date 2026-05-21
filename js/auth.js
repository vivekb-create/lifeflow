// LifeFlow — authentication (Google sign-in, sign-out, launch)
// AUTH  (Firebase-backed)
// ─────────────────────────────────────────────
let currentUser = null;

function signInWithGoogle() {
  // signInWithGoogle MUST be synchronous at call site so the browser
  // treats the popup as a direct response to a user gesture.
  // Any async wrapping breaks popup on mobile browsers and iOS PWA.
  if (!window._fb) {
    alert('App is still loading. Please wait a few seconds and try again.');
    return;
  }
  const { auth, GoogleAuthProvider, signInWithPopup } = window._fb;
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  // Set loading state
  const btn = document.getElementById('google-signin-btn');
  if (btn) { btn.textContent = 'Signing in...'; btn.disabled = true; }

  // signInWithPopup returns a Promise — we handle it async AFTER the sync call
  signInWithPopup(auth, provider)
    .then(() => {
      // onAuthStateChanged handles everything — nothing to do here
    })
    .catch(e => {
      if (btn) { btn.textContent = 'Sign in with Google'; btn.disabled = false; }
      if (e.code === 'auth/popup-blocked') {
        // Popup was blocked — fall back to redirect (works on desktop browsers with strict settings)
        if (window._fb.signInWithRedirect) {
          btn.textContent = 'Redirecting...';
          sessionStorage.setItem('googleRedirectPending', '1');
          window._fb.signInWithRedirect(auth, provider);
        } else {
          alert('Popup was blocked. Please allow popups for this site and try again.');
        }
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        console.error('Sign-in error:', e.code, e.message);
        alert('Sign-in failed. Please try again.\n\nError: ' + (e.code || e.message));
      }
    });
}

async function signInAsGuest() {
  const { auth, signInAnonymously } = window._fb;
  try {
    await signInAnonymously(auth);
  } catch(e) {
    alert('Guest sign-in failed: ' + e.message);
  }
}

async function signOut() {
  try {
    const { auth, fbSignOut } = window._fb;
    await fbSignOut(auth);
  } catch(e) { console.warn('signOut error:', e); }
  currentUser = null;
  window.currentUser = null;
  // Reset in-memory data
  _habits=[]; _goals=[]; _todos=[]; _spends=[];
  _customCats=[]; _friends=[]; _friendReqs=[]; _groups=[]; _splits=[];
  habits=[]; goals=[]; todos=[]; spends=[];
  customCats=[]; friends=[]; friendReqs=[]; groups=[]; splits=[];
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

function launchApp() {
  if (window.currentUser) currentUser = window.currentUser;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  initDateTime();
  renderSidebarUser();
  initSpendingTree();

  // Restore last visited page (survives refresh)
  const savedPage = sessionStorage.getItem('lf_last_page') || 'home';
  const savedSpendTab = sessionStorage.getItem('lf_last_spend_tab') || 'personal';
  if (savedPage === 'spending') {
    spendTab = savedSpendTab;
    navigate('spending', document.getElementById('nav-spending-parent'));
    setSpendTab(savedSpendTab, null);
  } else {
    const navBtn = document.getElementById('nav-' + savedPage);
    navigate(savedPage, navBtn);
  }

  setTimeout(handleInviteToken, 800);
  setTimeout(startPaymentReqListener, 1200);
}

function renderSidebarUser() {
  // Use window.currentUser as source of truth — it's set by Firebase module
  const u = window.currentUser || currentUser;
  const el = document.getElementById('sidebar-user');
  if (!u || !el) return;
  const avatar = u.picture
    ? `<img class="user-avatar" src="${u.picture}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const initials = `<div class="user-avatar-initials" style="${u.picture?'display:none':''}">
    ${(u.name||'G')[0].toUpperCase()}</div>`;
  el.innerHTML = `
    <div style="position:relative;flex-shrink:0">${avatar}${initials}</div>
    <div style="min-width:0;flex:1">
      <div class="user-name">${u.isGuest ? 'Guest' : (u.name||'User')}</div>
      ${!u.isGuest && u.email ? `<div class="user-email">${u.email}</div>` : ''}
      <div style="display:flex;align-items:center;gap:8px;margin-top:3px">
        <span style="font-size:10px;background:${u.isGuest?'var(--warm3)':'var(--sage-light)'};color:${u.isGuest?'var(--text3)':'var(--sage-dark)'};padding:2px 6px;border-radius:6px;font-weight:500">
          ${u.isGuest ? '👤 Guest' : '☁️ Synced'}
        </span>
        <button class="sign-out-btn" onclick="signOut()">Sign out</button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
