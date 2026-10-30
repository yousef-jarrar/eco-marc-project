"use strict";

window.StoreCommon = (function () {
  const apiBase = new URL("../../../backend/api/", document.currentScript.src).href;
  const imageFallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='750' viewBox='0 0 600 750'%3E%3Crect width='600' height='750' fill='%23efede8'/%3E%3Cpath d='M240 300h120v150H240z' fill='none' stroke='%23c8c2b8' stroke-width='4'/%3E%3Ccircle cx='300' cy='270' r='22' fill='none' stroke='%23c8c2b8' stroke-width='4'/%3E%3Ctext x='300' y='510' font-size='22' fill='%2373716d' text-anchor='middle' font-family='Arial'%3ELUMI%C3%88RE%3C/text%3E%3C/svg%3E";

  async function request(endpoint, options = {}) {
    await EcoAuth.ready;
    const response = await EcoAuth.fetch(apiBase + endpoint, options);
    let data;
    try { data = await response.json(); }
    catch (_) { throw new Error("The server returned an invalid response. Please try again."); }
    if (!response.ok || (data && data.success === false)) {
      const error = new Error(data.message || "The request could not be completed.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function getArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.products)) return data.products;
    if (Array.isArray(data.categories)) return data.categories;
    return [];
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }

  function getVariants(product) {
    let variants = product && product.variants ? product.variants : [];
    if (typeof variants === "string") { try { variants = JSON.parse(variants); } catch (_) { variants = []; } }
    return Array.isArray(variants) ? variants : [];
  }

  function getImages(product) {
    let images = product && (product.images || product.image || []);
    if (typeof images === "string") { try { images = JSON.parse(images); } catch (_) { images = images ? [images] : []; } }
    if (!Array.isArray(images)) images = images ? [images] : [];
    const result = images.map(image => typeof image === "string" ? image : (image.image_url || image.image_path || image.url || image.path || "")).filter(Boolean);
    if (!result.length && product && product.image_url) result.push(product.image_url);
    return result;
  }

  function priceInfo(product) {
    const price = Math.max(0, Number(product && product.price) || 0);
    const percentage = Math.min(100, Math.max(0, Number(product && product.discount_percentage) || 0));
    const discounted = Number(product && product.discount_id) > 0 && percentage > 0;
    const finalPrice = discounted ? Math.max(0, price * (1 - percentage / 100)) : price;
    return { price, percentage, discounted, finalPrice };
  }

  function money(value) { return `${Number(value).toFixed(2)} JOD`; }

  function imageUrl(url) {
    if (!url) return imageFallback;
    try {
      const baseUrl = ["frontend/","backend/uploads/","assets/products/"].some(prefix=>String(url).startsWith(prefix)) ? new URL("../../",apiBase) : document.baseURI;
      const parsed = new URL(url,baseUrl);
      if (!["http:", "https:", "data:"].includes(parsed.protocol)) return imageFallback;
      return parsed.href;
    } catch (_) { return imageFallback; }
  }

  function attachImageFallback(root) {
    root.querySelectorAll("img[data-product-image]").forEach(img => {
      img.addEventListener("error", function () {
        if (img.dataset.fallbackApplied) return;
        img.dataset.fallbackApplied = "1";
        img.src = imageFallback;
      });
    });
  }

  function notify(message, type = "success") {
    if (type === "success") Alerts.toast(message);
    else Alerts.show("Store", message, type);
  }

  function requireLogin() {
    return EcoAuth.ready.then(async state => {
      let current = state;
      try { current = await EcoAuth.refresh(); } catch (_) { current = state; }
      if (!current || !current.user) {
        const next = location.pathname + location.search;
        location.href = EcoAuth.loginUrl + "?next=" + encodeURIComponent(next);
        return false;
      }
      return true;
    });
  }

  async function addWishlist(productId) {
    const signedIn = await requireLogin();
    if (!signedIn) return false;
    const result = await request("wishlist.php", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({product_id:Number(productId)})});
    notify(result.message || "Added to your wishlist.", "success");
    return true;
  }

  async function removeWishlist(productId) {
    const signedIn = await requireLogin();
    if (!signedIn) return false;
    const result = await request("wishlist.php", {method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({product_id:Number(productId)})});
    notify(result.message || "Removed from your wishlist.", "success");
    return true;
  }

  function cardPrice(product) {
    const p = priceInfo(product);
    return p.discounted
      ? `<div class="card-price"><span class="sale-price">${money(p.finalPrice)}</span><span class="old-price">${money(p.price)}</span><span class="sale-tag">-${p.percentage}%</span></div>`
      : `<div class="card-price">${money(p.finalPrice)}</div>`;
  }

  function card(product, options = {}) {
    return ProductCards.html(product, {wishlist:!!options.wishlist});
  }
  let cartItemsCache = [];

async function refreshCartCount() {
    const badge = document.getElementById("store-cart-count");
    if (!badge) return 0;

    try {
        const result = await request("cart.php?action=items");
        cartItemsCache = getArray(result);

        const count = cartItemsCache.reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0
        );

        badge.textContent = String(count);
        badge.hidden = count === 0;

        return count;
    } catch (error) {
        cartItemsCache = [];
        badge.textContent = "0";
        badge.hidden = true;
        return 0;
    }
}
function renderCartDrawer(items) {
    let drawer = document.getElementById("store-cart-drawer");

    if (!drawer) {
        drawer = document.createElement("div");
        drawer.id = "store-cart-drawer";
        drawer.className = "store-cart-overlay";
        drawer.hidden = true;

        drawer.innerHTML = `
            <button
                type="button"
                class="store-cart-scrim"
                data-close-cart
                aria-label="Close cart"
            ></button>

            <aside class="store-cart-panel" role="dialog"
                aria-modal="true" aria-labelledby="store-cart-title">

                <div class="store-cart-heading">
                    <h2 id="store-cart-title">Your cart</h2>
                    <button type="button" data-close-cart aria-label="Close cart">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <p class="store-cart-status" id="store-cart-status"></p>
                <div class="store-cart-items" id="store-cart-items"></div>

                <div class="store-cart-footer">
                    <span>Items in cart</span>
                    <strong id="store-cart-total-quantity">0</strong>
                    <a href="${new URL("../../frontend/shop.html", apiBase).href}" class="store-cart-continue">
                        Continue shopping
                    </a>
                </div>
            </aside>
        `;

        document.body.appendChild(drawer);

        drawer.addEventListener("click", event => {
            if (event.target.closest("[data-close-cart]")) {
                drawer.hidden = true;
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") drawer.hidden = true;
        });
    }

    const list = drawer.querySelector("#store-cart-items");
    const status = drawer.querySelector("#store-cart-status");

    const totalQuantity = items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
    );

    drawer.querySelector("#store-cart-total-quantity").textContent =
        String(totalQuantity);

    if (!items.length) {
        list.innerHTML = `
            <p class="store-cart-empty">Your cart is empty.</p>
        `;
        status.textContent = "Choose a product to add it to your cart.";
        return;
    }

    status.textContent = "Your selected products";

    list.innerHTML = items.map(item => `
        <article class="store-cart-item">
            <div>
                <strong>${escapeHtml(item.product_name || "Product")}</strong>

                <p>
                    ${item.color ? `Color: ${escapeHtml(item.color)}` : ""}
                    ${item.color && item.size ? " · " : ""}
                    ${item.size ? `Size: ${escapeHtml(item.size)}` : ""}
                </p>

                <small>Qty: ${Number(item.quantity || 0)}</small>
            </div>

            <strong>
                ${money(Number(item.price || 0) * Number(item.quantity || 0))}
            </strong>
        </article>
    `).join("");
}
function initCartNavigation() {
    const button = document.getElementById("store-cart-button");

    if (!button || button.dataset.cartReady) return;

    button.dataset.cartReady = "1";

    button.addEventListener("click", async () => {
        renderCartDrawer(cartItemsCache);

        const drawer = document.getElementById("store-cart-drawer");
        const list = document.getElementById("store-cart-items");
        const status = document.getElementById("store-cart-status");

        drawer.hidden = false;
        list.innerHTML = '<p class="store-cart-empty">Loading your cart...</p>';

        try {
            const result = await request("cart.php?action=items");
            cartItemsCache = getArray(result);

            renderCartDrawer(cartItemsCache);
            drawer.hidden = false;
        } catch (error) {
            status.textContent = error.message;
            list.innerHTML = `
                <p class="store-cart-empty">
                    Sign in to view your cart items.
                </p>
            `;
        }
    });

    refreshCartCount();
}

document.addEventListener("DOMContentLoaded", initCartNavigation);

return {
    apiBase,
    request,
    getArray,
    escapeHtml,
    getVariants,
    getImages,
    priceInfo,
    money,
    imageUrl,
    attachImageFallback,
    notify,
    requireLogin,
    addWishlist,
    removeWishlist,
    refreshCartCount,
    card,
    cardPrice
};



})();
