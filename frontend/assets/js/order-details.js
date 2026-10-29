const API_URL = new URL("../../backend/api/cart.php", location.href).href;

 
 

const params = new URLSearchParams(window.location.search);
const orderId = params.get("id");

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
        "approved",
        "pending",
        "processing",
        "cancelled",
        "rejected"
    ];

    element.className = "status";

    const normalized = value.toLowerCase();

    if (allowedStatuses.includes(normalized)) {
        element.classList.add(normalized);
    }
}

function renderStatusControls(status) {
    const current = String(status ?? "").toLowerCase();
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
    saveStatusButton.disabled = locked;

    setStatusMessage(
        locked ? "A cancelled order cannot be changed." : ""
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
        const productWrap = document.createElement("div");
        productWrap.className = "product-cell";

        const imageUrl = orderImageUrl(item.product_image);
        if (imageUrl) {
            const image = document.createElement("img");
            image.className = "product-image";
            image.src = imageUrl;
            image.alt = displayValue(item.product_name);
            image.loading = "lazy";
            image.addEventListener("error", () => image.remove());
            productWrap.appendChild(image);
        }

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
        priceCell.textContent = formatMoney(price);

        const quantityCell = document.createElement("td");
        quantityCell.textContent = String(quantity);

        const subtotalCell = document.createElement("td");
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
                "The API response is missing order details or its items array. Check the response in Postman."
            );
        }

        renderOrder(order);
    } catch (error) {
        console.error("Failed to load order details:", error);

        showError(
            error.message ||
            "Could not load the order. Check that XAMPP and the PHP API are running."
        );
    }
}

async function saveStatus() {
    const newStatus = statusSelect.value;

    saveStatusButton.disabled = true;
    setStatusMessage("Saving...");

    try {
        const response = await EcoAuth.fetch(API_URL, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                action: "order_status",

                order_id: Number(orderId),
                status: newStatus
            })
        });

        const result = await response.json();

        if (!response.ok || result.success === false) {
            throw new Error(
                result.message || `Request failed (${response.status}).`
            );
        }

        renderStatus(newStatus);

        if (newStatus === "cancelled") {
            statusSelect.disabled = true;
            setStatusMessage("Order cancelled.", "success");
            return;  
        }

        setStatusMessage("Status updated.", "success");
    } catch (error) {
        console.error("Failed to update status:", error);
        setStatusMessage(error.message || "Could not update the status.", "error");
    }

    saveStatusButton.disabled = false;
}

 

retryButton.addEventListener("click", loadOrderDetails);
saveStatusButton.addEventListener("click", saveStatus);

loadOrderDetails();