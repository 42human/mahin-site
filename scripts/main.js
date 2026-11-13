/**
 * MAHIN - OFFICIAL WEBSITE INTERACTIVE SCRIPTS
 * Kinetic animations, loader, cursor and navigation logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Parallax is wired up first so its update hook exists before the Lenis
  // loop starts calling it every frame.
  initParallax();
  initSmoothScroll();
  initLoader();
  initCursor();
  initMobileNav();
  initRollingTexts();
  initCopyToClipboard();
});

/* Scroll-driven transform hook. initParallax replaces this with the real
   implementation; the Lenis loop calls it once per frame. */
let updateParallax = () => {};

/* ==========================================================================
   0. SMOOTH SCROLLING (Lenis)
   Inertial, buttery wheel scrolling — same engine ellio.to uses.
   Uses exponential lerp smoothing (position chases the wheel target every
   frame), which reads smoother than a fixed-duration tween. Falls back to
   native scrolling if the library fails to load.
   ========================================================================== */
function initSmoothScroll() {
  // Graceful fallback: native scrolling if Lenis didn't load (e.g. offline)
  if (typeof Lenis === 'undefined') {
    initAnchorFallback();
    return;
  }

  const lenis = new Lenis({
    // Exponential smoothing — the "floaty but responsive" feel. 0.075 is
    // slightly softer than the old 0.1, so fast wheel flicks glide instead of
    // snapping to their target.
    lerp: 0.075,
    smoothWheel: true,
    // Normalise trackpad/wheel deltas so one notch of a mouse wheel travels
    // the same distance on every machine, instead of lurching on hi-res
    // trackpads.
    wheelMultiplier: 1,
    touchMultiplier: 1.4,
    // Touch keeps the native iOS/Android momentum — Lenis' window scrolling
    // feels worse than the platform one on phones.
    syncTouch: false,
    anchors: true, // smooth in-page anchor links
    // ellio.to (Framer) ignores the OS "reduced motion" setting, so wheel
    // scrolling stays buttery everywhere. Without this, Lenis snaps instantly
    // on machines where "Show animations in Windows" is turned off.
    respectReducedMotion: false,
  });

  // One rAF loop drives both Lenis and the parallax, so scroll-driven
  // transforms are written in the same frame Lenis paints — no extra scroll
  // listener, no layout reads, no tearing between the two.
  function raf(time) {
    lenis.raf(time);
    updateParallax(lenis.scroll || 0);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Let the nav drawer pause/resume scrolling cleanly
  window.__lenis = lenis;
}

/* Fallback smooth anchors when Lenis isn't available */
function initAnchorFallback() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      const target = id.length > 1 && document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
      history.pushState(null, '', id);
    });
  });
}

/* ==========================================================================
   1. INTRO LOADER (0% -> 100%)
   ========================================================================== */
function initLoader() {
  const loader = document.getElementById('siteLoader');
  const loaderNum = document.getElementById('loaderNumber');
  const loaderBar = document.getElementById('loaderBar');

  if (!loader || !loaderNum || !loaderBar) return;

  // If visited within current session, load faster
  const alreadyVisited = sessionStorage.getItem('mahin_visited');
  const duration = alreadyVisited ? 650 : 1300;

  let current = 0;
  const startTime = performance.now();

  function updateCount(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Smooth easeOutCubic curve
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    current = Math.floor(easeProgress * 100);

    loaderNum.textContent = `${current}%`;
    loaderBar.style.width = `${current}%`;

    if (progress < 1) {
      requestAnimationFrame(updateCount);
    } else {
      loaderNum.textContent = '100%';
      loaderBar.style.width = '100%';
      setTimeout(() => {
        loader.classList.add('loaded');
        sessionStorage.setItem('mahin_visited', 'true');
      }, 150);
    }
  }

  requestAnimationFrame(updateCount);
}

/* ==========================================================================
   2. CUSTOM CURSOR — single inverted dot
   Tracks the pointer exactly (no smoothing) because it replaces the
   native cursor. Grows over interactive elements via .cursor-hover.
   ========================================================================== */
