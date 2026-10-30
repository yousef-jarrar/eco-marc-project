"use strict";
(async function () {
  const C = StoreCommon;
  const grid = document.getElementById("product-grid");
  const count = document.getElementById("products-count");
  const pageInfo = document.getElementById("page-info");
  const prev = document.getElementById("prev-page");
  const next = document.getElementById("next-page");
  const categoriesList = document.getElementById("categoriesList");
  const pageSize = 5;
  let products = [];
  let categories = [];
  let currentPage = 1;
  const filters = {
    name: document.getElementById("filter-name"),
    gender: document.getElementById("filter-gender"),
    color: document.getElementById("filter-color"),
    size: document.getElementById("filter-size"),
    minPrice: document.getElementById("filter-min-price"), price: document.getElementById("filter-price")
  };
  const selectedCategories = new Set();
  const query = new URLSearchParams(location.search);
  filters.name.value = query.get("q") || "";
  filters.gender.value = ["men","women","unisex"].includes(query.get("gender")) ? query.get("gender") : "";

  function fillSelect(select, values, placeholder) {
    const oldValue = select.value;
    select.replaceChildren(new Option(placeholder, ""));
    [...new Set(values.filter(value => value !== null && value !== undefined && String(value).trim() !== "").map(String))]
      .sort((a, b) => a.localeCompare(b)).forEach(value => select.add(new Option(value, value)));
    if ([...select.options].some(option => option.value === oldValue)) select.value = oldValue;
  }

  function populateFilters() {
    const colors = [], sizes = [];
    products.forEach(product => C.getVariants(product).forEach(variant => {
      if (variant.color) colors.push(variant.color);
      if (variant.size) sizes.push(String(variant.size).toUpperCase() === "ONE_SIZE" ? "One size" : variant.size);
    }));
    fillSelect(filters.color, colors, "All colors");
    fillSelect(filters.size, sizes, "All sizes");
    categoriesList.innerHTML = categories.length ? categories.map(category => {
      const id = String(category.id ?? category.category_id ?? "");
      const name = category.name ?? category.category_name ?? "Category";
      if (!id) return "";
      return `<label class="category-option"><input type="checkbox" value="${C.escapeHtml(id)}" data-category-filter><span>${C.escapeHtml(name)}</span></label>`;
    }).join("") : '<p class="shop-muted">No categories available.</p>';
  }

  function filteredProducts() {
    const name = filters.name.value.trim().toLowerCase();
    const color = filters.color.value.toLowerCase();
    const size = filters.size.value.toLowerCase();
    const minPrice = filters.minPrice.value.trim() === "" ? null : Number(filters.minPrice.value);
    const maxPrice = filters.price.value.trim() === "" ? null : Number(filters.price.value);
    return products.filter(product => {
      const productName = String(product.name || "").toLowerCase();
      const matchesName = !name || productName.includes(name);
      const matchesGender = !filters.gender.value || product.gender === filters.gender.value || product.gender === "unisex";
      const categoryId = String(product.category_id ?? product.categoryId ?? "");
      const matchesCategory = selectedCategories.size === 0 || selectedCategories.has(categoryId);
      const variants = C.getVariants(product);
      const matchesColor = !color || variants.some(v => String(v.color || "").toLowerCase() === color);
      const matchesSize = !size || variants.some(v => {
        const value = String(v.size || "").toLowerCase();
        return value === size || (size === "one size" && value === "one_size");
      });
      const price = C.priceInfo(product);
      const matchesPrice = (minPrice === null || (!Number.isNaN(minPrice) && price.finalPrice >= minPrice)) && (maxPrice === null || (!Number.isNaN(maxPrice) && price.finalPrice <= maxPrice));
      return matchesGender && matchesName && matchesCategory && matchesColor && matchesSize && matchesPrice && (query.get("sale") !== "1" || price.discounted);
    });
  }

  function render() {
    const matches = filteredProducts();
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    currentPage = Math.min(currentPage, pages);
    const visible = matches.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    count.textContent = `${matches.length} product${matches.length === 1 ? "" : "s"}`;
    pageInfo.textContent = `Page ${currentPage} of ${pages}`;
    prev.disabled = currentPage <= 1;
    next.disabled = currentPage >= pages;
    grid.innerHTML = visible.length ? visible.map(product => C.card(product, {detailsPage:"ProductShop.html"})).join("") : '<div class="empty-state">No products match your filters. Try changing or clearing them.</div>';
    C.attachImageFallback(grid);
  }

  async function load() {
    try {
      const [productData, categoryData] = await Promise.all([C.request("Products.php"), C.request("categories.php")]);
      products = C.getArray(productData).filter(product => Number(product.is_active ?? 1) === 1);
      categories = C.getArray(categoryData);
      if (query.get("sort") === "new") products.sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||Number(b.id)-Number(a.id));
      populateFilters();
      const category = query.get("category") || "";
      if (category) {
        const selected = categories.find(c=>String(c.id)===category || String(c.name).toLowerCase()===category.toLowerCase());
        if (selected) { selectedCategories.add(String(selected.id)); const checkbox=categoriesList.querySelector('input[value="'+String(selected.id)+'"]'); if(checkbox)checkbox.checked=true; }
      }
      render();
    } catch (error) {
      grid.innerHTML = `<div class="empty-state">${C.escapeHtml(error.message)}</div>`;
      count.textContent = "Products could not be loaded";
    }
  }

  Object.values(filters).forEach(input => input.addEventListener(input.tagName === "INPUT" && input.type === "search" ? "input" : "change", () => { if(input === filters.gender){if(input.value)query.set("gender",input.value);else query.delete("gender");history.replaceState(null,"",location.pathname+(query.toString()?"?"+query.toString():""));} currentPage = 1; render(); }));
  categoriesList.addEventListener("change", event => {
    const checkbox = event.target.closest("[data-category-filter]");
    if (!checkbox) return;
    if (checkbox.checked) selectedCategories.add(checkbox.value); else selectedCategories.delete(checkbox.value);
    currentPage = 1; render();
  });
  document.getElementById("clear-filters").addEventListener("click", () => {
    Object.values(filters).forEach(input => input.value = "");
    selectedCategories.clear();
    query.delete("gender"); query.delete("sale"); query.delete("category"); query.delete("q"); history.replaceState(null,"",location.pathname);
    categoriesList.querySelectorAll("[data-category-filter]").forEach(input => input.checked = false);
    currentPage = 1; render();
  });
  prev.addEventListener("click", () => { if (currentPage > 1) { currentPage--; render(); window.scrollTo({top:document.querySelector(".shop-container").offsetTop - 85,behavior:"smooth"}); } });
  next.addEventListener("click", () => { const pages = Math.max(1, Math.ceil(filteredProducts().length / pageSize)); if (currentPage < pages) { currentPage++; render(); window.scrollTo({top:document.querySelector(".shop-container").offsetTop - 85,behavior:"smooth"}); } });
  grid.addEventListener("click", async event => {
    const heart = event.target.closest("[data-add-wishlist]");
    if (!heart) return;
    event.preventDefault(); event.stopPropagation(); heart.disabled = true;
    try { const added = await C.addWishlist(heart.dataset.addWishlist); if (added) { heart.classList.add("is-favorite"); heart.innerHTML = '<i class="fa-solid fa-heart"></i>'; } }
    catch (error) { C.notify(error.message, "error"); }
    finally { heart.disabled = false; }
  });
  await load();
})();
