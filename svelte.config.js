import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const neonAuthOrigin = new URL(
  process.env.PUBLIC_NEON_AUTH_URL ??
    "https://ep-damp-bar-acu29m6g.neonauth.sa-east-1.aws.neon.tech/neondb/auth",
).origin;

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    csp: {
      mode: "auto",
      directives: {
        "default-src": ["self"],
        "base-uri": ["self"],
        "connect-src": [
          "self",
          "https://*.ingest.sentry.io",
          "https://*.ingest.us.sentry.io",
        ],
        "font-src": ["self", "data:"],
        // Chromium also checks every redirect after a form POST. Social login
        // goes through this branch's Neon host before reaching the provider.
        "form-action": [
          "self",
          neonAuthOrigin,
          "https://accounts.google.com",
          "https://appleid.apple.com",
        ],
        "frame-ancestors": ["none"],
        // Staff-authored Markdown supports remote HTTPS article images.
        "img-src": ["self", "data:", "blob:", "https:"],
        "manifest-src": ["self"],
        "object-src": ["none"],
        "script-src": ["self"],
        "style-src": ["self", "unsafe-inline"],
        "worker-src": ["self", "blob:"],
      },
    },
    adapter: adapter({
      routes: {
        include: ["/*"],
        exclude: ["<all>"],
      },
    }),
    alias: {
      $components: "src/lib/components",
      $server: "src/lib/server",
      $types: "src/lib/types",
    },
  },
};

export default config;
