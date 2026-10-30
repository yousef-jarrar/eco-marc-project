"use strict";

// API
const API_URL = new URL("../../backend/api/cart.php", location.href).href;

// HTML elements
const loadingMessage = document.getElementById("cart-loading");
const errorMessage = document.getElementById("cart-error");
const emptyMessage = document.getElementById("cart-empty");
const cartItemsContainer = document.getElementById("cart-items");
const checkoutButton = document.getElementById("checkout-button");
const cartCount = document.getElementById("cart-count");

const subtotalElement = document.getElementById("cart-subtotal");
const discountElement = document.getElementById("cart-discount");
const deliveryElement = document.getElementById("cart-delivery");
const totalElement = document.getElementById("cart-total");

// Status message
const statusMessage = document.createElement("div");
statusMessage.className = "cart-message";
statusMessage.setAttribute("role", "status");
cartItemsContainer.before(statusMessage);

let cartItems = [];
let cartTotals = null;
const busyItems = new Set();
let checkoutInProgress = false;

// Format prices in JOD
function formatMoney(value) {
    const amount = Number(value ?? 0);

    if (!Number.isFinite(amount)) {
        return "JOD 0.000";
    }

    return new Intl.NumberFormat("en-JO", {
        style: "currency",
        currency: "JOD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 3
    }).format(amount);
}

// Status messages
function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("cart-error", isError);
    statusMessage.hidden = !message;
}

function showLoading() {
    loadingMessage.hidden = false;
    errorMessage.hidden = true;
    emptyMessage.hidden = true;
    cartItemsContainer.hidden = true;
    showStatus("");
}

function showError(message) {
    loadingMessage.hidden = true;
    emptyMessage.hidden = true;
    cartItemsContainer.hidden = true;
    errorMessage.hidden = false;
    errorMessage.textContent = message;
}

// Resolve relative and absolute image paths
function getImageUrl(value) {
    if (!value || typeof value !== "string") {
        return "";
    }

    try {
        const url = new URL(value, new URL("../../", location.href));

        return ["http:", "https:"].includes(url.protocol)
            ? url.href
            : "";
    } catch {
        return "";
    }
}

function setMessage(message, isError = false) {
    cartMessage.textContent = message;
    cartMessage.classList.toggle("error-text", isError);
}

function showLoading() {
    loadingMessage.classList.remove("hidden");
    errorMessage.classList.add("hidden");
    emptyMessage.classList.add("hidden");
    cartContent.classList.add("hidden");
}

function showError(message) {
    loadingMessage.classList.add("hidden");
    emptyMessage.classList.add("hidden");
    cartContent.classList.add("hidden");
    errorMessage.classList.remove("hidden");
    errorText.textContent = message;
}

async function apiRequest(action, data = {}, method = "POST") {
    if (action === "list") {
        const [items, totals] = await Promise.all([apiRequest("items", {}, "GET"), apiRequest("total", {}, "GET")]);
        return Object.assign({}, totals, {items:Array.isArray(items)?items:[]});
    }
    if (action === "update_quantity") { action="quantity"; method="PATCH"; data.cart_item_id=Number(data.cart_item_id); }
    if (action === "remove") method="DELETE";
    const url=new URL(API_URL);
    const options={method,headers:{Accept:"application/json"}};
    if(method==="GET")url.searchParams.set("action",action);
    else { options.headers["Content-Type"]="application/json"; options.body=JSON.stringify({action,...data}); }
    const response=await EcoAuth.fetch(url,options);

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || result.success === false) {
        throw new Error(
            result.message || `Request failed (${response.status}).`
        );
    }

    return result.data ?? result.cart ?? result;
}

// Send requests using the method expected by PHP
async function apiRequest(action, data = {}, method = "POST") {
    const options = {
        method,
        headers: {
            Accept: "application/json"
        },
        credentials: "same-origin"
    };

    let url = API_URL;

    if (method === "GET") {
        const params = new URLSearchParams({
            action,
            ...data
        });

        url = `${API_URL}?${params.toString()}`;
    } else {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify({
            action,
            ...data
        });
    }

    const response =
        typeof EcoAuth !== "undefined" &&
        typeof EcoAuth.fetch === "function"
            ? await EcoAuth.fetch(url, options)
            : await fetch(url, options);

    return handleApiResponse(response);
}

