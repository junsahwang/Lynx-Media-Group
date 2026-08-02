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
      // fake success — bots get the same redirect real visitors do
      window.location.href = "thank-you.html";
      return;
    }

    const submitButton = form.querySelector("button[type='submit']");
    const applicationType = form.dataset.applicationType;

    const payload = {
      applicationType,
      source: "lynx-site-v1", // must match the endpoint's expected token
      submittedAt: new Date().toISOString(),
      page: window.location.href,
      ...Object.fromEntries(new FormData(form).entries())
    };

    // legacy aliases: the currently deployed Apps Script still reads the
    // old field names; the v8 script ignores unknown keys, so these are
    // safe to keep after redeploying
    if (payload.applicantName) payload.businessName = payload.applicantName;
    if (payload.marketingBudget) payload.goal = payload.marketingBudget;

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
      window.location.href =
        "thank-you.html?type=" + encodeURIComponent(applicationType || "");
      return;
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
   Budget slider — the range maps to labeled brackets; the label
   shows live and the hidden field carries it into the submission
   ========================================================= */
const budgetRange = document.querySelector(".budget-slider input[type='range']");
if (budgetRange) {
  const BUDGET_LABELS = ["Under $5K", "$5K–$10K", "$10K–$15K", "$15K–$25K", "Over $25K"];
  const budgetOutput = budgetRange.closest(".budget-slider").querySelector("output");
  const budgetHidden = budgetRange.closest(".budget-field").querySelector("input[type='hidden']");
  const syncBudget = () => {
    const label = BUDGET_LABELS[Number(budgetRange.value)] || BUDGET_LABELS[0];
    budgetOutput.textContent = label;
    budgetHidden.value = label;
  };
  budgetRange.addEventListener("input", syncBudget);
  syncBudget();
}

/* =========================================================
   Thank-you page — show only the section that matches the
   application the visitor just submitted (?type=…)
   ========================================================= */
const thanksPage = document.querySelector("[data-thanks]");
if (thanksPage) {
  const thanksType = new URLSearchParams(window.location.search).get("type");
  if (thanksType === "creator" || thanksType === "business") {
    thanksPage.querySelectorAll("[data-thanks-for]").forEach((section) => {
      if (section.dataset.thanksFor !== thanksType) section.remove();
    });
  }
}

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
  ".reveal, .about-card, .video-card, .service-list article, .apply-choice, .application-panel, .stats-band > div, .case-stat, .qa"
);

revealItems.forEach((item) => {
  item.classList.add("reveal");

  // Q&A articles reveal with zero stagger — long lists shouldn't
  // make the reader wait for a wave animation
  if (item.classList.contains("qa")) return;

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
  const onReveal = (entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        obs.unobserve(entry.target);
      }
    });
  };

  const observer = new IntersectionObserver(onReveal, {
    threshold: 0.12,
    rootMargin: "0px 0px -8% 0px",
  });

  // Q&A articles pre-reveal half a viewport ahead of the scroll, so
  // the reader never watches them fade in
  const qaObserver = new IntersectionObserver(onReveal, {
    threshold: 0,
    rootMargin: "0px 0px 50% 0px",
  });

  revealItems.forEach((item) =>
    (item.classList.contains("qa") ? qaObserver : observer).observe(item)
  );

  // anything already on screen reveals immediately on load — content
  // peeking above the fold shouldn't wait for a scroll to fade in
  requestAnimationFrame(() => {
    revealItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        item.classList.add("visible");
        observer.unobserve(item);
        qaObserver.unobserve(item);
      }
    });
  });
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

/* =========================================================
   How-it-works walkthrough — each step plays its animation
   (and counts up any numbers) when scrolled into view
   ========================================================= */
