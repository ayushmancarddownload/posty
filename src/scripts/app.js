import { SITE_LOGO_URL, FEED_OPACITY_BOTTOM, FEED_OPACITY_TOP, MY_GALLERY_IMAGES } from '../data/posters.js';

let cropper;
let deferredPrompt;
let activeEditId = null;

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

const profileShapes = ['rounded-full', 'rounded-none', 'rounded-2xl'];
const filters = ['', 'grayscale(100%)', 'sepia(80%)', 'contrast(150%)', 'hue-rotate(45deg)'];
const fonts = ['font-poppins', 'font-playfair', 'font-meow-script', 'font-pacifico', 'font-quicksand'];

document.addEventListener('DOMContentLoaded', () => {
  setupPWA();

  const saved = localStorage.getItem('aestheticUser');
  if (saved) {
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
    startApp();
  } else {
    document.getElementById('userDetailsModal')?.classList.remove('hidden');
  }

  document.getElementById('profilePicInput')?.addEventListener('change', handleFileSelect);
  document.getElementById('updateProfilePicInput')?.addEventListener('change', handleFileSelect);
  loadFeed();
});

function setupPWA() {
  if ('serviceWorker' in navigator) {
    const baseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
navigator.serviceWorker.register(`${baseUrl}sw.js`)
      .then(() => console.log('Service Worker Registered'))
      .catch((err) => console.log('SW Error:', err));
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
  ['fontListPanel', 'alignmentPanel', 'adjustmentsPanel', 'qualityPopup', 'textEditPanel', 'socialsEditPanel', 'cropperModal'].forEach(p => {
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

function updateAppImage(src) {
  user.pic = src;
  ['modalProfilePic', 'previewProfilePic', 'navUserPic'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.src = src;
  });
  localStorage.setItem('aestheticUser', JSON.stringify(user));
}

function initManualCrop() {
  openCropper(user.pic);
}

function openCropper(imageSrc) {
  const modal = document.getElementById('cropperModal');
  const image = document.getElementById('imageToCrop');
  if (image && modal) {
    image.src = imageSrc;
    modal.classList.remove('hidden');
    if (cropper) cropper.destroy();
    cropper = new window.Cropper(image, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      restore: false,
      guides: false,
      center: true,
      highlight: false,
      cropBoxMovable: false,
      cropBoxResizable: false,
      toggleDragModeOnDblclick: false,
      ready() {
        if (this.cropper) this.cropper.reset();
      }
    });
  }
}

function cancelCrop() {
  const image = document.getElementById('imageToCrop');
  if (image && image.src) updateAppImage(image.src);
  document.getElementById('cropperModal')?.classList.add('hidden');
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
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
  if (!nameInput || !nameInput.value.trim()) return;

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
}

function startApp() {
  document.getElementById('mainNav')?.classList.remove('hidden');
  document.getElementById('mainContent')?.classList.remove('hidden');
  const navName = document.getElementById('navUserName');
  if (navName) navName.innerText = user.name;
  const navPic = document.getElementById('navUserPic');
  if (navPic) navPic.src = user.pic;
}

function loadFeed() {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;

  const autoPosters = JSON.parse(gallery.dataset.posters || '[]');
  let images = autoPosters.length > 0
    ? [...autoPosters]
    : (MY_GALLERY_IMAGES.length > 0
      ? [...MY_GALLERY_IMAGES]
      : Array.from({ length: 24 }, (_, i) => `https://picsum.photos/id/${i + 60}/600/800`));

  images = images.sort(() => Math.random() - 0.5);
  gallery.innerHTML = '';

  images.forEach((url, index) => {
    const themes = ['theme-left', 'theme-center', 'theme-right'];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    const randomBg = profileBackgrounds[Math.floor(Math.random() * profileBackgrounds.length)];
    const randomFont = fonts[Math.floor(Math.random() * fonts.length)];

    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.id = `feed-item-${index}`;
    div.innerHTML = getPosterHTML(url, randomTheme, randomBg, randomFont, index);
    gallery.appendChild(div);
  });

  document.getElementById('loadingGallery')?.classList.add('hidden');
}

function getPosterHTML(url, theme, bg, fontClass, index) {
  let socialsHTML = '';
  if (user.socials.visible) {
    const anyVisible = user.socials.insta.visible || user.socials.twitter.visible || user.socials.fb.visible;
    if (anyVisible) {
      socialsHTML += `<p class="text-[8px] font-bold opacity-80 uppercase tracking-widest mb-0.5 flex items-center gap-1">Follow Me <i class="fas fa-pen text-[8px] opacity-50 capture-hide"></i></p><div class="social-inner-block flex flex-col gap-0.5 text-[9px] font-medium opacity-90">`;
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

  return `
    <div class="poster-card-wrapper relative">
      <div id="print-area-${index}" class="poster-capture-area relative w-full" onclick="openEditor('${url}')">
        <div class="relative w-full h-full">
          <img src="${url}" loading="lazy" class="main-img w-full block" alt="Poster" onload="handleImageLoad(this)" crossorigin="anonymous">
          <img src="${user.logo || SITE_LOGO_URL}" class="absolute top-2 right-2 w-12 h-12 object-contain drop-shadow-xl z-30" crossorigin="anonymous">
          <div class="absolute bottom-2 left-2 z-30 pointer-events-none bg-black/40 px-3 py-1 rounded-full backdrop-blur-[1px]">
            <span class="text-[7px] text-white font-quicksand font-bold tracking-[0.3em] uppercase drop-shadow-md">Generated By Mysite.com</span>
          </div>
        </div>
        <div class="poster-overlay-container ${theme}" style="background: linear-gradient(to top, rgba(0,0,0,${FEED_OPACITY_BOTTOM}), rgba(0,0,0,${FEED_OPACITY_TOP})), url('${bg}');">
          <div class="profile-group">
            <div class="profile-pic-container shrink-0">
              <img src="${user.pic}" class="w-14 h-14 rounded-full border-2 border-white/50 shadow-lg object-cover bg-white">
            </div>
            <div class="profile-text flex flex-col justify-center ${fontClass || ''}">
              <h3 class="modal-profile-name font-bold text-lg leading-none drop-shadow-md mb-1">${user.name}</h3>
              <div class="details-block">
                <div class="info-row"><i class="fas fa-briefcase fw-icon"></i> ${user.extra}</div>
                <div class="info-row"><i class="fab fa-whatsapp fw-icon"></i> ${user.contact}</div>
              </div>
            </div>
          </div>
          <div class="social-group">${socialsHTML}</div>
        </div>
      </div>
      <div class="action-bar poster-actions-area bg-white p-3 border-t border-gray-100 flex justify-between items-center mt-auto">
        <div class="flex items-center gap-1 text-emerald-600 text-xs font-bold italic cursor-pointer hover:underline" onclick="openEditor('${url}')">
          <i class="fas fa-magic"></i> Tap to Edit
        </div>
        <div class="flex gap-2">
          <button onclick="shareFeedItem('print-area-${index}')" class="bg-emerald-50 text-emerald-600 p-2 rounded-full hover:bg-emerald-100 transition shadow-sm w-9 h-9 flex items-center justify-center"><i class="fas fa-share-alt"></i></button>
          <button onclick="downloadFeedItem('print-area-${index}', this)" class="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-2 rounded-full hover:scale-105 transition shadow-md w-9 h-9 flex items-center justify-center"><i class="fas fa-download"></i></button>
        </div>
      </div>
    </div>
  `;
}

async function downloadFeedItem(containerId, btn) {
  const captureTarget = document.getElementById(containerId);
  const originalIcon = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i>';
  try {
    const canvas = await window.html2canvas(captureTarget, {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      onclone: (clonedDoc) => {
        const el = clonedDoc.getElementById(containerId);
        if (el) {
          el.style.borderRadius = '0';
          el.style.border = 'none';
          el.style.boxShadow = 'none';
        }
      }
    });
    const link = document.createElement('a');
    link.download = `aesthetic-post-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  } catch (err) {
    alert("Could not download image. Try opening it first.");
  } finally {
    btn.innerHTML = originalIcon;
  }
}

async function shareFeedItem(containerId) {
  const captureTarget = document.getElementById(containerId);
  try {
    const canvas = await window.html2canvas(captureTarget, { scale: 2, useCORS: true });
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'poster.png', { type: 'image/png' });
      if (navigator.share) {
        await navigator.share({ files: [file], title: 'Check out this design!' });
      } else {
        alert("Sharing not supported on this browser.");
      }
    });
  } catch (err) {}
}

function handleImageLoad(img) {
  img.classList.add('loaded');
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
  const modal = document.getElementById('modal');
  document.getElementById('modalImage').src = src;
  document.getElementById('modalProfileName').innerText = user.name;
  document.getElementById('modalProfileExtra').innerText = user.extra;
  document.getElementById('modalProfileContact').innerText = user.contact;
  document.getElementById('modalProfilePic').src = user.pic;

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
  const platforms = [
    { icon: 'fab fa-instagram', data: user.socials?.insta },
    { icon: 'fab fa-twitter', data: user.socials?.twitter },
    { icon: 'fab fa-facebook-f', data: user.socials?.fb }
  ];

  platforms.forEach(p => {
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

  ['fontListPanel', 'alignmentPanel', 'adjustmentsPanel', 'qualityPopup', 'textEditPanel'].forEach(p => document.getElementById(p)?.classList.add('hidden'));
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
  const panels = ['fontListPanel', 'alignmentPanel', 'adjustmentsPanel', 'qualityPopup', 'textEditPanel', 'socialsEditPanel'];
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

async function sharePoster() {
  const captureArea = document.getElementById('captureArea');
  try {
    const canvas = await window.html2canvas(captureArea, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      onclone: (clonedDoc) => clonedDoc.querySelectorAll('.capture-hide').forEach(el => el.style.display = 'none')
    });
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'poster.png', { type: 'image/png' });
      if (navigator.share) await navigator.share({ files: [file], title: 'Look at my Aesthetic Poster! ✨' });
    });
  } catch (err) {}
}

async function downloadPoster(scale, btn) {
  const originalText = btn.innerHTML;
  const originalClass = btn.className;
  btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Saving...';
  btn.classList.add('opacity-75', 'cursor-wait');
  btn.disabled = true;

  try {
    const canvas = await window.html2canvas(document.getElementById('captureArea'), {
      scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
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
    const link = document.createElement('a');
    link.download = `poster-${Date.now()}.png`;
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
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.className = originalClass;
      btn.disabled = false;
    }, 2000);
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

function showDownloadOptions() {
  togglePanel('qualityPopup');
}

function toggleEditProfilePopup() {
  const modal = document.getElementById('userDetailsModal');
  if (modal.classList.contains('hidden')) {
    document.getElementById('userNameInput').value = user.name;
    document.getElementById('professionInput').value = user.extra || "";
    document.getElementById('mobileInput').value = user.contact || "";
    document.getElementById('instaInput').value = user.socials?.insta?.val || "";
    document.getElementById('twitterInput').value = user.socials?.twitter?.val || "";
    document.getElementById('fbInput').value = user.socials?.fb?.val || "";
    const followToggle = document.getElementById('setupSocialsToggle');
    if (followToggle) followToggle.checked = user.socials?.visible ?? true;
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

Object.assign(window, {
  initManualCrop, saveUserSetup, toggleEditProfilePopup, closeModal, togglePanel,
  selectFont, setTheme, updateProfileSize, updateCardOpacity, editProfileText,
  editSocials, saveProfileText, toggleEditorSocials, toggleEditorPlatform, saveSocials,
  cancelCrop, performCrop, showDownloadOptions, sharePoster, changeProfileShape,
  applyFilter, changeProfileBackground, downloadPoster, openEditor, handleImageLoad,
  shareFeedItem, downloadFeedItem
});