// Normalize the cart response
function normalizeItems(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.cart_items)) return data.cart_items;
    if (Array.isArray(data?.cart?.items)) return data.cart.items;

    return [];
}

function itemId(item) {
    return String(
        item.cart_item_id ??
        item.id ??
        item.product_id ??
        ""
    );
}

function itemName(item) {
    return String(item.product_name ?? item.name ?? "Product");
}

function itemQuantity(item) {
    const quantity = Number(item.quantity ?? 1);

    return Number.isFinite(quantity)
        ? Math.max(1, quantity)
        : 1;
}

function itemPrice(item) {
    const price = Number(item.price ?? item.unit_price ?? 0);

    return Number.isFinite(price)
        ? Math.max(0, price)
        : 0;
}

function itemVariant(item) {
    const parts = [];

    if (item.size) parts.push(`Size: ${item.size}`);
    if (item.color) parts.push(`Color: ${item.color}`);

    return parts.join(" · ");
}

function calculateTotals() {
    const subtotal = cartItems.reduce(
        (sum, item) =>
            sum + itemPrice(item) * itemQuantity(item),
        0
    );

    const discountValue = Number(
        cartTotals?.discount_amount ??
        cartTotals?.discount ??
        0
    );

    const discount = Number.isFinite(discountValue)
        ? Math.max(0, discountValue)
        : 0;

    const serverTotal = Number(cartTotals?.total);

    return {
        quantity: cartItems.reduce(
            (sum, item) => sum + itemQuantity(item),
            0
        ),
        subtotal,
        discount,
        total:
            cartTotals?.total != null &&
            Number.isFinite(serverTotal)
                ? Math.max(0, serverTotal)
                : Math.max(0, subtotal - discount)
    };
}

// Create a product image
function createProductImage(item) {
    const image = document.createElement("img");

    image.className = "cart-item-image";
    image.alt = itemName(item);
    image.loading = "lazy";

    const imagePath =
        item.product_image ??
        item.product_image_url ??
        item.image_url ??
        item.image_path ??
        item.image ??
        "";

    const imageUrl = getImageUrl(imagePath);

    if (imageUrl) {
        image.src = imageUrl;

        image.addEventListener(
            "error",
            () => {
                console.error(
                    "Product image failed to load:",
                    imageUrl
                );

                image.hidden = true;
            },
            { once: true }
        );
    } else {
        image.hidden = true;
    }

    return image;
}

