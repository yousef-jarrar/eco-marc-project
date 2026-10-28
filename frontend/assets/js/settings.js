const API_URL = AdminConfig.apiBase + "Settings.php";
const settingsForm = document.getElementById("settingsForm");
const deliveryFee = document.getElementById("deliveryFee");
const freeDeliveryThreshold = document.getElementById("freeDeliveryThreshold");
const saveButton = document.getElementById("saveSettingsBtn");
const errorBanner = document.getElementById("settingsError");

function setSettingsLoading(loading) {
    deliveryFee.disabled = loading;
    freeDeliveryThreshold.disabled = loading;
    saveButton.disabled = loading;
}

async function settingsRequest(method, data = null) {
    const options = {
        method: method,
        credentials: "same-origin",
        headers: { Accept: "application/json" }
    };
    if (data !== null) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(data);
    }

    const response = await fetch(API_URL, options);
    let result;
    try {
        result = await response.json();
    } catch (error) {
        throw new Error("The server returned an unexpected response. Please retry.");
    }
    if (!response.ok || !result || result.seccses === false || result.seccess === false || result.success === false) {
        let message = "Settings could not be loaded or saved.";
        if (result && (result.message || result.massage)) message = result.message || result.massage;
        throw new Error(message);
    }
    return result;
}

async function loadSettings() {
    setSettingsLoading(true);
    errorBanner.hidden = true;

    try {
        const data = await settingsRequest("GET");
        if (data.delivery_fee === undefined || data.free_delivery_at === undefined) {
            throw new Error("The server returned incomplete delivery settings.");
        }
        deliveryFee.value = data.delivery_fee;
        freeDeliveryThreshold.value = data.free_delivery_at;
        setSettingsLoading(false);
    } catch (error) {
        document.getElementById("settingsErrorText").textContent = error.message;
        errorBanner.hidden = false;
        Alerts.toast("Settings could not load", "error");
    }
}

settingsForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (saveButton.disabled) return;

    const data = {
        delivery_fee: Number(deliveryFee.value),
        free_delivery_at: Number(freeDeliveryThreshold.value)
    };
    if (!Number.isFinite(data.delivery_fee) || !Number.isFinite(data.free_delivery_at) || data.delivery_fee < 0 || data.free_delivery_at < 0) {
        Alerts.show("Check the delivery amounts", "Use valid amounts of zero or more.", "warning");
        return;
    }

    setSettingsLoading(true);
    saveButton.textContent = "Saving…";
    try {
        await settingsRequest("PUT", data);
        Alerts.toast("Settings saved");
    } catch (error) {
        Alerts.show("Settings were not saved", error.message, "error");
    } finally {
        setSettingsLoading(false);
        saveButton.textContent = "Save preferences";
    }
});

document.getElementById("retrySettingsBtn").addEventListener("click", loadSettings);
loadSettings();
