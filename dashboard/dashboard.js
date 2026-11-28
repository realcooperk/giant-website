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
  const sessionKey = "giant-dashboard-session";
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
  const botApiUrl = (() => {
    try {
      const url = new URL(config.botApiUrl);
      if (
        url.protocol === "https:" ||
        (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
      ) {
        return url.href.replace(/\/+$/, "");
      }
    } catch {
      return "";
    }
    return "";
  })();
  const readDashboardSession = () => {
    try {
      const session = JSON.parse(sessionStorage.getItem(sessionKey) ?? "null");
      if (
        !session ||
        typeof session.accessToken !== "string" ||
        !session.accessToken ||
        !session.user ||
        typeof session.user.id !== "string" ||
        typeof session.user.username !== "string" ||
        !Number.isFinite(session.expiresAt) ||
        session.expiresAt <= Date.now()
      ) {
        sessionStorage.removeItem(sessionKey);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  };
  let dashboardAccessToken = readDashboardSession()?.accessToken ?? "";

  const requestBotApi = async (payload) => {
    if (!botApiUrl) {
      throw new Error("The Giant security API is not configured yet.");
    }
    if (!dashboardAccessToken) {
      throw new Error("Your Discord session is missing. Sign in again.");
    }
    const response = await fetch(botApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dashboardAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The Giant security API returned an invalid response.");
    }
    if (!response.ok) {
      throw new Error(result.error || `Security API request failed (${response.status}).`);
    }
    return result;
  };

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  };

  const clearDashboard = () => {
    dashboardAccessToken = "";
    sessionStorage.removeItem(sessionKey);
    userSection.hidden = true;
    serverSection.hidden = true;
    serverList.replaceChildren();
    serverCount.textContent = "";
    userName.textContent = "";
    userAvatar.src = "/giant-logo.png";
  };

  const defaultSecuritySettings = {
    enabled: false,
    logChannel: "",
    rules: {
      spam: true,
      invites: true,
      mentions: true,
      repeats: true,
      raids: true,
    },
    spamCount: 5,
    spamWindow: 8,
    raidJoins: 8,
    raidWindow: 10,
    raidDuration: 5,
    warnAt: 1,
    timeoutAt: 2,
    banAt: 4,
  };

  const makeToggle = (label, name, checked) => {
    const wrapper = document.createElement("label");
    wrapper.className = "dashboard-security-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.checked = checked;
    const track = document.createElement("span");
    track.className = "dashboard-security-toggle-track";
    track.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = label;
    wrapper.append(input, track, text);
    return wrapper;
  };

  const makeNumberField = (label, name, value, min, max, unit = "") => {
    const field = document.createElement("label");
    field.className = "dashboard-security-field";
    const caption = document.createElement("span");
    caption.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.name = name;
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    if (unit) input.setAttribute("aria-label", `${label} (${unit})`);
    field.append(caption, input);
    if (unit) {
      const suffix = document.createElement("small");
      suffix.textContent = unit;
      field.append(suffix);
    }
    return field;
  };

  const makeMessageSettingsFeature = (guild, feature, title) => {
    const section = document.createElement("section");
    section.className = "dashboard-message-settings";
    const heading = document.createElement("div");
    heading.className = "dashboard-security-heading";
    const titleElement = document.createElement("h3");
    titleElement.textContent = title;
    heading.append(titleElement);

    const form = document.createElement("form");
    form.className = "dashboard-security-form";
    const enabledToggle = makeToggle("Enabled", `${feature}Enabled`, false);
    const enabledInput = enabledToggle.querySelector("input");
    const channelLabel = document.createElement("label");
    channelLabel.className = "dashboard-message-field";
    const channelCaption = document.createElement("span");
    channelCaption.textContent = "Text channel ID";
    const channelInput = document.createElement("input");
    channelInput.type = "text";
    channelInput.inputMode = "numeric";
    channelInput.pattern = "[0-9]{5,25}";
    channelInput.placeholder = "Right-click channel > Copy Channel ID";
    channelLabel.append(channelCaption, channelInput);
    enabledInput.addEventListener("change", () => {
      channelInput.required = enabledInput.checked;
    });

    const messageLabel = document.createElement("label");
    messageLabel.className = "dashboard-message-field";
    const messageCaption = document.createElement("span");
    messageCaption.textContent = "Message";
    const messageInput = document.createElement("textarea");
    messageInput.rows = 3;
    messageInput.maxLength = 1800;
    messageInput.required = true;
    messageInput.placeholder =
      "Use {user}, {mention}, {server}, and {member_count}.";
    const placeholderHelp = document.createElement("small");
    placeholderHelp.textContent =
      "Placeholders: {user}, {mention}, {server}, {member_count}";
    messageLabel.append(messageCaption, messageInput, placeholderHelp);

    const status = document.createElement("p");
    status.className = "dashboard-security-message";
    status.setAttribute("role", "status");
    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "button button-outline dashboard-security-case-action";
    saveButton.textContent = `Save ${feature} settings`;

    form.append(enabledToggle, channelLabel, messageLabel, status, saveButton);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      saveButton.disabled = true;
      status.classList.remove("is-error");
      status.textContent = `Saving ${feature} settings...`;
      try {
        const result = await requestBotApi({
          guildId: guild.id,
          action: "message_save",
          feature,
          settings: {
            enabled: enabledInput.checked,
            channelId: channelInput.value.trim(),
            message: messageInput.value,
          },
        });
        setSettings(result.settings);
        status.textContent = `${title} saved to Giant.`;
      } catch (error) {
        console.error(`Could not save ${feature} settings:`, error);
        status.textContent =
          error instanceof Error ? error.message : `Could not save ${feature} settings.`;
        status.classList.add("is-error");
      } finally {
        saveButton.disabled = false;
      }
    });

    const setSettings = (settings) => {
      enabledInput.checked = settings.enabled;
      channelInput.value = settings.channelId;
      channelInput.required = settings.enabled;
      messageInput.value = settings.message;
      status.textContent = settings.enabled
        ? `${title} are enabled.`
        : `${title} are disabled.`;
      status.classList.remove("is-error");
    };

    section.append(heading, form);
    return { element: section, setSettings };
  };

  const makeSecuritySettings = (guild) => {
    const settings = {
      ...defaultSecuritySettings,
      rules: { ...defaultSecuritySettings.rules },
    };
    const panel = document.createElement("div");
    panel.className = "dashboard-security-settings";
    const welcomeSettings = makeMessageSettingsFeature(
      guild,
      "welcome",
      "Welcome messages",
    );
    const goodbyeSettings = makeMessageSettingsFeature(
      guild,
      "goodbye",
      "Goodbye messages",
    );

    const heading = document.createElement("div");
    heading.className = "dashboard-security-heading";
    const headingCopy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = "Security";
    const subtitle = document.createElement("p");
    subtitle.textContent = "Detection rules and escalations for this server.";
    headingCopy.append(title, subtitle);
    heading.append(headingCopy, makeToggle("Protection enabled", "enabled", settings.enabled));

    const form = document.createElement("form");
    form.className = "dashboard-security-form";

    const logField = document.createElement("label");
    logField.className = "dashboard-security-field dashboard-security-log-field";
    const logCaption = document.createElement("span");
    logCaption.textContent = "Security log channel";
    const logInput = document.createElement("input");
    logInput.type = "text";
    logInput.name = "logChannel";
    logInput.placeholder = "Channel ID or leave blank";
    logInput.value = settings.logChannel;
    logField.append(logCaption, logInput);

    const rulesTitle = document.createElement("h4");
    rulesTitle.textContent = "Detection rules";
    const ruleGrid = document.createElement("div");
    ruleGrid.className = "dashboard-security-rule-grid";
    ruleGrid.append(
      makeToggle("Spam", "ruleSpam", settings.rules.spam),
      makeToggle("Invite links", "ruleInvites", settings.rules.invites),
      makeToggle("Mention spam", "ruleMentions", settings.rules.mentions),
      makeToggle("Repeated messages", "ruleRepeats", settings.rules.repeats),
      makeToggle("Raid joins", "ruleRaids", settings.rules.raids),
    );

    const thresholdsTitle = document.createElement("h4");
    thresholdsTitle.textContent = "Spam threshold";
    const spamGrid = document.createElement("div");
    spamGrid.className = "dashboard-security-number-grid";
    spamGrid.append(
      makeNumberField("Messages", "spamCount", settings.spamCount, 3, 20),
      makeNumberField("Window", "spamWindow", settings.spamWindow, 3, 60, "seconds"),
    );

    const raidTitle = document.createElement("h4");
    raidTitle.textContent = "Raid mode";
    const raidGrid = document.createElement("div");
    raidGrid.className = "dashboard-security-number-grid";
    raidGrid.append(
      makeNumberField("Joins", "raidJoins", settings.raidJoins, 3, 100),
      makeNumberField("Window", "raidWindow", settings.raidWindow, 5, 120, "seconds"),
      makeNumberField("Duration", "raidDuration", settings.raidDuration, 1, 60, "minutes"),
    );

    const strikeTitle = document.createElement("h4");
    strikeTitle.textContent = "Escalating strikes";
    const strikeGrid = document.createElement("div");
    strikeGrid.className = "dashboard-security-number-grid";
    strikeGrid.append(
      makeNumberField("Warn", "warnAt", settings.warnAt, 1, 10, "strike"),
      makeNumberField("Timeout", "timeoutAt", settings.timeoutAt, 2, 10, "strikes"),
      makeNumberField("Ban", "banAt", settings.banAt, 3, 10, "strikes"),
    );

    const formMessage = document.createElement("p");
    formMessage.className = "dashboard-security-message";
    formMessage.setAttribute("role", "status");

    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "button button-primary dashboard-security-save";
    saveButton.textContent = "Save security settings";

    form.append(
      logField,
      rulesTitle,
      ruleGrid,
      thresholdsTitle,
      spamGrid,
      raidTitle,
      raidGrid,
      strikeTitle,
      strikeGrid,
      formMessage,
      saveButton,
    );

    const enabledToggle = heading.querySelector('input[name="enabled"]');

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const nextSettings = {
        enabled: enabledToggle.checked,
        logChannel: String(data.get("logChannel") ?? "").trim(),
        rules: {
          spam: form.elements.namedItem("ruleSpam").checked,
          invites: form.elements.namedItem("ruleInvites").checked,
          mentions: form.elements.namedItem("ruleMentions").checked,
          repeats: form.elements.namedItem("ruleRepeats").checked,
          raids: form.elements.namedItem("ruleRaids").checked,
        },
        spamCount: Number(data.get("spamCount")),
        spamWindow: Number(data.get("spamWindow")),
        raidJoins: Number(data.get("raidJoins")),
        raidWindow: Number(data.get("raidWindow")),
        raidDuration: Number(data.get("raidDuration")),
        warnAt: Number(data.get("warnAt")),
        timeoutAt: Number(data.get("timeoutAt")),
        banAt: Number(data.get("banAt")),
      };

      if (!(nextSettings.warnAt < nextSettings.timeoutAt && nextSettings.timeoutAt < nextSettings.banAt)) {
        formMessage.textContent = "Strike thresholds must increase: warn < timeout < ban.";
        formMessage.classList.add("is-error");
        return;
      }

      formMessage.classList.remove("is-error");
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
      try {
        const result = await requestBotApi({
          guildId: guild.id,
          action: "save",
          security: nextSettings,
        });
        setSettings(result.settings);
        settingsLoaded = true;
        formMessage.textContent = "Security settings saved to Giant.";
      } catch (error) {
        console.error("Could not save security settings:", error);
        formMessage.textContent =
          error instanceof Error ? error.message : "Could not save security settings.";
        formMessage.classList.add("is-error");
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save security settings";
      }
    });

    const cases = document.createElement("section");
    cases.className = "dashboard-security-cases";
    const casesTitle = document.createElement("h4");
    casesTitle.textContent = "Recent cases";
    const casesFilter = document.createElement("div");
    casesFilter.className = "dashboard-security-number-grid";
    const memberField = document.createElement("label");
    memberField.className = "dashboard-security-field";
    const memberCaption = document.createElement("span");
    memberCaption.textContent = "Member ID";
    const memberInput = document.createElement("input");
    memberInput.type = "text";
    memberInput.inputMode = "numeric";
    memberInput.placeholder = "Optional";
    memberField.append(memberCaption, memberInput);
    const caseField = document.createElement("label");
    caseField.className = "dashboard-security-field";
    const caseCaption = document.createElement("span");
    caseCaption.textContent = "Case";
    const caseInput = document.createElement("input");
    caseInput.type = "number";
    caseInput.min = "1";
    caseInput.placeholder = "#";
    caseField.append(caseCaption, caseInput);
    casesFilter.append(memberField, caseField);

    const caseActions = document.createElement("div");
    caseActions.className = "dashboard-security-actions";
    const caseMessage = document.createElement("p");
    caseMessage.className = "dashboard-security-message";
    caseMessage.setAttribute("role", "status");
    const caseList = document.createElement("div");
    caseList.className = "dashboard-security-case-list";
    const listCasesButton = document.createElement("button");
    listCasesButton.type = "button";
    listCasesButton.className = "button button-outline dashboard-security-case-action";
    listCasesButton.textContent = "List cases";
    listCasesButton.addEventListener("click", async () => {
      try {
        const result = await requestBotApi({
          guildId: guild.id,
          action: "cases",
          memberId: memberInput.value.trim() || null,
        });
        caseList.replaceChildren();
        if (Array.isArray(result.cases) && result.cases.length) {
          for (const item of result.cases) {
            const row = document.createElement("article");
            row.className = "dashboard-security-case";
            const title = document.createElement("strong");
            title.textContent = `#${item.id} · ${item.rule} · ${item.status}`;
            const description = document.createElement("p");
            description.textContent = `${item.reason} — ${item.outcome}`;
            row.append(title, description);
            caseList.append(row);
          }
          caseMessage.textContent = `${result.cases.length} recent ${
            result.cases.length === 1 ? "case" : "cases"
          } found.`;
        } else {
          caseMessage.textContent = "No security cases found.";
        }
        caseMessage.classList.remove("is-error");
      } catch (error) {
        caseList.replaceChildren();
        caseMessage.textContent = error instanceof Error ? error.message : "Could not load cases.";
        caseMessage.classList.add("is-error");
      }
    });
    const addCaseAction = (label, action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-outline dashboard-security-case-action";
      button.textContent = label;
      button.addEventListener("click", async () => {
        if (!caseInput.value) {
          caseMessage.textContent = "Enter a case number.";
          caseMessage.classList.add("is-error");
          return;
        }
        try {
          const result = await requestBotApi({
            guildId: guild.id,
            action: "case",
            caseAction: action,
            caseNumber: Number(caseInput.value),
          });
          if (result.case) {
            caseMessage.textContent = `Case #${caseInput.value} marked ${result.case.status}.`;
            if (result.message) caseMessage.textContent += ` ${result.message}`;
            caseList.replaceChildren();
          }
          caseMessage.classList.remove("is-error");
        } catch (error) {
          caseMessage.textContent = error instanceof Error ? error.message : "Could not update the case.";
          caseMessage.classList.add("is-error");
        }
      });
      return button;
    };
    caseActions.append(
      listCasesButton,
      addCaseAction("Review", "review"),
      addCaseAction("Dismiss", "dismiss"),
      addCaseAction("Escalate", "escalate"),
    );
    cases.append(casesTitle, casesFilter, caseActions, caseMessage, caseList);
    panel.append(
      heading,
      form,
      cases,
      welcomeSettings.element,
      goodbyeSettings.element,
    );

    let settingsLoaded = false;
    const setSettings = (serverSettings) => {
      enabledToggle.checked = serverSettings.enabled;
      logInput.value = serverSettings.logChannel;
      form.elements.namedItem("ruleSpam").checked = serverSettings.rules.spam;
      form.elements.namedItem("ruleInvites").checked = serverSettings.rules.invites;
      form.elements.namedItem("ruleMentions").checked = serverSettings.rules.mentions;
      form.elements.namedItem("ruleRepeats").checked = serverSettings.rules.repeats;
      form.elements.namedItem("ruleRaids").checked = serverSettings.rules.raids;
      for (const name of [
        "spamCount",
        "spamWindow",
        "raidJoins",
        "raidWindow",
        "raidDuration",
        "warnAt",
        "timeoutAt",
        "banAt",
      ]) {
        form.elements.namedItem(name).value = String(serverSettings[name]);
      }
    };
    const loadSettings = async () => {
      if (settingsLoaded) return;
      formMessage.textContent = "Loading server security settings...";
      try {
        const result = await requestBotApi({ guildId: guild.id, action: "status" });
        if (!result.settings || typeof result.settings !== "object") {
          throw new Error("The Giant security API returned incomplete settings.");
        }
        setSettings(result.settings);
        if (!result.messages?.welcome || !result.messages?.goodbye) {
          throw new Error("The Giant API returned incomplete welcome/goodbye settings.");
        }
        welcomeSettings.setSettings(result.messages.welcome);
        goodbyeSettings.setSettings(result.messages.goodbye);
        settingsLoaded = true;
        formMessage.textContent = "Settings loaded from Giant.";
        formMessage.classList.remove("is-error");
      } catch (error) {
        formMessage.textContent =
          error instanceof Error ? error.message : "Could not load security settings.";
        formMessage.classList.add("is-error");
      }
    };

    return { element: panel, loadSettings };
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
    let securitySettings = null;

    const description = document.createElement("p");
    if (guild.botInstalled) {
      description.textContent =
        "Giant is in this server. Manage security protection below.";
      securitySettings = makeSecuritySettings(guild);
      details.append(description, securitySettings.element);
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

    const detailsId = `server-details-${guild.id}`;
    details.id = detailsId;
    summary.setAttribute("aria-controls", detailsId);
    summary.addEventListener("click", () => {
      const expanded = summary.getAttribute("aria-expanded") === "true";
      summary.setAttribute("aria-expanded", String(!expanded));
      details.hidden = expanded;
      if (!expanded && securitySettings) securitySettings.loadSettings();
    });

    card.append(summary, details);
    return card;
  };

  const showDashboard = (result, previousExpiresAt = null) => {
    const expiresAt = Number.isFinite(result.expires_in)
      ? Date.now() + result.expires_in * 1000
      : previousExpiresAt;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new Error("Your Discord session expired. Please sign in again.");
    }

    const user = {
      id: result.user.id,
      username: result.user.username,
      global_name: result.user.global_name ?? null,
      avatar: result.user.avatar ?? null,
    };
    sessionStorage.setItem(
      sessionKey,
      JSON.stringify({ accessToken: result.access_token, user, expiresAt }),
    );
    dashboardAccessToken = result.access_token;
    const guilds = Array.isArray(result.guilds)
      ? result.guilds.filter(
          (guild) =>
            guild &&
            /^[0-9]{5,25}$/.test(guild.id) &&
            typeof guild.name === "string" &&
            typeof guild.botInstalled === "boolean",
        )
      : [];

    userName.textContent = user.global_name || user.username || "Discord user";
    if (
      /^[0-9]{5,25}$/.test(user.id) &&
      typeof user.avatar === "string" &&
      /^[A-Za-z0-9_]+$/.test(user.avatar)
    ) {
      userAvatar.src = `https://cdn.discordapp.com/avatars/${result.user.id}/${result.user.avatar}.webp?size=96`;
    } else {
      userAvatar.src = "/giant-logo.png";
    }
    userSection.hidden = false;
    loginSection.hidden = true;
    serverSection.hidden = false;
    serverCount.textContent = new Intl.NumberFormat("en-US").format(guilds.length);
    serverList.replaceChildren(...guilds.map(makeServerCard));

    setStatus(
      guilds.length
        ? "Only servers where you have Manage Server permission (including server owners and administrators) are shown."
        : "No servers with Manage Server permission were found for this account.",
    );
  };

  const loadDashboard = async (credentials, previousExpiresAt = null) => {
    if (!endpointUrl) {
      throw new Error("The dashboard API is not configured. Please contact the Giant team.");
    }

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The dashboard API returned an invalid response.");
    }
    if (!response.ok) {
      const error = new Error(
        result.error || `Dashboard request failed (${response.status}).`,
      );
      error.status = response.status;
      throw error;
    }
    if (
      !result.user ||
      !Array.isArray(result.guilds) ||
      typeof result.access_token !== "string"
    ) {
      throw new Error("The dashboard API returned incomplete server data.");
    }

    showDashboard(result, previousExpiresAt);
  };

  const handleDashboardError = (error) => {
    console.error("Could not load the dashboard:", error);
    if (error.status === 401) {
      clearDashboard();
      loginSection.hidden = false;
      setStatus("Your Discord session expired. Please sign in again.", true);
      return;
    }
    const message =
      error instanceof TypeError
        ? "Could not reach the dashboard service. Deploy the Supabase dashboard function and set DASHBOARD_ORIGIN to https://giant-bot.xyz."
        : error.message || "Could not load your servers. Please try again.";
    setStatus(message, true);
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
    authorizeUrl.searchParams.set("scope", "identify guilds");
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
  if (!authorizationCode && !authorizationError) {
    const savedSession = readDashboardSession();
    if (!savedSession) return;

    dashboardAccessToken = savedSession.accessToken;
    userName.textContent =
      savedSession.user.global_name || savedSession.user.username || "Discord user";
    if (
      /^[0-9]{5,25}$/.test(savedSession.user.id) &&
      typeof savedSession.user.avatar === "string" &&
      /^[A-Za-z0-9_]+$/.test(savedSession.user.avatar)
    ) {
      userAvatar.src = `https://cdn.discordapp.com/avatars/${savedSession.user.id}/${savedSession.user.avatar}.webp?size=96`;
    } else {
      userAvatar.src = "/giant-logo.png";
    }
    userSection.hidden = false;
    loginSection.hidden = true;
    loginButton.disabled = true;
    setStatus("Restoring your dashboard...");
    loadDashboard(
      { access_token: savedSession.accessToken },
      savedSession.expiresAt,
    )
      .catch(handleDashboardError)
      .finally(() => {
        loginButton.disabled = false;
      });
    return;
  }

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
    setStatus("Loading your servers...");
    loadDashboard(
      { code: authorizationCode, redirect_uri: oauthRedirectUri },
    )
      .catch(handleDashboardError)
      .finally(() => {
        loginButton.disabled = false;
      });
  }

})();
