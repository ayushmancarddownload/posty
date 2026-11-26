import { SITE_LOGO_URL, FEED_OPACITY_BOTTOM, FEED_OPACITY_TOP, MY_GALLERY_IMAGES } from '../data/posters.js';

// === 1. APNA SUPABASE URL & ANON KEY YAHAN DALEIN ===
const SUPABASE_URL = "https://wlxnxamlsqezpjsdyrah.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Tvq6grbkSIsG1Doh7Y7Txw_t_cFm7BK";
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const FREE_LAUNCH_MODE = false;

function captureReferralParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && ref.length > 10) {
      localStorage.setItem('posty_ref', ref);
    }
  } catch (e) {}
}
captureReferralParam();

let sb = null;
let currentAuthUser = null;
let userSubscription = { plan: 'free', proUntil: 0 };
let selectedPlanId = '90days';
let hideWatermark = false;

let cropper;
let deferredPrompt;
let activeEditId = null;
let allPosters = [];
let activeCategory = 'All';
let favoriteUrls = JSON.parse(localStorage.getItem('postyFavorites') || '[]');
let pendingShareFile = null;
let pendingUserAction = null;
let didHorizontalSwipe = false;

let user = {
  name: "Aesthetic Creator",
  extra: "Poster Artist",
  contact: "9876543210",
  pic: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  logo: "",
  socials: {
    visible: true,
    insta: { val: "", visible: true },
    twitter: { val: "", visible: true },
    fb: { val: "", visible: true }
  }
};

let currentOpacity = 0.8;
let currentBgIndex = 0;
let currentShapeIndex = 0;
let currentFilterIndex = 0;

const profileBackgrounds = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400"
];

const SWIPE_STYLE_PRESETS = [
  { theme: 'theme-left', font: 'font-poppins', bg: profileBackgrounds[0] },
  { theme: 'theme-center', font: 'font-playfair', bg: profileBackgrounds[1] },
  { theme: 'theme-right', font: 'font-pacifico', bg: profileBackgrounds[2] },
  { theme: 'theme-left', font: 'font-quicksand', bg: profileBackgrounds[3] },
  { theme: 'theme-center', font: 'font-meow-script', bg: profileBackgrounds[4] },
  { theme: 'theme-right', font: 'font-poppins', bg: profileBackgrounds[5] },
  { theme: 'theme-center', font: 'font-quicksand', bg: profileBackgrounds[0] },
  { theme: 'theme-left', font: 'font-playfair', bg: profileBackgrounds[2] }
];

const profileShapes = ['rounded-full', 'rounded-none', 'rounded-2xl'];
const filters = ['', 'grayscale(100%)', 'sepia(80%)', 'contrast(150%)', 'hue-rotate(45deg)'];
const fonts = ['font-poppins', 'font-playfair', 'font-meow-script', 'font-pacifico', 'font-quicksand'];

if (window.supabase && SUPABASE_URL && !SUPABASE_URL.includes("YOUR_PROJECT_ID")) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  sb.auth.onAuthStateChange(async (_event, session) => {
    currentAuthUser = session?.user || null;
    updateAuthUI();

    if (currentAuthUser) {
      await claimPendingReferral(currentAuthUser.id);
      await fetchUserSubscription(currentAuthUser.id);
      await fetchReferralCount(currentAuthUser.id);

      const meta = currentAuthUser.user_metadata || {};
      const cloudName = meta.custom_name || meta.full_name || meta.name || '';
      const cloudPic = meta.custom_pic || meta.avatar_url || meta.picture || '';

      if (!localStorage.getItem('aestheticUser') && (cloudName || cloudPic)) {
        if (cloudName) user.name = cloudName;
        if (cloudPic) user.pic = cloudPic;
        localStorage.setItem('aestheticUser', JSON.stringify(user));
        startApp();
      }

      if (pendingUserAction) {
        document.getElementById('userDetailsModal')?.classList.add('hidden');
        const action = pendingUserAction;
        pendingUserAction = null;
        action();
      }
    } else {
      userSubscription = { plan: 'free', proUntil: 0 };
      updateProUI();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupPWA();
  checkInstamojoReturn();

  const saved = localStorage.getItem('aestheticUser');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.socials && typeof parsed.socials.insta === 'string') {
        user = {
          ...parsed,
          socials: {
            visible: true,
            insta: { val: parsed.socials.insta, visible: true },
            twitter: { val: parsed.socials.twitter, visible: true },
            fb: { val: parsed.socials.fb, visible: true }
          }
        };
      } else {
        user = parsed;
      }
    } catch (e) {}
  }

  startApp();
  initSwipeGestureDetection();

  document.getElementById('profilePicInput')?.addEventListener('change', handleFileSelect);
  document.getElementById('updateProfilePicInput')?.addEventListener('change', handleFileSelect);
  document.getElementById('customPosterInput')?.addEventListener('change', handleCustomPosterUpload);

  initPostersData();
  renderCategories();
  loadFeed();
});

function initSwipeGestureDetection() {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let targetCard = null;
  let isPointerDown = false;

  gallery.addEventListener('touchstart', (e) => {
    const card = e.target.closest('.poster-capture-area');
    if (!card) return;
    targetCard = card;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    didHorizontalSwipe = false;
  }, { passive: true });

  gallery.addEventListener('touchend', (e) => {
    if (!targetCard) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    handleSwipeEnd(startX, startY, endX, endY, startTime, targetCard);
    targetCard = null;
  }, { passive: true });

  gallery.addEventListener('mousedown', (e) => {
    const card = e.target.closest('.poster-capture-area');
    if (!card) return;
    targetCard = card;
    startX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
    isPointerDown = true;
    didHorizontalSwipe = false;
  });

  gallery.addEventListener('mouseup', (e) => {
    if (!isPointerDown || !targetCard) return;
    isPointerDown = false;
    handleSwipeEnd(startX, startY, e.clientX, e.clientY, startTime, targetCard);
    targetCard = null;
  });
}

function handleSwipeEnd(sx, sy, ex, ey, st, card) {
  const diffX = ex - sx;
  const diffY = ey - sy;
  const elapsed = Date.now() - st;

  if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY) && elapsed < 600) {
    didHorizontalSwipe = true;
    const direction = diffX < 0 ? 'next' : 'prev';
    cycleFeedStyle(card, direction);
    setTimeout(() => { didHorizontalSwipe = false; }, 250);
  }
}

