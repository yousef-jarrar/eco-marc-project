 
"use strict";

const API_URL = new URL("../../backend/api/cart.php", location.href).href;

const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");
const emptyMessage = document.getElementById("empty-message");
const cartContent = document.getElementById("cart-content");
const cartItemsContainer = document.getElementById("cart-items");
const retryButton = document.getElementById("retry-button");
const checkoutButton = document.getElementById("checkout-button");
const cartMessage = document.getElementById("cart-message");

let cartItems = [];
let cartTotals = null;
let busyItems = new Set();
let checkoutInProgress = false;

function formatMoney(value) {
    const amount = Number(value ?? 0);

    if (!Number.isFinite(amount)) return "—";

    return new Intl.NumberFormat("en-JO", {
        style: "currency",
        currency: "JOD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 3
    }).format(amount);
}

function displayValue(value) {
    return value === null || value === undefined || value === ""
        ? "—"
        : String(value);
}

function safeImageUrl(value) {
    if (!value) return "";

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
    const response = await EcoAuth.fetch(API_URL, {
        method,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({ action, ...data })
    });

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

function normalizeItems(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.cart_items)) return data.cart_items;
    if (data.cart && Array.isArray(data.cart.items)) return data.cart.items;

    return [];
}

function itemId(item) {
    return item.cart_item_id ?? item.cart_id ?? item.id ?? item.product_id;
}

function itemName(item) {
    return item.product_name ?? item.name ?? "Product";
}

function itemQuantity(item) {
    return Math.max(1, Number(item.quantity ?? 1));
}

function itemPrice(item) {
    return Math.max(0, Number(item.price ?? item.unit_price ?? 0));
}

function itemVariant(item) {
    const parts = [];

    if (item.size) parts.push(`Size: ${item.size}`);
    if (item.color) parts.push(`Color: ${item.color}`);

    return parts.join(" · ") || "";
}

function calculateTotals() {
    const subtotal = cartItems.reduce(
        (sum, item) => sum + itemPrice(item) * itemQuantity(item),
        0
    );

    const discount = Math.max(
        0,
        Number(cartTotals?.discount_amount ?? cartTotals?.discount ?? 0)
    );

    return {
        quantity: cartItems.reduce((sum, item) => sum + itemQuantity(item), 0),
        subtotal,
        discount,
        total: Math.max(0, subtotal - discount)
    };
}

function renderCart() {
    cartItemsContainer.replaceChildren();

    if (!cartItems.length) {
        loadingMessage.classList.add("hidden");
        errorMessage.classList.add("hidden");
        cartContent.classList.add("hidden");
        emptyMessage.classList.remove("hidden");
        return;
    }

    const totals = calculateTotals();

    cartItems.forEach((item) => {
        const id = String(itemId(item));
        const quantity = itemQuantity(item);
        const price = itemPrice(item);
        const row = document.createElement("article");
        row.className = "cart-item";

        const image = document.createElement("img");
        image.className = "product-image";
        image.alt = itemName(item);
        image.loading = "lazy";

        const imageUrl = safeImageUrl(
            item.product_image ?? item.image_url ?? item.image
        );

        if (imageUrl) {
            image.src = imageUrl;
            image.addEventListener("error", () => image.remove(), { once: true });
        } else {
            image.classList.add("hidden");
        }

        const main = document.createElement("div");
        main.className = "item-main";

        const top = document.createElement("div");
        top.className = "item-top";

        const info = document.createElement("div");

        const name = document.createElement("h3");
        name.className = "product-name";
        name.textContent = itemName(item);

        const variant = document.createElement("div");
        variant.className = "product-variant";
        variant.textContent = itemVariant(item);

        const unitPrice = document.createElement("div");
        unitPrice.className = "product-price";
        unitPrice.textContent = `${formatMoney(price)} each`;

        info.append(name, variant, unitPrice);

        const lineTotal = document.createElement("div");
        lineTotal.className = "line-total";
        lineTotal.textContent = formatMoney(price * quantity);

        top.append(info, lineTotal);

        const bottom = document.createElement("div");
        bottom.className = "item-bottom";

        const controls = document.createElement("div");
        controls.className = "quantity-control";
        controls.setAttribute("aria-label", `Quantity for ${itemName(item)}`);

        const minus = document.createElement("button");
        minus.type = "button";
        minus.className = "quantity-button";
        minus.textContent = "−";
        minus.setAttribute("aria-label", `Decrease quantity of ${itemName(item)}`);
        minus.disabled = quantity <= 1 || busyItems.has(id);
        minus.addEventListener("click", () => changeQuantity(id, quantity - 1));

        const quantityText = document.createElement("span");
        quantityText.className = "quantity-value";
        quantityText.textContent = String(quantity);
        quantityText.setAttribute("aria-live", "polite");

        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "quantity-button";
        plus.textContent = "+";
        plus.setAttribute("aria-label", `Increase quantity of ${itemName(item)}`);
        plus.disabled = busyItems.has(id);
        plus.addEventListener("click", () => changeQuantity(id, quantity + 1));

        controls.append(minus, quantityText, plus);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-button";
        remove.innerHTML = '<span class="material-symbols-outlined" style="font-size:17px">delete</span> Remove';
        remove.disabled = busyItems.has(id);
        remove.addEventListener("click", () => removeItem(id));

        bottom.append(controls, remove);
        main.append(top, bottom);
        row.append(image, main);
        cartItemsContainer.appendChild(row);
    });

    document.getElementById("item-count").textContent =
        `${cartItems.length} ${cartItems.length === 1 ? "product" : "products"}`;

    document.getElementById("summary-quantity").textContent = totals.quantity;
    document.getElementById("summary-subtotal").textContent = formatMoney(
        cartTotals?.subtotal ?? totals.subtotal
    );
    document.getElementById("summary-discount").textContent =
        formatMoney(totals.discount);
    document.getElementById("summary-total").textContent = formatMoney(
        cartTotals?.total ?? totals.total
    );

    checkoutButton.disabled = checkoutInProgress || busyItems.size > 0;

    loadingMessage.classList.add("hidden");
    errorMessage.classList.add("hidden");
    emptyMessage.classList.add("hidden");
    cartContent.classList.remove("hidden");
}

