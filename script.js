// Update these two values to match your bot's current reach.
const giantStats = {
  servers: 10,
  users: 150,
};

const numberFormatter = new Intl.NumberFormat("en-US");
const dashboardSessionKey = "giant-dashboard-session";

const readDashboardSession = () => {
  try {
    const session = JSON.parse(sessionStorage.getItem(dashboardSessionKey) ?? "null");
    if (
      !session ||
      typeof session.accessToken !== "string" ||
      !session.accessToken ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now() ||
      !session.user ||
      typeof session.user.id !== "string"
    ) {
      sessionStorage.removeItem(dashboardSessionKey);
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

const dashboardLoginLink = document.querySelector(".header-login");
if (dashboardLoginLink) {
  const discordAuthorizeHref = dashboardLoginLink.href;
  const savedSession = readDashboardSession();
  if (savedSession) {
    const avatar = document.createElement("img");
    avatar.className = "header-account-avatar";
    avatar.alt = "";
    if (
      /^[0-9]{5,25}$/.test(savedSession.user.id) &&
      typeof savedSession.user.avatar === "string" &&
      /^[A-Za-z0-9_]+$/.test(savedSession.user.avatar)
    ) {
      avatar.src = `https://cdn.discordapp.com/avatars/${savedSession.user.id}/${savedSession.user.avatar}.webp?size=64`;
    } else {
      avatar.src = "giant-logo.png";
    }
    avatar.addEventListener(
      "error",
      () => {
        avatar.src = "giant-logo.png";
      },
      { once: true },
    );
    const dashboardLabel = document.createElement("span");
    dashboardLabel.textContent = "Dashboard";
    const displayName =
      savedSession.user.global_name || savedSession.user.username || "Discord user";
    dashboardLoginLink.href = "/dashboard/";
    dashboardLoginLink.classList.add("header-login-dashboard");
    dashboardLoginLink.setAttribute("aria-label", `Open dashboard for ${displayName}`);
    dashboardLoginLink.replaceChildren(avatar, dashboardLabel);
  }

  dashboardLoginLink.addEventListener("click", (event) => {
    if (readDashboardSession()) return;
    event.preventDefault();
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const stateValue = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem("giant-dashboard-oauth-state", stateValue);

    const authorizeUrl = new URL(discordAuthorizeHref);
    authorizeUrl.searchParams.set("state", stateValue);
    window.location.assign(authorizeUrl.href);
  });
}

const authorizationResponse = new URLSearchParams(window.location.search);
if (authorizationResponse.has("code") || authorizationResponse.has("error")) {
  const dashboardParams = new URLSearchParams();
  ["code", "state", "iss", "error", "error_description"].forEach((key) => {
    const value = authorizationResponse.get(key);
    if (value !== null) dashboardParams.set(key, value);
  });
  window.history.replaceState(null, "", window.location.pathname);
  window.location.replace(`/dashboard/?${dashboardParams.toString()}`);
}

document.getElementById("server-count").textContent =
  `${numberFormatter.format(giantStats.servers)}+`;
document.getElementById("user-count").textContent =
  `${numberFormatter.format(giantStats.users)}+`;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const scrollProgress = document.querySelector(".scroll-progress span");

if (scrollProgress) {
  let scrollFrame = 0;
  const updateScrollProgress = () => {
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress =
      scrollableHeight > 0
        ? Math.max(0, Math.min(1, window.scrollY / scrollableHeight))
        : 0;

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
  window.addEventListener("resize", updateScrollProgress);
  updateScrollProgress();
}

if (!reducedMotion && "IntersectionObserver" in window) {
  const revealItems = document.querySelectorAll(
    ".stats-bar, .section-heading, .feature-card, .directory-section, .cta-section",
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
    { threshold: 0.15, rootMargin: "0px 0px -24px 0px" },
  );

  document.body.classList.add("motion-ready");
  revealItems.forEach((item) => {
    item.classList.add("reveal");
    revealObserver.observe(item);
  });
}

if (!reducedMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  const hero = document.querySelector(".hero");
  const heroArt = document.querySelector(".hero-art");
  const logo = document.querySelector(".bot-logo-wrap");
  const cards = heroArt?.querySelectorAll(".floating-card") ?? [];

  if (hero && heroArt && logo) {
    let pointerFrame = 0;
    let pointerInside = false;
    let pointerEvent;

    hero.addEventListener("pointermove", (event) => {
      pointerEvent = event;
      pointerInside = true;
      if (pointerFrame) return;

      pointerFrame = window.requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!pointerInside) return;

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
        logo.style.setProperty("--tilt-x", `${normalizedY * -3}deg`);
        logo.style.setProperty("--tilt-y", `${normalizedX * 4}deg`);
        cards.forEach((card, index) => {
          const direction = index === 0 ? -1 : 1;
          card.style.setProperty("--card-x", `${normalizedX * direction * 4}px`);
          card.style.setProperty("--card-y", `${normalizedY * direction * 3}px`);
        });
      });
    });

    hero.addEventListener("pointerleave", () => {
      pointerInside = false;
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
}
