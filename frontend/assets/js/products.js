
      

        async function getJson(url, options = {}) {
            const response = await EcoAuth.fetch(url, options);
            const responseText = await response.text();

            let data;

// --------------------------------------------------
// API
// --------------------------------------------------

const PRODUCTS_API = "../../backend/api/Products.php";
const CATEGORIES_API = "../../backend/api/categories.php";
const DISCOUNTS_API = "../../backend/api/Discounts.php";

const IMAGE_BASE_PATH = "../../";

// --------------------------------------------------
// HTML Elements
// --------------------------------------------------

const productsTableBody = document.getElementById("productsTableBody");
const productForm = document.getElementById("productForm");
const productModal = document.getElementById("productModal");
const variantsContainer = document.getElementById("variantsContainer");
const tableMessage = document.getElementById("tableMessage");
const formMessage = document.getElementById("formMessage");
const productImagesInput = document.getElementById("productImages");

const productCategorySelect = document.getElementById("productCategory");
const productDiscountSelect = document.getElementById("productDiscount");

const filterProduct = document.getElementById("filterProduct");
const filterCategory = document.getElementById("filterCategory");
const filterColor = document.getElementById("filterColor");
const filterSize = document.getElementById("filterSize");

// --------------------------------------------------
// Data
// --------------------------------------------------

let products = [];
let categories = [];
let discounts = [];

let currentPage = 1;
const pageSize = 4;

let existingImages = [];
let selectedImages = [];
let isSaving = false;

// Default choices for new variants.
// Existing database values are added automatically.

const DEFAULT_COLORS = [
    "Beige",
    "Black",
    "Blue",
    "Brown",
    "Burgundy",
    "Charcoal",
    "Cream",
    "Dark Blue",
    "Dark Green",
    "Gold",
    "Gray",
    "Green",
    "Grey",
    "Light Blue",
    "Light Green",
    "Maroon",
    "Navy",
    "Olive",
    "Orange",
    "Pink",
    "Purple",
    "Red",
    "Silver",
    "Teal",
    "Turquoise",
    "White",
    "Yellow"
];

const DEFAULT_SIZES = [
    "XS", "S", "M", "L", "XL", "XXL", "XXXL",
    "34", "35", "36", "37", "38", "39", "40",
    "41", "42", "43", "44", "45", "46", "47",
    "48", "50", "52", "54"
];

// --------------------------------------------------
// API Helpers
// --------------------------------------------------

async function getJson(url, options = {}) {
    const response = await fetch(url, options);
    const responseText = await response.text();

    let data;

    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
        throw new Error(
            "The server returned an invalid response. Check your PHP API."
        );
    }

    if (!response.ok) {
        throw new Error(
            data.message || data.error || "Request failed."
        );
    }

    if (
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        data.success === false
    ) {
        throw new Error(
            data.message || data.error || "The operation failed."
        );
    }

    return data;
}

function getArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.products)) return data.products;
    if (Array.isArray(data.categories)) return data.categories;
    if (Array.isArray(data.discounts)) return data.discounts;

    return [];
}

// --------------------------------------------------
// Messages
// --------------------------------------------------

function showMessage(element, message, type = "success") {
    element.textContent = message;
    element.className = "message show " + type;
}

function hideMessage(element) {
    element.textContent = "";
    element.className = "message";
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[char];
    });
}

function quantityOf(product) {
    return Number(product.quantity) || 0;
}

function getProductImages(product) {
    let images = product.images ?? product.image ?? [];

    if (typeof images === "string") {
        try {
            images = JSON.parse(images);
        } catch (error) {
            images = images ? [images] : [];
        }
    }

    if (!Array.isArray(images)) {
        images = images ? [images] : [];
    }

    return images.map(function (image) {
        if (typeof image === "string") {
            return image;
        }

        return image.image_url ||
            image.image_path ||
            image.url ||
            image.path ||
            "";
    }).filter(Boolean);
}

