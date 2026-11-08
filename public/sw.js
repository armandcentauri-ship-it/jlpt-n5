/* Service worker de l'app 日本語 N5 : reçoit les push du rappel quotidien
   et affiche la notification système. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "C'est l'heure de réviser !" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "日本語 N5", {
      body: data.body || "C'est l'heure de réviser ton japonais !",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "jlpt-rappel", // une seule notification visible, remplacée si nouvelle
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          return;
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