const hiwSteps = document.querySelectorAll(".hiw-step");
if (hiwSteps.length) {
  const hiwReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const runHiwCounters = (step) => {
    if (hiwReduced) return; // final values are already in the markup
    step.querySelectorAll("strong[data-hiw-count]").forEach((el) => {
      const decimals = Number(el.dataset.decimals || 0);
      const target = parseFloat(el.dataset.hiwCount);
      const started = performance.now();
      const duration = 1400;
      const tick = (now) => {
        const progress = Math.min((now - started) / duration, 1);
        const value = target * (1 - Math.pow(1 - progress, 4));
        el.textContent =
          (el.dataset.prefix || "") +
          value.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }) +
          (el.dataset.suffix || "");
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  if ("IntersectionObserver" in window && !hiwReduced) {
    const hiwObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // .play only gates the ambient ring pulses — the stage
            // sequences and counters are driven by --p / the scroll
            entry.target.classList.add("play");
            hiwObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 }
    );
    hiwSteps.forEach((step) => hiwObserver.observe(step));
  } else {
    hiwSteps.forEach((step) => {
      step.classList.add("play");
      step.style.setProperty("--p", "1");
      step.dataset.hiwCounted = "1"; // markup already holds final values
    });
  }

  // Scroll driver: the spine line draws down the page (--flow) and
  // each step's copy and stage drift in at their own rate (--p) as
  // the step travels the viewport — the walkthrough moves WITH the
  // scroll instead of just appearing.
  const hiwFlow = document.querySelector(".hiw-flow");
  if (hiwFlow && !hiwReduced) {
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    let hiwTicking = false;

    const hiwScroll = () => {
      const vh = window.innerHeight;
      const flowRect = hiwFlow.getBoundingClientRect();
      // the dark line reaches whatever point of the flow sits at 60% of
      // the viewport — it "arrives" at each step as you reach it
      hiwFlow.style.setProperty(
        "--flow",
        clamp01((vh * 0.6 - flowRect.top) / flowRect.height).toFixed(4)
      );
      hiwSteps.forEach((step) => {
        const r = step.getBoundingClientRect();
        const p = clamp01((vh * 0.9 - r.top) / (r.height * 0.9));
        step.style.setProperty("--p", p.toFixed(4));
        // numbers start counting once the step is well in view
        if (p > 0.55 && !step.dataset.hiwCounted) {
          step.dataset.hiwCounted = "1";
          runHiwCounters(step);
        }
      });
      hiwTicking = false;
    };

    window.addEventListener(
      "scroll",
      () => {
        if (!hiwTicking) {
          hiwTicking = true;
          requestAnimationFrame(hiwScroll);
        }
      },
      { passive: true }
    );
    hiwScroll();
  }
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

  // Posters live in data-poster and are only attached on screens that
  // actually show the scatter — phones (tiles hidden ≤1024px) skip
  // ~350KB of images they would never render.
  const scatterMQ = window.matchMedia("(min-width:1025px)");
  const attachPosters = () => {
    if (!scatterMQ.matches) return;
    heroOrbit.querySelectorAll("video[data-poster]").forEach((video) => {
      video.poster = video.dataset.poster;
      video.removeAttribute("data-poster");
    });
  };
  attachPosters();
  if (scatterMQ.addEventListener) scatterMQ.addEventListener("change", attachPosters);

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

  // Skip the scroll-driven drift on touch devices: phones scroll the
  // hero away quickly anyway, and dropping the per-frame style writes
  // keeps mobile scrolling smooth.
  const coarsePointer = window.matchMedia("(pointer:coarse)").matches;
  if (!reduceMotion && !coarsePointer) {
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

/* =========================================================
   Engagement chip easter eggs — every floating chip reacts to a
   click: hearts burst/rain, repost flips to a checkmark, share
   copies the link, comments pop fake replies, views count up.
   ========================================================= */
const heroSocial = document.querySelector(".hero-social");
if (heroSocial) {
  const fxReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // one fixed full-viewport layer holds every particle/toast
  const fxLayer = document.createElement("div");
  fxLayer.className = "fx-layer";
  document.body.appendChild(fxLayer);

  const HEART_PATH =
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
  const REPOST_PATH =
    "M17 2l4 4-4 4V7h-6.5A4.5 4.5 0 0 0 6 11.5H4A6.5 6.5 0 0 1 10.5 5H17V2zM7 22l-4-4 4-4v3h6.5a4.5 4.5 0 0 0 4.5-4.5h2a6.5 6.5 0 0 1-6.5 6.5H7v3z";
  const CHECK_PATH = "M9.55 17.05L4.9 12.4l1.6-1.6 3.05 3.05 7.95-7.95 1.6 1.6z";
  const svgOf = (path) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;

  const HEART_COLORS = ["#d92d20", "#f04438", "#f97066", "#fda29b"];
  const FAKE_COMMENTS = [
    "this is so real 😭",
    "need part 2 immediately",
    "how is this free content",
    "sending this to everyone i know",
    "the hook got me ngl",
    "algorithm did its job today 🔥"
  ];

  const rand = (min, max) => min + Math.random() * (max - min);

  function formatCount(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toLocaleString("en-US");
  }

  function popCount(el) {
    el.classList.remove("count-pop");
    void el.offsetWidth; // restart the animation
    el.classList.add("count-pop");
  }

  // odometer-style roll from the stored value to a new target
  function rollCount(el, target, duration = 900) {
    if (!el) return;
    const from = Number(el.dataset.count) || 0;
    el.dataset.count = target;
    popCount(el);
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatCount(Math.round(from + (target - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // briefly override the bob animation with a one-shot (spin/wiggle),
  // then hand the transform back so the chip keeps floating
  function oneShot(chip, animation) {
    chip.style.animation = animation;
    chip.addEventListener(
      "animationend",
      () => {
        chip.style.animation = "";
      },
      { once: true }
    );
  }

  function chipCenter(chip) {
    const rect = chip.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function spawnParticle(className, style, html, lifetime) {
    const el = document.createElement("span");
    el.className = className;
    Object.assign(el.style, style);
    el.innerHTML = html;
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), lifetime);
    return el;
  }

  // hearts radiating out from the clicked chip
  function heartBurst(x, y, n) {
    if (fxReduceMotion) return;
    for (let i = 0; i < n; i++) {
      const size = rand(12, 22);
      spawnParticle(
        "fx-heart fx-heart-burst",
        {
          left: x + "px",
          top: y + "px",
          width: size + "px",
          color: HEART_COLORS[i % HEART_COLORS.length],
          "--dx": rand(-110, 110) + "px",
          "--dy": rand(-140, -40) + "px",
          "--rot": rand(-40, 40) + "deg"
        },
        svgOf(HEART_PATH),
        1000
      );
    }
  }

  // hearts filling the page — popping up scattered across the whole
  // viewport (not a rising line), each drifting up a little as it fades
  function heartRain(n) {
    if (fxReduceMotion) return;
    for (let i = 0; i < n; i++) {
      const size = rand(14, 34);
      spawnParticle(
        "fx-heart fx-heart-rain",
        {
          left: rand(2, 96) + "vw",
          top: rand(4, 94) + "vh",
          width: size + "px",
          color: HEART_COLORS[i % HEART_COLORS.length],
          "--dur": rand(1.3, 2.2) + "s",
          "--delay": rand(0, 1.1) + "s",
          "--sway": rand(-40, 40) + "px",
          "--rot": rand(-50, 50) + "deg"
        },
        svgOf(HEART_PATH),
        4200
      );
    }
  }

  function commentBubble(chip) {
    // only one bubble on screen at a time
    fxLayer.querySelectorAll(".fx-bubble").forEach((b) => b.remove());
    const { x, y } = chipCenter(chip);
    const text = FAKE_COMMENTS[Math.floor(Math.random() * FAKE_COMMENTS.length)];
    const bubble = spawnParticle("fx-bubble", { left: x + "px", top: y + "px" }, text, 2400);
    // the bubble is centered on the chip — near a screen edge that would
    // clip it, so nudge it back inside the viewport
    const half = bubble.offsetWidth / 2;
    bubble.style.left =
      Math.min(Math.max(x, half + 12), window.innerWidth - half - 12) + "px";
  }

  function paperPlane(chip) {
    if (fxReduceMotion) return;
    const { x, y } = chipCenter(chip);
    spawnParticle(
      "fx-plane",
      { left: x + "px", top: y + "px" },
      svgOf("M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"),
      1300
    );
  }

  function floater(chip, text) {
    const { x, y } = chipCenter(chip);
    spawnParticle("fx-float", { left: x + "px", top: y + "px" }, text, 1600);
  }

  function toast(html) {
    fxLayer.querySelectorAll(".fx-toast").forEach((t) => t.remove());
    spawnParticle("fx-toast", {}, html, 2200);
  }

  /* ---- per-icon behaviors ---- */

  function heartFx(chip) {
    const count = chip.querySelector(".chip-count");
    const { x, y } = chipCenter(chip);
    chip.classList.add("is-liked");
    heartBurst(x, y, 14);
    heartRain(64);
    if (count) rollCount(count, Number(count.dataset.count) + 1200, 1100);
  }

  function commentFx(chip) {
    const count = chip.querySelector(".chip-count");
    oneShot(chip, "chip-wiggle .5s var(--ease)");
    commentBubble(chip);
    if (count) rollCount(count, Number(count.dataset.count) + 1, 300);
  }

  function shareFx(chip) {
    const label = chip.querySelector(".chip-label");
    if (navigator.clipboard) {
      navigator.clipboard.writeText("https://lynxmediagroup.org").catch(() => {});
    }
    if (label && !chip.dataset.busy) {
      chip.dataset.busy = "1";
      const original = label.textContent;
      label.textContent = "Copied!";
      chip.classList.add("is-shared");
      setTimeout(() => {
        label.textContent = original;
        chip.classList.remove("is-shared");
        delete chip.dataset.busy;
      }, 1600);
    }
    paperPlane(chip);
    toast("🔗 Link copied to clipboard");
  }

  function viewsFx(chip) {
    const count = chip.querySelector(".chip-count");
    if (!count) return;
    // sprint to the next round million
    const current = Number(count.dataset.count);
    const target = Math.ceil((current + 1) / 1e6) * 1e6;
    rollCount(count, target, 1200);
    floater(chip, "+" + formatCount(target - current));
  }

  function repostFx(chip) {
    const svgHolder = chip;
    const reposted = chip.classList.contains("is-reposted");
    if (reposted) {
      // clicking again un-reposts
      chip.classList.remove("is-reposted");
      svgHolder.innerHTML = svgOf(REPOST_PATH);
      return;
    }
    chip.classList.add("is-reposted");
    svgHolder.innerHTML = svgOf(CHECK_PATH);
    oneShot(chip, "chip-spin .6s var(--ease)");
    toast("✓ Reposted");
  }

  heroSocial.addEventListener("click", (event) => {
    const chip = event.target.closest(".social-chip");
    if (!chip) return;
    if (chip.matches(".chip-like, .chip-mini-like")) heartFx(chip);
    else if (chip.matches(".chip-comment, .chip-mini-comment")) commentFx(chip);
    else if (chip.matches(".chip-share")) shareFx(chip);
    else if (chip.matches(".chip-views")) viewsFx(chip);
    else if (chip.matches(".chip-mini-repost")) repostFx(chip);
  });
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

/* Demo posters attach only when the demo section approaches the
   viewport — first paint never waits on below-the-fold images. */
const demoVideos = document.querySelectorAll(".video-frame video[data-poster]");
if (demoVideos.length) {
  const attach = (video) => {
    video.poster = video.dataset.poster;
    video.removeAttribute("data-poster");
  };
  if ("IntersectionObserver" in window) {
    const posterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            attach(entry.target);
            posterObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "800px 0px" }
    );
    demoVideos.forEach((video) => posterObserver.observe(video));
  } else {
    demoVideos.forEach(attach);
  }
}

