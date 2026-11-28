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

4. Configure and expose the bot's dashboard API over HTTPS by following [`DASHBOARD-API-SETUP.md`](https://github.com/realcooperk/Giant/blob/main/DASHBOARD-API-SETUP.md). Set `botApiUrl` in `directory-config.js` to that API's `/security` endpoint. The API validates the signed-in Discord user and Manage Server permission for each request. The API supports security settings and welcome/goodbye message configuration.
5. Redeploy this Supabase dashboard function and publish the website changes. The dashboard lists servers where the signed-in user owns the server or has Administrator or Manage Server permission. It checks Giant's membership using the bot token and offers a server-specific invite when Giant is not installed.

Security settings and case actions work only after the bot API is reachable over HTTPS and `botApiUrl` is configured in `directory-config.js`.

If the page reports that it cannot reach the dashboard service, confirm the function is deployed to the same Supabase project configured in `directory-config.js` and that `DASHBOARD_ORIGIN` is exactly `https://giant-bot.xyz`.
