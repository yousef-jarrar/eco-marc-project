const loginForm = document.getElementById("login-form");
const registering = document.body.dataset.authMode === "register";

async function setupGoogle(session, linking) {
  const status = document.getElementById("google-status");
  if (!session.google_client_id) {
    status.textContent = "Google sign-in is currently unavailable.";
    return;
  }
  status.textContent = "Loading Google sign-in…";
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client?hl=en";
  script.async = true;
  script.onerror = function () { status.textContent = "Google could not load. Please try again later."; };
  script.onload = function () {
    status.textContent = "";
    google.accounts.id.initialize({
      client_id: session.google_client_id,
      nonce: session.google_nonce,
      auto_select: false,
      callback: async function (response) {
        try {
          const result = await EcoAuth.request(linking ? "link_google" : "google", { credential: response.credential });
          if (linking) {
            await Alerts.show("Google linked", "You can now sign in with your Google account.", "success");
            location.reload();
          } else location.replace(EcoAuth.destination(result.user));
        } catch (error) {
          await Alerts.show("Google sign-in failed", error.message, "error");
          // nonce جديد للمحاولة التالية بدون إعادة إرسال الرمز السابق.
          location.reload();
        }
      }
    });
    const width = Math.min(360, document.getElementById("google-button").clientWidth || 280);
    google.accounts.id.renderButton(document.getElementById("google-button"), { theme: "outline", size: "large", locale: "en", width: width, text: linking ? "continue_with" : "signin_with" });
  };
  document.head.appendChild(script);
}

EcoAuth.ready.then(function (session) {
  if (loginForm) {
    if (session.user) { location.replace(EcoAuth.destination(session.user)); return; }
    document.getElementById("session-status").textContent = "";
    document.getElementById("submit-login").disabled = false;
    setupGoogle(session, false);
  } else {
    if (!session.user) { location.replace(EcoAuth.loginUrl); return; }
    document.getElementById("account-name").textContent = "Hello, " + session.user.first_name;
    document.getElementById("account-email").textContent = session.user.email;
    document.getElementById("account-role").textContent = session.user.role === "admin" ? "Administrator" : "Customer";
    document.getElementById("admin-link").hidden = session.user.role !== "admin";
    document.getElementById("account-logout").addEventListener("click", EcoAuth.logout);
    setupGoogle(session, true);
  }
}).catch(function () {
  if (loginForm) {
    document.getElementById("session-status").textContent = "Could not connect. Reload to try again.";
    document.getElementById("retry-session").hidden = false;
  }
});

if (loginForm) {
  document.getElementById("retry-session").addEventListener("click", function () { location.reload(); });
  // نحافظ على وجهة الرجوع عند التنقل بين الدخول والتسجيل.
  const next = new URLSearchParams(location.search).get("next");
  if (next) document.getElementById("switch-mode").href += "?next=" + encodeURIComponent(next);
  document.getElementById("toggle-password").addEventListener("click", function () {
    const field = document.getElementById("password");
    const show = field.type === "password";
    field.type = show ? "text" : "password";
    this.textContent = show ? "Hide" : "Show";
    this.setAttribute("aria-label", show ? "Hide password" : "Show password");
    this.setAttribute("aria-pressed", String(show));
  });
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (registering && document.getElementById("password").value !== document.getElementById("confirm-password").value) {
      await Alerts.show("Check your password", "The passwords do not match.", "warning");
      return;
    }
    const button = document.getElementById("submit-login");
    button.disabled = true;
    button.textContent = "Please wait…";
    try {
      const result = await EcoAuth.request(registering ? "register" : "login", {
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
        first_name: document.getElementById("first-name").value.trim(),
        last_name: document.getElementById("last-name").value.trim()
      });
      document.getElementById("password").value = "";
      location.replace(EcoAuth.destination(result.user));
    } catch (error) {
      await Alerts.show(registering ? "Could not create account" : "Could not sign in", error.message, "error");
      button.disabled = false;
      button.textContent = registering ? "Create account" : "Sign in";
    }
  });
}
