/*
 * Eco Marc checkout frontend.
 *
 * PHP API (backend/api/cart.php):
 * GET  ?action=items
 * GET  ?action=total[&coupon_code=XXX]
 * GET  ?action=profile                  -> name, email, phone, address from users
 * POST ?action=checkout  { shipping_address, coupon_code }
 */

const CHECKOUT_CONFIG = {
    apiUrl: "../../backend/api/cart.php",
    currency: "JOD"
};

const form = document.getElementById("checkout-form");
const itemsContainer = document.getElementById("checkout-items");
const messageBox =
    document.getElementById("checkout-error") ||
    document.getElementById("checkout-message");
const placeOrderButton = document.getElementById("place-order");
const addressPreview = document.getElementById("shipping-preview");
const couponInput = document.getElementById("coupon-input");
const couponApply = document.getElementById("coupon-apply");
const couponMessage = document.getElementById("coupon-message");

let cartItems = [];
let cartTotals = null;
let submitting = false;
let checkoutPhoneRequired = true;

const currentYear = document.getElementById("current-year");
if (currentYear) currentYear.textContent = new Date().getFullYear();

/* ---------- helpers ---------- */

function money(value) {
    const number = Number(value);
    return `${CHECKOUT_CONFIG.currency} ${
        Number.isFinite(number) ? number.toFixed(2) : "0.00"
    }`;
}

function showMessage(message, type = "error") {
    if (!messageBox) {
        console.error(message);
        return;
    }
    messageBox.textContent = message;
    messageBox.className = `notice ${type}`;
    messageBox.hidden = false;
    messageBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    Alerts.show("Checkout", message, type === "error" ? "error" : "info");
}

function clearMessage() {
    if (!messageBox) return;
    messageBox.hidden = true;
    messageBox.textContent = "";
    messageBox.className = "notice";
}

// The cart page should save the typed code with:
//   sessionStorage.setItem("coupon_code", code)
function getCoupon() {
    try {
        return (sessionStorage.getItem("coupon_code") || "").trim();
    } catch {
        return "";
    }
}

function endpoint(action, extra = {}) {
    const url = new URL(CHECKOUT_CONFIG.apiUrl, window.location.href);
    url.searchParams.set("action", action);

    Object.entries(extra).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
    });

    return url.toString();
}

async function apiRequest(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    await EcoAuth.ready;

    const requestOptions = {
        credentials: "same-origin",
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),

            ...(options.headers || {})
        }
    };

    const fetchFunction = EcoAuth.fetch;
    const response = await fetchFunction(url, requestOptions);

    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error(
            "The server did not return JSON. Check your PHP API response."
        );
    }

    if (
        !response.ok ||
        result?.success === false ||
        result?.status === "error"
    ) {
        throw new Error(
            result?.message ||
            result?.error ||
            `Request failed (${response.status}).`
        );
    }

    return result;
}

function unwrapItems(result) {
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.items)) return result.items;
    if (Array.isArray(result?.cart_items)) return result.cart_items;
    return [];
}

function unwrapTotals(result) {
    if (
        result?.data &&
        typeof result.data === "object" &&
        !Array.isArray(result.data)
    ) {
        return result.data;
    }
    if (result?.totals && typeof result.totals === "object") {
        return result.totals;
    }
    return result || {};
}

/* ---------- order summary ---------- */

function createItemElement(item) {
    const row = document.createElement("article");
    row.className = "checkout-item";

    const info = document.createElement("div");
    info.className = "item-info";

    const name = document.createElement("p");
    name.className = "item-name";
    name.textContent = item.product_name || item.name || "Product";
    info.appendChild(name);

    const variantParts = [];
    if (item.size) variantParts.push(`Size: ${item.size}`);
    if (item.color) variantParts.push(`Color: ${item.color}`);

    if (variantParts.length) {
        const variant = document.createElement("p");
        variant.className = "item-variant";
        variant.textContent = variantParts.join(" · ");
        info.appendChild(variant);
    }

    const qty = Number(item.quantity) || 1;

    const quantity = document.createElement("p");
    quantity.className = "item-quantity";
    quantity.textContent = `Qty: ${qty}`;
    info.appendChild(quantity);

    const unitPrice = Number(item.price ?? item.product_price ?? 0);
    const discount = Math.min(
        100,
        Math.max(0, Number(item.discount_percentage) || 0)
    );

    const price = document.createElement("div");
    price.className = "item-price";
    price.textContent = money(unitPrice * qty * (1 - discount / 100));

    // No image column: name/details on the left, price on the right.
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "flex-start";
    row.style.gap = "1rem";

    row.append(info, price);
    return row;
}

