 
const EcoAuth = (function () {
  const api = "/xampp/php-project/backend/api/auth.php";
  const login = "/xampp/php-project/frontend/account/login.html";
  const account = "/xampp/php-project/frontend/account/index.html";
  const admin = "/xampp/php-project/frontend/admin/ai-assistant.html";
  let state = null;
  let pageUserId = null;
  const isAdminPage = location.pathname.includes("/frontend/admin/");

  async function loadSession() {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 15000);
    let response;
    try {
      response = await fetch(api, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
    } finally { clearTimeout(timer); }
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Could not check your session.");
    state = result;
    return state;
  }

  const ready = loadSession().then(function (session) {
    pageUserId = session.user ? String(session.user.id) : null;
    if (isAdminPage && !session.user) {
      location.replace(login + "?next=" + encodeURIComponent(location.pathname + location.search));
      throw new Error("Please sign in.");
    }
    if (isAdminPage && session.user.role !== "admin") {
      location.replace(account);
      throw new Error("Admin access required.");
    }
    document.documentElement.classList.remove("auth-checking");
    return session;
  });

  async function refreshForWrite(requireLogin) {
    await ready;
     
    const session = await loadSession();
    if (requireLogin && !session.user) {
      location.replace(login + "?next=" + encodeURIComponent(location.pathname + location.search));
      throw new Error("Your session ended. Please sign in again.");
    }
    if (requireLogin && String(session.user.id) !== pageUserId) {
      throw new Error("Your signed-in account changed in another tab. Reload this page before saving.");
    }
    if (isAdminPage && session.user && session.user.role !== "admin") {
      location.replace(account);
      throw new Error("Admin access required.");
    }
    return session;
  }

   
  ready.catch(function (error) {
    if (!state) {
      function showError() {
        document.documentElement.classList.remove("auth-checking");
        if (typeof Alerts !== "undefined") Alerts.show("Session unavailable", error.message, "error");
      }
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showError);
      else showError();
    }
  });

  async function request(action, data = {}) {
    await refreshForWrite(action === "link_google" || action === "logout");
    const response = await fetch(api, {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": state.csrf_token },
      body: JSON.stringify(Object.assign({}, data, { action: action }))
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      if (result.code === "csrf_invalid") await loadSession();
      throw new Error(result.message || "Authentication failed.");
    }
    state.user = result.user;
    state.csrf_token = result.csrf_token;
    pageUserId = result.user ? String(result.user.id) : null;
    return result;
  }

  async function apiFetch(url, options = {}) {
    await ready;
    const method = (options.method || "GET").toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) await refreshForWrite(true);
    const headers = new Headers(options.headers || {});
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("X-CSRF-Token", state.csrf_token);
    const response = await fetch(url, Object.assign({}, options, { headers: headers, credentials: "same-origin" }));
    if (response.status === 401 && isAdminPage) location.replace(login + "?next=" + encodeURIComponent(location.pathname + location.search));
     
    if (response.status === 403) {
      try {
        const result = await response.clone().json();
        if (result.code === "csrf_invalid") await loadSession();
      } catch (error) { }
    }
    return response;
  }

  function destination(user) {
    const next = new URLSearchParams(location.search).get("next");
    const allowed = ["ai-assistant.html", "categories.html", "Customer.html", "Customer-details.html", "Products.html", "ProductDetails.html", "reviews.html", "settings.html", "overveiw.html", "orders.html", "order-details.html"];
    if (user.role === "admin" && next) {
      const url = new URL(next, location.origin);
      if (url.origin === location.origin && url.pathname.startsWith("/xampp/php-project/frontend/admin/") && allowed.includes(url.pathname.split("/").pop())) return url.pathname + url.search;
    }
    return user.role === "admin" ? admin : account;
  }

  async function logout() {
    const answer = await Alerts.confirm("Log out?", "You can sign in again at any time.");
    if (!answer.isConfirmed) return;
    try {
      await request("logout");
      location.replace(login);
    } catch (error) { Alerts.show("Could not log out", error.message, "error"); }
  }

  return { ready: ready, fetch: apiFetch, request: request, refresh: loadSession, token: function () { return state ? state.csrf_token : ""; }, destination: destination, logout: logout, accountUrl: account, loginUrl: login };
})();
