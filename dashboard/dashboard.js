(() => {
  const config = window.GIANT_DIRECTORY_CONFIG ?? {};
  const loginButton = document.getElementById("discord-login");
  const logoutButton = document.getElementById("dashboard-logout");
  const loginSection = document.getElementById("dashboard-login");
  const userSection = document.getElementById("dashboard-user");
  const userAvatar = document.getElementById("dashboard-user-avatar");
  const userName = document.getElementById("dashboard-user-name");
  const status = document.getElementById("dashboard-status");
  const serverSection = document.getElementById("dashboard-server-section");
  const serverCount = document.getElementById("dashboard-server-count");
  const serverList = document.getElementById("dashboard-server-list");

  if (
    !loginButton ||
    !logoutButton ||
    !loginSection ||
    !userSection ||
    !userAvatar ||
    !userName ||
    !status ||
    !serverSection ||
    !serverCount ||
    !serverList
  ) {
    throw new Error("The dashboard page is missing required elements.");
  }

  const applicationId = "1385271103030689863";
  const stateKey = "giant-dashboard-oauth-state";
  const oauthRedirectUri = window.location.origin;
  const endpointUrl = (() => {
    try {
      const supabaseUrl = new URL(config.supabaseUrl);
      if (supabaseUrl.protocol !== "https:" || !config.supabaseAnonKey) return null;
      return new URL("/functions/v1/dashboard", supabaseUrl.origin);
    } catch {
      return null;
    }
  })();

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  };

  const clearDashboard = () => {
    userSection.hidden = true;
    serverSection.hidden = true;
    serverList.replaceChildren();
    serverCount.textContent = "";
    userName.textContent = "";
    userAvatar.src = "/giant-logo.png";
  };

  const makeServerCard = (guild) => {
    const card = document.createElement("article");
    card.className = "dashboard-server-card";

    const summary = document.createElement("button");
    summary.className = "dashboard-server-summary";
    summary.type = "button";
    summary.setAttribute("aria-expanded", "false");

    const icon = document.createElement("img");
    icon.className = "dashboard-server-icon";
    icon.alt = "";
    if (/^[0-9]{5,25}$/.test(guild.id) && /^[A-Za-z0-9_]+$/.test(guild.icon ?? "")) {
      icon.src = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=96`;
      icon.addEventListener(
        "error",
        () => {
          icon.src = "/giant-logo.png";
        },
        { once: true },
      );
    } else {
      icon.src = "/giant-logo.png";
    }

    const name = document.createElement("span");
    name.className = "dashboard-server-name";
    name.textContent = guild.name;

    const badge = document.createElement("span");
    badge.className = guild.botInstalled
      ? "dashboard-server-badge is-installed"
      : "dashboard-server-badge";
    badge.textContent = guild.botInstalled ? "Giant is in" : "Invite Giant";
    summary.append(icon, name, badge);

    const details = document.createElement("div");
    details.className = "dashboard-server-details";
    details.hidden = true;

    const description = document.createElement("p");
    if (guild.botInstalled) {
      description.textContent =
        "Giant is in this server. Server settings will be available here soon.";
    } else {
      description.textContent =
        "Giant isn’t in this server yet. Invite it to get started.";
      const inviteUrl = new URL("https://discord.com/oauth2/authorize");
      inviteUrl.searchParams.set("client_id", applicationId);
      inviteUrl.searchParams.set("permissions", "8");
      inviteUrl.searchParams.set("integration_type", "0");
      inviteUrl.searchParams.set("scope", "bot");
      inviteUrl.searchParams.set("guild_id", guild.id);
      inviteUrl.searchParams.set("disable_guild_select", "true");

      const invite = document.createElement("a");
      invite.className = "button button-primary dashboard-invite-button";
      invite.href = inviteUrl.href;
      invite.target = "_blank";
      invite.rel = "noopener noreferrer";
      invite.textContent = "Invite Giant";
      details.append(description, invite);
    }
    if (guild.botInstalled) details.append(description);

    const detailsId = `server-details-${guild.id}`;
    details.id = detailsId;
    summary.setAttribute("aria-controls", detailsId);
    summary.addEventListener("click", () => {
      const expanded = summary.getAttribute("aria-expanded") === "true";
      summary.setAttribute("aria-expanded", String(!expanded));
      details.hidden = expanded;
    });

    card.append(summary, details);
    return card;
  };

  const showDashboard = (result) => {
    const guilds = Array.isArray(result.guilds)
      ? result.guilds.filter(
          (guild) =>
            guild &&
            /^[0-9]{5,25}$/.test(guild.id) &&
            typeof guild.name === "string" &&
            typeof guild.botInstalled === "boolean",
        )
      : [];

    userName.textContent = result.user?.global_name || result.user?.username || "Discord user";
    if (typeof result.user?.id === "string" && typeof result.user?.avatar === "string") {
      userAvatar.src = `https://cdn.discordapp.com/avatars/${result.user.id}/${result.user.avatar}.webp?size=96`;
    }
    userSection.hidden = false;
    loginSection.hidden = true;
    serverSection.hidden = false;
    serverCount.textContent = new Intl.NumberFormat("en-US").format(guilds.length);
    serverList.replaceChildren(...guilds.map(makeServerCard));

    setStatus(
      guilds.length
        ? "Only servers where you have Administrator permission are shown."
        : "No servers with Administrator permission were found for this account.",
    );
  };

  const loadDashboard = async (code) => {
    if (!endpointUrl) {
      throw new Error("The dashboard API is not configured. Please contact the Giant team.");
    }

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, redirect_uri: oauthRedirectUri }),
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The dashboard API returned an invalid response.");
    }
    if (!response.ok) {
      throw new Error(result.error || `Dashboard request failed (${response.status}).`);
    }
    if (!result.user || !Array.isArray(result.guilds)) {
      throw new Error("The dashboard API returned incomplete server data.");
    }

    showDashboard(result);
  };

  const startLogin = () => {
    if (!endpointUrl) {
      setStatus("The dashboard API is not configured. Please contact the Giant team.", true);
      return;
    }

    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const stateValue = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(stateKey, stateValue);

    const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", applicationId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", oauthRedirectUri);
    authorizeUrl.searchParams.set("scope", "identify email guilds");
    authorizeUrl.searchParams.set("state", stateValue);
    window.location.assign(authorizeUrl.href);
  };

  const signOut = () => {
    sessionStorage.removeItem(stateKey);
    clearDashboard();
    loginSection.hidden = false;
    setStatus("You have signed out.");
  };

  loginButton.addEventListener("click", startLogin);
  logoutButton.addEventListener("click", signOut);

  const callbackParams = new URLSearchParams(window.location.search);
  const authorizationCode = callbackParams.get("code");
  const authorizationError = callbackParams.get("error");
  if (!authorizationCode && !authorizationError) return;

  const authorizationState = callbackParams.get("state");
  const issuer = callbackParams.get("iss");
  window.history.replaceState(null, "", window.location.pathname);

  const expectedState = sessionStorage.getItem(stateKey);
  sessionStorage.removeItem(stateKey);
  if (
    !expectedState ||
    authorizationState !== expectedState ||
    issuer !== "https://discord.com"
  ) {
    setStatus("Discord sign-in could not be verified. Please try again.", true);
  } else if (authorizationError) {
    setStatus("Discord sign-in was cancelled. You can try again whenever you’re ready.", true);
  } else if (!authorizationCode) {
    setStatus("Discord did not return an authorization code. Please try again.", true);
  } else {
    loginButton.disabled = true;
    setStatus("Loading your administrator servers...");
    loadDashboard(authorizationCode)
      .catch((error) => {
        console.error("Could not load the dashboard:", error);
        const message =
          error instanceof TypeError
            ? "Could not reach the dashboard service. Deploy the Supabase dashboard function and set DASHBOARD_ORIGIN to https://giant-bot.xyz."
            : error.message || "Could not load your servers. Please try again.";
        setStatus(message, true);
      })
      .finally(() => {
        loginButton.disabled = false;
      });
  }
})();
