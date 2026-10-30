const CATEGORIES_API = "../backend/api/categories.php";
const PRODUCTS_API = "../backend/api/Products.php";

const categoriesList = document.getElementById("categoriesList");
const productsGrid = document.getElementById("productsGrid");
const productsCount = document.getElementById("productsCount");
const searchInput = document.getElementById("searchInput");

let allProducts = [];

async function loadCategories() {
    categoriesList.textContent = "Loading categories...";

    try {
        const response = await fetch(CATEGORIES_API);

        if (!response.ok) {
            throw new Error("Failed to load categories");
        }

        const data = await response.json();

        const categories = Array.isArray(data)
            ? data
            : data.categories ?? data.data ?? [];

        const activeCategories = categories.filter(category =>
            category.status === "active"
        );

        categoriesList.innerHTML = "";

        if (activeCategories.length === 0) {
            categoriesList.textContent = "No categories available";
            return;
        }

        activeCategories.forEach(category => {
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            const name = document.createElement("span");

            checkbox.type = "checkbox";
            checkbox.value = category.id;
            checkbox.className = "category-checkbox";

            name.textContent = category.name;

            label.append(checkbox, name);
            categoriesList.appendChild(label);
        });

    } catch (error) {
        console.error(error);
        categoriesList.textContent = "Unable to load categories";
    }
}

function renderProducts(products) {
    productsGrid.innerHTML = "";

    productsCount.textContent = `${products.length} products`;

    if (products.length === 0) {
        productsGrid.textContent = "No products available";
        return;
    }

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";

        const imageContainer = document.createElement("div");
        imageContainer.className = "product-image";

        const image = document.createElement("img");

        image.src = product.image_url
            ? new URL("../" + product.image_url.replace(/^\.?\//, ""), location.href).href
            : "";

        image.alt = product.name;

        const badge = document.createElement("span");
        badge.className = "product-badge";
        badge.textContent = "New season";

        const wishlist = document.createElement("button");
        wishlist.className = "wishlist-btn";
        wishlist.type = "button";
        wishlist.setAttribute("aria-label", `Add ${product.name} to wishlist`);
        wishlist.innerHTML = '<i class="fa-regular fa-heart"></i>';

        const quickView = document.createElement("button");
        quickView.className = "quick-view";
        quickView.type = "button";
        quickView.textContent = "Quick view +";

        imageContainer.append(image, badge, wishlist, quickView);

        const info = document.createElement("div");
        info.className = "product-info";

        const name = document.createElement("h3");
        name.textContent = product.name;

        const price = document.createElement("p");
        price.className = "product-price";
        price.textContent = `JOD ${Number(product.price).toFixed(2)}`;

        info.append(name, price);

        card.append(imageContainer, info);
        productsGrid.appendChild(card);
    });
}

async function loadProducts() {
    productsGrid.textContent = "Loading products...";

    try {
        const response = await fetch(PRODUCTS_API);

        if (!response.ok) {
            throw new Error("Failed to load products");
        }

        const products = await response.json();

        if (!Array.isArray(products)) {
            throw new Error("Invalid products data");
        }

        allProducts = products.filter(product =>
            product.is_active == 1
        );

        filterProducts();

    } catch (error) {
        console.error(error);
        productsGrid.textContent = "Unable to load products";
        productsCount.textContent = "0 products";
    }
}

function filterProducts() {
    const selectedCategories = [
        ...document.querySelectorAll(".category-checkbox:checked")
    ].map(checkbox => checkbox.value);

    const searchValue = searchInput.value.trim().toLowerCase();

    const filteredProducts = allProducts.filter(product => {
        const matchesCategory =
            selectedCategories.length === 0 ||
            selectedCategories.includes(String(product.category_id));

        const matchesSearch = product.name
            .toLowerCase()
            .includes(searchValue);

        return matchesCategory && matchesSearch;
    });

    renderProducts(filteredProducts);
}

categoriesList.addEventListener("change", filterProducts);
searchInput.addEventListener("input", filterProducts);

loadCategories();
loadProducts();