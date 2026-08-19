/**
 * ============================================================================
 * MODULE: Modal, Navigation, Router & UI State Management
 * FILE: js/ui/modal.js
 * DESCRIPTION:
 *   Handles page transitions via hash-based routing, modal overlays,
 *   embedded media player control, theme toggling, navigation drawer state,
 *   accessibility focus-trapping, and system notification banners.
 * ============================================================================
 */

import { renderLevelsDashboard } from './list.js';

// ============================================================================
// CONSTANTS & STATE VARIABLES
// ============================================================================

/** Registered page container IDs in index.html without the 'Page' suffix */
const CORE_PAGES = Object.freeze([
  'landingPage',
  'levelsPage',
  'statsPage',
  'detailPage',
  'playerVideoPage'
]);

/** Lock flag preventing loopback execution during programmatically pushed history states */
let ignoreNextHashChange = false;

/** Tracks previously focused element prior to modal opening for accessibility restoration */
let lastActiveElementBeforeModal = null;

/** Currently opened modal element reference */
let activeModalElement = null;

// ============================================================================
// HASH ROUTING & PAGE CONTROLLER
// ============================================================================

/**
 * Parses URL location hash string into a structured page and parameters object.
 * @param {string} h - Raw window.location.hash string (e.g. "#detail?level=123&tab=demons")
 * @returns {{ page: string, params: Object<string, string> }} Parsed page name and key-value parameter map.
 */
