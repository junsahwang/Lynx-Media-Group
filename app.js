/* =========================================================
   Clickjacking guard — GitHub Pages can't send frame-ancestors
   headers, so refuse to render inside a hostile iframe
   ========================================================= */
if (window.top !== window.self) {
  try {
    window.top.location = window.self.location;
  } catch (e) {
    document.documentElement.style.display = "none";
  }
}

/* =========================================================
   Motion preferences
   ========================================================= */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* =========================================================
   Mobile navigation
   ========================================================= */
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

/* =========================================================
   Sticky header state + footer wordmark fill
   ========================================================= */
const header = document.querySelector(".site-header");
const wordmark = document.querySelector(".footer-wordmark .wm");

let scrollTicking = false;
let lastScrollTop = 0;

function onScroll() {
  const doc = document.documentElement;
  const y = doc.scrollTop;

  if (header) {
    header.classList.toggle("is-scrolled", y > 12);

    // the bar hides while scrolling down and returns on scroll up —
    // but never while the mobile menu is open
    const menuOpen = siteNav && siteNav.classList.contains("open");
    if (!menuOpen) {
      if (y > lastScrollTop && y > 140) {
        header.classList.add("is-hidden");
      } else if (y < lastScrollTop) {
        header.classList.remove("is-hidden");
      }
    }
    lastScrollTop = y;
  }

  // footer wordmark fills with ink from the moment it enters the
  // viewport until the page is scrolled all the way to the bottom
  if (wordmark) {
    const r = wordmark.getBoundingClientRect();
    const start = r.top + doc.scrollTop - doc.clientHeight;
    const end = doc.scrollHeight - doc.clientHeight;
    const seen = end > start ? (doc.scrollTop - start) / (end - start) : 1;
    const fill = Math.min(1, Math.max(0, seen)) * 100;
    wordmark.style.setProperty("--fill", `${fill.toFixed(1)}%`);
  }

  scrollTicking = false;
}

window.addEventListener(
  "scroll",
  () => {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(onScroll);
    }
  },
  { passive: true }
);
onScroll();

/* =========================================================
   Application form submission
   ========================================================= */
const applicationWebhookUrl =
  "https://script.google.com/macros/s/AKfycbwcVAIn4TBanYW2y5WlagwbMpnz04ByKwsGzvR_FJK5Jdc4R--2L4ZlV_e3-hEzZbKilw/exec";

function showFormMessage(form, text, type = "success") {
  const existingMessage = form.querySelector(".form-message");
  if (existingMessage) existingMessage.remove();

  const message = document.createElement("p");
  message.className = `form-message ${type}`;
  message.textContent = text;
  form.appendChild(message);
}

document.querySelectorAll(".apply-form").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // honeypot: real visitors never see this field — bots that fill
    // it get a fake success and their submission is dropped
    const honeypot = form.querySelector("input[name='company_url_confirm']");
    if (honeypot && honeypot.value) {
      form.reset();
      showFormMessage(form, "Application submitted. Thank you!");
      return;
    }

    const submitButton = form.querySelector("button[type='submit']");
    const applicationType = form.dataset.applicationType;

    const payload = {
      applicationType,
      submittedAt: new Date().toISOString(),
      page: window.location.href,
      ...Object.fromEntries(new FormData(form).entries())
    };

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    try {
      const response = await fetch(applicationWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || "Submission failed.");
      }

      form.reset();
      showFormMessage(form, "Application submitted. Thank you!");
    } catch (error) {
      showFormMessage(
        form,
        "Something went wrong. Please try again or contact Lynx directly.",
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent =
          applicationType === "creator"
            ? "Submit creator application"
            : "Submit business application";
      }
    }
  });
});

/* =========================================================
   Scrollspy — underline the nav link for the section in view
   ========================================================= */
const spyLinks = new Map();
document.querySelectorAll('.site-nav a[href^="#"]').forEach((link) => {
  const section = document.querySelector(link.getAttribute("href"));
  if (section) spyLinks.set(section, link);
});

if (spyLinks.size && "IntersectionObserver" in window) {
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const link = spyLinks.get(entry.target);
        spyLinks.forEach((l) => l.classList.remove("active"));
        if (link) link.classList.add("active");
      });
    },
    { rootMargin: "-45% 0px -45% 0px" }
  );
  spyLinks.forEach((_, section) => spy.observe(section));
  // observing the hero clears the highlight back at the top of the page
  const heroSection = document.querySelector(".hero");
  if (heroSection) spy.observe(heroSection);
}

/* =========================================================
   Reveal on scroll, with per-group stagger
   ========================================================= */
const revealItems = document.querySelectorAll(
  ".reveal, .about-card, .video-card, .service-list article, .apply-choice, .application-panel, .stats-band > div, .case-stat"
);

