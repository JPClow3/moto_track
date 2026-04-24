(function () {
  const storageKey = "mototrack-theme";
  const themeOrder = ["system", "dark", "light"];
  const themeMeta = {
    system: { icon: "monitor", label: "Sistema" },
    dark: { icon: "moon-star", label: "Noturno" },
    light: { icon: "sun-medium", label: "Claro" },
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
    meta.setAttribute("content", getResolvedTheme(currentTheme) === "dark" ? "#09090B" : "#F5F5F4");
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
      button.setAttribute("aria-label", "Tema atual: " + currentMeta.label + ". Alternar tema.");
      button.setAttribute("title", "Tema: " + currentMeta.label);
      button.dataset.themeMode = currentTheme;
      button.innerHTML =
        '<span class="ui-icon-dot" aria-hidden="true"><i data-lucide="' +
        currentMeta.icon +
        '"></i></span><span class="hidden sm:inline">Tema</span><span>' +
        currentMeta.label +
        "</span>";
    });
    if (window.lucide) {
      window.lucide.createIcons();
    }
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