function initCursor() {
  const dot = document.querySelector('.cursor-dot');

  if (!dot) return;

  window.addEventListener('mousemove', (e) => {
    // Move to pointer, then offset by half the dot size to center it
    dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
  }, { passive: true });

  // Grow over interactive elements
  const interactiveTargets = document.querySelectorAll(
    'a, button, input, textarea, .work-card, .contact-channel-item, .marquee-item, .gallery-card'
  );

  interactiveTargets.forEach((el) => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
}

/* ==========================================================================
   3. HAMBURGER NAVIGATION DRAWER
   ========================================================================== */
function initMobileNav() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const drawer = document.getElementById('mobileNavDrawer');

  if (!toggleBtn || !drawer) return;

  toggleBtn.addEventListener('click', () => {
    toggleBtn.classList.toggle('open');
    drawer.classList.toggle('open');
    const isOpen = drawer.classList.contains('open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (window.__lenis) isOpen ? window.__lenis.stop() : window.__lenis.start();
  });

  drawer.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      toggleBtn.classList.remove('open');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
      if (window.__lenis) window.__lenis.start();
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      toggleBtn.classList.remove('open');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
      if (window.__lenis) window.__lenis.start();
    }
  });
}

/* ==========================================================================
   4. KINETIC ROLLING TEXTS AUTO-PREPARATION
   ========================================================================== */
function initRollingTexts() {
  // Automatically duplicates the text in .rolling-text-track if single
  const tracks = document.querySelectorAll('.rolling-text-track');
  tracks.forEach((track) => {
    if (track.children.length === 1) {
      const clone = track.children[0].cloneNode(true);
      track.appendChild(clone);
    }
  });
}

/* ==========================================================================
   5. PARALLAX & SUBTLE MOVEMENT
   Throttled to one update per animation frame and uses translate3d so
   scrolling stays GPU-composited and jitter-free.
   ========================================================================== */
function initParallax() {
  const heroLogo = document.querySelector('.hero-logo-svg');

  if (!heroLogo) return;

  // Cached viewport height: reading window.innerHeight every frame forces a
  // style/layout flush mid-scroll, which is exactly what causes stutter.
  let vh = window.innerHeight;
  let lastY = -1;
  window.addEventListener('resize', () => {
    vh = window.innerHeight;
    // Force the next frame to re-write the transform with the new height
    lastY = -1;
  }, { passive: true });

  // Called from the Lenis rAF loop when Lenis is available (see
  // initSmoothScroll); otherwise attached to the native scroll event.
  updateParallax = function (y) {
    if (y === lastY) return;
    lastY = y;

    // Stop writing once the hero is fully off-screen
    const offset = Math.min(y, vh) * 0.22;
    heroLogo.style.transform = `translate3d(0, ${offset}px, 0)`;
  };

    // Only fall back to the native scroll event when Lenis didn't load;
  // otherwise the Lenis rAF loop drives this (see initSmoothScroll), so the
  // parallax never runs twice and never reads window.scrollY mid-scroll.
  if (typeof Lenis === 'undefined') {
    document.addEventListener('scroll', () => {
      updateParallax(window.scrollY);
    }, { passive: true });
  }
}

/* ==========================================================================
   6. CLICK-TO-COPY CONTACT DETAILS
   The phone number and email copy to the clipboard instead of firing a
   tel:/mailto: handler, with a short inline confirmation. The hrefs are
   left in place so the details stay visible to screen readers and to
   anything that reads links without running JS.
   ========================================================================== */
function initCopyToClipboard() {
  const items = document.querySelectorAll('[data-copy]');

  if (!items.length) return;

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        // Permission denied — fall through to the legacy path below
      }
    }

    // Fallback for non-secure contexts (e.g. opened straight from disk)
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-9999px';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (err) {
      copied = false;
    }
    document.body.removeChild(field);
    return copied;
  }

  items.forEach((item) => {
    const track = item.querySelector('.contact-channel-text-track');
    const spans = track ? track.querySelectorAll('span') : [];
    const label = spans.length ? spans[0].textContent : '';
    let resetTimer = null;

    item.addEventListener('click', async (e) => {
      // Replace the tel:/mailto: navigation with a copy to the clipboard
      e.preventDefault();

      const copied = await copyText(item.dataset.copy);
      if (!copied || !spans.length) return;

      spans.forEach((span) => { span.textContent = 'Copied to clipboard'; });
      item.classList.add('copied');

      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        spans.forEach((span) => { span.textContent = label; });
        item.classList.remove('copied');
      }, 1600);
    });
  });
}