export function parseHashHash(h) {
  if (!h || typeof h !== 'string') {
    return { page: 'landing', params: {} };
  }

  const raw = h.replace(/^#/, '').trim();
  if (!raw) {
    return { page: 'landing', params: {} };
  }

  const [pagePart, queryPart] = raw.split('?');
  const page = pagePart ? pagePart.trim() : 'landing';
  const params = {};

  if (queryPart) {
    const pairs = queryPart.split('&');
    for (let i = 0; i < pairs.length; i++) {
      const kv = pairs[i];
      if (!kv) continue;
      const [key, val] = kv.split('=');
      if (key) {
        try {
          params[decodeURIComponent(key.trim())] = decodeURIComponent((val || '').trim());
        } catch (e) {
          params[key.trim()] = (val || '').trim();
        }
      }
    }
  }

  return { page, params };
}

/**
 * Constructs a valid URL hash string from a page identifier and parameter dictionary.
 * @param {string} page - Target page name (e.g. "detail")
 * @param {Object<string, string|number>} [params={}] - Key-value pair options
 * @returns {string} Formatted hash string (e.g. "#detail?level=clubstep")
 */
export function buildHash(page, params = {}) {
  const keys = Object.keys(params || {});
  if (keys.length === 0) {
    return `#${page}`;
  }

  const queryString = keys
    .filter(key => params[key] !== undefined && params[key] !== null)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  return `#${page}${queryString ? '?' + queryString : ''}`;
}

/**
 * Executes visibility toggling for target page views and clears transient media DOM elements.
 * @param {string} pageId - Target page prefix name (without 'Page' suffix)
 * @param {Object<string, string>} [params={}] - Parameters passed to page lifecycle hooks
 * @param {boolean} [push=true] - Whether to push state to browser history stack
 */
export function showPage(pageId, params = {}, push = true) {
  // Terminate and clear active player frames to stop ambient audio
  const mainVid = document.getElementById('video');
  const playerVid = document.getElementById('pvVideo');
  
  if (mainVid) mainVid.innerHTML = '';
  if (playerVid) playerVid.innerHTML = '';

  // Close mobile navigation drawer on page transition
  closeNavMenu();

  // Hide all registered core pages
  CORE_PAGES.forEach(id => {
    const pageEl = document.getElementById(id);
    if (pageEl) {
      pageEl.style.display = 'none';
      pageEl.classList.remove('active-page');
      pageEl.setAttribute('aria-hidden', 'true');
    }
  });

  // Activate target container
  const targetPage = document.getElementById(`${pageId}Page`);
  if (targetPage) {
    targetPage.style.display = 'block';
    targetPage.classList.add('active-page');
    targetPage.setAttribute('aria-hidden', 'false');
    window.scrollTo({ top: 0, behavior: 'instant' });
  } else {
    console.warn(`[Router] Target page container "#${pageId}Page" missing from DOM. Falling back to landingPage.`);
    const fallback = document.getElementById('landingPage');
    if (fallback) {
      fallback.style.display = 'block';
      fallback.classList.add('active-page');
      fallback.setAttribute('aria-hidden', 'false');
    }
  }

  // Synchronize browser URL location hash
  if (push) {
    const newHash = buildHash(pageId, params);
    ignoreNextHashChange = true;
    location.hash = newHash;
    setTimeout(() => { ignoreNextHashChange = false; }, 60);
  }

  // Dispatch lifecycle hooks attached to global scope
  try {
    if (pageId === 'detail' && params.level && typeof window.routeToDetail === 'function') {
      window.routeToDetail(params.level, params);
    }
    if (pageId === 'playerVideo' && typeof window.routeToPlayerVideo === 'function') {
      window.routeToPlayerVideo(params.level || '', params.videoLink || '');
    }
  } catch (err) {
    console.error(`[Router] Exception dispatched inside lifecycle hook for route "${pageId}":`, err);
  }
}

/**
 * Convenience wrapper method for programmatically pushing a new history state route.
 * @param {string} pageId - Target page identifier
 * @param {Object<string, string>} [params={}] - Page options
 */
export function switchPage(pageId, params = {}) {
  showPage(pageId, params, true);
}

/**
 * Event handler bound to window 'hashchange' listener.
 */
export function handleHashChangeEvent() {
  if (ignoreNextHashChange) return;
  const { page, params } = parseHashHash(location.hash);
  showPage(page, params, false);
}

/**
 * Bootstraps route initialization after core application state loading completes.
 */
export function handleHashRouteOnLoad() {
  const { page, params } = parseHashHash(location.hash);
  showPage(page || 'landing', params || {}, false);
}

// ============================================================================
// NAVIGATION MENU CONTROLLER
// ============================================================================

/**
 * Toggles visibility state of mobile navigation overlay menu.
 */
export function toggleNavMenu() {
  const menu = document.getElementById('navMenu');
  const toggleBtn = document.getElementById('navToggleBtn');
  if (!menu) return;

  const isOpen = menu.classList.contains('open');
  if (isOpen) {
    menu.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  } else {
    menu.classList.add('open');
    menu.setAttribute('aria-expanded', 'true');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  }
}

/**
 * Explicitly closes mobile navigation overlay menu.
 */
export function closeNavMenu() {
  const menu = document.getElementById('navMenu');
  const toggleBtn = document.getElementById('navToggleBtn');
  if (menu && menu.classList.contains('open')) {
    menu.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Directs view hierarchy to main levels dashboard page.
 */
export function goToLevelsDashboard() {
  switchPage('levels');
  const sBox = document.getElementById('submissionBox');
  if (sBox) sBox.style.display = 'block';
  
  if (typeof renderLevelsDashboard === 'function') {
    renderLevelsDashboard();
  }
}

/**
 * Directs router to levels dashboard and smoothly scrolls to submission box.
 */
export function goToSubmissionBox() {
  switchPage('levels');
  window.requestAnimationFrame(() => {
    setTimeout(() => {
      const sBox = document.getElementById('submissionBox');
      if (sBox) {
        sBox.style.display = 'block';
        sBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  });
}

// ============================================================================
// MODAL DIALOG CONTROLLER & ACCESSIBILITY
// ============================================================================

/**
 * Traps keyboard focus navigation inside active modal dialog (WCAG 2.1 Compliance).
 * @param {KeyboardEvent} e - Keyboard event
 * @param {HTMLElement} modalEl - Active modal element container
 */
function handleModalFocusTrap(e, modalEl) {
  if (e.key !== 'Tab' || !modalEl) return;

  const focusables = modalEl.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;

  const firstEl = focusables[0];
  const lastEl = focusables[focusables.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    }
  } else {
    if (document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  }
}

/**
 * Generalized function to open modal instances with background scroll-lock and ARIA updates.
 * @param {string} modalId - Target modal element ID
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    console.error(`[Modal] Modal element with ID "#${modalId}" does not exist.`);
    return;
  }

  lastActiveElementBeforeModal = document.activeElement;
  activeModalElement = modal;

  modal.style.display = 'flex';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';

  // Set focus to modal or first focusable element inside
  const focusTarget = modal.querySelector('[data-autofocus]') || modal.querySelector('button, [tabindex="0"]');
  if (focusTarget) {
    focusTarget.focus();
  }
}

/**
 * Generalized function to close active modal instances and restore page state.
 * @param {string} modalId - Target modal element ID
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';

  activeModalElement = null;

  // Restore body scrolling if no other modals are open
  const anyRemainingModals = document.querySelector('.modal.active, .modal-backdrop.active');
  if (!anyRemainingModals) {
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  }

  // Restore focus to element active before modal opened
  if (lastActiveElementBeforeModal && typeof lastActiveElementBeforeModal.focus === 'function') {
    lastActiveElementBeforeModal.focus();
    lastActiveElementBeforeModal = null;
  }
}

/**
 * Opens submission rules & guidelines overlay dialog.
 */
export function openGuidelinesModal() {
  closeNavMenu();
  openModal('guidelinesModal');
}

/**
 * Closes submission rules & guidelines overlay dialog.
 */
export function closeGuidelinesModal() {
  closeModal('guidelinesModal');
}

// ============================================================================
// EMBEDDED MEDIA PLAYER MODAL
// ============================================================================

/**
 * Converts standard YouTube/Twitch video URLs into embeddable iframe endpoints.
 * @param {string} url - Original video web link
 * @returns {string} Processed iframe player URL source
 */
export function parseEmbedVideoUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  let clean = url.trim();

  // YouTube Watch URLs
  if (clean.includes('youtube.com/watch')) {
    try {
      const parsedUrl = new URL(clean);
      const videoId = parsedUrl.searchParams.get('v');
      return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : clean;
    } catch (e) {
      return clean.replace('watch?v=', 'embed/') + '?autoplay=1&rel=0';
    }
  }

  // YouTube Short URLs
  if (clean.includes('youtu.be/')) {
    const videoId = clean.split('youtu.be/')[1]?.split('?')[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : clean;
  }

  // YouTube Shorts Format
  if (clean.includes('youtube.com/shorts/')) {
    const videoId = clean.split('youtube.com/shorts/')[1]?.split('?')[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : clean;
  }

  // Twitch Clips Format
  if (clean.includes('clips.twitch.tv/')) {
    const clipId = clean.split('clips.twitch.tv/')[1]?.split('?')[0];
    const hostname = window.location.hostname || 'localhost';
    return clipId ? `https://clips.twitch.tv/embed?clip=${clipId}&parent=${hostname}` : clean;
  }

  return clean;
}

/**
 * Populates and displays video modal player overlay with specified video stream URL.
 * @param {string} videoUrl - Target proof record video link
 * @param {string} [playerName=""] - Optional victor display name
 * @param {string} [levelName=""] - Optional demon level title
 */
export function viewPlayerVideo(videoUrl, playerName = '', levelName = '') {
  if (!videoUrl || videoUrl === '#' || videoUrl.toUpperCase() === 'N/A') {
    showToast('No proof video link available for this record.', 'warning');
    return;
  }

  const iframe = document.getElementById('videoPlayerIframe');
  const titleElem = document.getElementById('videoModalTitle');
  const embedUrl = parseEmbedVideoUrl(videoUrl);

  if (titleElem) {
    if (playerName && levelName) {
      titleElem.textContent = `${playerName} — ${levelName}`;
    } else if (levelName) {
      titleElem.textContent = levelName;
    } else if (playerName) {
      titleElem.textContent = `Record Proof: ${playerName}`;
    } else {
      titleElem.textContent = 'Record Proof Video';
    }
  }

  if (iframe) {
    iframe.src = embedUrl;
  }

  openModal('videoModal');
}

/**
 * Safely terminates video player modal and resets frame source to eliminate background audio.
 */
export function closeVideoModal() {
  const iframe = document.getElementById('videoPlayerIframe');
  if (iframe) {
    iframe.src = '';
  }
  closeModal('videoModal');
}

// ============================================================================
// THEME MANAGEMENT ENGINE
// ============================================================================

/**
 * Updates UI textual label state for theme toggle triggers.
 */
export function updateThemeToggleText() {
  const toggleButtons = document.querySelectorAll('.theme-toggle-btn, #themeToggle');
  const isLight = document.body.classList.contains('light-theme');
  
  toggleButtons.forEach(btn => {
    btn.textContent = isLight ? 'Toggle Dark Mode' : 'Toggle Light Mode';
    btn.setAttribute('aria-label', isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode');
  });
}

/**
 * Toggles app theme state between dark and light modes, persisting preference in localStorage.
 */
export function toggleThemeMode() {
  document.body.classList.toggle('light-theme');
  const isLight = document.body.classList.contains('light-theme');
  
  try {
    localStorage.setItem('pshsmc_theme', isLight ? 'light' : 'dark');
  } catch (e) {
    console.warn('[Theme] Unable to save theme preference to localStorage.');
  }

  updateThemeToggleText();
  closeNavMenu();
}

// ============================================================================
// NOTIFICATION & FEEDBACK BANNERS
// ============================================================================

/**
 * Injects a formatted inline fallback notification message inside a target DOM node.
 * @param {string} elementId - ID of target element container
 * @param {string} message - Message text string
 */
export function displayFallbackUIMessage(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.innerHTML = `
    <div class="fallback-ui-message" style="color:var(--accent, #ff4757); text-align:center; padding:24px 16px; font-size:13px; line-height:1.5;">
      <span class="fallback-icon" style="display:block; font-size:20px; margin-bottom:8px;">⚠️</span>
      ${message}
    </div>
  `;
}

/**
 * Displays persistent network offline warning banner.
 * @param {string} message - Warning alert text
 */
export function showOfflineBanner(message) {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;

  banner.textContent = message;
  banner.hidden = false;
  banner.classList.add('visible');
}

/**
 * Displays temporary toast message banner overlay.
 * @param {string} message - Text notification string
 * @param {'info'|'warning'|'error'|'success'} [type='info'] - Severity variant
 * @param {number} [duration=3500] - Duration in milliseconds before auto-dismissal
 */
export function showToast(message, type = 'info', duration = 3500) {
  let toastContainer = document.getElementById('toastContainer');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  toast.style.cssText = `
    pointer-events: auto;
    padding: 12px 18px;
    border-radius: 6px;
    background: var(--card-bg, #1e1e24);
    color: var(--text-color, #ffffff);
    border-left: 4px solid var(--accent, #74b9ff);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-size: 13px;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.25s cubic-bezier(0.1, 0.9, 0.2, 1);
  `;

  if (type === 'error') toast.style.borderLeftColor = '#ff4757';
  if (type === 'warning') toast.style.borderLeftColor = '#ffa502';
  if (type === 'success') toast.style.borderLeftColor = '#2ed573';

  toast.textContent = message;
  toastContainer.appendChild(toast);

  // Trigger entrance transition
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Auto dismissal cleanup
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// ============================================================================
// EVENT LISTENERS INITIALIZATION
// ============================================================================

/**
 * Registers global document keyboard and overlay click event handling routines.
 */
export function initModalListeners() {
  // Global backdrop click dismissal
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop') || e.target.classList.contains('modal')) {
      const modalId = e.target.id;
      if (modalId === 'videoModal') {
        closeVideoModal();
      } else if (modalId) {
        closeModal(modalId);
      } else {
        closeGuidelinesModal();
        closeVideoModal();
      }
    }
  });

  // Keyboard shortcut listeners (Escape to close, Tab for focus trap)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (activeModalElement) {
        const modalId = activeModalElement.id;
        if (modalId === 'videoModal') {
          closeVideoModal();
        } else {
          closeModal(modalId);
        }
      } else {
        closeGuidelinesModal();
        closeVideoModal();
        closeNavMenu();
      }
    }

    if (e.key === 'Tab' && activeModalElement) {
      handleModalFocusTrap(e, activeModalElement);
    }
  });
}

// Bind router hash change event listener immediately
window.addEventListener('hashchange', handleHashChangeEvent);

// Auto-run keyboard and backdrop interaction setup
initModalListeners();

// ============================================================================
// GLOBAL WINDOW SCOPE ATTACHMENTS (FOR INLINE HTML ATTRIBUTES)
// ============================================================================

window.switchPage = switchPage;
window.goToLevelsDashboard = goToLevelsDashboard;
window.goToSubmissionBox = goToSubmissionBox;
window.toggleNavMenu = toggleNavMenu;
window.closeNavMenu = closeNavMenu;
window.openModal = openModal;
window.closeModal = closeModal;
window.openGuidelinesModal = openGuidelinesModal;
window.closeGuidelinesModal = closeGuidelinesModal;
window.viewPlayerVideo = viewPlayerVideo;
window.closeVideoModal = closeVideoModal;
window.toggleThemeMode = toggleThemeMode;
window.showOfflineBanner = showOfflineBanner;
window.handleHashRouteOnLoad = handleHashRouteOnLoad;
window.showToast = showToast;

// ============================================================================
// EXPORTS FOR MODULAR ES IMPORT
// ============================================================================

export {
  switchPage as switchPageExport,
  showPage,
  handleHashChangeEvent,
  handleHashRouteOnLoad,
  toggleNavMenu,
  closeNavMenu,
  goToLevelsDashboard,
  goToSubmissionBox,
  openModal,
  closeModal,
  openGuidelinesModal,
  closeGuidelinesModal,
  viewPlayerVideo,
  closeVideoModal,
  updateThemeToggleText,
  toggleThemeMode,
  displayFallbackUIMessage,
  showOfflineBanner,
  showToast,
  initModalListeners
};
