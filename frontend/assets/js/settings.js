const API_URL = AdminConfig.apiBase + "Settings.php";
const settingsForm = document.getElementById("settingsForm");
const deliveryFee = document.getElementById("deliveryFee");
const freeDeliveryThreshold = document.getElementById("freeDeliveryThreshold");
const saveButton = document.getElementById("saveSettingsBtn");
const discardButton = document.getElementById("discardSettingsBtn");
const errorBanner = document.getElementById("settingsError");
const previewSubtotal = document.getElementById("previewSubtotal");
let savedSettings = null;
let settingsBusy = false;

function readValues() {
    return {
        delivery_fee: deliveryFee.value.trim() === "" ? null : Number(deliveryFee.value),
        free_delivery_at: freeDeliveryThreshold.value.trim() === "" ? null : Number(freeDeliveryThreshold.value)
    };
}

function hasChanges() {
    if (!savedSettings) return false;
    const current = readValues();
    return current.delivery_fee !== savedSettings.delivery_fee || current.free_delivery_at !== savedSettings.free_delivery_at;
}

function money(value) {
    return new Intl.NumberFormat("en-JO", {style: "currency", currency: "JOD", minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value);
}

function updateControls() {
    const unavailable = settingsBusy || !savedSettings;
    for (const input of [deliveryFee, freeDeliveryThreshold, previewSubtotal]) input.disabled = unavailable;
    saveButton.disabled = unavailable || !hasChanges();
    discardButton.disabled = unavailable || !hasChanges();
    document.getElementById("retrySettingsBtn").disabled = settingsBusy;
    settingsForm.setAttribute("aria-busy", String(settingsBusy));
    saveButton.innerHTML = settingsBusy ? '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Please wait…' : '<i class="fa-solid fa-check" aria-hidden="true"></i> Save changes';
}

function updateStatus() {
    const state = document.getElementById("settingsState");
    const dirty = hasChanges();
    state.classList.toggle("has-changes", dirty);
    state.innerHTML = dirty ? '<i class="fa-regular fa-pen-to-square" aria-hidden="true"></i> Unsaved changes' : '<i class="fa-regular fa-circle-check" aria-hidden="true"></i> Preferences saved';
    document.getElementById("saveStatus").textContent = dirty ? "You have unsaved changes" : "All changes saved";
    document.getElementById("saveHelp").textContent = dirty ? "Save to apply these delivery rules to your store." : "Your store is using these delivery preferences.";
    updateControls();
}

function validAmount(input, required = false) {
    if (input.validity.badInput) return false;
    if (input.value.trim() === "") return !required;
    return Number.isFinite(Number(input.value)) && Number(input.value) >= 0 && !input.validity.stepMismatch;
}

function updatePreview() {
    const fee = readValues().delivery_fee;
    const threshold = readValues().free_delivery_at;
    if (!savedSettings || !validAmount(deliveryFee, true) || !validAmount(freeDeliveryThreshold) || !validAmount(previewSubtotal, true)) {
        for (const id of ["previewSubtotalValue", "previewDeliveryValue", "previewTotalValue"]) document.getElementById(id).textContent = "—";
        document.getElementById("previewNote").textContent = "Enter valid amounts to see the delivery preview.";
        return;
    }
    const subtotal = Number(previewSubtotal.value);
    const free = fee === 0 || (threshold !== null && subtotal >= threshold);
    const charge = free ? 0 : fee;
    document.getElementById("previewSubtotalValue").textContent = money(subtotal);
    document.getElementById("previewDeliveryValue").textContent = free ? "Free" : money(charge);
    document.getElementById("previewTotalValue").textContent = money(subtotal + charge);
    const note = document.getElementById("previewNote");
    note.classList.toggle("qualifies", free);
    if (free) note.textContent = "This order qualifies for free delivery.";
    else if (threshold !== null) note.textContent = "Add " + money(threshold - subtotal) + " to qualify for free delivery.";
    else note.textContent = "The standard delivery fee applies to this order.";
}

function clearErrors() {
    for (const [input, id] of [[deliveryFee, "deliveryFeeError"], [freeDeliveryThreshold, "thresholdError"]]) {
        input.removeAttribute("aria-invalid");
        document.getElementById(id).hidden = true;
    }
}

async function settingsRequest(method, data = null) {
    const options = {method, credentials: "same-origin", cache: "no-store", headers: {Accept: "application/json"}};
    if (data !== null) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(data);
    }
    const response = await EcoAuth.fetch(API_URL, options);
    let result;
    try { result = await response.json(); }
    catch (error) { throw new Error("The server returned an unexpected response. Please retry."); }
    if (!response.ok || !result || result.seccses === false || result.seccess === false || result.success === false) {
        throw new Error(result && (result.message || result.massage) || "Settings could not be loaded or saved.");
    }
    return result;
}

