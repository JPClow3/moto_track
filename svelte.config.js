import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

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
        "form-action": ["self"],
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
