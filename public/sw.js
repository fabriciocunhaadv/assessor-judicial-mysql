// Service worker do Assessor Judicial: recebe os avisos da fila (Web Push) e mostra a notificação no aparelho. Não guarda nada em cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { titulo: "Assessor Judicial", corpo: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(String(d.titulo || "Assessor Judicial"), { body: String(d.corpo || ""), tag: String(d.tag || "fila"), icon: "/icon-192.png", badge: "/icon-192.png", data: { url: String(d.url || "/?fila=1") }, renotify: true }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/?fila=1";
  e.waitUntil((async () => {
    const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const a of abas) { if ("focus" in a) { await a.focus(); try { a.postMessage({ acao: "abrir-fila" }); } catch {} return; } }
    await self.clients.openWindow(url);
  })());
});
