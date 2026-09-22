export function urlBase64ToUint8Array(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replaceAll("-", "+").replaceAll("_", "/");
  const bytes = atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

function supportsPushNotifications() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

export async function pushNotificationsEnabled() {
  if (!supportsPushNotifications()) return false;
  // `ready` can remain pending forever when registration or installation
  // fails. The passive account-page probe must always settle so the user can
  // retry; reserve `ready` for explicit enable/disable actions.
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  return Boolean(await registration.pushManager.getSubscription());
}

export async function enablePushNotifications() {
  if (!supportsPushNotifications()) {
    throw new Error(
      "Notificações push não são compatíveis com este navegador.",
    );
  }
  const status = await fetch("/api/pwa/status").then((response) =>
    response.json(),
  );
  if (!status.authenticated || !status.pushPublicKey) {
    throw new Error("As notificações push ainda não estão configuradas.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Permissão para notificações não concedida.");
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(status.pushPublicKey),
    }));
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) throw new Error("Não foi possível ativar as notificações.");
}

export async function disablePushNotifications() {
  if (!supportsPushNotifications()) {
    throw new Error(
      "Notificações push não são compatíveis com este navegador.",
    );
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  // Remove the server record first. If the browser unsubscribe then fails,
  // delivery is already disabled and a retry remains safe and idempotent.
  const response = await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!response.ok) {
    throw new Error("Não foi possível desativar as notificações.");
  }
  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed) {
    throw new Error(
      "As notificações foram desativadas no Moto Track, mas o navegador não removeu a inscrição. Tente novamente.",
    );
  }
}
