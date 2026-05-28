(function () {
  const storageKey = "mototrack-theme";
  const themeOrder = ["system", "dark", "light"];
  const themeMeta = {
    system: { icon: "monitor", label: "sistema", next: "escuro" },
    dark: { icon: "moon", label: "escuro", next: "claro" },
    light: { icon: "sun", label: "claro", next: "sistema" },
  };
  const themeIcons = {
    monitor:
      '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8"></path><path d="M12 16v4"></path></svg>',
    moon:
      '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.9 14.4A8.2 8.2 0 0 1 9.6 3.1 8.2 8.2 0 1 0 20.9 14.4Z"></path></svg>',
    sun:
      '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>',
  };

  function isValidTheme(value) {
    return themeOrder.includes(value);
  }

  function readStoredTheme() {
    try {
      const value = window.localStorage.getItem(storageKey);
      return isValidTheme(value) ? value : "system";
    } catch (error) {
      return "system";
    }
  }

  function persistTheme(value) {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch (error) {
      // Ignore localStorage failures.
    }
  }

  function getMediaQuery() {
    if (!window.matchMedia) {
      return null;
    }
    return window.matchMedia("(prefers-color-scheme: dark)");
  }

  function getResolvedTheme(theme) {
    const currentTheme = isValidTheme(theme) ? theme : readStoredTheme();
    if (currentTheme !== "system") {
      return currentTheme;
    }
    const media = getMediaQuery();
    return media && media.matches ? "dark" : "light";
  }

  function updateThemeColorMeta(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      return;
    }
    const currentTheme = isValidTheme(theme)
      ? theme
      : document.documentElement.dataset.theme || readStoredTheme();
    meta.setAttribute("content", getResolvedTheme(currentTheme) === "dark" ? "#0B0B0F" : "#F5F5F7");
  }

  function updateManifestLink(theme) {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      return;
    }
    const currentTheme = isValidTheme(theme)
      ? theme
      : document.documentElement.dataset.theme || readStoredTheme();
    const resolvedTheme = getResolvedTheme(currentTheme);
    const baseHref = manifestLink.dataset.baseHref || manifestLink.getAttribute("href");
    if (!baseHref) {
      return;
    }
    manifestLink.dataset.baseHref = baseHref;
    const manifestUrl = new URL(baseHref, window.location.origin);
    manifestUrl.searchParams.set("mode", currentTheme);
    manifestUrl.searchParams.set("resolved", resolvedTheme);
    manifestLink.setAttribute("href", manifestUrl.toString());
  }

  function renderThemeButtons() {
    const currentTheme = document.documentElement.dataset.theme || readStoredTheme();
    const currentMeta = themeMeta[currentTheme] || themeMeta.system;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", "Tema " + currentMeta.label + ". Alternar para tema " + currentMeta.next + ".");
      button.setAttribute("title", "Tema " + currentMeta.label);
      button.dataset.themeMode = currentTheme;
      button.innerHTML = themeIcons[currentMeta.icon] || themeIcons.sun;
    });
  }

  function applyTheme(theme, options) {
    const settings = options || {};
    const nextTheme = isValidTheme(theme) ? theme : "system";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.dataset.resolvedTheme = getResolvedTheme(nextTheme);
    updateThemeColorMeta(nextTheme);
    updateManifestLink(nextTheme);
    renderThemeButtons();
    if (settings.persist !== false) {
      persistTheme(nextTheme);
    }
    if (settings.dispatch !== false) {
      window.dispatchEvent(
        new CustomEvent("mototrack:themechange", {
          detail: {
            mode: nextTheme,
            resolved: getResolvedTheme(nextTheme),
          },
        })
      );
    }
  }

  function saveServerPreference(theme) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    if (!csrfToken) return;
    fetch('/api/theme/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRFToken': csrfToken,
      },
      body: new URLSearchParams({ theme }),
    }).catch(() => {});
  }

  function cycleTheme() {
    const currentTheme = document.documentElement.dataset.theme || readStoredTheme();
    const currentIndex = themeOrder.indexOf(currentTheme);
    const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
    applyTheme(nextTheme);
    saveServerPreference(nextTheme);
  }

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-theme-toggle]");
    if (!toggle) {
      return;
    }
    cycleTheme();
  });

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(document.documentElement.dataset.theme || readStoredTheme(), {
      persist: false,
      dispatch: false,
    });
  });

  const media = getMediaQuery();
  if (media) {
    media.addEventListener("change", () => {
      if ((document.documentElement.dataset.theme || "system") === "system") {
        applyTheme("system", { persist: false });
      }
    });
  }

  window.MotoTrackTheme = {
    applyTheme,
    cycleTheme,
    getResolvedTheme,
    readStoredTheme,
  };
})();