revealItems.forEach((item) => {
  item.classList.add("reveal");

  // stagger siblings inside grids for a wave-like entrance
  // (skip top-level sections so each section reveals promptly on scroll)
  const parent = item.parentElement;
  if (parent && parent.tagName !== "MAIN" && parent.tagName !== "BODY") {
    const siblings = Array.from(parent.children).filter((el) =>
      el.classList.contains("reveal")
    );
    const index = siblings.indexOf(item);
    if (index > 0) item.style.transitionDelay = `${Math.min(index, 6) * 80}ms`;
  }
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

/* =========================================================
   Case-study cards — every client card expands the same way,
   and its stats count up the first time it opens
   ========================================================= */
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const runCaseCounters = (card) => {
  if (card.dataset.counted) return;
  card.dataset.counted = "1";
  if (reducedMotion) return; // final values are already in the markup

  card.querySelectorAll(".case-stat strong[data-count]").forEach((el) => {
    const decimals = Number(el.dataset.decimals || 0);
    const target = parseFloat(el.dataset.count);
    const started = performance.now();
    const duration = 1400;

    const render = (value) => {
      el.textContent =
        (el.dataset.prefix || "") +
        value.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }) +
        (el.dataset.suffix || "");
    };

    const tick = (now) => {
      const progress = Math.min((now - started) / duration, 1);
      render(target * (1 - Math.pow(1 - progress, 4)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
};

document.querySelectorAll(".case-card").forEach((card) => {
  const summary = card.querySelector(".case-summary");
  if (!summary) return;
  summary.addEventListener("click", () => {
    const open = card.classList.toggle("open");
    summary.setAttribute("aria-expanded", String(open));
    if (open) runCaseCounters(card);
  });
});

/* =========================================================
   Hero scatter — tiles sit tilted around the copy (positions
   live in the CSS). Hovering a tile plays its clip while the
   rest fall back; the copy drifts and fades as you scroll away.
   ========================================================= */
const heroEl = document.querySelector(".hero");
const heroOrbit = document.querySelector(".hero-orbit");

if (heroEl && heroOrbit) {
  const heroCopy = heroEl.querySelector(".hero-copy");

  // Hover previews play muted — browsers refuse audible playback until
  // the visitor has clicked something, so sound can't start on hover
  // alone. Each tile gets a small speaker toggle (heyclicky-style);
  // that click is the gesture that unlocks audio, and once sound is on,
  // every later hover plays with audio automatically.
  // Sound is on by default; browsers still block audible autoplay until
  // the visitor interacts, so the first hovers fall back to muted and
  // the toggle (or any click on the page) unlocks it.
  let heroSoundOn = true;
  const volSyncs = [];
  const ICON_MUTED =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" fill="currentColor"/><path d="m15.5 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_SOUND =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" fill="currentColor"/><path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a8 8 0 0 1 0 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  heroOrbit.querySelectorAll(".hero-video-tile").forEach((tile) => {
    const video = tile.querySelector("video");
    if (!video) return;

    const vol = document.createElement("button");
    vol.type = "button";
    vol.className = "tile-vol";
    const syncVol = () => {
      vol.innerHTML = video.muted ? ICON_MUTED : ICON_SOUND;
      vol.setAttribute("aria-label", video.muted ? "unmute video" : "mute video");
    };
    syncVol();
    volSyncs.push(syncVol);
    tile.appendChild(vol);

    vol.addEventListener("click", (e) => {
      e.stopPropagation();
      video.muted = !video.muted;
      heroSoundOn = !video.muted;
      if (video.paused) video.play().catch(() => {});
      syncVol();
    });

    tile.addEventListener("mouseenter", () => {
      video.muted = !heroSoundOn;
      syncVol();
      video.play().catch(() => {
        // audible play refused (no gesture yet) — preview muted instead
        video.muted = true;
        syncVol();
        video.play().catch(() => {});
      });
    });
    tile.addEventListener("mouseleave", () => video.pause());
  });


  // The first real click anywhere is the gesture that unlocks audio.
  // If a preview is playing muted only because the browser refused
  // sound before that gesture, switch its audio back on immediately.
  const unlockAudio = (e) => {
    if (e.target.closest && e.target.closest(".tile-vol")) return; // speaker button manages itself
    document.removeEventListener("pointerdown", unlockAudio, true);
    if (!heroSoundOn) return;
    heroOrbit.querySelectorAll("video").forEach((video) => {
      if (!video.paused && video.muted) video.muted = false;
    });
    volSyncs.forEach((sync) => sync());
  };
  document.addEventListener("pointerdown", unlockAudio, true);

  if (!reduceMotion) {
    // Scrolling away fades the tiles (not the copy), each at its own
    // pace — faster tiles vanish first while slower ones linger, and
    // every tile drifts upward at a different rate as it goes.
    const tiles = [...heroOrbit.querySelectorAll(".hero-video-tile")];
    const FADE_SPEED = [1.9, 1.2, 1.55, 0.95, 2.3, 1.4, 1.05];
    const DRIFT_SPEED = [0.34, 0.18, 0.26, 0.12, 0.42, 0.22, 0.3];
    let heroTicking = false;
    const heroParallax = () => {
      const y = window.scrollY;
      if (y < heroEl.offsetHeight) {
        const leave = Math.min(y / (heroEl.offsetHeight * 0.72), 1);
        tiles.forEach((tile, i) => {
          tile.style.setProperty(
            "--fade",
            Math.max(0, 1 - leave * FADE_SPEED[i % FADE_SPEED.length]).toFixed(3)
          );
          tile.style.setProperty(
            "--drift",
            `${(-y * DRIFT_SPEED[i % DRIFT_SPEED.length]).toFixed(1)}px`
          );
        });
      }
      heroTicking = false;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!heroTicking) {
          heroTicking = true;
          requestAnimationFrame(heroParallax);
        }
      },
      { passive: true }
    );
  }
}

/* Duplicate the trusted-by logos so the marquee fills the width and loops seamlessly */
const trustedRow = document.querySelector(".trusted-row");
if (trustedRow) {
  const logos = Array.from(trustedRow.children);
  for (let i = 0; i < 5; i++) {
    logos.forEach((logo) => {
      const clone = logo.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("tabindex", "-1");
      trustedRow.appendChild(clone);
    });
  }
}

/* Hero clips only play while hovered (see the scatter block above). */

