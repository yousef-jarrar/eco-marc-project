 
const EcoAuth = (function () {
  const scriptUrl = document.currentScript ? document.currentScript.src : new URL("../assets/js/auth.js", location.href).href;
  const projectRoot = new URL("../../../", scriptUrl);
  const api = new URL("backend/api/auth.php", projectRoot).href;
  const login = new URL("frontend/account/login.html", projectRoot).href;
  const account = new URL("frontend/account/index.html", projectRoot).href;
  const adminFolder = new URL("frontend/admin/", projectRoot).pathname;
  const admin = new URL("frontend/admin/ai-assistant.html", projectRoot).href;
  let state = null;
  let pageUserId = null;
  const isAdminPage = location.pathname.startsWith(adminFolder);

  async function readAuthResponse(response) {
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); }
    catch {
      if (response.status === 404) throw new Error("The sign-in endpoint could not be found. Check your project URL.");
      throw new Error("The sign-in server returned an invalid response. Check the PHP error log and local environment setup.");
    }
    if (!result || typeof result !== "object" || Array.isArray(result) || typeof result.success !== "boolean") {
      throw new Error("The sign-in server returned an unexpected response.");
    }
    return result;
  }

  async function loadSession() {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 15000);
    let response;
    try {
      response = await fetch(api, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
    } finally { clearTimeout(timer); }
    const result = await readAuthResponse(response);
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
    const result = await readAuthResponse(response);
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
      try {
        const url = new URL(next, location.origin);
        const page = url.pathname.slice(adminFolder.length);
        if (url.origin === location.origin && url.pathname.startsWith(adminFolder) && allowed.includes(page)) return url.pathname + url.search;
      } catch { }
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
