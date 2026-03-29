self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : { title: "Commute Alert", body: "New alert" };
  const title = payload.title || "Commute Alert";
  const options = {
    body: payload.body || "Traffic condition matched your rules.",
    icon: "/icon.png"
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