function cycleFeedStyle(card, direction) {
  let currentIndex = parseInt(card.dataset.styleIndex || '0', 10);
  if (direction === 'next') {
    currentIndex = (currentIndex + 1) % SWIPE_STYLE_PRESETS.length;
  } else {
    currentIndex = (currentIndex - 1 + SWIPE_STYLE_PRESETS.length) % SWIPE_STYLE_PRESETS.length;
  }
  card.dataset.styleIndex = currentIndex;

  const preset = SWIPE_STYLE_PRESETS[currentIndex];
  const overlay = card.querySelector('.poster-overlay-container');
  const textBlock = card.querySelector('.profile-text');

  if (overlay) {
    overlay.classList.add('swipe-animating');
    overlay.classList.remove('theme-left', 'theme-center', 'theme-right');
    overlay.classList.add(preset.theme);

    overlay.style.background = `linear-gradient(to top, rgba(0,0,0,${FEED_OPACITY_BOTTOM}), rgba(0,0,0,${FEED_OPACITY_TOP})), url('${preset.bg}')`;
    overlay.style.backgroundSize = 'cover';
    overlay.style.backgroundPosition = 'center';

    if (textBlock) {
      textBlock.classList.remove('font-poppins', 'font-playfair', 'font-meow-script', 'font-pacifico', 'font-quicksand');
      textBlock.classList.add(preset.font);
    }

    setTimeout(() => {
      overlay.classList.remove('swipe-animating');
    }, 150);
  }

  showSwipeFeedback(card, preset.theme.replace('theme-', '').toUpperCase());
}

function showSwipeFeedback(card, themeName) {
  let badge = card.querySelector('.swipe-feedback-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'swipe-feedback-badge absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 text-white text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md pointer-events-none transition-all duration-300 opacity-0 z-40';
    card.appendChild(badge);
  }
  badge.innerHTML = `<i class="fas fa-magic text-yellow-300 mr-1"></i> ${themeName} Style`;
  badge.style.opacity = '1';
  badge.style.transform = 'translate(-50%, -50%) scale(1.05)';

  setTimeout(() => {
    badge.style.opacity = '0';
    badge.style.transform = 'translate(-50%, -50%) scale(0.95)';
  }, 650);
}

function hasProfileSetup() {
  const saved = localStorage.getItem('aestheticUser');
  return Boolean(saved || currentAuthUser);
}

function closeUserSetupModal() {
  pendingUserAction = null;
  document.getElementById('userDetailsModal')?.classList.add('hidden');
}

async function claimPendingReferral(myUid) {
  const referrerId = localStorage.getItem('posty_ref');
  if (!referrerId || referrerId === myUid) {
    if (referrerId === myUid) localStorage.removeItem('posty_ref');
    return;
  }

  try {
    const { data, error } = await sb.rpc('claim_referral', {
      referrer_uuid: referrerId
    });

    if (error) {
      if (error.message.includes('Already referred') || error.message.includes('not found') || error.message.includes('Self referral')) {
        localStorage.removeItem('posty_ref');
      }
    } else if (data) {
      if (data.success || data.error === 'Already referred') {
        localStorage.removeItem('posty_ref');
      }
    }
  } catch (e) {
    console.error('Referral network error:', e);
  }
}

async function fetchReferralCount(myUid) {
  if (!sb || !myUid) return;
  try {
    const { count, error } = await sb
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', myUid);

    if (error) return;

    const total = count || 0;
    const textEl = document.getElementById('refCountText');
    const barEl = document.getElementById('refProgressBar');
    const statusMsg = document.getElementById('refStatusMsg');

    if (textEl) textEl.innerText = `${Math.min(total, 10)} / 10`;
    if (barEl) barEl.style.width = `${Math.min(100, (total / 10) * 100)}%`;

    const m1 = document.getElementById('milestone-box-1');
    const mb1 = document.getElementById('milestone-badge-1');
    if (total >= 2) {
      m1?.classList.add('bg-emerald-100', 'border-emerald-500');
      if (mb1) { mb1.innerText = '✅ UNLOCKED'; mb1.className = 'text-[8px] font-bold text-emerald-700 block mt-0.5'; }
    }

    const m2 = document.getElementById('milestone-box-2');
    const mb2 = document.getElementById('milestone-badge-2');
    if (total >= 5) {
      m2?.classList.add('bg-teal-100', 'border-teal-500');
      if (mb2) { mb2.innerText = '✅ UNLOCKED'; mb2.className = 'text-[8px] font-bold text-teal-700 block mt-0.5'; }
    }

    const m3 = document.getElementById('milestone-box-3');
    const mb3 = document.getElementById('milestone-badge-3');
    if (total >= 10) {
      m3?.classList.add('bg-amber-100', 'border-amber-500');
      if (mb3) { mb3.innerText = '✅ UNLOCKED'; mb3.className = 'text-[8px] font-bold text-amber-700 block mt-0.5'; }
    }

    if (statusMsg) {
      if (total < 2) statusMsg.innerText = `Sirf ${2 - total} dost aur invite karein -> 7 Din Pro Free!`;
      else if (total < 5) statusMsg.innerText = `Sirf ${5 - total} dost aur invite karein -> 30 Din Pro Free!`;
      else if (total < 10) statusMsg.innerText = `Sirf ${10 - total} dost aur invite karein -> 90 Din Pro Free!`;
      else statusMsg.innerText = `🎉 Mubarak ho! Saare 3 Free Pro Milestones Unlock Ho Gaye!`;
    }
  } catch (err) {
    console.error('Fetch referral count error:', err);
  }
}

async function shareReferralOnWhatsApp() {
  if (!currentAuthUser) {
    await loginWithGoogle();
    return;
  }
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const refLink = `${window.location.origin}${baseUrl}?ref=${currentAuthUser.id}`;
  const msg = `Apni photo aur naam wala Good Morning, Bhakti & Festival Poster 5 second me FREE banayein! 👇✨\n\n${refLink}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

async function fetchUserSubscription(userId) {
  if (!sb || !userId) return;
  const { data } = await sb
    .from('subscriptions')
    .select('plan, pro_until')
    .eq('user_id', userId)
    .maybeSingle();

  if (data) {
    userSubscription = { plan: data.plan || 'free', proUntil: Number(data.pro_until || 0) };
  } else {
    userSubscription = { plan: 'free', proUntil: 0 };
  }
  updateProUI();
}

function isProUser() {
  if (FREE_LAUNCH_MODE) return true;
  return Boolean(currentAuthUser && userSubscription.proUntil > Date.now());
}

function requirePro(callback) {
  if (isProUser()) {
    callback();
  } else {
    openPricingModal();
  }
}

async function loginWithGoogle() {
  if (!sb) {
    alert("Pehle app.js me apna SUPABASE_URL aur SUPABASE_ANON_KEY daalein!");
    return;
  }
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${baseUrl}` }
  });
  if (error) alert("Google Login error: " + error.message);
}

