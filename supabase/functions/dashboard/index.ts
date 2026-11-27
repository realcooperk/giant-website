type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

type DiscordGuild = {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions: string;
};

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

const jsonResponse = (body: Record<string, unknown>, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const hasServerManagementPermission = (guild: DiscordGuild) => {
  if (guild.owner === true) return true;
  if (typeof guild.permissions !== "string" || !/^\d+$/.test(guild.permissions)) {
    return false;
  }
  return (BigInt(guild.permissions) & 40n) !== 0n;
};

Deno.serve(async (request) => {
  const allowedOrigin = Deno.env.get("DASHBOARD_ORIGIN")?.replace(/\/+$/, "");
  const requestOrigin = request.headers.get("Origin");
  if (!allowedOrigin || requestOrigin !== allowedOrigin) {
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, allowedOrigin);
  }

  const clientId = Deno.env.get("DISCORD_CLIENT_ID");
  const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET");
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!clientId || !clientSecret || !botToken) {
    console.error("Dashboard function is missing one or more Discord secrets.");
    return jsonResponse({ error: "The dashboard service is not configured." }, 500, allowedOrigin);
  }

  let body: { code?: unknown; redirect_uri?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "The request body must be valid JSON." }, 400, allowedOrigin);
  }

  const redirectUri = allowedOrigin;
  if (
    typeof body.code !== "string" ||
    body.code.length < 1 ||
    body.code.length > 2048 ||
    body.redirect_uri !== redirectUri
  ) {
    return jsonResponse({ error: "The authorization request is invalid." }, 400, allowedOrigin);
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: body.code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) {
      console.error(`Discord token exchange failed (${tokenResponse.status}).`);
      return jsonResponse(
        { error: "Discord sign-in expired or could not be completed. Please sign in again." },
        401,
        allowedOrigin,
      );
    }

    const tokenData = await tokenResponse.json();
    if (typeof tokenData.access_token !== "string") {
      console.error("Discord token exchange returned no access token.");
      return jsonResponse({ error: "Discord sign-in could not be completed." }, 502, allowedOrigin);
    }
    const userHeaders = { Authorization: `Bearer ${tokenData.access_token}` };

    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: userHeaders,
    });
    if (!userResponse.ok) {
      console.error(`Discord user request failed (${userResponse.status}).`);
      return jsonResponse({ error: "Could not load your Discord profile." }, 502, allowedOrigin);
    }
    const user = (await userResponse.json()) as DiscordUser;
    if (typeof user.id !== "string" || typeof user.username !== "string") {
      console.error("Discord returned an invalid user profile.");
      return jsonResponse({ error: "Discord returned an invalid profile." }, 502, allowedOrigin);
    }

    const userGuilds: DiscordGuild[] = [];
    let after = "";
    while (true) {
      const guildsUrl = new URL("https://discord.com/api/v10/users/@me/guilds");
      guildsUrl.searchParams.set("limit", "200");
      if (after) guildsUrl.searchParams.set("after", after);

      const guildsResponse = await fetch(guildsUrl, { headers: userHeaders });
      if (!guildsResponse.ok) {
        console.error(`Discord guild request failed (${guildsResponse.status}).`);
        return jsonResponse({ error: "Could not load your Discord servers." }, 502, allowedOrigin);
      }

      const page = await guildsResponse.json();
      if (!Array.isArray(page)) {
        console.error("Discord returned an invalid guild list.");
        return jsonResponse({ error: "Discord returned invalid server data." }, 502, allowedOrigin);
      }

      userGuilds.push(...(page as DiscordGuild[]));
      if (page.length < 200) break;

      const nextAfter = page[page.length - 1]?.id;
      if (typeof nextAfter !== "string" || nextAfter === after) {
        console.error("Discord guild pagination did not advance.");
        return jsonResponse({ error: "Could not load all of your Discord servers." }, 502, allowedOrigin);
      }
      after = nextAfter;
    }

    const adminGuilds = userGuilds.filter(hasServerManagementPermission);
    const results = [];
    for (let index = 0; index < adminGuilds.length; index += 5) {
      const batch = adminGuilds.slice(index, index + 5);
      const batchResults = await Promise.all(
        batch.map(async (guild) => {
          if (!/^[0-9]{5,25}$/.test(guild.id)) {
            throw new Error("Discord returned an invalid server ID.");
          }

          const botGuildResponse = await fetch(
            `https://discord.com/api/v10/guilds/${guild.id}`,
            { headers: { Authorization: `Bot ${botToken}` } },
          );
          if (botGuildResponse.status === 404) {
            return { id: guild.id, name: guild.name, icon: guild.icon ?? null, botInstalled: false };
          }
          if (!botGuildResponse.ok) {
            throw new Error(`Could not check Giant's membership (${botGuildResponse.status}).`);
          }
          return { id: guild.id, name: guild.name, icon: guild.icon ?? null, botInstalled: true };
        }),
      );
      results.push(...batchResults);
    }

    return jsonResponse(
      {
        user: {
          id: user.id,
          username: user.username,
          global_name: user.global_name ?? null,
          avatar: user.avatar ?? null,
        },
        guilds: results,
        access_token: tokenData.access_token,
      },
      200,
      allowedOrigin,
    );
  } catch (error) {
    console.error("Dashboard request failed:", error);
    return jsonResponse(
      { error: "Could not load your servers. Please try again." },
      502,
      allowedOrigin,
    );
  }
});