// Render cart items
function renderCart() {
    cartItemsContainer.replaceChildren();

    if (!cartItems.length) {
        checkoutButton.disabled=true;
        document.getElementById("item-count").textContent="0 products";
        document.getElementById("cart-count").hidden=true;
        ["summary-subtotal","summary-discount","summary-total","cart-delivery"].forEach(id=>document.getElementById(id).textContent=formatMoney(0));
        loadingMessage.classList.add("hidden");
        errorMessage.classList.add("hidden");
        cartContent.classList.add("hidden");
        emptyMessage.classList.remove("hidden");
        return;
    }

    subtotalElement.textContent = formatMoney(
        cartTotals?.subtotal ?? totals.subtotal
    );

    discountElement.textContent =
        `−${formatMoney(totals.discount)}`;

    deliveryElement.textContent = "Complimentary";
    totalElement.textContent = formatMoney(totals.total);

    loadingMessage.hidden = true;
    errorMessage.hidden = true;
    emptyMessage.hidden = cartItems.length !== 0;
    cartItemsContainer.hidden = cartItems.length === 0;

    if (cartItems.length === 0) {
        checkoutButton.disabled = true;
        return;
    }

    cartItems.forEach((item) => {
        const id = itemId(item);
        const quantity = itemQuantity(item);
        const price = itemPrice(item);
        const busy = busyItems.has(id);

        const row = document.createElement("article");
        row.className = "cart-item";

        // Product image
        const image = createProductImage(item);

        // Product information
        const info = document.createElement("div");
        info.className = "cart-item-info";

        const name = document.createElement("h3");
        name.className = "cart-item-name";
        name.textContent = itemName(item);

        const details = document.createElement("p");
        details.className = "cart-item-details";

        const variant = itemVariant(item);

        details.textContent = variant
            ? `${variant}\n${formatMoney(price)} each`
            : `${formatMoney(price)} each`;

        // Quantity controls
        const controls = document.createElement("div");
        controls.className = "quantity-control";

        const minus = document.createElement("button");
        minus.type = "button";
        minus.textContent = "−";
        minus.setAttribute("aria-label", "Decrease quantity");
        minus.disabled = busy || quantity <= 1;

        minus.addEventListener("click", () => {
            changeQuantity(id, quantity - 1);
        });

        const quantityText = document.createElement("span");
        quantityText.className = "quantity-value";
        quantityText.textContent = String(quantity);

        const plus = document.createElement("button");
        plus.type = "button";
        plus.textContent = "+";
        plus.setAttribute("aria-label", "Increase quantity");
        plus.disabled = busy;

        plus.addEventListener("click", () => {
            changeQuantity(id, quantity + 1);
        });

        controls.append(minus, quantityText, plus);

        // Remove button
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-button";
        remove.textContent = "Remove";
        remove.disabled = busy;

        remove.addEventListener("click", () => {
            removeItem(id);
        });

        info.append(name, details, controls, remove);

        // Line total
        const priceElement = document.createElement("div");
        priceElement.className = "cart-item-price";
        priceElement.textContent = formatMoney(price * quantity);

    document.getElementById("cart-delivery").textContent=formatMoney(cartTotals?.delivery_fee??0);
    const badge=document.getElementById("cart-count");badge.textContent=String(totals.quantity);badge.hidden=totals.quantity===0;
    checkoutButton.disabled = checkoutInProgress || busyItems.size > 0;

    checkoutButton.disabled =
        checkoutInProgress || busyItems.size > 0;
}

// GET cart items
async function loadCart() {
    showLoading();

    try {
        const data = await apiRequest("items", {}, "GET");

        cartItems = normalizeItems(data);
        cartTotals = Array.isArray(data) ? null : data;

        renderCart();
    } catch (error) {
        console.error("Unable to load cart:", error);
        showError(error.message || "Unable to load your cart.");
    }
}

// PATCH quantity
async function changeQuantity(id, quantity) {
    if (busyItems.has(id) || quantity < 1) return;

    const item = cartItems.find(
        entry => itemId(entry) === id
    );

    if (!item) return;

    busyItems.add(id);
    renderCart();
    showStatus("Updating quantity...");

    try {
        await apiRequest("quantity", {
            cart_item_id: id,
            quantity
        }, "PATCH");

        const refreshed = await apiRequest("items", {}, "GET");

        cartItems = normalizeItems(refreshed);
        cartTotals = Array.isArray(refreshed) ? null : refreshed;

        showStatus("Cart updated.");
    } catch (error) {
        console.error("Unable to update quantity:", error);
        showStatus(error.message, true);
    } finally {
        busyItems.delete(id);
        renderCart();
    }
}

// DELETE item
async function removeItem(id) {
    if (busyItems.has(id)) return;

    const item = cartItems.find(
        entry => itemId(entry) === id
    );

    if (!item) return;

    const confirmed = typeof Swal !== "undefined"
        ? (await Swal.fire({
            title: "Remove this item?",
            text: `Remove ${itemName(item)} from your cart?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Remove",
            cancelButtonText: "Keep item",
            confirmButtonColor: "#B91C1C"
        })).isConfirmed
        : window.confirm(
            `Remove ${itemName(item)} from your cart?`
        );

    if (!confirmed) return;

    busyItems.add(id);
    renderCart();
    showStatus("Removing item...");

    try {
        if (item.product_id == null) {
            throw new Error(
                "The API response does not contain product_id."
            );
        }

        await apiRequest("remove", {
            product_id: item.product_id
        }, "DELETE");

        const refreshed = await apiRequest("items", {}, "GET");

        cartItems = normalizeItems(refreshed);
        cartTotals = Array.isArray(refreshed) ? null : refreshed;

        showStatus("Item removed.");
    } catch (error) {
        console.error("Unable to remove cart item:", error);
        showStatus(error.message, true);
    } finally {
        busyItems.delete(id);
        renderCart();
    }
}

// Checkout
function proceedToCheckout() {
    if (
        checkoutInProgress ||
        cartItems.length === 0 ||
        busyItems.size > 0
    ) {
        return;
    }

    // This route is a placeholder until the project's checkout page is confirmed.
    await Alerts.show("Checkout is not connected yet", "Your cart is saved. You can keep shopping or adjust your selection.", "info");
}

checkoutButton.addEventListener("click", proceedToCheckout);

// Start
loadCart();