async function logoutGoogle() {
  if (sb) {
    await sb.auth.signOut();
    currentAuthUser = null;
    userSubscription = { plan: 'free', proUntil: 0 };
    updateAuthUI();
    updateProUI();
  }
}

function updateAuthUI() {
  const loggedOut = document.getElementById('loggedOutView');
  const loggedIn = document.getElementById('loggedInView');
  const setupBtn = document.getElementById('setupGoogleBtn');

  if (currentAuthUser) {
    const meta = currentAuthUser.user_metadata || {};
    loggedOut?.classList.add('hidden');
    loggedIn?.classList.remove('hidden');
    const avatar = document.getElementById('authUserAvatar');
    const email = document.getElementById('authUserEmail');
    if (avatar) avatar.src = meta.avatar_url || meta.picture || user.pic;
    if (email) email.innerText = currentAuthUser.email || meta.full_name || meta.name || "Google User";
    if (setupBtn) setupBtn.innerHTML = `<i class="fas fa-check-circle text-emerald-500"></i> Logged in as ${meta.full_name || meta.name || currentAuthUser.email}`;
  } else {
    loggedOut?.classList.remove('hidden');
    loggedIn?.classList.add('hidden');
  }
}

function updateProUI() {
  const badge = document.getElementById('navProBadge');
  const badgeText = document.getElementById('navProText');
  const planStatus = document.getElementById('authPlanStatus');

  const proActive = isProUser();
  if (proActive) {
    const daysLeft = Math.max(1, Math.ceil((userSubscription.proUntil - Date.now()) / (1000 * 60 * 60 * 24)));
    if (badgeText) badgeText.innerText = `PRO (${daysLeft}d)`;
    if (badge) badge.className = "bg-emerald-600 text-white px-3 py-1.5 rounded-full text-[11px] font-bold shadow-sm flex items-center gap-1";
    if (planStatus) planStatus.innerText = `PRO ACTIVE • ${daysLeft} Days Left 👑`;
    document.querySelectorAll('.pro-lock-badge').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.watermark-strip').forEach(el => el.classList.add('hidden'));
  } else {
    if (badgeText) badgeText.innerText = "Get Pro";
    if (badge) badge.className = "bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-full text-[11px] font-bold shadow-sm hover:scale-105 transition flex items-center gap-1";
    if (planStatus) planStatus.innerText = "Free Plan (Upgrade to Pro)";
    document.querySelectorAll('.pro-lock-badge').forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('.watermark-strip').forEach(el => el.classList.remove('hidden'));
    hideWatermark = false;
    document.getElementById('editorWatermark')?.classList.remove('hidden');
  }
}

function openPricingModal() {
  updateAuthUI();
  updateProUI();
  if (currentAuthUser) fetchReferralCount(currentAuthUser.id);
  document.getElementById('pricingModal')?.classList.remove('hidden');
}

function closePricingModal() {
  document.getElementById('pricingModal')?.classList.add('hidden');
}

function selectPlan(planId) {
  selectedPlanId = planId;
  const c30 = document.getElementById('plan-card-30days');
  const c90 = document.getElementById('plan-card-90days');
  const btnText = document.getElementById('payBtnText');

  if (planId === '30days') {
    c30.className = "cursor-pointer rounded-2xl p-3.5 border-2 border-amber-500 bg-amber-50/60 transition relative shadow-md";
    c90.className = "cursor-pointer rounded-2xl p-3.5 border-2 border-gray-200 bg-gray-50/50 transition relative";
    if (btnText) btnText.innerText = "Instant Buy: 30 Days Pass — ₹49";
  } else {
    c90.className = "cursor-pointer rounded-2xl p-3.5 border-2 border-amber-500 bg-amber-50/60 transition relative shadow-md";
    c30.className = "cursor-pointer rounded-2xl p-3.5 border-2 border-gray-200 bg-gray-50/50 transition relative";
    if (btnText) btnText.innerText = "Instant Buy: 90 Days Pass — ₹99";
  }
}

async function startInstamojoPayment() {
  if (!currentAuthUser) {
    await loginWithGoogle();
    return;
  }

  const btn = document.getElementById('payNowBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Redirecting to Instamojo...';

  try {
    const meta = currentAuthUser.user_metadata || {};
    const res = await fetch(`${FUNCTIONS_URL}/create-instamojo-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        planId: selectedPlanId,
        uid: currentAuthUser.id,
        name: meta.full_name || meta.name || user.name,
        email: currentAuthUser.email || "",
        phone: user.contact || ""
      })
    });

    const data = await res.json();
    if (!data.paymentUrl) {
      const errMsg = data.error || data.message || JSON.stringify(data);
      throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    }
    window.location.href = data.paymentUrl;
  } catch (err) {
    alert("Payment start nahi ho paya: " + err.message);
    btn.disabled = false;
    selectPlan(selectedPlanId);
  }
}

async function checkInstamojoReturn() {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment_id');
  const paymentRequestId = params.get('payment_request_id');
  const paymentStatus = params.get('payment_status');

  if (!paymentId || !paymentRequestId) return;
  window.history.replaceState({}, document.title, window.location.pathname);

  if (paymentStatus !== 'Credit') {
    alert("Payment complete nahi hua (Status: " + (paymentStatus || 'Failed') + ").");
    return;
  }

  try {
    const res = await fetch(`${FUNCTIONS_URL}/verify-instamojo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ payment_id: paymentId, payment_request_id: paymentRequestId })
    });
    const data = await res.json();
    if (data.success) {
      if (sb && !currentAuthUser) {
        const { data: sessionData } = await sb.auth.getSession();
        currentAuthUser = sessionData?.session?.user || null;
      }
      if (currentAuthUser) await fetchUserSubscription(currentAuthUser.id);
      alert("🎉 Badhai ho! Aapka Posty Pro Pass activate ho gaya hai!");
    } else {
      alert("Payment verification failed: " + (data.error || ""));
    }
  } catch (err) {
    console.error("Verify error:", err);
  }
}

