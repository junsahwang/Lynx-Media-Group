/* =========================================================
   Motion preferences
   ========================================================= */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

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
   Scroll progress bar + sticky header state
   ========================================================= */
const header = document.querySelector(".site-header");
const heroCopy = document.querySelector(".hero-copy");
const wordmark = document.querySelector(".footer-wordmark .wm");
const progress = document.createElement("div");
progress.className = "scroll-progress";
document.body.appendChild(progress);

let scrollTicking = false;

function onScroll() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  const ratio = max > 0 ? doc.scrollTop / max : 0;
  progress.style.transform = `scaleX(${ratio})`;

  if (header) header.classList.toggle("is-scrolled", doc.scrollTop > 12);

  // hero copy drifts down and fades slightly as it scrolls away (parallax)
  if (heroCopy && !reduceMotion) {
    const y = Math.min(doc.scrollTop, 900);
    heroCopy.style.transform = `translateY(${(y * 0.16).toFixed(1)}px)`;
    heroCopy.style.opacity = Math.max(0, 1 - y / 1100).toFixed(3);
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
   Scroll cue in the hero
   ========================================================= */
const hero = document.querySelector(".hero");
if (hero && !reduceMotion) {
  const cue = document.createElement("div");
  cue.className = "scroll-cue";
  cue.setAttribute("aria-hidden", "true");
  hero.appendChild(cue);
}

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
   Hero headline — split into words that rise in one by one
   ========================================================= */
const heroTitle = document.querySelector(".hero h1");
if (heroTitle && !reduceMotion) {
  const words = heroTitle.textContent.trim().split(/\s+/);
  heroTitle.textContent = "";
  words.forEach((word, i) => {
    const wrap = document.createElement("span");
    wrap.className = "w";
    const inner = document.createElement("span");
    inner.className = "wi";
    inner.textContent = word;
    inner.style.animationDelay = `${0.12 + i * 0.09}s`;
    wrap.appendChild(inner);
    heroTitle.appendChild(wrap);
    if (i < words.length - 1) heroTitle.append(" ");
  });
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
  ".reveal, .about-card, .video-card, .service-list article, .apply-choice, .application-panel, .stats-band > div"
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
   Seamless hero marquee (duplicate tiles for a clean loop)
   ========================================================= */
document.querySelectorAll(".hero-video-row, .type-row").forEach((row) => {
  Array.from(row.children).forEach((tile) => {
    const clone = tile.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    row.appendChild(clone);
  });
});

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

/* Only play hero clips whose tile is on-screen. Browsers can only decode
   a limited number of videos at once, so playing all ~20 tiles together
   makes the extras freeze a few seconds in. Pausing the off-screen ones
   keeps the active count low while the marquee still looks continuous. */
const heroVideos = document.querySelectorAll(".hero-video-tile video");
if ("IntersectionObserver" in window && heroVideos.length) {
  const heroPlayObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.muted = true;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { root: null, rootMargin: "0px 120px", threshold: 0 }
  );
  heroVideos.forEach((video) => {
    video.muted = true;
    heroPlayObserver.observe(video);
  });
} else {
  heroVideos.forEach((video) => video.play().catch(() => {}));
}

/* =========================================================
   Magnetic buttons + subtle card tilt (fine pointer only)
   ========================================================= */
if (finePointer && !reduceMotion) {
  // magnetic buttons with a smooth spring press on select
  document.querySelectorAll(".button").forEach((btn) => {
    let tx = 0;
    let ty = -3;
    let pressed = false;
    const apply = () => {
      btn.style.transform = `translate(${tx}px, ${ty}px) scale(${pressed ? 0.95 : 1})`;
    };
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) * 0.18;
      ty = (e.clientY - r.top - r.height / 2) * 0.28 - 3;
      apply();
    });
    btn.addEventListener("pointerdown", () => {
      pressed = true;
      apply();
    });
    btn.addEventListener("pointerup", () => {
      pressed = false;
      apply();
    });
    btn.addEventListener("pointerleave", () => {
      pressed = false;
      tx = 0;
      ty = -3;
      btn.style.transform = "";
    });
  });

  // the two hero figures drift slightly toward the cursor
  document.querySelectorAll(".path-figure").forEach((fig) => {
    fig.addEventListener("pointermove", (e) => {
      const r = fig.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.16;
      const y = (e.clientY - r.top - r.height / 2) * 0.16;
      fig.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
    fig.addEventListener("pointerleave", () => {
      fig.style.transform = "";
    });
  });

  // gentle 3D tilt on cards. The card AND its photo are transformed
  // together in the same frame so the image zoom can never drift out of
  // sync with the box (both start on pointerenter, same transition).
  const tiltCards = document.querySelectorAll(
    ".about-card, .video-card, .service-list article"
  );
  tiltCards.forEach((card) => {
    const img = card.querySelector(".photo-slot img");
    let raf = null;
    let px = 0;
    let py = 0;
    let pressed = false;
    let hovered = false;

    const apply = () => {
      card.style.transform = hovered
        ? `translateY(-8px) perspective(900px) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg) scale(${pressed ? 0.985 : 1})`
        : "";
      if (img) img.style.transform = hovered ? `scale(${pressed ? 1.04 : 1.06})` : "";
    };

    card.addEventListener("pointerenter", () => {
      hovered = true;
      apply();
    });
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width - 0.5;
      py = (e.clientY - r.top) / r.height - 0.5;
      hovered = true;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    });
    card.addEventListener("pointerdown", () => {
      pressed = true;
      apply();
    });
    card.addEventListener("pointerup", () => {
      pressed = false;
      apply();
    });
    card.addEventListener("pointerleave", () => {
      if (raf) cancelAnimationFrame(raf);
      pressed = false;
      hovered = false;
      apply();
    });
  });
}

