const API_URL = new URL("../../backend/api/cart.php", location.href).href;

 
 

const params = new URLSearchParams(window.location.search);
const orderId = params.get("id");
let currentStatus = "";
let saving = false;

const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");
const orderContent = document.getElementById("order-content");
const retryButton = document.getElementById("retry-button");

const statusSelect = document.getElementById("status-select");
const saveStatusButton = document.getElementById("save-status");
const statusMessage = document.getElementById("status-message");

 

function showError(message) {
    loadingMessage.classList.add("hidden");
    orderContent.classList.add("hidden");
    errorMessage.classList.remove("hidden");
    errorText.textContent = message;
}

function formatMoney(value) {
    const amount = Number(value ?? 0);

    if (!Number.isFinite(amount)) {
        return "—";
    }

    return new Intl.NumberFormat("en-JO", {
        style: "currency",
        currency: "JOD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 3
    }).format(amount);
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
}

function orderImageUrl(value) {
    if (!value) return "";
    try {
        const url = new URL(value, new URL("../../", location.href));
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
}
function displayValue(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    return String(value);
}

function setText(id, value) {
    document.getElementById(id).textContent = displayValue(value);
}

function setMoney(id, value) {
    document.getElementById(id).textContent = formatMoney(value);
}

function setStatusMessage(text, type = "") {
    statusMessage.className = type ? `status-message ${type}` : "status-message";
    statusMessage.textContent = text;
}

 

function renderStatus(status) {
    const element = document.getElementById("order-status");
    const value = displayValue(status);

    element.textContent = value;

     
    const allowedStatuses = [
        "completed",
        "delivered",
        "confirmed",
        "shipped",
        "pending",
        "processing",
        "cancelled",
        "rejected"
    ];

    element.className = "od-status";

    const normalized = value.toLowerCase();

    if (allowedStatuses.includes(normalized)) {
        element.classList.add(normalized);
    }
}

function renderStatusControls(status) {
    const current = String(status ?? "").toLowerCase();
    currentStatus = current;
    const locked = current === "cancelled";

     
    const hasOption = Array.from(statusSelect.options).some(
        (option) => option.value === current
    );

    if (current && !hasOption) {
        const option = document.createElement("option");
        option.value = current;
        option.textContent = current.charAt(0).toUpperCase() + current.slice(1);
        statusSelect.appendChild(option);
    }

    statusSelect.value = current;
    statusSelect.disabled = locked;
    saveStatusButton.disabled = true;

    setStatusMessage(
        locked ? "This order is cancelled and cannot be changed." : "No unsaved changes."
    );
}

function renderItems(items) {
    const tbody = document.getElementById("items-table");
    tbody.replaceChildren();

    if (!Array.isArray(items) || items.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent = "No products were found for this order.";
        row.appendChild(cell);
        tbody.appendChild(row);

        setText("summary-items", "0");
        return;
    }

    let totalQuantity = 0;

    items.forEach((item) => {
        const row = document.createElement("tr");

         
        const productCell = document.createElement("td");
        productCell.dataset.label = "Product";
        const productWrap = document.createElement("div");
        productWrap.className = "product-cell";

        const placeholder = document.createElement("span");
        placeholder.className = "od-image-placeholder";
        placeholder.innerHTML = '<i class="fa-regular fa-image" aria-hidden="true"></i>';
        placeholder.setAttribute("aria-label", "Product image unavailable");
        const imageUrl = orderImageUrl(item.product_image);
        if (imageUrl) {
            const image = document.createElement("img");
            image.className = "product-image";
            image.src = imageUrl;
            image.alt = displayValue(item.product_name);
            image.loading = "lazy";
            image.addEventListener("error", () => image.replaceWith(placeholder), {once: true});
            productWrap.appendChild(image);
        } else { productWrap.appendChild(placeholder); }

        const productText = document.createElement("div");

        const productName = document.createElement("div");
        productName.className = "product-name";
        productName.textContent = displayValue(item.product_name);

        const productMeta = document.createElement("div");
        productMeta.className = "product-meta";
        productMeta.textContent =
            item.product_id !== null && item.product_id !== undefined
                ? `Product ID: ${item.product_id}`
                : "";

        productText.append(productName, productMeta);
        productWrap.appendChild(productText);
        productCell.appendChild(productWrap);

         
        const variantCell = document.createElement("td");
        const variantParts = [];

        if (item.size) {
            variantParts.push(`Size: ${item.size}`);
        }

        if (item.color) {
            variantParts.push(`Color: ${item.color}`);
        }

        variantCell.textContent = variantParts.length
            ? variantParts.join(" · ")
            : "—";

         
        const price = Number(item.price ?? 0);
        const quantity = Number(item.quantity ?? 0);

        const priceCell = document.createElement("td");
        priceCell.dataset.label = "Unit price";
        priceCell.textContent = formatMoney(price);

        const quantityCell = document.createElement("td");
        quantityCell.dataset.label = "Quantity";
        quantityCell.textContent = String(quantity);

        const subtotalCell = document.createElement("td");
        subtotalCell.dataset.label = "Total";
        subtotalCell.textContent = formatMoney(price * quantity);

        row.append(
            productCell,
            variantCell,
            priceCell,
            quantityCell,
            subtotalCell
        );

        tbody.appendChild(row);

        if (Number.isFinite(quantity)) {
            totalQuantity += quantity;
        }
    });

    setText("summary-items", totalQuantity);
}

function renderOrder(order) {
    setText("order-number", `#${order.order_id}`);
    document.title = `Order #${order.order_id} | LUMIÈRE`;
    setText("summary-date", formatDate(order.placed_at));
    setMoney("summary-total", order.total);

    setText("customer-name", order.customer_name);
    setText("customer-email", order.customer_email);
    setText("customer-id", order.user_id);
    setText("shipping-address", order.shipping_address);

    renderStatus(order.status);
    renderStatusControls(order.status);
    renderItems(order.items);

    setMoney("subtotal", order.subtotal);
    setMoney("discount", order.discount_amount);
    setMoney("delivery-fee", order.delivery_fee);
    setMoney("final-total", order.total);

    loadingMessage.classList.add("hidden");
    errorMessage.classList.add("hidden");
    orderContent.classList.remove("hidden");
}

 

async function loadOrderDetails() {
    if (!orderId || !/^\d+$/.test(orderId) || Number(orderId) < 1) {
        showError("Invalid order ID. Open this page from the Orders table.");
        return;
    }

    loadingMessage.classList.remove("hidden");
    errorMessage.classList.add("hidden");
    orderContent.classList.add("hidden");

    try {
        const response = await EcoAuth.fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                action: "details",

                order_id: Number(orderId)
            })
        });

        const result = await response.json();

        if (!response.ok || result.success === false) {
            throw new Error(
                result.message || `Request failed (${response.status}).`
            );
        }

         
        const order = result.data ?? result.order ?? result;

        if (
            !order ||
            order.order_id === undefined ||
            !Array.isArray(order.items)
        ) {
            throw new Error(
                "The order details could not be loaded. Please try again."
            );
        }

        renderOrder(order);
    } catch (error) {
        console.error("Failed to load order details:", error);

        showError(
            error.message ||
            "Could not load this order. Try again or return to the orders list."
        );
    }
}

