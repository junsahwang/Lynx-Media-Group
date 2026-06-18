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
document.querySelectorAll(".hero-video-row").forEach((row) => {
  const tiles = Array.from(row.children);
  tiles.forEach((tile) => {
    const clone = tile.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    const video = clone.querySelector("video");
    if (video) {
      video.muted = true;
      const playClone = () => video.play().catch(() => {});
      if (video.readyState >= 2) playClone();
      else video.addEventListener("loadeddata", playClone, { once: true });
    }
    row.appendChild(clone);
  });
});

/* =========================================================
   Magnetic buttons + subtle card tilt (fine pointer only)
   ========================================================= */
if (finePointer && !reduceMotion) {
  // magnetic buttons
  document.querySelectorAll(".button").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.18}px, ${y * 0.28 - 3}px)`;
    });
    btn.addEventListener("pointerleave", () => {
      btn.style.transform = "";
    });
  });

  // gentle 3D tilt on cards
  const tiltCards = document.querySelectorAll(
    ".about-card, .video-card, .service-list article"
  );
  tiltCards.forEach((card) => {
    let raf = null;
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.transform = `translateY(-8px) perspective(900px) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`;
      });
    });
    card.addEventListener("pointerleave", () => {
      if (raf) cancelAnimationFrame(raf);
      card.style.transform = "";
    });
  });
}

/* =========================================================
   Cursor follower — a lagging ring that adds a little
   character. Mouse only; native cursor stays visible.
   ========================================================= */
if (finePointer && !reduceMotion) {
  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  ring.setAttribute("aria-hidden", "true");
  document.body.appendChild(ring);

  const interactiveSel =
    'a, button, .button, input, textarea, [role="button"], .about-card, .video-card, .service-list article, .apply-choice, .footer-links a, .nav-toggle';

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let rx = mx;
  let ry = my;
  let scale = 1;
  let hover = false;
  let down = false;
  let shown = false;

  const targetScale = () => (hover ? 1.7 : 1) * (down ? 0.82 : 1);

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      mx = e.clientX;
      my = e.clientY;
      if (!shown) {
        shown = true;
        ring.classList.add("is-visible");
      }
    },
    { passive: true }
  );

  document.addEventListener("pointerover", (e) => {
    if (e.target.closest && e.target.closest(interactiveSel)) {
      hover = true;
      ring.classList.add("is-hover");
    }
  });
  document.addEventListener("pointerout", (e) => {
    if (e.target.closest && e.target.closest(interactiveSel)) {
      hover = false;
      ring.classList.remove("is-hover");
    }
  });

  window.addEventListener("pointerdown", () => (down = true));
  window.addEventListener("pointerup", () => (down = false));

  document.addEventListener("mouseleave", () => {
    shown = false;
    ring.classList.remove("is-visible");
  });
  document.addEventListener("mouseenter", () => {
    shown = true;
    ring.classList.add("is-visible");
  });

  const renderCursor = () => {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    scale += (targetScale() - scale) * 0.2;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${scale.toFixed(3)})`;
    requestAnimationFrame(renderCursor);
  };
  renderCursor();
}