function imageUrl(path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("data:")) return path;

    return IMAGE_BASE_PATH + String(path).replace(/^\/+/, "");
}

function getCategoryId(product) {
    return product.category_id ?? product.categoryId ?? "";
}

function getCategoryName(product) {
    if (product.category_name) {
        return product.category_name;
    }

    const categoryId = getCategoryId(product);

    const category = categories.find(function (item) {
        return String(item.id) === String(categoryId);
    });

    return category ? category.name : "—";
}

function getVariants(product) {
    let variants = product.variants ?? [];

    if (typeof variants === "string") {
        try {
            variants = JSON.parse(variants);
        } catch (error) {
            variants = [];
        }
    }

    return Array.isArray(variants) ? variants : [];
}

// --------------------------------------------------
// Dropdown Helpers
// --------------------------------------------------

function fillSelect(
    select,
    placeholder,
    values,
    selectedValue = ""
) {
    select.innerHTML = "";

    const firstOption = document.createElement("option");
    firstOption.value = "";
    firstOption.textContent = placeholder;

    select.appendChild(firstOption);

    values.forEach(function (value) {
        const option = document.createElement("option");

        option.value = String(value);
        option.textContent = String(value);

        select.appendChild(option);
    });

    const selectedExists = Array.from(select.options).some(
        function (option) {
            return option.value === String(selectedValue);
        }
    );

    if (selectedExists) {
        select.value = String(selectedValue);
    } else {
        select.value = "";
    }
}

function getAllVariantColors() {
    const existingColors = products.flatMap(function (product) {
        return getVariants(product).map(function (variant) {
            return String(variant.color ?? "").trim();
        });
    });

    const colors = [
        ...DEFAULT_COLORS,
        ...existingColors
    ].filter(Boolean);

    const uniqueColors = new Map();

    colors.forEach(function (color) {
        const key = color.toLowerCase();

        if (!uniqueColors.has(key)) {
            uniqueColors.set(key, color);
        }
    });

    return Array.from(uniqueColors.values()).sort(
        function (a, b) {
            return a.localeCompare(b);
        }
    );
}

function getAllVariantSizes() {
    const existingSizes = products.flatMap(function (product) {
        return getVariants(product).map(function (variant) {
            return String(variant.size ?? "").trim();
        });
    });

    const sizes = [
        ...DEFAULT_SIZES,
        ...existingSizes
    ].filter(Boolean);

    const uniqueSizes = new Map();

    sizes.forEach(function (size) {
        const key = size.toLowerCase();

        if (!uniqueSizes.has(key)) {
            uniqueSizes.set(key, size);
        }
    });

    return Array.from(uniqueSizes.values()).sort(
        function (a, b) {
            return a.localeCompare(b, undefined, {
                numeric: true
            });
        }
    );
}

// --------------------------------------------------
// Load Categories
// --------------------------------------------------

async function loadCategories() {
    const data = await getJson(CATEGORIES_API);

    categories = getArray(data);

    const selectedProductCategory = productCategorySelect.value;
    const selectedFilterCategory = filterCategory.value;

    fillSelect(
        productCategorySelect,
        "Select category",
        categories.map(function (category) {
            return category.id;
        })
    );

    // Display category names instead of IDs.
    Array.from(productCategorySelect.options).forEach(
        function (option) {
            if (!option.value) return;

            const category = categories.find(function (item) {
                return String(item.id) === option.value;
            });

            if (category) {
                option.textContent = category.name;
            }
        }
    );

    filterCategory.innerHTML = "";

    const allCategoriesOption = document.createElement("option");
    allCategoriesOption.value = "";
    allCategoriesOption.textContent = "All Categories";

    filterCategory.appendChild(allCategoriesOption);

    categories.forEach(function (category) {
        const option = document.createElement("option");

        option.value = category.id;
        option.textContent = category.name;

        filterCategory.appendChild(option);
    });

    productCategorySelect.value = selectedProductCategory;
    filterCategory.value = selectedFilterCategory;
}