function toggleWatermark() {
  hideWatermark = !hideWatermark;
  const wm = document.getElementById('editorWatermark');
  if (wm) wm.classList.toggle('hidden', hideWatermark);
}

function setupPWA() {
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${baseUrl}sw.js`).catch(() => {});
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    checkDisplayMode();
  });

  checkDisplayMode();

  document.getElementById('installBtn')?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      document.getElementById('installBanner')?.classList.add('hidden');
    } else {
      alert('To install: Tap Share/Menu icon in browser -> Add to Home Screen');
    }
  });

  window.addEventListener('appinstalled', () => {
    document.getElementById('installBanner')?.classList.add('hidden');
  });
}

function checkDisplayMode() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const banner = document.getElementById('installBanner');
  if (!banner) return;
  if (isStandalone) {
    banner.classList.add('hidden');
  } else {
    banner.classList.remove('hidden');
    banner.classList.add('flex');
  }
}

window.addEventListener('popstate', () => {
  const modal = document.getElementById('modal');
  if (modal && !modal.classList.contains('hidden')) hideModalUI();
});

function hideModalUI() {
  document.getElementById('modal')?.classList.add('hidden');
  document.getElementById('floatingButtonsContainer')?.classList.add('hidden');
  document.getElementById('bottom-nav')?.classList.remove('hidden');
  ['fontListPanel', 'alignmentPanel', 'adjustmentsPanel', 'proStylePanel', 'quoteEditPanel', 'qualityPopup', 'textEditPanel', 'socialsEditPanel', 'cropperModal', 'shareReadyModal'].forEach(p => {
    document.getElementById(p)?.classList.add('hidden');
  });
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => updateAppImage(e.target.result);
    reader.readAsDataURL(file);
  }
  event.target.value = '';
}

function handleCustomPosterUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => openEditor(e.target.result);
    reader.readAsDataURL(file);
  }
  event.target.value = '';
}

function updateAppImage(src) {
  user.pic = src;
  ['modalProfilePic', 'previewProfilePic', 'navUserPic'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.src = src;
  });
  localStorage.setItem('aestheticUser', JSON.stringify(user));
}

function initManualCrop() { openCropper(user.pic); }

function openCropper(imageSrc) {
  const modal = document.getElementById('cropperModal');
  const image = document.getElementById('imageToCrop');
  if (image && modal) {
    image.src = imageSrc;
    modal.classList.remove('hidden');
    if (cropper) cropper.destroy();
    cropper = new window.Cropper(image, {
      aspectRatio: 1, viewMode: 1, dragMode: 'move', autoCropArea: 0.8,
      restore: false, guides: false, center: true, highlight: false,
      cropBoxMovable: false, cropBoxResizable: false, toggleDragModeOnDblclick: false,
      ready() { if (this.cropper) this.cropper.reset(); }
    });
  }
}

function cancelCrop() {
  const image = document.getElementById('imageToCrop');
  if (image && image.src) updateAppImage(image.src);
  document.getElementById('cropperModal')?.classList.add('hidden');
  if (cropper) { cropper.destroy(); cropper = null; }
}

function performCrop() {
  if (!cropper) return;
  const canvas = cropper.getCroppedCanvas({ width: 300, height: 300 });
  updateAppImage(canvas.toDataURL('image/png'));
  document.getElementById('cropperModal')?.classList.add('hidden');
  cropper.destroy();
  cropper = null;
}

function saveUserSetup() {
  const nameInput = document.getElementById('userNameInput');
  if (!nameInput || !nameInput.value.trim()) {
    alert("Kripya apna naam bharein!");
    return;
  }

  user.name = nameInput.value.trim();
  user.extra = document.getElementById('professionInput').value.trim() || "Digital Creator";
  user.contact = document.getElementById('mobileInput').value.trim() || "";

  const preview = document.getElementById('previewProfilePic');
  if (!user.pic && preview) user.pic = preview.src;

  const setupToggle = document.getElementById('setupSocialsToggle');
  const isSocialsVisible = setupToggle ? setupToggle.checked : true;

  user.socials = {
    visible: isSocialsVisible,
    insta: { val: document.getElementById('instaInput').value.trim(), visible: user.socials?.insta?.visible ?? true },
    twitter: { val: document.getElementById('twitterInput').value.trim(), visible: user.socials?.twitter?.visible ?? true },
    fb: { val: document.getElementById('fbInput').value.trim(), visible: user.socials?.fb?.visible ?? true }
  };

  localStorage.setItem('aestheticUser', JSON.stringify(user));
  document.getElementById('userDetailsModal')?.classList.add('hidden');
  startApp();
  loadFeed();

  if (pendingUserAction) {
    const action = pendingUserAction;
    pendingUserAction = null;
    action();
  }
}

function startApp() {
  document.getElementById('mainNav')?.classList.remove('hidden');
  document.getElementById('categoryBar')?.classList.remove('hidden');
  document.getElementById('mainContent')?.classList.remove('hidden');
  const navName = document.getElementById('navUserName');
  if (navName) navName.innerText = user.name;
  const navPic = document.getElementById('navUserPic');
  if (navPic) navPic.src = user.pic;
}

function initPostersData() {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;
  const raw = JSON.parse(gallery.dataset.posters || '[]');

  if (raw.length > 0) {
    allPosters = raw.map(item => typeof item === 'string' ? { url: item, category: 'Trending' } : item);
  } else if (MY_GALLERY_IMAGES.length > 0) {
    allPosters = MY_GALLERY_IMAGES.map(url => ({ url, category: 'Trending' }));
  } else {
    allPosters = Array.from({ length: 15 }, (_, i) => ({
      url: `https://picsum.photos/id/${i + 60}/600/800`,
      category: i % 2 === 0 ? 'Motivation' : 'Trending'
    }));
  }
}

function renderCategories() {
  const bar = document.getElementById('categoryBar');
  if (!bar) return;
  const cats = ['All', ...new Set(allPosters.map(p => p.category)), 'Favorites'];

  bar.innerHTML = cats.map(cat => {
    const isActive = cat === activeCategory;
    const classes = isActive
      ? 'bg-emerald-500 text-white shadow-sm'
      : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-100';
    return `<button onclick="filterCategory('${cat}')" class="px-3.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${classes}">${cat === 'Favorites' ? '❤️ Saved' : cat}</button>`;
  }).join('');
}

