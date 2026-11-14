# Dashboard setup

The dashboard uses a Supabase Edge Function to exchange Discord authorization codes and check whether Giant is in each server. Keep the Discord client secret and bot token in Supabase secrets; never add them to website JavaScript or `directory-config.js`.

1. In the Discord Developer Portal for application `1385271103030689863`, add this exact OAuth2 redirect URI:

   `https://giant-bot.xyz`

2. From the repository root, set the Edge Function secrets. Use the bot token without the `Bot ` prefix:

   ```sh
   supabase secrets set DISCORD_CLIENT_ID="1385271103030689863" DISCORD_CLIENT_SECRET="your-discord-client-secret" DISCORD_BOT_TOKEN="your-discord-bot-token" DASHBOARD_ORIGIN="https://giant-bot.xyz" --project-ref xmgryoegbzyxulimmaed
   ```

3. Deploy the function:

   ```sh
   supabase functions deploy dashboard --project-ref xmgryoegbzyxulimmaed
   ```

4. Publish the website changes. The dashboard lists only guilds where the signed-in user owns the server or has Discord's Administrator permission. It checks Giant's membership using the bot token and offers a server-specific invite when Giant is not installed.

The settings area is intentionally informational until server-management controls are added.

If the page reports that it cannot reach the dashboard service, confirm the function is deployed to the same Supabase project configured in `directory-config.js` and that `DASHBOARD_ORIGIN` is exactly `https://giant-bot.xyz`.
