"use strict";
(async function () {
  const C = StoreCommon;
  const section = document.getElementById("product-details");
  const status = document.getElementById("details-status");
  const productId = Number(new URLSearchParams(location.search).get("id"));
  let product = null, images = [], variants = [], selectedImage = 0;
  let suggestionsLoading = false;
  const suggestions = document.getElementById("product-suggestions");
  const suggestionsGrid = document.getElementById("suggested-products-grid");
  function suggestionMessage(message, retry = false) {
    const box = document.createElement("div");
    box.className = "suggestions-state";
    box.setAttribute("role", "status");
    const text = document.createElement("p");
    text.textContent = message;
    box.append(text);
    if (retry) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Try again";
      button.addEventListener("click", loadSuggestions);
      box.append(button);
    }
    suggestionsGrid.replaceChildren(box);
  }
  function sameCategory(item) {
    if (product.category_id != null && item.category_id != null) return String(item.category_id) === String(product.category_id);
    const category = String(product.category_name || "").trim().toLowerCase();
    return category !== "" && String(item.category_name || "").trim().toLowerCase() === category;
  }
  function hasStock(item) {
    if (item.in_stock !== undefined) return item.in_stock === true || Number(item.in_stock) > 0;
    return C.getVariants(item).some(variant => Number(variant.quantity) > 0);
  }
  async function loadSuggestions() {
    if (suggestionsLoading) return;
    suggestionsLoading = true;
    suggestions.hidden = false;
    suggestionsGrid.setAttribute("aria-busy", "true");
    suggestionMessage("Finding more pieces for you…");
    try {
      const response = await C.request("Products.php");
      if (!Array.isArray(response) && !Array.isArray(response?.data) && !Array.isArray(response?.products)) throw new Error("Unexpected product response.");
      const seen = new Set();
      const items = C.getArray(response).filter(item => {
        const id = Number(item.id);
        if (!Number.isInteger(id) || id < 1 || id === productId || seen.has(id) || Number(item.is_active ?? 1) !== 1) return false;
        if (["men", "women"].includes(product.gender) && ["men", "women"].includes(item.gender) && item.gender !== product.gender) return false;
        seen.add(id);
        return true;
      });
      const currentPrice = C.priceInfo(product).finalPrice;
      items.sort((a, b) => Number(sameCategory(b)) - Number(sameCategory(a)) || Number(hasStock(b)) - Number(hasStock(a)) || Math.abs(C.priceInfo(a).finalPrice - currentPrice) - Math.abs(C.priceInfo(b).finalPrice - currentPrice) || Number(b.id) - Number(a.id));
      if (!items.length) { suggestionMessage("There are no more pieces to suggest right now. Explore the collection for more."); return; }
      suggestionsGrid.replaceChildren(...items.slice(0, 4).map(item => ProductCards.create(item)));
      const collection = document.getElementById("suggestions-collection");
      collection.href = product.category_id != null ? "shop.html?category=" + encodeURIComponent(product.category_id) : "shop.html";
    } catch (error) {
      suggestionMessage("Suggested products couldn’t be loaded. Please try again.", true);
    } finally {
      suggestionsLoading = false;
      suggestionsGrid.setAttribute("aria-busy", "false");
    }
  }
  function availableVariants() { return variants.filter(variant => Number(variant.quantity) > 0); }
  function selectedVariant() {
    const color = section.querySelector("#product-color")?.value || "";
    const size = section.querySelector("#product-size")?.value || "";
    return availableVariants().find(variant => String(variant.color) === color && String(variant.size) === size) || null;
  }
  function renderGallery() {
    section.querySelector("#gallery-main").innerHTML = `<img data-product-image src="${C.escapeHtml(C.imageUrl(images[selectedImage]))}" alt="${C.escapeHtml(product.name || "Product")}">`;
    section.querySelector("#gallery-thumbs").innerHTML = images.length > 1 ? images.map((image,index) => `<button type="button" data-gallery="${index}" class="${index === selectedImage ? "active" : ""}" aria-label="Show product image ${index+1}"><img data-product-image src="${C.escapeHtml(C.imageUrl(image))}" alt=""></button>`).join("") : "";
    C.attachImageFallback(section);
  }
  function renderOptions(preferredColor, preferredSize) {
    const available = availableVariants();
    const colorSelect = section.querySelector("#product-color"), sizeSelect = section.querySelector("#product-size");
    const colors = [...new Set(available.map(variant => String(variant.color || "")).filter(Boolean))];
    const color = colors.includes(preferredColor) ? preferredColor : (colorSelect.value && colors.includes(colorSelect.value) ? colorSelect.value : colors[0] || "");
    colorSelect.innerHTML = '<option value="">Choose color</option>' + colors.map(value => `<option value="${C.escapeHtml(value)}">${C.escapeHtml(value)}</option>`).join("");
    colorSelect.value = color;
    const sizes = [...new Set(available.filter(variant => String(variant.color || "") === color).map(variant => String(variant.size || "")).filter(Boolean))];
    const size = sizes.includes(preferredSize) ? preferredSize : (sizeSelect.value && sizes.includes(sizeSelect.value) ? sizeSelect.value : sizes[0] || "");
    sizeSelect.innerHTML = '<option value="">Choose size</option>' + sizes.map(value => `<option value="${C.escapeHtml(value)}">${C.escapeHtml(value.toUpperCase() === "ONE_SIZE" ? "One size" : value)}</option>`).join("");
    sizeSelect.value = size;
    updateStock();
  }
  function updateStock() {
    const variant = selectedVariant();
    const quantity = section.querySelector("#product-quantity");
    const stock = variant ? Number(variant.quantity) : 0;
    section.querySelector("#variant-stock").textContent = variant ? `${stock} available` : "Choose an available color and size.";
    quantity.max = String(Math.max(stock, 1));
    if (Number(quantity.value) > stock) quantity.value = String(Math.max(stock, 1));
    section.querySelector("#add-cart").disabled = !variant;
  }
  function renderProduct() {
    const price = C.priceInfo(product);
    const priceHtml = price.discounted ? `<span class="sale-price">${C.money(price.finalPrice)}</span><span class="old-price">${C.money(price.price)}</span><span class="sale-tag">-${price.percentage}%</span>` : `<span>${C.money(price.finalPrice)}</span>`;
    section.innerHTML = `<div class="details-gallery"><div class="gallery-main" id="gallery-main"></div><div class="gallery-thumbs" id="gallery-thumbs"></div></div>
      <div class="details-copy"><p class="details-category">${C.escapeHtml(product.category_name || "Collection")}</p><h1>${C.escapeHtml(product.name || "Product")}</h1><div class="details-price">${priceHtml}</div>
      <p class="details-description">${C.escapeHtml(product.description || "A considered piece from our collection.")}</p>
      <div class="option-group"><label class="option-label" for="product-color">Color</label><select id="product-color"><option value="">Choose color</option></select></div>
      <div class="option-group"><label class="option-label" for="product-size">Size</label><select id="product-size"><option value="">Choose size</option></select></div>
      <p id="variant-stock" class="stock-line" aria-live="polite"></p>
      <div class="quantity-row"><label for="product-quantity">Quantity</label><input id="product-quantity" type="number" min="1" value="1" inputmode="numeric"></div>
      <div class="details-actions"><button type="button" class="primary-store-btn" id="add-cart">Add to cart</button><button type="button" class="secondary-store-btn" id="add-detail-wishlist"><i class="fa-regular fa-heart"></i> Add to wishlist</button></div><p id="details-feedback" class="details-status" role="status"></p></div>`;
    section.hidden = false; renderGallery(); renderOptions();
  }
  section.addEventListener("change", event => {
    if (event.target.id === "product-color") renderOptions(event.target.value, "");
    if (event.target.id === "product-size") updateStock();
    if (event.target.id === "product-quantity") updateStock();
  });
  section.addEventListener("click", async event => {
    const gallery = event.target.closest("[data-gallery]");
    if (gallery) { selectedImage = Number(gallery.dataset.gallery); renderGallery(); return; }
    if (event.target.closest("#add-detail-wishlist")) {
      const button = section.querySelector("#add-detail-wishlist"); button.disabled = true;
      try { if (!(await C.addWishlist(product.id))) return; button.innerHTML = '<i class="fa-solid fa-heart"></i> Added to wishlist'; }
      catch (error) { C.notify(error.message, "error"); }
      finally { button.disabled = false; }
      return;
    }
    if (event.target.closest("#add-cart")) {
      const variant = selectedVariant();
      if (!variant) { C.notify("Choose a color and size first.", "error"); return; }
      const quantityInput = section.querySelector("#product-quantity"), quantity = Number(quantityInput.value);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > Number(variant.quantity)) { C.notify(`Choose a quantity between 1 and ${variant.quantity}.`, "error"); quantityInput.focus(); return; }
      if (!(await C.requireLogin())) return;
      const button = section.querySelector("#add-cart"); button.disabled = true;
      try {
        await C.request("cart.php", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        action: "add",
        variant_id: Number(variant.id),
        quantity: quantity
    })
});

await C.refreshCartCount();

C.notify("Product added to your cart.", "success");section.querySelector("#details-feedback").textContent = "Product added to your cart successfully.";
      } catch (error) { C.notify(error.message, "error"); }
      finally { button.disabled = false; }
    }
  });
  try {
    await EcoAuth.ready;
    if (!Number.isInteger(productId) || productId < 1) throw new Error("Please choose a product from the shop first.");
    product = await C.request(`Products.php?id=${encodeURIComponent(productId)}`);
    if (product && product.data && !product.id) product = product.data;
    if (!product || !product.id || Number(product.is_active ?? 1) !== 1) throw new Error("This product is not available.");
    images = C.getImages(product); if (!images.length) images = [""];
    variants = C.getVariants(product); status.textContent = ""; renderProduct();
    loadSuggestions();
  } catch (error) { status.textContent = error.message; status.classList.add("status-error"); }
})();