function filterCategory(cat) {
  activeCategory = cat;
  renderCategories();
  loadFeed();
  document.getElementById('mainContent')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleFavorite(url, btn) {
  if (favoriteUrls.includes(url)) {
    favoriteUrls = favoriteUrls.filter(u => u !== url);
    btn.innerHTML = '<i class="far fa-heart"></i>';
    btn.classList.remove('text-rose-500', 'bg-rose-50');
    btn.classList.add('text-emerald-600', 'bg-emerald-50');
  } else {
    favoriteUrls.push(url);
    btn.innerHTML = '<i class="fas fa-heart"></i>';
    btn.classList.remove('text-emerald-600', 'bg-emerald-50');
    btn.classList.add('text-rose-500', 'bg-rose-50');
  }
  localStorage.setItem('postyFavorites', JSON.stringify(favoriteUrls));
  if (activeCategory === 'Favorites') loadFeed();
}

function loadFeed() {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;

  let filtered = allPosters;
  if (activeCategory === 'Favorites') {
    filtered = allPosters.filter(p => favoriteUrls.includes(p.url));
  } else if (activeCategory !== 'All') {
    filtered = allPosters.filter(p => p.category === activeCategory);
  }

  if (filtered.length === 0) {
    gallery.innerHTML = `
      <div class="h-screen flex flex-col items-center justify-center text-center px-6">
        <i class="far fa-heart text-4xl text-emerald-300 mb-3"></i>
        <p class="text-emerald-700 font-bold text-sm">Abhi koi poster saved nahi hai!</p>
        <button onclick="filterCategory('All')" class="mt-3 bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold">All Posters Dekhein</button>
      </div>`;
    document.getElementById('loadingGallery')?.classList.add('hidden');
    return;
  }

  const displayList = [...filtered].sort(() => Math.random() - 0.5);
  gallery.innerHTML = '';

  displayList.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.id = `feed-item-${index}`;
    div.innerHTML = getPosterHTML(item.url, item.category, index);
    gallery.appendChild(div);
  });

  document.getElementById('loadingGallery')?.classList.add('hidden');
}

function getPosterHTML(url, category, index) {
  let socialsHTML = '';
  if (user.socials.visible) {
    const anyVisible = user.socials.insta.visible || user.socials.twitter.visible || user.socials.fb.visible;
    if (anyVisible) {
      socialsHTML += `<p class="text-[8px] font-bold opacity-80 uppercase tracking-widest mb-0.5 flex items-center gap-1">Follow Me</p><div class="social-inner-block flex flex-col gap-0.5 text-[9px] font-medium opacity-90">`;
      if (user.socials.insta.visible) {
        socialsHTML += `<div class="info-row"><i class="fab fa-instagram fw-icon ${!user.socials.insta.val ? 'opacity-60' : ''}"></i> ${user.socials.insta.val ? `<span>${user.socials.insta.val}</span>` : ''}</div>`;
      }
      if (user.socials.twitter.visible) {
        socialsHTML += `<div class="info-row"><i class="fab fa-twitter fw-icon ${!user.socials.twitter.val ? 'opacity-60' : ''}"></i> ${user.socials.twitter.val ? `<span>${user.socials.twitter.val}</span>` : ''}</div>`;
      }
      if (user.socials.fb.visible) {
        socialsHTML += `<div class="info-row"><i class="fab fa-facebook-f fw-icon ${!user.socials.fb.val ? 'opacity-60' : ''}"></i> ${user.socials.fb.val ? `<span>${user.socials.fb.val}</span>` : ''}</div>`;
      }
      socialsHTML += `</div>`;
    }
  }

  const isFav = favoriteUrls.includes(url);
  const defaultPreset = SWIPE_STYLE_PRESETS[index % SWIPE_STYLE_PRESETS.length];

  return `
    <div class="poster-card-wrapper relative">
      <div id="print-area-${index}" data-style-index="${index % SWIPE_STYLE_PRESETS.length}" class="poster-capture-area relative w-full" onclick="openEditor('${url}')">
        
        <!-- Image Container (Clean, koi side watermark nahi) -->
        <div class="relative w-full h-full">
          <img src="${url}" loading="lazy" class="main-img w-full block" alt="${category}" crossorigin="anonymous">
          <img src="${user.logo || SITE_LOGO_URL}" class="absolute top-2 right-2 w-10 h-10 object-contain drop-shadow-xl z-30" crossorigin="anonymous">

          <div class="capture-hide absolute bottom-1 right-2 z-20 pointer-events-none opacity-40 text-[8px] text-white font-bold flex items-center gap-1">
            <span>👈 Slide Style 👉</span>
          </div>
        </div>

        <!-- Profile Overlay (Watermark ab isi ke andar niche hai, bina black patti ke!) -->
        <div class="poster-overlay-container ${defaultPreset.theme}" style="background: linear-gradient(to top, rgba(0,0,0,${FEED_OPACITY_BOTTOM}), rgba(0,0,0,${FEED_OPACITY_TOP})), url('${defaultPreset.bg}');">
          <div class="profile-group">
            <div class="profile-pic-container shrink-0">
              <img src="${user.pic}" crossorigin="anonymous" class="w-14 h-14 rounded-full border-2 border-white/60 shadow-lg object-cover bg-white">
            </div>
            <div class="profile-text flex flex-col justify-center ${defaultPreset.font}">
              <h3 class="modal-profile-name font-bold text-lg leading-none drop-shadow-md mb-1">${user.name}</h3>
              <div class="details-block">
                <div class="info-row"><i class="fas fa-briefcase fw-icon"></i> ${user.extra}</div>
                <div class="info-row"><i class="fab fa-whatsapp fw-icon"></i> ${user.contact}</div>
              </div>
            </div>
          </div>
          <div class="social-group">${socialsHTML}</div>

          <!-- Profile ke andar hi niche chhota clean text -->
          <div class="watermark-strip absolute bottom-1 left-0 right-0 text-center pointer-events-none ${isProUser() ? 'hidden' : ''}">
            <span class="text-[8px] font-quicksand font-semibold tracking-wider opacity-75">Made with postbnao.com</span>
          </div>
        </div>
      </div>

      <div class="action-bar poster-actions-area bg-white p-3 border-t border-gray-100 flex justify-between items-center mt-auto">
        <div class="flex items-center gap-1.5 text-emerald-600 text-xs font-bold italic cursor-pointer hover:underline" onclick="openEditor('${url}')">
          <i class="fas fa-magic"></i> Tap to Edit
        </div>
        <div class="flex gap-2">
          <button onclick="toggleFavorite('${url}', this)" class="${isFav ? 'text-rose-500 bg-rose-50' : 'text-emerald-600 bg-emerald-50'} p-2 rounded-full transition shadow-sm w-9 h-9 flex items-center justify-center">
            <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
          </button>
          <button onclick="shareFeedItem('print-area-${index}', this)" class="bg-[#25D366] text-white p-2 rounded-full hover:scale-105 transition shadow-sm w-9 h-9 flex items-center justify-center">
            <i class="fab fa-whatsapp"></i>
          </button>
          <button onclick="requirePro(() => downloadFeedItem('print-area-${index}', this))" class="relative bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-2 rounded-full hover:scale-105 transition shadow-md w-9 h-9 flex items-center justify-center">
            <i class="fas fa-download"></i>
            <span class="pro-lock-badge absolute -top-1 -right-1 text-[8px]">👑</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

async function downloadFeedItem(containerId, btn) {
  const captureTarget = document.getElementById(containerId);
  const originalIcon = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i>';
  btn.disabled = true;
  try {
    const canvas = await window.html2canvas(captureTarget, {
      scale: 3, useCORS: true, allowTaint: false, backgroundColor: null,
      ignoreElements: (el) => el.classList?.contains('capture-hide'),
      onclone: (clonedDoc) => {
        const el = clonedDoc.getElementById(containerId);
        if (el) { el.style.borderRadius = '0'; el.style.border = 'none'; el.style.boxShadow = 'none'; }
      }
    });
    const link = document.createElement('a');
    link.download = `postbnao-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  } catch (err) {
    alert("Could not download image. Try opening editor.");
  } finally {
    btn.innerHTML = originalIcon;
    btn.disabled = false;
  }
}