// --------------------------------------------------
// Load Discounts
// --------------------------------------------------

async function loadDiscounts() {
    productDiscountSelect.innerHTML =
        '<option value="">No discount</option>';

    try {
        const data = await getJson(DISCOUNTS_API);

        discounts = getArray(data);

        discounts.forEach(function (discount) {
            const option = document.createElement("option");

            option.value = discount.id;

            option.textContent =
                discount.name ||
                discount.title ||
                ("Discount #" + discount.id);

            productDiscountSelect.appendChild(option);
        });
    } catch (error) {
        console.warn(
            "Could not load discounts:",
            error.message
        );
    }
}

// --------------------------------------------------
// Populate Color and Size Filters
// --------------------------------------------------

function populateVariantFilters() {
    const selectedColor = filterColor.value;
    const selectedSize = filterSize.value;

    fillSelect(
        filterColor,
        "All Colors",
        getAllVariantColors(),
        selectedColor
    );

    fillSelect(
        filterSize,
        "All Sizes",
        getAllVariantSizes(),
        selectedSize
    );
}

// --------------------------------------------------
// Load Products
// --------------------------------------------------

async function loadProducts() {
    productsTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                Loading products...
            </td>
        </tr>
    `;

    hideMessage(tableMessage);

    try {
        const data = await getJson(PRODUCTS_API);

        products = getArray(data);

        populateVariantFilters();

        currentPage = 1;

        renderProducts();
    } catch (error) {
        products = [];

        productsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;

        document.getElementById("paginationInfo").textContent =
            "Showing 0 products";

        document.getElementById("prevPageBtn").disabled = true;
        document.getElementById("nextPageBtn").disabled = true;

        showMessage(tableMessage, error.message, "error");
    }
}

// --------------------------------------------------
// Filter Products
// --------------------------------------------------

function getFilteredProducts() {
    const productSearch = filterProduct.value.trim().toLowerCase();
    const categorySearch = filterCategory.value;
    const colorSearch = filterColor.value.trim().toLowerCase();
    const sizeSearch = filterSize.value.trim().toLowerCase();

    return products.filter(function (product) {
        const productName = String(product.name ?? "").toLowerCase();
        const productId = String(product.id ?? "").toLowerCase();

        const categoryName = String(
            getCategoryName(product)
        ).toLowerCase();

        const categoryId = String(
            getCategoryId(product)
        );

        const variants = getVariants(product);

        const matchesProduct =
            !productSearch ||
            productName.includes(productSearch) ||
            productId.includes(productSearch);

        const matchesCategory =
            !categorySearch ||
            categoryId === categorySearch;

        const matchesColor =
            !colorSearch ||
            variants.some(function (variant) {
                return String(variant.color ?? "")
                    .trim()
                    .toLowerCase() === colorSearch;
            });

        const matchesSize =
            !sizeSearch ||
            variants.some(function (variant) {
                return String(variant.size ?? "")
                    .trim()
                    .toLowerCase() === sizeSearch;
            });

        return matchesProduct &&
            matchesCategory &&
            matchesColor &&
            matchesSize;
    });
}

// --------------------------------------------------
// Render Products
// --------------------------------------------------

function renderProducts() {
    const filteredProducts = getFilteredProducts();

    const totalPages = Math.max(
        1,
        Math.ceil(filteredProducts.length / pageSize)
    );

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const start = (currentPage - 1) * pageSize;

    const pageProducts = filteredProducts.slice(
        start,
        start + pageSize
    );

    if (pageProducts.length === 0) {
        productsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No products found matching your filters.
                </td>
            </tr>
        `;
    } else {
        productsTableBody.innerHTML = pageProducts.map(
            function (product) {
                const images = getProductImages(product);

                const firstImage = images.length
                    ? imageUrl(images[0])
                    : "";

                const variants = getVariants(product);

                return `
                    <tr>
                        <td>
                            <div class="product-cell">
                                ${
                                    firstImage
                                        ? `
                                            <img
                                                class="product-image"
                                                src="${escapeHtml(firstImage)}"
                                                alt="${escapeHtml(product.name)}"
                                            >
                                        `
                                        : `
                                            <div class="product-image"></div>
                                        `
                                }

                                <div>
                                    <div class="product-name">
                                        ${escapeHtml(product.name)}
                                    </div>

                                    <div class="product-id">
                                        ID: ${escapeHtml(product.id)}
                                    </div>
                                </div>
                            </div>
                        </td>

                        <td>
                            ${escapeHtml(getCategoryName(product))}
                        </td>

                        <td>
                            ${Number(product.price || 0).toFixed(2)}
                        </td>

                        <td>
                            ${quantityOf(product)}
                        </td>

                        <td>
                            ${variants.length}
                        </td>

                        <td>
                            <div class="actions">
                                <button
                                    type="button"
                                    class="action-btn view-btn"
                                    data-action="view"
                                    data-id="${escapeHtml(product.id)}"
                                    aria-label="View product"
                                >
                                    <i class="fa-regular fa-eye"></i>
                                </button>

                                <button
                                    type="button"
                                    class="action-btn"
                                    data-action="edit"
                                    data-id="${escapeHtml(product.id)}"
                                    aria-label="Edit product"
                                >
                                    <i class="fa-solid fa-pen"></i>
                                </button>

                                <button
                                    type="button"
                                    class="action-btn"
                                    data-action="delete"
                                    data-id="${escapeHtml(product.id)}"
                                    aria-label="Delete product"
                                >
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        ).join("");

            const firstItem = filteredProducts.length
                ? start + 1
                : 0;

            const lastItem = Math.min(
                start + pageSize,
                filteredProducts.length
            );

            document.getElementById("paginationInfo").textContent =
                `Showing ${firstItem}-${lastItem} of ${filteredProducts.length} products`;

            document.getElementById("prevPageBtn").disabled =
                currentPage <= 1;

            document.getElementById("nextPageBtn").disabled =
                currentPage >= totalPages;
        }

        // --------------------------------------------------
        // Variants
        // --------------------------------------------------

        function readVariants() {
            const rows =
                variantsContainer.querySelectorAll(".variant-row");

            return Array.from(rows).map(function (row) {
                return {
                    size: row.querySelector(".variant-size").value,
                    color: row.querySelector(".variant-color").value.trim().toLowerCase(),
                    quantity: Number(
                        row.querySelector(".variant-quantity").value
                    )
                };
            });
    }

    const firstItem = filteredProducts.length ? start + 1 : 0;

    const lastItem = Math.min(
        start + pageSize,
        filteredProducts.length
    );

    document.getElementById("paginationInfo").textContent =
        `Showing ${firstItem}-${lastItem} of ${filteredProducts.length} products`;

    document.getElementById("prevPageBtn").disabled =
        currentPage <= 1;

    document.getElementById("nextPageBtn").disabled =
        currentPage >= totalPages;
}

// --------------------------------------------------
// Variants
// --------------------------------------------------

function readVariants() {
    const rows = variantsContainer.querySelectorAll(".variant-row");

    return Array.from(rows).map(function (row) {
        return {
            size: row.querySelector(".variant-size").value,
            color: row.querySelector(".variant-color").value.trim(),
            quantity: Number(
                row.querySelector(".variant-quantity").value
            )
        };
    });
}

function updateTotalVariantQuantity() {
    const variants = readVariants();

    const totalVariants = variants.reduce(
        function (total, variant) {
            return total + (Number(variant.quantity) || 0);
        },
        0
    );

    const quantityInput = document.getElementById("productQuantity");

    const productQuantity = quantityInput.value.trim() === ""
        ? 0
        : Number(quantityInput.value);

    const summary = document.getElementById("stockSummary");

    document.getElementById("totalVariantQuantity").textContent =
        `${totalVariants} / ${productQuantity}`;

    summary.classList.remove("match", "mismatch");

    if (quantityInput.value.trim() !== "") {
        if (
            Number.isInteger(productQuantity) &&
            productQuantity >= 0 &&
            totalVariants === productQuantity
        ) {
            summary.classList.add("match");
        } else {
            summary.classList.add("mismatch");
        }

        function updateTotalVariantQuantity() {
            const variants = readVariants();

            const totalVariants = variants.reduce(
                function (total, variant) {
                    return total + (
                        Number(variant.quantity) || 0
                    );
                },
                0
            );

            const quantityInput =
                document.getElementById("productQuantity");

            const productQuantity =
                quantityInput.value.trim() === ""
                    ? 0
                    : Number(quantityInput.value);

            const summary =
                document.getElementById("stockSummary");

            document.getElementById(
                "totalVariantQuantity"
            ).textContent = `${totalVariants} / ${productQuantity}`;

            summary.classList.remove("match", "mismatch");

            if (quantityInput.value.trim() !== "") {
                if (
                    Number.isInteger(productQuantity) &&
                    productQuantity >= 0 &&
                    totalVariants === productQuantity
                ) {
                    summary.classList.add("match");
                } else {
                    summary.classList.add("mismatch");
                }
            }
        }

        function addVariantRow(variant = {}) {
            const row = document.createElement("div");

            row.className = "variant-row";

            const sizeOptions = [
                "XS", "S", "M", "L", "XL", "XXL",
                "36", "37", "38", "39", "40", "41",
                "42", "43", "44", "45", "46", "ONE_SIZE"
            ];

            const size = String(variant.size ?? "");
            const color = String(variant.color ?? "");

            const quantity =
                Number(variant.quantity ?? 0);

            const allSizes = [...new Set([
                ...sizeOptions,
                ...(size ? [size] : [])
            ])];

            const optionsHtml = allSizes.map(function (option) {
                return `
                    <option
                        value="${escapeHtml(option)}"
                        ${option === size ? "selected" : ""}
                    >
                        ${escapeHtml(option)}
                    </option>
                `;
            }).join("");

            row.innerHTML = `
                <div class="form-group">
                    <label>Size *</label>

                    <select class="field variant-size" required>
                        <option value="">Select size</option>
                        ${optionsHtml}
                    </select>
                </div>

                <div class="form-group">
                    <label>Color *</label>

                    <input
                        type="text"
                        class="field variant-color"
                        value="${escapeHtml(color)}"
                        placeholder="e.g. Black"
                        required
                    >
                </div>

                <div class="form-group">
                    <label>Quantity *</label>

                    <input
                        type="number"
                        class="field variant-quantity"
                        value="${quantity}"
                        min="0"
                        step="1"
                        required
                    >
                </div>

                <button
                    type="button"
                    class="remove-variant"
                    title="Remove variant"
                    aria-label="Remove variant"
                >
                    &times;
                </button>
            `;

            variantsContainer.appendChild(row);

            row.querySelector(".variant-quantity").addEventListener(
                "input",
                updateTotalVariantQuantity
            );

            row.querySelector(".variant-size").addEventListener(
                "change",
                updateTotalVariantQuantity
            );

            row.querySelector(".variant-color").addEventListener(
                "input",
                updateTotalVariantQuantity
            );

            row.querySelector(".remove-variant").addEventListener(
                "click",
                function () {
                    row.remove();
                    updateTotalVariantQuantity();
                }
            );

            updateTotalVariantQuantity();
        }
    );

        function validateVariants(variants) {
            if (variants.length === 0) {
                return "Please add at least one product variant.";
            }

            const combinations = new Set();
            const allowedColors = ["black", "white", "gray", "red", "blue", "navy", "green", "yellow", "orange", "pink", "purple", "brown", "beige", "other"];

            for (const variant of variants) {
                if (!variant.size || !variant.color.trim()) {
                    return "Please select a size and enter a color for every variant.";
                }

                if (!allowedColors.includes(variant.color)) {
                    return "Use one of these colors: " + allowedColors.join(", ") + ".";
                }

                if (
                    !Number.isInteger(variant.quantity) ||
                    variant.quantity < 0
                ) {
                    return "Variant quantities must be whole numbers greater than or equal to zero.";
                }

                const combination =
                    variant.size.toLowerCase().trim() +
                    "|" +
                    variant.color.toLowerCase().trim();

function validateVariants(variants) {
    if (variants.length === 0) {
        return "Please add at least one product variant.";
    }

    const combinations = new Set();

    for (const variant of variants) {
        if (!variant.size || !variant.color.trim()) {
            return "Please select a size and color for every variant.";
        }

        if (
            !Number.isInteger(variant.quantity) ||
            variant.quantity < 0
        ) {
            return "Variant quantities must be whole numbers greater than or equal to zero.";
        }

        const combination =
            variant.size.toLowerCase().trim() +
            "|" +
            variant.color.toLowerCase().trim();

        if (combinations.has(combination)) {
            return "Each size and color combination must be unique.";
        }

        combinations.add(combination);
    }

    return "";
}

// --------------------------------------------------
// Form and Modal
// --------------------------------------------------

function resetForm() {
    productForm.reset();

    document.getElementById("productId").value = "";

    document.getElementById("modalTitle").textContent =
        "Add Product";

    document.getElementById("saveProductBtn").textContent =
        "Save Product";

    variantsContainer.innerHTML = "";

    existingImages = [];
    selectedImages = [];

    document.getElementById("imagePreview").innerHTML = "";
    productImagesInput.value = "";

    document.getElementById("totalVariantQuantity").textContent =
        "0 / 0";

    document.getElementById("stockSummary").classList.remove(
        "match",
        "mismatch"
    );

    hideMessage(formMessage);

    isSaving = false;

    document.getElementById("saveProductBtn").disabled = false;
}

function openModal() {
    productModal.classList.add("open");
}

function closeModal() {
    if (isSaving) return;

    productModal.classList.remove("open");
}

function openAddForm() {
    resetForm();

    populateVariantFilters();

    document.getElementById("modalTitle").textContent =
        "Add Product";

    addVariantRow();

    openModal();
}

function openEditForm(id) {
    const product = products.find(function (item) {
        return String(item.id) === String(id);
    });

    if (!product) {
        showMessage(tableMessage, "Product not found.", "error");
        return;
    }

    resetForm();

    document.getElementById("modalTitle").textContent =
        "Edit Product";

    document.getElementById("saveProductBtn").textContent =
        "Save Changes";

    document.getElementById("productId").value = product.id;

    document.getElementById("productName").value =
        product.name ?? "";

    productCategorySelect.value = getCategoryId(product);

    document.getElementById("productPrice").value =
        product.price ?? "";

    document.getElementById("productQuantity").value =
        quantityOf(product);

    document.getElementById("productDescription").value =
        product.description ?? "";

    productDiscountSelect.value =
        product.discount_id ?? product.discountId ?? "";

    existingImages = getProductImages(product);

    renderImagePreview();

    const variants = getVariants(product);

    variantsContainer.innerHTML = "";

    if (variants.length > 0) {
        variants.forEach(function (variant) {
            addVariantRow(variant);
        });
    } else {
        addVariantRow();
    }

    updateTotalVariantQuantity();

    openModal();
}

// --------------------------------------------------
// Images
// --------------------------------------------------

function renderImagePreview() {
    const preview = document.getElementById("imagePreview");

    const existingHtml = existingImages.map(
        function (image, index) {
            return `
                <div class="preview-item">
                    <img
                        src="${escapeHtml(imageUrl(image))}"
                        alt="Product image"
                    >

                    <button
                        type="button"
                        data-image-type="existing"
                        data-image-index="${index}"
                        title="Remove image"
                    >
                        &times;
                    </button>
                </div>
            `;
        }
    ).join("");

    const selectedHtml = selectedImages.map(
        function (file, index) {
            const localUrl = URL.createObjectURL(file);

            return `
                <div class="preview-item">
                    <img
                        src="${localUrl}"
                        alt="${escapeHtml(file.name)}"
                    >

                    <button
                        type="button"
                        data-image-type="selected"
                        data-image-index="${index}"
                        title="Remove image"
                    >
                        &times;
                    </button>
                </div>
            `;
        }
    ).join("");

    preview.innerHTML = existingHtml + selectedHtml;
}

            if (!document.getElementById("productId").value && selectedImages.length === 0) {
                showMessage(formMessage, "Upload at least one product image.", "error");
                return;
            }
            if (selectedImages.length > 5) {
                showMessage(formMessage, "Upload up to 5 images at a time.", "error");
                return;
            }
            for (const file of selectedImages) {
                if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
                    showMessage(formMessage, "Use JPG, PNG, WEBP or GIF images, each 5MB or less.", "error");
                    return;
                }
            }

            const formData = new FormData(productForm);

async function saveProduct(event) {
    event.preventDefault();

    if (isSaving) return;

    hideMessage(formMessage);

    const quantityInput = document.getElementById("productQuantity");

    const productQuantity = Number(quantityInput.value);

    const variants = readVariants();

    const variantError = validateVariants(variants);

    if (variantError) {
        showMessage(formMessage, variantError, "error");
        return;
    }

    if (
        quantityInput.value.trim() === "" ||
        !Number.isInteger(productQuantity) ||
        productQuantity < 0
    ) {
        showMessage(
            formMessage,
            "Please enter a valid total product quantity.",
            "error"
        );
        return;
    }

    const totalVariantQuantity = variants.reduce(
        function (total, variant) {
            return total + variant.quantity;
        },
        0
    );

    if (totalVariantQuantity !== productQuantity) {
        showMessage(
            formMessage,
            `Product quantity is ${productQuantity}, but variants total is ${totalVariantQuantity}. The quantities must match.`,
            "error"
        );
        return;
    }

    const priceInput = document.getElementById("productPrice");
    const price = Number(priceInput.value);

    if (
        priceInput.value.trim() === "" ||
        !Number.isFinite(price) ||
        price < 0
    ) {
        showMessage(
            formMessage,
            "Please enter a valid product price.",
            "error"
        );
        return;
    }

    if (
        !document.getElementById("productName").value.trim() ||
        !document.getElementById("productDescription").value.trim() ||
        !productCategorySelect.value
    ) {
        showMessage(
            formMessage,
            "Please fill in all required product fields.",
            "error"
        );
        return;
    }

    const formData = new FormData(productForm);

    formData.set("quantity", String(productQuantity));
    formData.set("variants", JSON.stringify(variants));

    formData.delete("images[]");

    selectedImages.forEach(function (file) {
        formData.append("images[]", file);
    });

    formData.set(
        "existing_images",
        JSON.stringify(existingImages)
    );

    const wasEditing = Boolean(
        document.getElementById("productId").value
    );

    const saveButton = document.getElementById("saveProductBtn");

    isSaving = true;

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        await getJson(PRODUCTS_API, {
            method: "POST",
            body: formData
        });

        productModal.classList.remove("open");

        resetForm();

        showMessage(
            tableMessage,
            wasEditing
                ? "Product updated successfully."
                : "Product added successfully.",
            "success"
        );

        await loadProducts();
    } catch (error) {
        showMessage(formMessage, error.message, "error");
    } finally {
        isSaving = false;

        saveButton.disabled = false;

        saveButton.textContent = wasEditing
            ? "Save Changes"
            : "Save Product";
    }
}

// --------------------------------------------------
// Delete Product
// --------------------------------------------------

async function deleteProduct(id) {
    const product = products.find(function (item) {
        return String(item.id) === String(id);
    });

    if (!product) {
        showMessage(tableMessage, "Product not found.", "error");
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to delete "${product.name}"?`
    );

    if (!confirmed) return;

    try {
        await getJson(
            PRODUCTS_API + "?id=" + encodeURIComponent(id),
            {
                method: "DELETE"
            }
        );

        showMessage(
            tableMessage,
            "Product deleted successfully.",
            "success"
        );

        await loadProducts();
    } catch (error) {
        showMessage(tableMessage, error.message, "error");
    }
}

// --------------------------------------------------
// View Product
// --------------------------------------------------

function viewProduct(id) {
    window.location.href =
        "ProductDetails.html?id=" + encodeURIComponent(id);
}

// --------------------------------------------------
// Event Listeners
// --------------------------------------------------

document.getElementById("addProductBtn").addEventListener(
    "click",
    openAddForm
);

document.getElementById("closeModalBtn").addEventListener(
    "click",
    closeModal
);

document.getElementById("cancelBtn").addEventListener(
    "click",
    closeModal
);

productModal.addEventListener("click", function (event) {
    if (event.target === productModal) {
        closeModal();
    }
});

document.getElementById("addVariantBtn").addEventListener(
    "click",
    function () {
        addVariantRow();
    }
);

document.getElementById("productQuantity").addEventListener(
    "input",
    updateTotalVariantQuantity
);

productForm.addEventListener("submit", saveProduct);

// Search and dropdown filters

filterProduct.addEventListener("input", function () {
    currentPage = 1;
    renderProducts();
});

[
    filterCategory,
    filterColor,
    filterSize
].forEach(function (filter) {
    filter.addEventListener("change", function () {
        currentPage = 1;
        renderProducts();
    });
});

// Clear filters

document.getElementById("clearFiltersBtn").addEventListener(
    "click",
    function () {
        filterProduct.value = "";
        filterCategory.value = "";
        filterColor.value = "";
        filterSize.value = "";

        currentPage = 1;

        renderProducts();
    }
);

// Previous page

document.getElementById("prevPageBtn").addEventListener(
    "click",
    function () {
        if (currentPage > 1) {
            currentPage--;
            renderProducts();
        }
    }
);

// Next page

document.getElementById("nextPageBtn").addEventListener(
    "click",
    function () {
        const totalPages = Math.max(
            1,
            Math.ceil(getFilteredProducts().length / pageSize)
        );

        if (currentPage < totalPages) {
            currentPage++;
            renderProducts();
        }
    }
);

// View / Edit / Delete

productsTableBody.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "view") {
        viewProduct(id);
    } else if (action === "edit") {
        openEditForm(id);
    } else if (action === "delete") {
        deleteProduct(id);
    }
});

// Select images

productImagesInput.addEventListener("change", function (event) {
    selectedImages = Array.from(event.target.files || []);

    renderImagePreview();
});

// Remove images

document.getElementById("imagePreview").addEventListener(
    "click",
    function (event) {
        const button = event.target.closest(
            "button[data-image-type]"
        );

        if (!button) return;

        const index = Number(button.dataset.imageIndex);

        if (button.dataset.imageType === "existing") {
            existingImages.splice(index, 1);
        } else {
            selectedImages.splice(index, 1);

            const transfer = new DataTransfer();

            selectedImages.forEach(function (file) {
                transfer.items.add(file);
            });

            productImagesInput.files = transfer.files;
        }

        renderImagePreview();
    }
);

// --------------------------------------------------
// Initialize Page
// --------------------------------------------------

async function initPage() {
    try {
        await Promise.all([
            loadCategories(),
            loadDiscounts()
        ]);
    } catch (error) {
        showMessage(tableMessage, error.message, "error");
    }

    await loadProducts();
}

initPage();