async function saveStatus() {
    const newStatus = statusSelect.value;
    if (saving || newStatus === currentStatus || currentStatus === "cancelled") return;
    saving = true;
    saveStatusButton.disabled = true;
    statusSelect.disabled = true;
    if (newStatus === "cancelled") {
        const result = await Alerts.confirm("Cancel this order?", "This will cancel the order and return its items to stock. A cancelled order cannot be changed.");
        if (!result.isConfirmed) {
            saving = false;
            statusSelect.disabled = false;
            statusSelect.value = currentStatus;
            setStatusMessage("No unsaved changes.");
            return;
        }
    }
    saveStatusButton.setAttribute("aria-busy", "true");
    saveStatusButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Saving';
    setStatusMessage("Saving your change…");
    try {
        const response = await EcoAuth.fetch(API_URL, {
            method: "PATCH",
            headers: {"Content-Type": "application/json", "Accept": "application/json"},
            body: JSON.stringify({action: "order_status", order_id: Number(orderId), status: newStatus})
        });
        const result = await response.json();
        if (!response.ok || result.success === false) throw new Error(result.message || "Could not update the order status.");
        renderStatus(newStatus);
        renderStatusControls(newStatus);
        setStatusMessage(newStatus === "cancelled" ? "Order cancelled. Its status can no longer be changed." : "Status updated.", "success");
        Alerts.toast(newStatus === "cancelled" ? "Order cancelled" : "Order status updated");
    } catch (error) {
        setStatusMessage(error.message || "Could not update the status. Try again.", "error");
        Alerts.show("Status was not saved", error.message || "Please try again.", "error");
    } finally {
        saving = false;
        statusSelect.disabled = currentStatus === "cancelled";
        saveStatusButton.disabled = currentStatus === "cancelled" || statusSelect.value === currentStatus;
        saveStatusButton.removeAttribute("aria-busy");
        saveStatusButton.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Save status';
    }
}

statusSelect.addEventListener("change", () => {
    const changed = statusSelect.value !== currentStatus;
    saveStatusButton.disabled = !changed || saving || currentStatus === "cancelled";
    setStatusMessage(changed ? "You have an unsaved status change." : "No unsaved changes.");
});

retryButton.addEventListener("click", loadOrderDetails);
saveStatusButton.addEventListener("click", saveStatus);

loadOrderDetails();