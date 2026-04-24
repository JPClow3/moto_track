/* AI-NOTE: justified-exception — global app utilities, PWA, accessibility, and HTMX lifecycle */

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
    if (previousFocusedElement && typeof previousFocusedElement.focus === "function") {
      previousFocusedElement.focus();
    }
  }

  window.closeQuickFormModal = closeQuickFormModal;

  function showClientSnackbar(message) {
    const snackbar = document.getElementById("client-snackbar");
    if (!snackbar) return;
    snackbar.textContent = message;
    snackbar.classList.remove("hidden");
    window.clearTimeout(snackbar.dataset.hideTimer);
    const timer = window.setTimeout(() => {
      snackbar.classList.add("hidden");
    }, 5000);
    snackbar.dataset.hideTimer = timer;
  }

  window.showClientSnackbar = showClientSnackbar;

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
    if (!dialog) return;
    const focusableElements = getFocusableElements(dialog);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
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
  });

  document.body.addEventListener("htmx:afterSwap", (event) => {
    renderLucideIcons();
    if (window.Alpine && event.detail && event.detail.target) {
      window.Alpine.initTree(event.detail.target);
    }
    initAutocomplete(event.detail?.target || document.body);
    if (event.detail?.target) {
      initFuelDefaults(event.detail.target);
    }
  });

  document.body.addEventListener("htmx:beforeRequest", (event) => {
    previousFocusedElement = document.activeElement;
    const trigger = event.detail.elt;
    if (trigger) {
      trigger.setAttribute("aria-busy", "true");
    }
  });

  document.body.addEventListener("htmx:afterRequest", (event) => {
    const trigger = event.detail.elt;
    if (trigger) {
      trigger.removeAttribute("aria-busy");
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