function openShareReadyModal(file) {
  pendingShareFile = file;
  document.getElementById('shareReadyModal')?.classList.remove('hidden');
}

function closeShareReadyModal() {
  pendingShareFile = null;
  document.getElementById('shareReadyModal')?.classList.add('hidden');
}

async function triggerPendingShare() {
  if (!pendingShareFile) return;
  const file = pendingShareFile;
  closeShareReadyModal();
  try {
    await navigator.share({
      files: [file],
      title: 'Apne naam aur photo ke sath poster banayein!',
      text: 'Banayein apna poster: https://postbnao.com/posty/'
    });
  } catch (err) {
    if (err?.name !== 'AbortError') alert("Share cancelled ya browser supported nahi hai.");
  }
}

async function handleShareCanvas(canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Image generate nahi ho payi');

  const file = new File([blob], 'postbnao-poster.png', { type: 'image/png' });

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({
        files: [file],
        title: 'Apne naam aur photo ke sath poster banayein!',
        text: 'Banayein apna poster: https://postbnao.com/posty/'
      });
    } catch (shareErr) {
      if (shareErr?.name === 'AbortError') return;
      if (shareErr?.name === 'NotAllowedError') {
        openShareReadyModal(file);
        return;
      }
      throw shareErr;
    }
  } else {
    const link = document.createElement('a');
    link.download = `postbnao-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    alert("Is browser par direct share support nahi hai, image download ho gayi hai!");
  }
}

async function shareFeedItem(containerId, btn) {
  if (!hasProfileSetup()) {
    pendingUserAction = () => shareFeedItem(containerId, btn);
    document.getElementById('userDetailsModal')?.classList.remove('hidden');
    return;
  }

  const captureTarget = document.getElementById(containerId);
  if (!captureTarget) return;

  const originalIcon = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i>';
    btn.disabled = true;
    btn.classList.add('opacity-75', 'cursor-wait');
  }

  try {
    const canvas = await window.html2canvas(captureTarget, {
      scale: 1.5,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 5000,
      backgroundColor: null,
      ignoreElements: (el) =>
        (el.classList?.contains('gallery-item') && !el.contains(captureTarget)) ||
        el.classList?.contains('capture-hide') ||
        el.classList?.contains('swipe-feedback-badge') ||
        ['modal', 'pricingModal', 'userDetailsModal', 'shareReadyModal'].includes(el.id),
      onclone: (clonedDoc) => {
        const el = clonedDoc.getElementById(containerId);
        if (el) {
          el.style.borderRadius = '0';
          el.style.border = 'none';
          el.style.boxShadow = 'none';
        }
      }
    });

    await handleShareCanvas(canvas);
  } catch (err) {
    console.error('Share error:', err);
    alert("Share karne me samasya aayi. Kripya Download button try karein.");
  } finally {
    if (btn) {
      btn.innerHTML = originalIcon;
      btn.disabled = false;
      btn.classList.remove('opacity-75', 'cursor-wait');
    }
  }
}

async function sharePoster(btn) {
  const captureArea = document.getElementById('captureArea');
  if (!captureArea) return;

  const originalIcon = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fas fa-spinner animate-spin text-xs"></i>';
    btn.disabled = true;
    btn.classList.add('opacity-75', 'cursor-wait');
  }

  try {
    const canvas = await window.html2canvas(captureArea, {
      scale: 1.5,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 5000,
      backgroundColor: null,
      ignoreElements: (el) =>
        el.id === 'mainContent' ||
        el.classList?.contains('capture-hide') ||
        ['pricingModal', 'userDetailsModal', 'shareReadyModal'].includes(el.id),
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('.capture-hide').forEach(el => el.style.display = 'none');
        const captureDiv = clonedDoc.getElementById('captureArea');
        if (captureDiv) {
          captureDiv.style.border = 'none';
          captureDiv.style.boxShadow = 'none';
          captureDiv.style.borderRadius = '0';
        }
      }
    });

    await handleShareCanvas(canvas);
  } catch (err) {
    console.error('Share error:', err);
    alert("Share karne me samasya aayi. Kripya Download button try karein.");
  } finally {
    if (btn) {
      btn.innerHTML = originalIcon;
      btn.disabled = false;
      btn.classList.remove('opacity-75', 'cursor-wait');
    }
  }
}

function adjustNameSize() {
  const nameEl = document.getElementById('modalProfileName');
  if (!nameEl) return;
  nameEl.style.fontSize = '20px';
  let currentSize = 20;
  while (nameEl.scrollWidth > nameEl.offsetWidth && currentSize > 10) {
    currentSize -= 0.5;
    nameEl.style.fontSize = `${currentSize}px`;
  }
}

function openEditor(src) {
  if (didHorizontalSwipe) {
    didHorizontalSwipe = false;
    return;
  }

  if (!hasProfileSetup()) {
    pendingUserAction = () => openEditor(src);
    document.getElementById('userDetailsModal')?.classList.remove('hidden');
    return;
  }

  const modal = document.getElementById('modal');
  document.getElementById('modalImage').src = src;
  document.getElementById('modalProfileName').innerText = user.name;
  document.getElementById('modalProfileExtra').innerText = user.extra;
  document.getElementById('modalProfileContact').innerText = user.contact;
  document.getElementById('modalProfilePic').src = user.pic;
  document.getElementById('posterQuoteBox')?.classList.add('hidden');
  if (!isProUser()) {
    hideWatermark = false;
    document.getElementById('editorWatermark')?.classList.remove('hidden');
  }

  renderSocials();

  const overlay = document.getElementById('profileOverlay');
  const currentTheme = overlay.classList.contains('theme-right') ? 'right' : overlay.classList.contains('theme-center') ? 'center' : 'left';
  setTheme(currentTheme);

  const logoImg = document.getElementById('userLogoImg');
  if (logoImg) logoImg.src = user.logo || SITE_LOGO_URL;

  changeProfileBackground();
  document.getElementById('cardOpacitySlider').value = currentOpacity * 100;
  document.getElementById('opacityValueDisplay').innerText = Math.round(currentOpacity * 100) + '%';

  modal.classList.remove('hidden');
  document.getElementById('floatingButtonsContainer').classList.remove('hidden');
  document.getElementById('bottom-nav').classList.add('hidden');
  setTimeout(adjustNameSize, 50);
  window.history.pushState({ editorOpen: true }, "");
}

function setTextColor(color) {
  const overlay = document.getElementById('profileOverlay');
  if (overlay) overlay.style.color = color;
}

function setPhotoRing(ringClass) {
  const pic = document.getElementById('modalProfilePic');
  if (!pic) return;
  pic.classList.remove('ring-white', 'ring-gold', 'ring-emerald', 'ring-pink', 'ring-none');
  pic.classList.add(ringClass);
}

function setCardLayout(layout) {
  const overlay = document.getElementById('profileOverlay');
  if (!overlay) return;
  overlay.classList.remove('card-style-overlay', 'card-style-pill', 'card-style-glass');
  if (layout === 'overlay') overlay.classList.add('card-style-overlay');
  if (layout === 'pill') overlay.classList.add('card-style-pill');
  if (layout === 'glass') overlay.classList.add('card-style-glass');
}

function openQuotePanel() {
  const currentQuote = document.getElementById('posterQuoteText')?.innerText || '';
  document.getElementById('quoteInput').value = currentQuote;
  togglePanel('quoteEditPanel');
}

function savePosterQuote() {
  const val = document.getElementById('quoteInput').value.trim();
  const box = document.getElementById('posterQuoteBox');
  const textEl = document.getElementById('posterQuoteText');
  if (val) {
    textEl.innerText = val;
    box.classList.remove('hidden');
  } else {
    box.classList.add('hidden');
  }
  document.getElementById('quoteEditPanel')?.classList.add('hidden');
}

function removePosterQuote() {
  document.getElementById('posterQuoteText').innerText = '';
  document.getElementById('posterQuoteBox')?.classList.add('hidden');
  document.getElementById('quoteEditPanel')?.classList.add('hidden');
}

function renderSocials() {
  const socialsContainer = document.getElementById('socialsContainer');
  const mainSection = document.querySelector('#profileOverlay .social-media-section');
  if (!mainSection) return;

  const anyVisible = user.socials.insta.visible || user.socials.twitter.visible || user.socials.fb.visible;
  if (!user.socials.visible || !anyVisible) {
    mainSection.classList.add('hidden');
    mainSection.style.display = 'none';
  } else {
    mainSection.classList.remove('hidden');
    mainSection.style.display = '';
  }

  let itemsHTML = `<div class="social-inner-block flex flex-col gap-0.5 text-[9px] font-medium opacity-90">`;
  [
    { icon: 'fab fa-instagram', data: user.socials?.insta },
    { icon: 'fab fa-twitter', data: user.socials?.twitter },
    { icon: 'fab fa-facebook-f', data: user.socials?.fb }
  ].forEach(p => {
    if (!p.data?.visible) return;
    itemsHTML += p.data.val
      ? `<div class="info-row"><i class="${p.icon} fw-icon"></i> <span>${p.data.val}</span></div>`
      : `<div class="info-row"><i class="${p.icon} opacity-60 fw-icon"></i></div>`;
  });
  itemsHTML += `</div>`;
  socialsContainer.innerHTML = itemsHTML;
}

function editSocials() {
  document.getElementById('editInstaInput').value = user.socials?.insta?.val || '';
  document.getElementById('editTwitterInput').value = user.socials?.twitter?.val || '';
  document.getElementById('editFbInput').value = user.socials?.fb?.val || '';
  updateToggleButton('editorSocialsToggle', user.socials.visible);
  updateToggleButton('btn-insta', user.socials.insta.visible);
  updateToggleButton('btn-twitter', user.socials.twitter.visible);
  updateToggleButton('btn-fb', user.socials.fb.visible);

  ['fontListPanel', 'alignmentPanel', 'adjustmentsPanel', 'proStylePanel', 'quoteEditPanel', 'qualityPopup', 'textEditPanel'].forEach(p => document.getElementById(p)?.classList.add('hidden'));
  document.getElementById('socialsEditPanel')?.classList.remove('hidden');
}

function updateToggleButton(btnId, isVisible) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const icon = btn.querySelector('i');
  if (isVisible) {
    icon.className = 'fas fa-eye';
    btn.classList.remove('text-red-400', 'border-red-100', 'bg-red-50');
    if (btnId !== 'editorSocialsToggle') btn.classList.add('text-emerald-400');
  } else {
    icon.className = 'fas fa-eye-slash';
    if (btnId !== 'editorSocialsToggle') {
      btn.classList.add('text-red-400', 'border-red-100', 'bg-red-50');
      btn.classList.remove('text-emerald-400');
    }
  }
}

function toggleEditorSocials() {
  user.socials.visible = !user.socials.visible;
  updateToggleButton('editorSocialsToggle', user.socials.visible);
  renderSocials();
}

function toggleEditorPlatform(platform) {
  user.socials[platform].visible = !user.socials[platform].visible;
  updateToggleButton(`btn-${platform}`, user.socials[platform].visible);
  renderSocials();
}

function saveSocials() {
  user.socials.insta.val = document.getElementById('editInstaInput').value;
  user.socials.twitter.val = document.getElementById('editTwitterInput').value;
  user.socials.fb.val = document.getElementById('editFbInput').value;
  localStorage.setItem('aestheticUser', JSON.stringify(user));
  renderSocials();
  document.getElementById('socialsEditPanel')?.classList.add('hidden');
}

function closeModal() {
  if (window.history.state?.editorOpen) window.history.back();
  else hideModalUI();
}

function togglePanel(id) {
  const panel = document.getElementById(id);
  const panels = ['fontListPanel', 'alignmentPanel', 'adjustmentsPanel', 'proStylePanel', 'quoteEditPanel', 'qualityPopup', 'textEditPanel', 'socialsEditPanel'];
  if (panel && panel.classList.contains('hidden')) {
    panels.forEach(p => document.getElementById(p)?.classList.add('hidden'));
    panel.classList.remove('hidden');
  } else {
    panel?.classList.add('hidden');
  }
}

function selectFont(fontClass) {
  const target = document.querySelector('#modal .profile-text');
  if (!target) return;
  target.classList.remove('font-poppins', 'font-playfair', 'font-meow-script', 'font-pacifico', 'font-quicksand');
  target.classList.add(fontClass);
  setTimeout(adjustNameSize, 50);
}

function setTheme(alignment) {
  const overlay = document.getElementById('profileOverlay');
  overlay.classList.remove('theme-left', 'theme-right', 'theme-center');
  overlay.classList.add('theme-' + alignment);
  setTimeout(adjustNameSize, 50);
}

function updateProfileSize(val) {
  const pic = document.getElementById('modalProfilePic');
  pic.style.width = val + 'px';
  pic.style.height = val + 'px';
  document.getElementById('sizeValueDisplay').innerText = val + 'px';
}

function updateCardOpacity(val) {
  currentOpacity = val / 100;
  document.getElementById('opacityValueDisplay').innerText = val + '%';
  const overlay = document.getElementById('profileOverlay');
  overlay.style.background = `linear-gradient(to top, rgba(0,0,0,${currentOpacity}), rgba(0,0,0,${currentOpacity * 0.6})), url('${profileBackgrounds[currentBgIndex]}')`;
  overlay.style.backgroundSize = 'cover';
  overlay.style.backgroundPosition = 'center';
}

function changeProfileShape() {
  currentShapeIndex = (currentShapeIndex + 1) % profileShapes.length;
  const pic = document.getElementById('modalProfilePic');
  pic.classList.remove('rounded-full', 'rounded-none', 'rounded-2xl');
  pic.classList.add(profileShapes[currentShapeIndex]);
}

function applyFilter() {
  currentFilterIndex = (currentFilterIndex + 1) % filters.length;
  document.getElementById('modalImage').style.filter = filters[currentFilterIndex];
}

function changeProfileBackground() {
  currentBgIndex = (currentBgIndex + 1) % profileBackgrounds.length;
  const overlay = document.getElementById('profileOverlay');
  overlay.style.background = `linear-gradient(to top, rgba(0,0,0,${currentOpacity}), rgba(0,0,0,${currentOpacity * 0.6})), url('${profileBackgrounds[currentBgIndex]}')`;
  overlay.style.backgroundSize = 'cover';
  overlay.style.backgroundPosition = 'center';
}

async function downloadPoster(scale, btn) {
  const originalText = btn.innerHTML;
  const originalClass = btn.className;
  btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Saving...';
  btn.classList.add('opacity-75', 'cursor-wait');
  btn.disabled = true;

  try {
    const canvas = await window.html2canvas(document.getElementById('captureArea'), {
      scale, useCORS: true, allowTaint: false, backgroundColor: null,
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('.capture-hide').forEach(el => el.style.display = 'none');
        const captureDiv = clonedDoc.getElementById('captureArea');
        if (captureDiv) { captureDiv.style.border = 'none'; captureDiv.style.boxShadow = 'none'; captureDiv.style.borderRadius = '0'; }
      }
    });
    const link = document.createElement('a');
    link.download = `postbnao-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();

    btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
    setTimeout(() => {
      togglePanel('qualityPopup');
      btn.innerHTML = originalText;
      btn.className = originalClass;
      btn.disabled = false;
    }, 1000);
  } catch (err) {
    btn.innerHTML = '<i class="fas fa-times"></i> Error';
    setTimeout(() => { btn.innerHTML = originalText; btn.className = originalClass; btn.disabled = false; }, 2000);
  }
}

