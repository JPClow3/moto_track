/* AI-NOTE: justified-exception — global app utilities, PWA, accessibility, and HTMX lifecycle */

function registerAppShell() {
  if (typeof Alpine === "undefined") return;
  Alpine.data("appShell", () => ({
    mobileMenuOpen: false,
    quickFormOpen: false,
    snackbarMessage: "",
    snackbarVisible: false,
    snackbarTimer: null,
    skeletonVisible: false,
    previousFocusedElement: null,
    kbdHelpOpen: false,

    init() {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    },

    openMobileMenu() {
      this.previousFocusedElement = document.activeElement;
      this.mobileMenuOpen = true;
      this.$nextTick(() => {
        const firstLink = this.$refs.mobileMenuDialog?.querySelector("a, button");
        if (firstLink) firstLink.focus();
      });
    },

    closeMobileMenu() {
      this.mobileMenuOpen = false;
      if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === "function") {
        this.previousFocusedElement.focus();
      }
    },

    closeQuickFormModal() {
      if (typeof window.closeQuickFormModal === "function") {
        window.closeQuickFormModal();
        this.quickFormOpen = false;
        return;
      }
      const quickFormRoot = document.getElementById("quick-form-root");
      if (quickFormRoot) quickFormRoot.innerHTML = "";
      const appShell = document.getElementById("app-shell-main");
      if (appShell) {
        appShell.removeAttribute("inert");
        appShell.removeAttribute("aria-hidden");
      }
      this.quickFormOpen = false;
    },

    showSnackbar(message) {
      this.snackbarMessage = message;
      this.snackbarVisible = true;
      clearTimeout(this.snackbarTimer);
      this.snackbarTimer = setTimeout(() => {
        this.snackbarVisible = false;
      }, 5000);
    },

    openKbdHelp() {
      this.kbdHelpOpen = true;
    },

    closeKbdHelp() {
      this.kbdHelpOpen = false;
    },

    triggerQuickForm(url) {
      if (typeof htmx !== "undefined" && url) {
        htmx.ajax("GET", url, { target: "#quick-form-root", swap: "innerHTML", indicator: "#quick-form-skeleton" });
      }
    },

    isTyping() {
      const active = document.activeElement;
      if (!active) return false;
      return active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable;
    },
  }));
}

if (typeof Alpine !== "undefined") {
  registerAppShell();
} else {
  document.addEventListener("alpine:init", registerAppShell);
}