function renderItems() {
    if (!itemsContainer || !placeOrderButton) {
        console.error("Missing #checkout-items or #place-order in checkout.html.");
        return;
    }

    itemsContainer.replaceChildren();

    const loading = document.getElementById("checkout-loading");
    if (loading) loading.hidden = true;

    if (!cartItems.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Your bag is empty. Add an item before checking out.";
        itemsContainer.appendChild(empty);
        placeOrderButton.disabled = true;
        return;
    }

    cartItems.forEach(item => itemsContainer.appendChild(createItemElement(item)));
    placeOrderButton.disabled = false;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function renderTotals() {
    const totals = cartTotals || {};

    const subtotal = Number(totals.subtotal) || 0;
    const discount = Number(
        totals.discount_amount ?? totals.product_discount ?? 0
    ) || 0;
    const delivery = Number(totals.delivery_fee) || 0;
    const total = Number(totals.total ?? (subtotal - discount + delivery)) || 0;

    setText("subtotal", money(subtotal));
    setText("discount", `− ${money(discount)}`);
    setText("delivery", delivery === 0 ? "Free" : money(delivery));
    setText("total", money(total));
}

/* ---------- saved info + address preview ---------- */

function fillIfEmpty(id, value) {
    const input = document.getElementById(id);
    if (input && value && !input.value.trim()) input.value = value;
}

// profile = { first_name, last_name, email, phone, address }
// Name, email and phone come from the users table and are only displayed.
function prefillForm(profile) {
    if (!profile || typeof profile !== "object") return;

    const fullName = [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(" ");

    setText("acc-name", fullName || "—");
    setText("acc-email", profile.email || "—");
    const savedPhone = normalizePhone(profile.phone || "");
    checkoutPhoneRequired = !savedPhone;
    setText("acc-phone", savedPhone || "Add your number below");
    const phoneInput = document.getElementById("phone");
    phoneInput.required = checkoutPhoneRequired;
    phoneInput.disabled = !checkoutPhoneRequired;
    document.getElementById("checkout-phone-field").hidden = !checkoutPhoneRequired;

    fillIfEmpty("address", profile.address);
}

function value(id) {
    return document.getElementById(id)?.value.trim() || "";
}

function buildShippingAddress() {
    const lines = [
        value("address"),
        [value("district"), value("city")].filter(Boolean).join(", ")
    ];

    return lines.filter(Boolean).join("\n");
}

// Shows exactly what will be saved on the order, updated as the person types.
function updateAddressPreview() {
    if (!addressPreview) return;

    const text = buildShippingAddress();
    addressPreview.textContent = text || "Fill in your delivery address to see it here.";
}

/* ---------- coupon ---------- */

function saveCoupon(code) {
    try {
        if (code) sessionStorage.setItem("coupon_code", code);
        else sessionStorage.removeItem("coupon_code");
    } catch { /* ignore */ }
}

function setCouponMessage(text, good = false) {
    if (!couponMessage) return;
    couponMessage.textContent = text;
    couponMessage.style.color = good ? "#2e7d32" : text ? "#c62828" : "";
}

// Type a code + Apply = discount. Empty box + Apply = remove the coupon.
async function applyCoupon() {
    if (!couponInput || !couponApply) return;

    const code = couponInput.value.trim();

    couponApply.disabled = true;
    setCouponMessage("");

    try {
        const response = await apiRequest(
            endpoint("total", { coupon_code: code })
        );
        const totals = unwrapTotals(response);

        if (code && totals.coupon_invalid) {
            setCouponMessage("Invalid or expired coupon code.");
            return;
        }

        saveCoupon(code);
        cartTotals = totals;
        renderTotals();

        setCouponMessage(
            code ? `Coupon ${totals.coupon_code || code} applied.` : "Coupon removed.",
            true
        );
    } catch (error) {
        setCouponMessage(error.message || "Could not apply the coupon.");
    } finally {
        couponApply.disabled = false;
    }
}

/* ---------- loading ---------- */

async function loadCheckout() {
    if (!itemsContainer || !placeOrderButton) {
        showMessage("Checkout HTML is missing #checkout-items or #place-order.");
        return;
    }

    try {
        const [itemsResponse, totalsResponse] = await Promise.all([
            apiRequest(endpoint("items")),
            apiRequest(endpoint("total", { coupon_code: getCoupon() }))
        ]);

        cartItems = unwrapItems(itemsResponse);
        cartTotals = unwrapTotals(totalsResponse);

        if (couponInput) couponInput.value = getCoupon();

        if (cartTotals.coupon_invalid) {
            saveCoupon("");
            if (couponInput) couponInput.value = "";
            setCouponMessage("Your saved coupon is no longer valid.");
        } else if (getCoupon()) {
            setCouponMessage(`Coupon ${getCoupon()} applied.`, true);
        }

        renderItems();
        renderTotals();

        if (!cartItems.length) {
            showMessage("Your bag is empty. Add a product before checking out.");
        }
    } catch (error) {
        itemsContainer.replaceChildren();

        const errorElement = document.createElement("div");
        errorElement.className = "empty-state";
        errorElement.textContent = "Could not load your bag.";
        itemsContainer.appendChild(errorElement);
        placeOrderButton.disabled = true;

        showMessage(
            error.message
        );
    }

    // Saved details are optional: if this fails, the form just stays empty.
    try {
        const profileResponse = await apiRequest(endpoint("profile"));
        prefillForm(profileResponse?.data);
    } catch (error) {
        console.warn("Could not load saved details:", error.message);
    }

    updateAddressPreview();
}

/* ---------- validation ---------- */

function validateForm() {
    if (!form) {
        showMessage("Checkout form #checkout-form was not found.");
        return false;
    }

    let valid = true;

    const requiredIds = ["address", "city"];
    if (checkoutPhoneRequired) requiredIds.unshift("phone");

    form.querySelectorAll(".form-field").forEach(field => {
        field.classList.remove("invalid");
        field.querySelector("input")?.removeAttribute("aria-invalid");
        const error = field.querySelector(".field-error");
        if (error) error.textContent = "";
    });

    requiredIds.forEach(id => {
        const input = document.getElementById(id);

        if (!input) {
            console.error(`Missing required checkout input: #${id}`);
            valid = false;
            return;
        }

        const field = input.closest(".form-field");

        if (!field) {
            console.error(`Input #${id} needs a parent with class "form-field".`);
            valid = false;
            return;
        }

        let error = "";

        if (!input.value.trim()) {
            error = "This field is required.";
        } else if (
            id === "email" &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())
        ) {
            error = "Enter a valid email address.";
        } else if (
            id === "phone" &&
            !normalizePhone(input.value)
        ) {
            error = "Enter a valid phone number with 8–15 digits.";
        }

        if (error) {
            valid = false;
            field.classList.add("invalid");
            input.setAttribute("aria-invalid", "true");

            const errorElement = field.querySelector(".field-error");
            if (errorElement) errorElement.textContent = error;
        }
    });

    return valid;
}

/* ---------- submit ---------- */

if (form) {
    form.addEventListener("submit", async event => {
        event.preventDefault();
        clearMessage();

        if (submitting) return;

        if (!validateForm()) {
            showMessage("Please correct the highlighted fields before placing your order.");
            form.querySelector(
                ".form-field.invalid input, .form-field.invalid textarea"
            )?.focus();
            return;
        }

        if (!cartItems.length) {
            showMessage("Your bag is empty. Add a product before placing an order.");
            return;
        }

        submitting = true;
        placeOrderButton.disabled = true;

        const buttonLabel = placeOrderButton.querySelector(".button-label");
        if (buttonLabel) buttonLabel.textContent = "Placing order...";

        try {
            const result = await apiRequest(endpoint("checkout"), {
                method: "POST",
                body: JSON.stringify({
                    action: "checkout",
                    shipping_address: buildShippingAddress(),
                    ...(checkoutPhoneRequired ? {phone: normalizePhone(value("phone"))} : {}),
                    coupon_code: getCoupon()
                })
            });

            const order =
                result?.data && typeof result.data === "object"
                    ? result.data
                    : result;

            try {
                sessionStorage.removeItem("coupon_code");
            } catch { /* ignore */ }

            if (buttonLabel) buttonLabel.textContent = "Order placed";

            const orderId = order.cart_id ?? order.order_id ?? "";
            window.location.href =
                `Order-success.html${orderId ? `?order=${encodeURIComponent(orderId)}` : ""}`;
            return;
        } catch (error) {
            showMessage(
                error.message || "We couldn't place your order. Please try again."
            );

            placeOrderButton.disabled = false;
            if (buttonLabel) buttonLabel.textContent = "Place order";
        } finally {
            submitting = false;
        }
    });
} else {
    console.error("Checkout form #checkout-form was not found.");
}

document
    .querySelectorAll("#checkout-form input, #checkout-form textarea")
    .forEach(input => {
        input.addEventListener("input", () => {
            const field = input.closest(".form-field");

            if (field) {
                field.classList.remove("invalid");
                input.removeAttribute("aria-invalid");
                const error = field.querySelector(".field-error");
                if (error) error.textContent = "";
            }

            updateAddressPreview();
        });
    });

if (couponApply) couponApply.addEventListener("click", applyCoupon);

if (couponInput) {
    couponInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            applyCoupon();
        }
    });
}

loadCheckout();
function normalizePhone(value) {
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    const persian = "۰۱۲۳۴۵۶۷۸۹";
    let phone = String(value).trim().replace(/[٠-٩۰-۹]/g, digit => {
        const index = arabic.indexOf(digit);
        return String(index >= 0 ? index : persian.indexOf(digit));
    });
    phone = phone.replace(/[\s().-]/g, "");
    return /^\+?[0-9]{8,15}$/.test(phone) ? phone : "";
}
