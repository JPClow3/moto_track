export function urlBase64ToUint8Array(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replaceAll("-", "+").replaceAll("_", "/");
  const bytes = atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

export async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
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
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(status.pushPublicKey),
  });
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) throw new Error("Não foi possível ativar as notificações.");
}