(function () {
  let previousFocusedElement = null;

  function getFocusableElements(container) {
    return Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hasAttribute("hidden") && element.offsetParent !== null);
  }

  function closeQuickFormModal() {
    const quickFormRoot = document.getElementById("quick-form-root");
    if (!quickFormRoot) return;
    quickFormRoot.innerHTML = "";
    setAppInert(false);
    document.body.dispatchEvent(new CustomEvent("quick-form-closed"));
    if (previousFocusedElement && typeof previousFocusedElement.focus === "function") {
      previousFocusedElement.focus();
    }
  }

  window.closeQuickFormModal = closeQuickFormModal;

  function showClientSnackbar(message) {
    const snackbar = document.getElementById("client-snackbar");
    if (!snackbar) return;
    snackbar.textContent = message;
    snackbar.classList.remove("hidden", "snackbar-exit");
    snackbar.classList.add("snackbar-enter");
    window.clearTimeout(Number(snackbar.dataset.hideTimer || 0));
    window.clearTimeout(Number(snackbar.dataset.exitTimer || 0));
    const timer = window.setTimeout(() => {
      snackbar.classList.remove("snackbar-enter");
      snackbar.classList.add("snackbar-exit");
      const hideSnackbar = () => {
        if (snackbar.classList.contains("snackbar-exit")) {
          snackbar.classList.add("hidden");
          snackbar.classList.remove("snackbar-exit");
        }
        window.clearTimeout(Number(snackbar.dataset.exitTimer || 0));
      };
      snackbar.addEventListener("animationend", hideSnackbar, { once: true });
      snackbar.dataset.exitTimer = window.setTimeout(hideSnackbar, 300);
    }, 5000);
    snackbar.dataset.hideTimer = timer;
  }

  window.showClientSnackbar = showClientSnackbar;

  function bindAutoDismissToast(toast) {
    if (!toast || toast.dataset.toastBound === "true") return;
    toast.dataset.toastBound = "true";
    toast.classList.add("snackbar-enter");
    window.clearTimeout(Number(toast.dataset.hideTimer || 0));
    window.clearTimeout(Number(toast.dataset.exitTimer || 0));

    const hideToast = () => {
      if (toast.classList.contains("snackbar-exit")) {
        toast.classList.add("hidden");
        toast.classList.remove("snackbar-exit");
      }
      window.clearTimeout(Number(toast.dataset.exitTimer || 0));
    };

    toast.dataset.hideTimer = window.setTimeout(() => {
      toast.classList.remove("snackbar-enter");
      toast.classList.add("snackbar-exit");
      toast.addEventListener("animationend", hideToast, { once: true });
      toast.dataset.exitTimer = window.setTimeout(hideToast, 300);
    }, 5000);
  }

  function initToasts(container) {
    const scope = container || document;
    scope.querySelectorAll("[data-auto-dismiss-toast]").forEach(bindAutoDismissToast);
  }

  function renderLucideIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  window.renderLucideIcons = renderLucideIcons;

  function setupQuickFormAccessibility() {
    const quickFormRoot = document.getElementById("quick-form-root");
    if (!quickFormRoot) return;
    const dialog = quickFormRoot.querySelector('[role="dialog"]');
    setAppInert(Boolean(dialog));
    if (!dialog) return;
    dialog.setAttribute("data-modal-root", "");
    const focusableElements = getFocusableElements(dialog);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }

  function setAppInert(isInert) {
    const appShell = document.getElementById("app-shell-main");
    if (!appShell) return;
    if (isInert) {
      appShell.setAttribute("inert", "");
      appShell.setAttribute("aria-hidden", "true");
    } else {
      appShell.removeAttribute("inert");
      appShell.removeAttribute("aria-hidden");
    }
  }

  function initPolish(container) {
    const scope = container || document;
    const targets = scope.querySelectorAll("[data-animate-once], [data-chart-reveal]");
    if (!targets.length) return;
    document.documentElement.classList.add("js-anim");
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    targets.forEach((el) => observer.observe(el));
  }

  function setQuickSkeleton(kind) {
    const skeleton = document.getElementById("quick-form-skeleton");
    if (!skeleton) return;
    const labels = {
      chooser: ["Abrindo atalhos", "Escolha o registro em instantes."],
      fuel: ["Preparando abastecimento", "Campos principais primeiro, detalhes depois."],
      maintenance: ["Preparando manutenção", "Serviço, custo e vencimentos ficam prontos para preencher."],
      odometer: ["Preparando odômetro", "Atualize a quilometragem com segurança."],
      form: ["Carregando formulário", "Só um instante."]
    };
    const label = labels[kind] || labels.form;
    skeleton.dataset.skeletonKind = kind || "form";
    skeleton.querySelectorAll("[data-skeleton-title]").forEach((el) => { el.textContent = label[0]; });
    skeleton.querySelectorAll("[data-skeleton-copy]").forEach((el) => { el.textContent = label[1]; });
  }

  function initFilterForms(container) {
    const scope = container || document;
    scope.querySelectorAll("[data-filter-form]").forEach((form) => {
      if (form.dataset.polishBound === "true") return;
      form.dataset.polishBound = "true";
      form.addEventListener("submit", () => {
        form.classList.add("is-loading");
        const target = form.dataset.skeletonTarget ? document.querySelector(form.dataset.skeletonTarget) : null;
        if (target) {
          target.classList.add("list-loading");
          target.setAttribute("aria-busy", "true");
        }
      });
    });
  }

  function initExportLinks(container) {
    const scope = container || document;
    scope.querySelectorAll("[data-export-link]").forEach((link) => {
      if (link.dataset.polishBound === "true") return;
      link.dataset.polishBound = "true";
      link.addEventListener("click", () => {
        const original = link.dataset.originalLabel || link.textContent.trim();
        link.dataset.originalLabel = original;
        link.classList.add("is-loading");
        link.setAttribute("aria-busy", "true");
        link.textContent = link.dataset.loadingLabel || "Gerando...";
        window.setTimeout(() => {
          link.classList.remove("is-loading");
          link.removeAttribute("aria-busy");
          link.textContent = original;
        }, 3500);
      });
    });
  }

  function initDismissibleCards(container) {
    const scope = container || document;
    scope.querySelectorAll("[data-dismissible-card]").forEach((card) => {
      if (card.dataset.polishBound === "true") return;
      card.dataset.polishBound = "true";
      card.querySelectorAll("[data-dismiss-card]").forEach((button) => {
        button.addEventListener("click", () => {
          card.style.transition = "opacity 160ms ease-out, transform 160ms ease-out, max-height 180ms ease-out";
          card.style.maxHeight = card.scrollHeight + "px";
          requestAnimationFrame(() => {
            card.style.opacity = "0";
            card.style.transform = "translateY(-0.25rem)";
            card.style.maxHeight = "0";
          });
        });
      });
    });
  }

  function initLazyImageShimmer() {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      if (!img.complete) {
        img.classList.add("skeleton-shimmer");
        img.addEventListener("load", () => img.classList.remove("skeleton-shimmer"), { once: true });
        img.addEventListener("error", () => img.classList.remove("skeleton-shimmer"), { once: true });
      }
    });
  }

  function initAutocomplete(container) {
    const scope = container || document;
    const hasDal = scope.querySelector(".autocomplete-light-widget, .select2, [data-autocomplete-light-url]");
    if (!hasDal) return;
    if (window.django && window.django.jQuery) {
      window.django.jQuery(document).trigger("autocompleteLightInitialize");
    } else if (window.jQuery) {
      window.jQuery(document).trigger("autocompleteLightInitialize");
    }
  }

  function initFuelDefaults(container) {
    const form =
      (container.closest && container.closest("[data-fuel-defaults]")) ||
      (typeof container.querySelector === "function" && container.querySelector("[data-fuel-defaults]")) ||
      document.querySelector("[data-fuel-defaults]");
    if (!form) return;
    const defaultsUrl = form.dataset.defaultsUrl;
    if (!defaultsUrl) return;
    const station = form.querySelector("#id_station");
    const grade = form.querySelector("#id_fuel_grade");
    const type = form.querySelector("#id_fuel_type");
    const price = form.querySelector("#id_price_per_liter_0, #id_price_per_liter");
    const tankFull = form.querySelector("#id_tank_full");
    const stationName = form.querySelector("#id_station_name");
    async function loadDefaults() {
      const params = new URLSearchParams();
      if (station && station.value) params.set("station", station.value);
      if (grade && grade.value) params.set("fuel_grade", grade.value);
      if (type && type.value) params.set("fuel_type", type.value);
      if (!params.toString()) return;
      try {
        const response = await fetch(defaultsUrl + "?" + params.toString(), { headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const data = await response.json();
        if (price && data.price_per_liter && !price.value) price.value = data.price_per_liter;
        if (tankFull && typeof data.tank_full === "boolean") tankFull.checked = data.tank_full;
        if (stationName && data.station_name && !stationName.value) stationName.value = data.station_name;
      } catch (e) {
        // ignore
      }
    }
    [station, grade, type].forEach((el) => el && el.addEventListener("change", loadDefaults));
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderLucideIcons();
    initLazyImageShimmer();
    initAutocomplete(document.body);
    initFuelDefaults(document.body);
    initPolish(document.body);
    initFilterForms(document.body);
    initExportLinks(document.body);
    initDismissibleCards(document.body);
    initToasts(document.body);
  });

  document.body.addEventListener("htmx:afterSwap", (event) => {
    renderLucideIcons();
    if (window.Alpine && event.detail && event.detail.target) {
      window.Alpine.initTree(event.detail.target);
    }
    initAutocomplete(event.detail?.target || document.body);
    if (event.detail?.target) {
      initFuelDefaults(event.detail.target);
      initPolish(event.detail.target);
      initFilterForms(event.detail.target);
      initExportLinks(event.detail.target);
      initDismissibleCards(event.detail.target);
      initToasts(event.detail.target);
    }
  });

  document.body.addEventListener("htmx:configRequest", (event) => {
    event.detail.headers["X-CSRFToken"] = getCsrfToken();
  });

  document.body.addEventListener("htmx:beforeRequest", (event) => {
    previousFocusedElement = document.activeElement;
    const trigger = event.detail.elt;
    if (trigger) {
      trigger.setAttribute("aria-busy", "true");
      trigger.classList.add("is-loading");
      setQuickSkeleton(trigger.dataset.skeletonKind || trigger.closest("[data-skeleton-kind]")?.dataset.skeletonKind);
    }
  });

  document.body.addEventListener("htmx:afterRequest", (event) => {
    const trigger = event.detail.elt;
    if (trigger) {
      trigger.removeAttribute("aria-busy");
      trigger.classList.remove("is-loading");
    }
  });

  document.body.addEventListener("htmx:afterSwap", (event) => {
    if (event.target && event.target.id === "quick-form-root") {
      setupQuickFormAccessibility();
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target && event.target.matches("[data-quick-modal-backdrop]")) {
      closeQuickFormModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    const quickFormRoot = document.getElementById("quick-form-root");
    if (!quickFormRoot || !quickFormRoot.firstElementChild) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeQuickFormModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const quickFormRoot = document.getElementById("quick-form-root");
    const dialog = quickFormRoot ? quickFormRoot.querySelector('[role="dialog"]') : null;
    if (!dialog) return;
    const focusableElements = getFocusableElements(dialog);
    if (focusableElements.length === 0) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  });

  if (window.matchMedia('(display-mode: standalone)').matches === false) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('pwa-prompt-available', { detail: e }));
    });
  }

  if ("serviceWorker" in navigator) {
    const swUrlMeta = document.querySelector('meta[name="service-worker-url"]');
    const swUrl = swUrlMeta ? swUrlMeta.content : "/sw.js";
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(swUrl).catch(() => {});
    });
  }

  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) return meta.content;
    const input = document.querySelector('[name=csrfmiddlewaretoken]');
    return input ? input.value : "";
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
  }

  window.initOnboardingWizard = function (previewUrl) {
    const templateSelect = document.getElementById("id_template");
    const notListedField = document.getElementById("id_template_not_listed");
    const preview = document.getElementById("template-preview");
    function normalize(value) {
      return (value || "").toString().trim();
    }
    function refreshSpecBadges() {
      document.querySelectorAll(".onboarding-spec-field").forEach((container) => {
        const field = container.querySelector("input, textarea, select");
        const prefilledBadge = container.querySelector("[data-prefilled-badge]");
        const overrideBadge = container.querySelector("[data-override-badge]");
        if (!field || !prefilledBadge || !overrideBadge) return;
        const prefilledValue = field.getAttribute("data-prefilled-value");
        if (!prefilledValue) {
          prefilledBadge.classList.add("hidden");
          overrideBadge.classList.add("hidden");
          return;
        }
        const currentValue = normalize(field.value);
        const originalValue = normalize(prefilledValue);
        if (!currentValue) {
          prefilledBadge.classList.add("hidden");
          overrideBadge.classList.remove("hidden");
        } else if (currentValue === originalValue) {
          prefilledBadge.classList.remove("hidden");
          overrideBadge.classList.add("hidden");
        } else {
          prefilledBadge.classList.add("hidden");
          overrideBadge.classList.remove("hidden");
        }
      });
    }
    function loadTemplatePreview() {
      if (!preview) return;
      if (notListedField && notListedField.checked) {
        preview.innerHTML = "<p class='text-sm text-on-surface-variant'>Fluxo sem template ativo. Preencha manualmente os campos da sua moto.</p>";
        return;
      }
      if (!templateSelect || !templateSelect.value) {
        preview.innerHTML = "<p class='text-sm text-on-surface-variant'>Selecione uma moto no catálogo para visualizar as especificações base.</p>";
        return;
      }
      const url = previewUrl + "?template=" + encodeURIComponent(templateSelect.value);
      fetch(url, { headers: { "X-Requested-With": "XMLHttpRequest" } })
        .then((response) => response.text())
        .then((html) => {
          preview.innerHTML = html || "<p class='text-sm text-on-surface-variant'>Template selecionado sem preview disponível.</p>";
        })
        .catch(() => {
          preview.innerHTML = "<p class='text-sm text-on-surface-variant'>Não foi possível carregar o preview do template.</p>";
        });
    }
    refreshSpecBadges();
    loadTemplatePreview();
    document.addEventListener("input", refreshSpecBadges, true);
    document.addEventListener(
      "change",
      (e) => {
        refreshSpecBadges();
        if (e.target.id === "id_template" || e.target.id === "id_template_not_listed") {
          loadTemplatePreview();
        }
      },
      true
    );
  };

  window.subscribeToPush = async function (button) {
    const trigger = button || document.getElementById("push-subscribe-button");
    const publicKey = trigger ? trigger.dataset.vapidKey : "";
    const pushUrlMeta = document.querySelector('meta[name="push-subscribe-url"]');
    const pushUrl = pushUrlMeta ? pushUrlMeta.content : "/api/push/subscribe/";
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      showClientSnackbar("Notificações push não são compatíveis com este navegador.");
      return;
    }
    if (!("PushManager" in window)) {
      showClientSnackbar("Este navegador não oferece suporte a assinatura push.");
      return;
    }
    if (!publicKey) {
      showClientSnackbar("Notificações push ainda não foram configuradas no servidor.");
      return;
    }
    try {
      if (trigger) {
        trigger.disabled = true;
        trigger.setAttribute("aria-busy", "true");
      }
      const registration = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showClientSnackbar("Permissão de notificação não concedida.");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const response = await fetch(pushUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
        },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) {
        throw new Error("Subscription API failed");
      }
      showClientSnackbar("Notificações ativadas com sucesso.");
    } catch (e) {
      console.error("Push subscription failed:", e);
      showClientSnackbar("Não foi possível ativar as notificações agora.");
    } finally {
      if (trigger) {
        trigger.disabled = false;
        trigger.removeAttribute("aria-busy");
      }
    }
  };
})();