async function loadSettings() {
    if (settingsBusy) return;
    settingsBusy = true;
    updateControls();
    errorBanner.hidden = true;
    try {
        const data = await settingsRequest("GET");
        if (data.delivery_fee === undefined || data.delivery_fee === null || data.delivery_fee === "" || data.free_delivery_at === undefined || !Number.isFinite(Number(data.delivery_fee)) || Number(data.delivery_fee) < 0 || (data.free_delivery_at !== null && (!Number.isFinite(Number(data.free_delivery_at)) || Number(data.free_delivery_at) < 0))) throw new Error("The server returned incomplete delivery settings.");
        savedSettings = {delivery_fee: Number(data.delivery_fee), free_delivery_at: data.free_delivery_at === null ? null : Number(data.free_delivery_at)};
        deliveryFee.value = savedSettings.delivery_fee.toFixed(2);
        freeDeliveryThreshold.value = savedSettings.free_delivery_at === null ? "" : savedSettings.free_delivery_at.toFixed(2);
        clearErrors();
    } catch (error) {
        document.getElementById("settingsErrorText").textContent = error.message;
        errorBanner.hidden = false;
        document.getElementById("settingsState").textContent = "Connection unavailable";
        document.getElementById("saveStatus").textContent = "Preferences could not load";
        document.getElementById("saveHelp").textContent = "Retry the connection to edit your delivery rules.";
    } finally {
        settingsBusy = false;
        if (savedSettings) updateStatus();
        updateControls();
        updatePreview();
    }
}

settingsForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (settingsBusy || !savedSettings || !hasChanges()) return;
    clearErrors();
    let firstInvalid = null;
    for (const [input, id, required] of [[deliveryFee, "deliveryFeeError", true], [freeDeliveryThreshold, "thresholdError", false]]) {
        if (!validAmount(input, required)) {
            input.setAttribute("aria-invalid", "true");
            const error = document.getElementById(id);
            error.textContent = "Enter an amount of 0 or more, with up to two decimal places.";
            error.hidden = false;
            if (!firstInvalid) firstInvalid = input;
        }
    }
    if (firstInvalid) { firstInvalid.focus(); return; }
    const data = readValues();
    settingsBusy = true;
    updateControls();
    document.getElementById("saveStatus").textContent = "Saving your preferences…";
    try {
        await settingsRequest("PUT", data);
        savedSettings = {...data};
        deliveryFee.value = data.delivery_fee.toFixed(2);
        freeDeliveryThreshold.value = data.free_delivery_at === null ? "" : data.free_delivery_at.toFixed(2);
        Alerts.toast("Delivery preferences saved");
    } catch (error) {
        Alerts.show("Settings were not saved", error.message, "error");
    } finally {
        settingsBusy = false;
        updateStatus();
        updatePreview();
    }
});

for (const input of [deliveryFee, freeDeliveryThreshold]) {
    input.addEventListener("input", function () { clearErrors(); updateStatus(); updatePreview(); });
}
previewSubtotal.addEventListener("input", updatePreview);
discardButton.addEventListener("click", async function () {
    const result = await Alerts.confirm("Discard your changes?", "Your saved delivery preferences will be restored.");
    if (!result.isConfirmed) return;
    deliveryFee.value = savedSettings.delivery_fee.toFixed(2);
    freeDeliveryThreshold.value = savedSettings.free_delivery_at === null ? "" : savedSettings.free_delivery_at.toFixed(2);
    clearErrors();
    updateStatus();
    updatePreview();
});
window.addEventListener("beforeunload", function (event) {
    if (hasChanges()) { event.preventDefault(); event.returnValue = ""; }
});
document.getElementById("retrySettingsBtn").addEventListener("click", loadSettings);
loadSettings();
