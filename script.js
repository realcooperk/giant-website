// Update these two values to match your bot's current reach.
const giantStats = {
  servers: 128,
  users: 25000,
};

const numberFormatter = new Intl.NumberFormat("en-US");

document.getElementById("server-count").textContent =
  `${numberFormatter.format(giantStats.servers)}+`;
document.getElementById("user-count").textContent =
  `${numberFormatter.format(giantStats.users)}+`;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const scrollProgress = document.querySelector(".scroll-progress span");

let scrollFrame = 0;
const updateScrollProgress = () => {
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
  scrollProgress.style.transform = `scaleX(${progress})`;
  scrollFrame = 0;
};

window.addEventListener(
  "scroll",
  () => {
    if (!scrollFrame) {
      scrollFrame = window.requestAnimationFrame(updateScrollProgress);
    }
  },
  { passive: true },
);
updateScrollProgress();

if (!prefersReducedMotion && "IntersectionObserver" in window) {
  const revealItems = document.querySelectorAll(
    ".stats-bar, .section-heading, .feature-card, .cta-section",
  );
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -32px 0px" },
  );

  document.body.classList.add("motion-ready");
  revealItems.forEach((item) => {
    item.classList.add("reveal");
    revealObserver.observe(item);
  });
}

if (
  !prefersReducedMotion &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches
) {
  const hero = document.querySelector(".hero");
  const heroArt = document.querySelector(".hero-art");
  const logo = document.querySelector(".bot-logo-wrap");
  const cards = heroArt.querySelectorAll(".floating-card");
  let pointerFrame = 0;
  let pointerEvent;

  hero.addEventListener("pointermove", (event) => {
    pointerEvent = event;
    if (pointerFrame) return;

    pointerFrame = window.requestAnimationFrame(() => {
      const heroBounds = hero.getBoundingClientRect();
      const artBounds = heroArt.getBoundingClientRect();
      const x = (pointerEvent.clientX - heroBounds.left) / heroBounds.width;
      const y = (pointerEvent.clientY - heroBounds.top) / heroBounds.height;
      const normalizedX = Math.max(
        -1,
        Math.min(1, ((pointerEvent.clientX - artBounds.left) / artBounds.width) * 2 - 1),
      );
      const normalizedY = Math.max(
        -1,
        Math.min(1, ((pointerEvent.clientY - artBounds.top) / artBounds.height) * 2 - 1),
      );

      hero.style.setProperty("--pointer-x", `${x * 100}%`);
      hero.style.setProperty("--pointer-y", `${y * 100}%`);
      logo.style.setProperty("--tilt-x", `${normalizedY * -5}deg`);
      logo.style.setProperty("--tilt-y", `${normalizedX * 7}deg`);
      cards.forEach((card, index) => {
        const direction = index === 0 ? -1 : 1;
        card.style.setProperty("--card-x", `${normalizedX * direction * 7}px`);
        card.style.setProperty("--card-y", `${normalizedY * direction * 5}px`);
      });
      pointerFrame = 0;
    });
  });

  hero.addEventListener("pointerleave", () => {
    hero.style.removeProperty("--pointer-x");
    hero.style.removeProperty("--pointer-y");
    logo.style.removeProperty("--tilt-x");
    logo.style.removeProperty("--tilt-y");
    cards.forEach((card) => {
      card.style.removeProperty("--card-x");
      card.style.removeProperty("--card-y");
    });
  });
}
