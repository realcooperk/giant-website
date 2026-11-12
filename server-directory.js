(() => {
  const config = window.GIANT_DIRECTORY_CONFIG ?? {};
  const searchInput = document.getElementById("server-search");
  const resultCount = document.getElementById("server-result-count");
  const resultsContainer = document.getElementById("server-results");
  const directoryStatus = document.getElementById("directory-status");
  const form = document.getElementById("server-submit-form");
  const formStatus = document.getElementById("form-status");
  const previewButton = document.getElementById("preview-server");
  const inviteInput = form?.elements.namedItem("invite");
  const previewContainer = document.getElementById("invite-preview");
  const submitButton = form?.querySelector(".submit-listing-button");

  if (
    !searchInput ||
    !resultCount ||
    !resultsContainer ||
    !directoryStatus ||
    !form ||
    !formStatus ||
    !previewButton ||
    !inviteInput ||
    !previewContainer ||
    !submitButton
  ) {
    return;
  }

  let supabaseUrl = "";
  try {
    const projectUrl = new URL(config.supabaseUrl);
    if (
      config.supabaseAnonKey &&
      (projectUrl.protocol === "https:" ||
        (projectUrl.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(projectUrl.hostname)))
    ) {
      supabaseUrl = projectUrl.href.replace(/\/+$/, "");
    }
  } catch {
    supabaseUrl = "";
  }
  const configured = Boolean(supabaseUrl && config.supabaseAnonKey);
  const apiHeaders = configured
    ? {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      }
    : null;
  const numberFormatter = new Intl.NumberFormat("en-US");
  let listings = [];
  let invitePreview = null;
  let invitePreviewCode = "";
  let directoryUnavailable = false;

  const setStatus = (element, message, isError = false) => {
    element.textContent = message;
    element.classList.toggle("is-error", isError);
  };

  const normalizeInvite = (value) => {
    let url;
    try {
      url = new URL(value.trim());
    } catch {
      throw new Error("Enter a valid Discord invite link.");
    }

    const host = url.hostname.toLowerCase();
    const segments = url.pathname.split("/").filter(Boolean);
    let code = "";

    if (url.protocol !== "https:") {
      throw new Error("Use a secure Discord invite link that starts with https://.");
    }

    if (host === "discord.gg" || host === "www.discord.gg") {
      code = segments.length === 1 ? segments[0] : "";
    } else if (
      host === "discord.com" ||
      host === "www.discord.com" ||
      host === "discordapp.com" ||
      host === "www.discordapp.com"
    ) {
      code = segments.length === 2 && segments[0] === "invite" ? segments[1] : "";
    }

    if (!/^[A-Za-z0-9-]{2,64}$/.test(code)) {
      throw new Error("Use a valid discord.gg or discord.com/invite link.");
    }

    return code;
  };

  const assetUrl = (guildId, hash, assetType) => {
    if (!/^[0-9]{5,25}$/.test(guildId) || !/^[A-Za-z0-9_]+$/.test(hash ?? "")) {
      return "";
    }

    const extension = hash.startsWith("a_") ? "gif" : "webp";
    return `https://cdn.discordapp.com/${assetType}/${guildId}/${hash}.${extension}?size=512`;
  };

  const resolveInvite = async (inviteCode) => {
    const response = await fetch(
      `https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true`,
    );
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("That invite is invalid or has expired.");
      }
      throw new Error("Discord could not load that invite. Try again.");
    }

    const invite = await response.json();
    const guild = invite.guild;
    if (!guild || !/^[0-9]{5,25}$/.test(guild.id) || !guild.name) {
      throw new Error("This invite does not include public server details.");
    }

    return {
      code: inviteCode,
      guildId: guild.id,
      guildName: guild.name,
      iconHash: guild.icon ?? "",
      bannerHash: guild.banner ?? "",
      memberCount: Number.isInteger(invite.approximate_member_count)
        ? invite.approximate_member_count
        : null,
    };
  };

  const makeIcon = (guildId, iconHash) => {
    const image = document.createElement("img");
    image.className = "listing-server-icon";
    image.alt = "";
    image.src = assetUrl(guildId, iconHash, "icons") || "giant-logo.png";
    image.addEventListener(
      "error",
      () => {
        image.src = "giant-logo.png";
      },
      { once: true },
    );
    return image;
  };

  const makeListingCard = (listing) => {
    const card = document.createElement("article");
    card.className = "server-listing-card";

    const banner = document.createElement("div");
    banner.className = "listing-banner";
    const bannerUrl = assetUrl(listing.guild_id, listing.guild_banner_hash, "banners");
    if (bannerUrl) {
      banner.style.backgroundImage = `url("${bannerUrl}")`;
    }
    banner.append(makeIcon(listing.guild_id, listing.guild_icon_hash));

    const body = document.createElement("div");
    body.className = "listing-card-body";

    const title = document.createElement("h3");
    title.textContent = listing.title;

    const serverName = document.createElement("p");
    serverName.className = "listing-server-name";
    serverName.textContent = listing.guild_name;

    const description = document.createElement("p");
    description.className = "listing-description";
    description.textContent = listing.description;

    const footer = document.createElement("div");
    footer.className = "listing-card-footer";

    const members = document.createElement("span");
    members.className = "listing-member-count";
    members.textContent =
      listing.approximate_member_count === null
        ? "Discord community"
        : `${numberFormatter.format(listing.approximate_member_count)} members`;

    const joinLink = document.createElement("a");
    joinLink.className = "listing-join-link";
    joinLink.href = `https://discord.gg/${encodeURIComponent(listing.invite_code)}`;
    joinLink.target = "_blank";
    joinLink.rel = "noopener noreferrer";
    joinLink.textContent = "Join server";

    footer.append(members, joinLink);
    body.append(title, serverName, description, footer);
    card.append(banner, body);
    return card;
  };

  const renderListings = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const matchingListings = listings.filter((listing) =>
      [listing.title, listing.description, listing.guild_name]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );

    resultCount.textContent = `${numberFormatter.format(matchingListings.length)} ${
      matchingListings.length === 1 ? "server" : "servers"
    }`;
    resultsContainer.replaceChildren();

    if (matchingListings.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "directory-empty";
      emptyState.textContent = directoryUnavailable
        ? "Community listings are unavailable right now."
        : query
          ? "No communities match that search. Try another name or keyword."
          : "No communities are listed yet. Be the first to submit one.";
      resultsContainer.append(emptyState);
      return;
    }

    resultsContainer.append(...matchingListings.map(makeListingCard));
  };

  const loadListings = async () => {
    if (!configured) {
      directoryUnavailable = true;
      setStatus(
        directoryStatus,
        "The server directory is not connected yet. Add your Supabase project settings to directory-config.js.",
        true,
      );
      setStatus(formStatus, "The server directory is not connected yet.", true);
      renderListings();
      return;
    }

    setStatus(directoryStatus, "Loading communities...");
    try {
      const allListings = [];
      const pageSize = 1000;
      let offset = 0;
      while (true) {
        const url = new URL(`${supabaseUrl}/rest/v1/server_listings`);
        url.searchParams.set(
          "select",
          "title,description,invite_code,guild_id,guild_name,guild_icon_hash,guild_banner_hash,approximate_member_count,created_at",
        );
        url.searchParams.set("status", "eq.approved");
        url.searchParams.set("order", "created_at.desc");
        url.searchParams.set("limit", String(pageSize));
        url.searchParams.set("offset", String(offset));

        const response = await fetch(url, { headers: apiHeaders });
        if (!response.ok) {
          throw new Error(`Directory request failed (${response.status}).`);
        }

        const page = await response.json();
        allListings.push(...page);
        if (page.length < pageSize) break;
        offset += pageSize;
      }

      listings = allListings;
      directoryUnavailable = false;
      setStatus(
        directoryStatus,
        listings.length
          ? "Search by listing title, server name, or description."
          : "No communities are listed yet. Be the first to submit one.",
      );
      renderListings();
    } catch (error) {
      directoryUnavailable = true;
      console.error("Could not load server listings:", error);
      setStatus(
        directoryStatus,
        "Could not load communities. Check your Supabase setup and try again.",
        true,
      );
      renderListings();
    }
  };

  const showInvitePreview = async () => {
    const buttonLabel = previewButton.textContent;
    previewButton.disabled = true;
    previewButton.textContent = "Checking invite...";
    setStatus(formStatus, "Fetching server details from Discord...");

    try {
      const code = normalizeInvite(inviteInput.value);
      invitePreview = await resolveInvite(code);
      invitePreviewCode = code;
      previewContainer.replaceChildren();

      const previewBanner = document.createElement("div");
      previewBanner.className = "invite-preview-banner";
      const bannerUrl = assetUrl(invitePreview.guildId, invitePreview.bannerHash, "banners");
      if (bannerUrl) previewBanner.style.backgroundImage = `url("${bannerUrl}")`;

      const icon = document.createElement("img");
      icon.alt = "";
      icon.src =
        assetUrl(invitePreview.guildId, invitePreview.iconHash, "icons") || "giant-logo.png";

      const details = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = invitePreview.guildName;
      const members = document.createElement("small");
      members.textContent =
        invitePreview.memberCount === null
          ? "Server found"
          : `${numberFormatter.format(invitePreview.memberCount)} members`;
      details.append(name, members);
      previewBanner.append(icon);
      previewContainer.append(previewBanner, details);
      previewContainer.hidden = false;
      setStatus(formStatus, "Server found. Complete the form to submit your listing.");
    } catch (error) {
      invitePreview = null;
      invitePreviewCode = "";
      previewContainer.hidden = true;
      setStatus(formStatus, error.message, true);
    } finally {
      previewButton.disabled = false;
      previewButton.textContent = buttonLabel;
    }
  };

  searchInput.addEventListener("input", renderListings);
  inviteInput.addEventListener("input", () => {
    try {
      const code = normalizeInvite(inviteInput.value);
      if (code !== invitePreviewCode) {
        invitePreview = null;
        invitePreviewCode = "";
        previewContainer.hidden = true;
      }
    } catch {
      invitePreview = null;
      invitePreviewCode = "";
      previewContainer.hidden = true;
    }
  });
  previewButton.addEventListener("click", showInvitePreview);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!configured) {
      setStatus(formStatus, "The server directory is not connected yet.", true);
      return;
    }

    submitButton.disabled = true;
    setStatus(formStatus, "Submitting your listing...");
    try {
      const code = normalizeInvite(inviteInput.value);
      const server = invitePreview && invitePreviewCode === code
        ? invitePreview
        : await resolveInvite(code);
      const payload = {
        title: form.elements.namedItem("title").value.trim(),
        description: form.elements.namedItem("description").value.trim(),
        invite_code: server.code,
        guild_id: server.guildId,
        guild_name: server.guildName,
        guild_icon_hash: server.iconHash || null,
        guild_banner_hash: server.bannerHash || null,
        approximate_member_count: server.memberCount,
      };

      const response = await fetch(`${supabaseUrl}/rest/v1/server_listings`, {
        method: "POST",
        headers: {
          ...apiHeaders,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        throw new Error("This invite has already been submitted.");
      }
      if (!response.ok) {
        throw new Error(`Listing submission failed (${response.status}).`);
      }

      form.reset();
      invitePreview = null;
      invitePreviewCode = "";
      previewContainer.hidden = true;
      setStatus(formStatus, "Submitted for review. Your listing will appear after it is approved.");
    } catch (error) {
      console.error("Could not submit server listing:", error);
      setStatus(formStatus, error.message || "Could not submit your listing. Try again.", true);
    } finally {
      submitButton.disabled = false;
    }
  });

  loadListings();
})();