function editProfileText(id) {
  activeEditId = id;
  const input = document.getElementById('textEditInput');
  input.value = document.getElementById(id).innerText;
  document.getElementById('textEditPanel').classList.remove('hidden');
  input.focus();
}

function saveProfileText() {
  if (activeEditId) document.getElementById(activeEditId).innerText = document.getElementById('textEditInput').value;
  document.getElementById('textEditPanel').classList.add('hidden');
  if (activeEditId === 'modalProfileName') adjustNameSize();
}

function showDownloadOptions() { togglePanel('qualityPopup'); }

Object.assign(window, {
  initManualCrop, saveUserSetup, closeModal, togglePanel,
  selectFont, setTheme, updateProfileSize, updateCardOpacity, editProfileText,
  editSocials, saveProfileText, toggleEditorSocials, toggleEditorPlatform, saveSocials,
  cancelCrop, performCrop, showDownloadOptions, sharePoster, changeProfileShape,
  applyFilter, changeProfileBackground, downloadPoster, openEditor,
  shareFeedItem, downloadFeedItem, filterCategory, toggleFavorite,
  setTextColor, setPhotoRing, setCardLayout, openQuotePanel, savePosterQuote, removePosterQuote,
  isProUser, requirePro, loginWithGoogle, logoutGoogle, openPricingModal,
  closePricingModal, selectPlan, startInstamojoPayment, toggleWatermark, shareReferralOnWhatsApp,
  triggerPendingShare, closeShareReadyModal, closeUserSetupModal
});
