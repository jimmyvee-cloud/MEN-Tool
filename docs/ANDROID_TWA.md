# Android Trusted Web Activity (PWABuilder)

1. Deploy the PWA to HTTPS with a valid `manifest.json` (see `frontend/vite.config.ts` PWA plugin).
2. Replace placeholders in `frontend/public/.well-known/assetlinks.json` with your Android `applicationId` and release keystore SHA-256 fingerprint.
3. Use [PWABuilder](https://www.pwabuilder.com/) to generate the TWA package from your site URL.
4. Sign the APK/AAB with a keystore **not** committed to git.
5. Ensure `assetlinks.json` is served at `https://your-domain/.well-known/assetlinks.json` without redirects.
