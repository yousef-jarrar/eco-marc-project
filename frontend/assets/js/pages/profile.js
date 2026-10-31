const profileForm = document.getElementById("personal-form");
const addressForm = document.getElementById("address-form");
const passwordForm = document.getElementById("password-form");
const profileApi = new URL("../../backend/api/profile.php", location.href).href;

function setProfileStatus(id, message, isError = false) {
  const status = document.getElementById(id);
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function setFormBusy(form, busy) {
  form.querySelectorAll("button[type='submit']").forEach(function (button) {
    button.disabled = busy;
  });
}

function showProfile(user) {
  document.getElementById("profile-greeting").textContent = "Hello, " + (user.first_name || "there") + ".";
  document.getElementById("first-name").value = user.first_name || "";
  document.getElementById("last-name").value = user.last_name || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("phone").value = user.phone || "";
  document.getElementById("address").value = user.address || "";
}

async function requestProfile(action, payload = {}) {
  const options = action
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({}, payload, { action: action }))
      }
    : {};
  const response = await EcoAuth.fetch(profileApi, options);
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The profile service returned an invalid response.");
  }
  if (!response.ok || !result.success) {
    throw new Error(result.message || "Your profile request could not be completed.");
  }
  return result;
}

async function saveProfile(form, action, payload, statusId, successMessage) {
  setFormBusy(form, true);
  setProfileStatus(statusId, "");
  try {
    const result = await requestProfile(action, payload);
    if (result.data) showProfile(result.data);
    setProfileStatus(statusId, successMessage);
    Alerts.toast(successMessage);
    if (form === passwordForm) form.reset();
  } catch (error) {
    setProfileStatus(statusId, error.message || "Your changes could not be saved.", true);
    Alerts.show("Changes were not saved", error.message || "Please try again.", "error");
  } finally {
    setFormBusy(form, false);
  }
}

EcoAuth.ready.then(function (session) {
  if (!session.user) {
    location.replace(EcoAuth.loginUrl + "?next=" + encodeURIComponent(location.pathname + location.search));
    return;
  }
  requestProfile().then(function (result) {
    showProfile(result.data);
  }).catch(function (error) {
    setProfileStatus("personal-status", error.message || "Your profile could not be loaded.", true);
  }).finally(function () {
    document.documentElement.classList.remove("auth-checking");
  });
}).catch(function () {
  document.documentElement.classList.remove("auth-checking");
});


profileForm.addEventListener("submit", function (event) {
  event.preventDefault();
  saveProfile(profileForm, "update", {
    first_name: document.getElementById("first-name").value.trim(),
    last_name: document.getElementById("last-name").value.trim(),
    phone: document.getElementById("phone").value.trim()
  }, "personal-status", "Your information has been saved.");
});

addressForm.addEventListener("submit", function (event) {
  event.preventDefault();
  saveProfile(addressForm, "update", {
    address: document.getElementById("address").value.trim()
  }, "address-status", "Your address has been saved.");
});

passwordForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  if (newPassword !== confirmPassword) {
    setProfileStatus("password-status", "The new passwords do not match.", true);
    return;
  }
  setProfileStatus("password-status", "");
  saveProfile(passwordForm, "change_password", {
    current_password: document.getElementById("current-password").value,
    new_password: newPassword
  }, "password-status", "Your password has been updated.");
});