async function loadCart() {
    showLoading();
    setMessage("");

    try {
        const data = await apiRequest("list");
        cartItems = normalizeItems(data);
        cartTotals = data && !Array.isArray(data) ? data : null;
        renderCart();
    } catch (error) {
        console.error("Unable to load cart:", error);
        showError(error.message || "Unable to load your cart.");
    }
}

async function changeQuantity(id, quantity) {
    if (busyItems.has(id) || quantity < 1) return;

    const item = cartItems.find((entry) => String(itemId(entry)) === id);
    if (!item) return;

    const previousQuantity = itemQuantity(item);

    if (quantity === previousQuantity) return;

    busyItems.add(id);
    renderCart();
    setMessage("Updating quantity...");

    try {
        // Adjust the action and field names if your PHP API expects different names.
        await apiRequest("update_quantity", {
            cart_item_id: id,
            product_id: item.product_id,
            quantity
        });

        const refreshed = await apiRequest("list");
        cartItems = normalizeItems(refreshed);
        cartTotals = refreshed && !Array.isArray(refreshed) ? refreshed : null;

        setMessage("Cart updated.");
    } catch (error) {
        console.error("Unable to update quantity:", error);
        setMessage(error.message || "Unable to update quantity.", true);
    } finally {
        busyItems.delete(id);
        renderCart();
    }
}

async function removeItem(id) {
    if (busyItems.has(id)) return;

    const item = cartItems.find((entry) => String(itemId(entry)) === id);
    if (!item) return;

    let confirmed = true;

    if (window.Swal) {
        const result = await Swal.fire({
            title: "Remove this item?",
            text: `Remove ${itemName(item)} from your cart?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Remove",
            cancelButtonText: "Keep item",
            confirmButtonColor: "#B91C1C"
        });

        confirmed = result.isConfirmed;
    } else {
        confirmed = window.confirm(`Remove ${itemName(item)} from your cart?`);
    }

    if (!confirmed) return;

    busyItems.add(id);
    renderCart();
    setMessage("Removing item...");

    try {
        // Adjust the action and field names if your PHP API expects different names.
        await apiRequest("remove", {
            cart_item_id: id,
            product_id: item.product_id
        });

        const refreshed = await apiRequest("list");
        cartItems = normalizeItems(refreshed);
        cartTotals = refreshed && !Array.isArray(refreshed) ? refreshed : null;

        setMessage("Item removed.");
    } catch (error) {
        console.error("Unable to remove cart item:", error);
        setMessage(error.message || "Unable to remove item.", true);
    } finally {
        busyItems.delete(id);
        renderCart();
    }
}

async function proceedToCheckout() {
    if (checkoutInProgress || !cartItems.length) return;

    // This route is a placeholder until the project's checkout page is confirmed.
    window.location.href = "checkout.html";
}

retryButton.addEventListener("click", loadCart);
checkoutButton.addEventListener("click", proceedToCheckout);

loadCart();
