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