/* =========================================================
   Pointer-tracked spotlight on cards (fine pointer only)
   ========================================================= */
if (finePointer) {
  const spotEls = document.querySelectorAll(
    ".about-card, .video-card, .service-list article, .apply-choice, .application-panel, .stats-band > div, .cta-section"
  );
  spotEls.forEach((el) => {
    el.classList.add("spot");
    const glow = document.createElement("div");
    glow.className = "spot-glow";
    glow.setAttribute("aria-hidden", "true");
    el.appendChild(glow);
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(1)}px`);
      el.style.setProperty("--my", `${(e.clientY - r.top).toFixed(1)}px`);
    });
  });
}

/* =========================================================
   Custom cursor — a dot with a trailing ring, inverted over
   dark surfaces via blend mode. Fine pointers only.
   ========================================================= */
if (finePointer && !reduceMotion) {
  const dot = document.createElement("div");
  dot.className = "cursor-dot";
  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  dot.setAttribute("aria-hidden", "true");
  ring.setAttribute("aria-hidden", "true");
  document.body.append(dot, ring);
  document.body.classList.add("has-cursor");

  let cx = -100;
  let cy = -100;
  let ringX = -100;
  let ringY = -100;
  let dotScale = 1;
  let ringBase = 1;
  let pressed = false;

  window.addEventListener(
    "pointermove",
    (e) => {
      cx = e.clientX;
      cy = e.clientY;
    },
    { passive: true }
  );

  (function follow() {
    ringX += (cx - ringX) * 0.16;
    ringY += (cy - ringY) * 0.16;
    const ringScale = ringBase * (pressed ? 0.75 : 1);
    dot.style.transform = `translate(${cx}px, ${cy}px) scale(${dotScale})`;
    ring.style.transform = `translate(${ringX.toFixed(1)}px, ${ringY.toFixed(1)}px) scale(${ringScale})`;
    requestAnimationFrame(follow);
  })();

  // the ring swells over anything interactive; the dot shrinks away
  document.addEventListener("pointerover", (e) => {
    const interactive = e.target.closest(
      "a, button, .button, [role='button'], label, input, textarea, select"
    );
    dotScale = interactive ? 0.4 : 1;
    ringBase = interactive ? 1.7 : 1;
  });
  document.addEventListener("pointerdown", () => {
    pressed = true;
  });
  document.addEventListener("pointerup", () => {
    pressed = false;
  });

  // hide the cursor when the pointer leaves the window
  document.documentElement.addEventListener("pointerleave", () => {
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  });
  document.documentElement.addEventListener("pointerenter", () => {
    dot.style.opacity = "";
    ring.style.opacity = "";
  });
}

/* =========================================================
   Give each hero figure a random look on load — hairstyle,
   skin tone, hair colour, and clothing colour — for variety
   and inclusivity. The character silhouette never changes;
   only the hair shape and fills are swapped.
   ========================================================= */
const SKIN_TONES = ["#f7d7ba", "#efc6a3", "#e2ad84", "#cf9a6e", "#b27c54", "#925f3f", "#6f4628"];
const HAIR_COLORS = ["#1b1916", "#2e2620", "#4a3526", "#6e4a2c", "#9a6334", "#c98a3a", "#9aa0a8", "#a6402b"];

/* A library of hairstyles. Each has a "top" (drawn over the head) and an
   optional "back" (drawn behind the head, for longer styles). All shapes
   stay within the head bounds so the silhouette below is untouched. */
const LONG_BACK =
  "M37 44C36 22 47 11 60 11C73 11 84 22 83 44C83 60 81 78 79 92L70 92C72 74 72 58 70 48C72 38 67 32 60 32C53 32 48 38 50 48C48 58 48 74 50 92L41 92C39 78 37 60 37 44Z";

const HAIRSTYLES = [
  /* side part — pronounced, smooth low hairline with an off-centre parting */
  { top: "M40 38C39 20 47 12 60 12C73 12 81 20 80 38C79 29 73 25 60 25C47 25 41 31 40 38Z", part: "M51 25Q52 20 55 15" },
  /* buzz / fade — close to the scalp */
  { top: "M41 40C40 26 48 18 60 18C72 18 80 26 79 40C78 33 73 29 60 29C47 29 42 33 41 40Z" },
  /* quiff — short sides, a lift at the front */
  { top: "M40 39C40 22 47 14 60 14C73 14 80 23 80 39C79 31 73 27 67 27C66 19 61 17 57 20C54 22 53 24 52 27C46 28 41 32 40 39Z" },
  /* top bun — pulled-back hair, a connecting neck, and a knot (one filled shape) */
  { top: "M41 40C40 25 48 16 60 16C72 16 80 25 79 40C78 32 73 28 60 28C47 28 42 32 41 40Z M55 16L65 16L64 22L56 22Z M53 13a7 7 0 1 0 14 0a7 7 0 1 0-14 0Z" },
  /* wavy bob — frames the face down past the cheeks */
  { top: "M40 44C38 24 48 14 60 14C72 14 82 24 80 44C79 36 74 31 68 31C66 25 62 23 60 23C58 23 54 25 52 31C46 31 41 36 40 44Z" },
  /* long straight — centre part with hair behind the shoulders */
  { top: "M40 44C39 23 48 13 60 13C72 13 81 23 80 44C79 35 74 30 68 30C66 24 62 22 60 22C58 22 54 24 52 30C46 30 41 35 40 44Z", back: LONG_BACK },
  /* long wavy */
  { top: "M40 44C38 22 48 13 60 13C72 13 82 22 80 44C79 34 74 30 68 30C66 24 62 22 60 22C58 22 54 24 52 30C46 30 41 34 40 44Z", back: LONG_BACK }
];

/* Clothing palettes — businesses get tailored, professional tones;
   creators get brighter, casual streetwear colours. */
const SUIT_COLORS = ["#333a48", "#1f2a44", "#23252b", "#3c4250", "#2c3b34", "#42323e"];
const TIE_COLORS = ["#c44a3d", "#3b5bdb", "#2f9e44", "#9c36b5", "#1a1a1a", "#e0a33d"];
const HOODIE_COLORS = ["#5c6470", "#e85d04", "#2563eb", "#0ea5e9", "#10b981", "#ec4899", "#8b5cf6", "#ef4444", "#1f2937"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* shift a hex colour lighter (pct > 0) or darker (pct < 0) */
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + pct))));
  const r = clamp((n >> 16) & 255);
  const g = clamp((n >> 8) & 255);
  const b = clamp(n & 255);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

document.querySelectorAll(".path-figure").forEach((fig) => {
  const skin = pick(SKIN_TONES);
  const hairColor = pick(HAIR_COLORS);
  const style = pick(HAIRSTYLES);

  fig.querySelectorAll(".skin").forEach((el) => el.setAttribute("fill", skin));
  fig.querySelectorAll(".hair, .hair-back").forEach((el) => el.setAttribute("fill", hairColor));

  const top = fig.querySelector(".hair");
  const back = fig.querySelector(".hair-back");
  const part = fig.querySelector(".hair-part");
  if (top) top.setAttribute("d", style.top);
  if (back) back.setAttribute("d", style.back || "");
  if (part) {
    part.setAttribute("d", style.part || "");
    part.setAttribute("stroke", skin);
  }

  /* recolour the clothing without touching the shape: fills get the body
     colour, strokes (e.g. the creator's raised arm) get it too */
  const isBusiness = fig.classList.contains("business-path");
  const clothes = pick(isBusiness ? SUIT_COLORS : HOODIE_COLORS);
  fig.querySelectorAll(".clothes").forEach((el) => {
    if (el.getAttribute("stroke")) el.setAttribute("stroke", clothes);
    const fill = el.getAttribute("fill");
    if (fill && fill !== "none") el.setAttribute("fill", clothes);
  });

  if (isBusiness) {
    const tie = fig.querySelector(".tie");
    if (tie) tie.setAttribute("fill", pick(TIE_COLORS));
  } else {
    /* the creator's inner-tee neckline reads as a darker shade of the hoodie */
    const detail = fig.querySelector(".clothes-detail");
    if (detail) detail.setAttribute("fill", shade(clothes, -0.28));
  }
});
