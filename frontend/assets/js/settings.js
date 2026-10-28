const API_URL = "http://localhost/eco-marc-project/backend/api/settings.php";

const settingsForm = document.getElementById("settingsForm");
const deliveryFee = document.getElementById("deliveryFee");
const freeDeliveryThreshold = document.getElementById("freeDeliveryThreshold");

async function loadSettings() {
    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Failed to load settings");
        }

        const data = await response.json();

        deliveryFee.value = data.delivery_fee;
        freeDeliveryThreshold.value = data.free_delivery_at;

    } catch (error) {
        console.error(error);
        alert("Failed to load settings");
    }
}

settingsForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const data = {
        delivery_fee: deliveryFee.value,
        free_delivery_at: freeDeliveryThreshold.value
    };

    try {
        const response = await fetch(API_URL, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error("Failed to update settings");
        }

        const result = await response.json();

        if (result.seccses) {
            alert("Settings updated successfully");
        } else {
            alert(result.massage || "Failed to update settings");
        }

    } catch (error) {
        console.error(error);
        alert("Something went wrong");
    }
});

loadSettings();