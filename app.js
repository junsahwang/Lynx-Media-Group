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
  Array.from(row.children).forEach((tile) => {
    const clone = tile.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    row.appendChild(clone);
  });
});

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
