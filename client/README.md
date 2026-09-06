# React + Vite

This client is the Evalcue AI React/Vite application.

## Client configuration

Create a `.env` file in `client/` with the values your environment needs:

```env
VITE_API_BASE_URL=/api
# Canonical production origin used to generate sitemap.xml and robots.txt.
# Example: https://www.evalcue.example
VITE_PUBLIC_ORIGIN=

VITE_CAPTCHA_PROVIDER=turnstile
VITE_TURNSTILE_SITE_KEY=<your_turnstile_site_key>
# If using reCAPTCHA instead:
# VITE_CAPTCHA_PROVIDER=recaptcha
# VITE_RECAPTCHA_SITE_KEY=<your_recaptcha_site_key>

VITE_GOOGLE_CLIENT_ID=<your_google_oauth_client_id>
VITE_ACCOUNT_DATA_EXPORT_ENABLED=false
```

`VITE_PUBLIC_ORIGIN` should be the public canonical origin with no path component. When it is set for a production build, Vite emits `sitemap.xml` and `robots.txt` for the public landing, documentation, privacy, and terms routes. Protected Practice/Hiring routes are intentionally excluded from the sitemap and disallowed in `robots.txt`.

On the server, set `CAPTCHA_ENABLED=true` and `CAPTCHA_SECRET` and enable the login/register CAPTCHA gates in production.
