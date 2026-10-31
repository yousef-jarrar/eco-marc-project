import {getAllCategories, getCategoryProducts, createCategory, updateCategory} from "./services/categories-services.js?v=20261029-mergefix";

const grid = document.getElementById("categoriesTableBody");
const searchInput = document.getElementById("searchCategory");
const statusFilter = document.getElementById("categoryStatusFilter");
const sortInput = document.getElementById("categorySort");
const hiddenStorageKey = "eco-marc-hidden-categories";
let hiddenCategoryIds = new Set();
try { hiddenCategoryIds = new Set((localStorage.getItem(hiddenStorageKey) || "").split(",").filter(id => /^[1-9]\d*$/.test(id))); } catch (error) {}
let categories = [];
let changingCategory = false;
let loadVersion = 0;
const categoryProducts = new Map();

function safeImage(value) {
    if (!value) return "";
    try { const url = new URL(value, document.baseURI); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch (error) { return ""; }
}

function setCategoryBusy(busy) {
    changingCategory = busy;
    grid.setAttribute("aria-busy", String(busy));
    document.querySelectorAll(".category-heading-actions button,.category-toolbar input,.category-toolbar select,.category-toolbar button,.category-hidden-note button,.category-card button,#retryCategoriesBtn").forEach(control => control.disabled = busy);
}

function updateSummary() {
    document.getElementById("categoryTotal").textContent = categories.length;
    document.getElementById("categoryActive").textContent = categories.filter(category => category.status === "active").length;
    document.getElementById("categoryMissingImages").textContent = categories.filter(category => !category.image_url).length;
    const hidden = categories.filter(category => hiddenCategoryIds.has(String(category.id))).length;
    document.getElementById("categoryHiddenNote").hidden = hidden === 0;
    document.getElementById("categoryHiddenCount").textContent = hidden + (hidden === 1 ? " category" : " categories");
}

function button(icon, label, action) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "secondary";
    element.innerHTML = fa(icon);
    const text = document.createElement("span");
    text.textContent = label;
    element.appendChild(text);
    element.disabled = changingCategory;
    element.addEventListener("click", action);
    return element;
}

function showFilteredCategories() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = categories.filter(category => !hiddenCategoryIds.has(String(category.id)) && (category.name + " " + category.id).toLowerCase().includes(query) && (!statusFilter.value || category.status === statusFilter.value));
    filtered.sort((a, b) => sortInput.value === "name" ? a.name.localeCompare(b.name) : Number(b.id) - Number(a.id));
    grid.replaceChildren();
    document.getElementById("categoryResultCount").textContent = filtered.length + " of " + categories.length + " categories";
    if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "category-empty";
        empty.innerHTML = fa("layer-group") + "<h3>" + (categories.length ? "No categories in this view" : "Start your collection") + "</h3><p>" + (categories.length ? "Try a different search, reset the filters or restore hidden categories." : "Add your first category to organize your products.") + "</p>";
        grid.appendChild(empty);
    }
    for (const category of filtered) {
        const card = document.createElement("article");
        card.className = "category-card";
        card.dataset.categoryId = category.id;
        const active = category.status === "active";
        card.innerHTML = '<div class="category-cover"><span class="category-cover-placeholder">' + fa("image") + '<span>No category image</span></span><span class="category-status ' + (active ? "is-active" : "is-inactive") + '">' + (active ? "Active" : "Inactive") + '</span></div><div class="category-card-info"><div><h3></h3><span class="category-id"></span></div><button class="category-products-button" type="button"><span data-product-count>Loading…</span>' + fa("arrow-right") + '</button></div><div class="category-card-actions"></div>';
        const cover = card.querySelector(".category-cover");
        const url = safeImage(category.image_url);
        if (url) {
            const image = document.createElement("img");
            image.src = url;
            image.alt = "";
            image.loading = "lazy";
            cover.querySelector(".category-cover-placeholder").hidden = true;
            image.addEventListener("error", () => {image.hidden = true; cover.querySelector(".category-cover-placeholder").hidden = false;});
            cover.appendChild(image);
        }
        card.querySelector("h3").textContent = category.name;
        card.querySelector(".category-id").textContent = "Category #" + category.id;
        const productsButton = card.querySelector(".category-products-button");
        productsButton.setAttribute("aria-label", "View products in " + category.name);
        productsButton.disabled = changingCategory;
        productsButton.addEventListener("click", () => showCategoryProducts(category));
        const cached = categoryProducts.get(String(category.id));
        card.querySelector("[data-product-count]").textContent = cached ? cached.length + (cached.length === 1 ? " product" : " products") : cached === null ? "View products" : "Loading…";
        const actions = card.querySelector(".category-card-actions");
        actions.appendChild(button("pen", "Edit", () => openCategoryForm(category)));
        actions.appendChild(button(active ? "pause" : "play", active ? "Deactivate" : "Activate", () => changeCategoryStatus(category)));
        const hide = button("eye-slash", "", () => hideCategory(category));
        hide.classList.add("category-hide-button");
        hide.title = "Hide on this browser";
        hide.setAttribute("aria-label", "Hide " + category.name + " on this browser");
        actions.appendChild(hide);
        grid.appendChild(card);
    }
    updateSummary();
}

async function loadCategories() {
    const version = ++loadVersion;
    setCategoryBusy(true);
    document.getElementById("categoriesError").hidden = true;
    try {
        categories = await getAllCategories();
        categoryProducts.clear();
        showFilteredCategories();
        document.getElementById("categoriesUpdated").textContent = "Updated " + new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
        const queue = [...categories];
        await Promise.all(Array.from({length: Math.min(3, queue.length)}, async () => {
            while (queue.length && version === loadVersion) {
                const category = queue.shift();
                let products = null;
                try { const result = await getCategoryProducts(category.id); if (Array.isArray(result)) products = result; } catch (error) {}
                if (version !== loadVersion) return;
                categoryProducts.set(String(category.id), products);
                const card = [...grid.querySelectorAll("[data-category-id]")].find(element => element.dataset.categoryId === String(category.id));
                if (card) card.querySelector("[data-product-count]").textContent = products ? products.length + (products.length === 1 ? " product" : " products") : "View products";
            }
        }));
    } catch (error) {
        document.getElementById("categoriesErrorText").textContent = error.message;
        document.getElementById("categoriesError").hidden = false;
        if (!categories.length) {
            grid.innerHTML = '<div class="category-empty">' + fa("cloud-arrow-down") + '<h3>Categories could not load</h3><p>Retry the connection above to continue.</p></div>';
            document.getElementById("categoryResultCount").textContent = "Unavailable";
        }
    } finally { setCategoryBusy(false); }
}

async function showCategoryProducts(category) {
    if (changingCategory) return;
    setCategoryBusy(true);
    try {
        const products = categoryProducts.get(String(category.id)) || await getCategoryProducts(category.id);
        if (!Array.isArray(products)) throw new Error("Products could not load. Please retry.");
        categoryProducts.set(String(category.id), products);
        const content = products.length ? '<div class="category-product-records">' + products.map(product => '<a href="ProductDetails.html?id=' + encodeURIComponent(product.id) + '"><span><strong>' + escapeHTML(product.name) + '</strong><small>Product #' + escapeHTML(product.id) + '</small></span>' + fa("arrow-up-right-from-square") + '</a>').join("") + '</div>' : '<div class="category-empty">' + fa("box-open") + '<h3>No products yet</h3><p>Assign products to this category from the Products page.</p></div>';
        await Alerts.show(category.name, "", "info", {icon: undefined, html: content, width: 620, customClass: {popup: "category-products-dialog"}});
    } catch (error) { Alerts.show("Products unavailable", error.message, "error"); }
    finally { setCategoryBusy(false); }
}

async function openCategoryForm(category = null) {
    if (changingCategory) return;
    setCategoryBusy(true);
    const image = safeImage(category?.image_url);
    let selectedFile = null;
    let previewUrl = null;
    const fields = '<div class="category-alert-form"><p class="category-editor-intro">' + (category ? "Update the name, image and saved status of this category." : "Create a category your collection can grow into.") + '</p><div class="category-editor-fields"><div><label for="categoryName">Category name</label><input id="categoryName" maxlength="100" placeholder="e.g. Footwear" value="' + escapeHTML(category?.name || "") + '"><span id="categoryNameCount" class="category-field-hint"></span></div><div><label for="categoryStatus">Status</label><select id="categoryStatus"><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div><div class="category-image-heading"><label for="categoryImageFile">Category image <span>Optional</span></label><span>JPG, PNG, WEBP or GIF · Up to 5MB</span></div><div class="category-dropzone" id="categoryDropzone"><div class="category-preview-wrap"><img id="categoryImagePreview" alt="Category image preview" hidden><span id="categoryImageEmpty">' + fa("image") + '<span>Add an image to represent this category</span></span></div><label class="category-upload-button" for="categoryImageFile">' + fa("arrow-up-from-bracket") + ' Choose image<input id="categoryImageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><p>or drop an image here</p></div><p id="categoryImageError" class="category-image-error" role="alert" hidden></p><p id="categoryImageStatus" class="category-image-status" aria-live="polite"></p><div class="category-image-controls"><label id="categoryRemoveControl" class="category-remove-image" hidden><input id="categoryRemoveImage" type="checkbox"> Remove image when saving</label><button id="categoryImageRestore" type="button" class="secondary" hidden>Keep current image</button></div></div>';
    try {
        const dialog = Alerts.form(category ? "Edit category" : "Add category", fields, async () => {
            const name = document.getElementById("categoryName").value.trim();
            if (!name) { Alerts.validation("Enter the category name."); document.getElementById("categoryName").focus(); return false; }
            const status = document.getElementById("categoryStatus").value;
            const remove = document.getElementById("categoryRemoveImage").checked;
            try {
                if (category) return await updateCategory(category.id, name, remove ? "" : category.image_url || "", selectedFile, status);
                return await createCategory(name, "", selectedFile, status);
            } catch (error) { Alerts.validation(error.message); return false; }
        }, {width: 660, customClass: {popup: "category-editor"}, showCloseButton: true, closeButtonAriaLabel: "Close category editor", confirmButtonText: category ? "Save changes" : "Create category"});
        const fileInput = document.getElementById("categoryImageFile");
        const remove = document.getElementById("categoryRemoveImage");
        const preview = document.getElementById("categoryImagePreview");
        const restore = document.getElementById("categoryImageRestore");
        const imageError = document.getElementById("categoryImageError");
        const dropzone = document.getElementById("categoryDropzone");
        document.getElementById("categoryStatus").value = category?.status === "inactive" ? "inactive" : "active";
        function showPreview() {
            if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
            let url = remove.checked ? "" : image;
            if (selectedFile && !remove.checked) { previewUrl = URL.createObjectURL(selectedFile); url = previewUrl; }
            preview.hidden = !url;
            document.getElementById("categoryImageEmpty").hidden = Boolean(url);
            if (url) preview.src = url; else preview.removeAttribute("src");
            document.getElementById("categoryImageStatus").textContent = remove.checked ? "The image will be removed when saved." : selectedFile ? selectedFile.name + " · " + Math.ceil(selectedFile.size / 1024) + " KB · Ready to upload when saved" : image ? "Current image. Choose a replacement or keep it as it is." : "An image is optional. You can add one later.";
            document.getElementById("categoryRemoveControl").hidden = !image && !selectedFile && !remove.checked;
            restore.hidden = !image || (!selectedFile && !remove.checked);
        }
        function chooseFile(file) {
            if (!file) return;
            if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
                imageError.textContent = "Choose a JPG, PNG, WEBP or GIF image of 5MB or less.";
                imageError.hidden = false;
                fileInput.value = "";
                return;
            }
            imageError.hidden = true;
            selectedFile = file;
            remove.checked = false;
            showPreview();
        }
        fileInput.addEventListener("change", () => chooseFile(fileInput.files[0]));
        dropzone.addEventListener("dragover", event => {event.preventDefault(); dropzone.classList.add("is-dragging");});
        dropzone.addEventListener("dragleave", event => {if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove("is-dragging");});
        dropzone.addEventListener("drop", event => {event.preventDefault(); dropzone.classList.remove("is-dragging"); chooseFile(event.dataTransfer.files[0]);});
        remove.addEventListener("change", () => {if (remove.checked) {selectedFile = null; fileInput.value = "";} imageError.hidden = true; showPreview();});
        restore.addEventListener("click", () => {selectedFile = null; fileInput.value = ""; remove.checked = false; imageError.hidden = true; showPreview();});
        preview.addEventListener("error", () => {preview.hidden = true; document.getElementById("categoryImageEmpty").hidden = false;});
        const nameInput = document.getElementById("categoryName");
        const updateCount = () => { document.getElementById("categoryNameCount").textContent = nameInput.value.length + " / 100 characters"; if (nameInput.value.trim()) Swal.resetValidationMessage(); };
        nameInput.addEventListener("input", updateCount);
        updateCount();
        showPreview();
        const result = await dialog;
        if (result.isConfirmed) { Alerts.toast(category ? "Category updated" : "Category created"); await loadCategories(); }
    } finally {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setCategoryBusy(false);
    }
}

async function changeCategoryStatus(category) {
    if (changingCategory) return;
    const active = category.status !== "active";
    setCategoryBusy(true);
    try {
        const confirmation = await Alerts.confirm(active ? "Activate this category?" : "Deactivate this category?", 'Change the saved status of "' + category.name + '" to ' + (active ? "active" : "inactive") + '?');
        if (!confirmation.isConfirmed) return;
        await updateCategory(category.id, category.name, category.image_url || "", null, active ? "active" : "inactive");
        Alerts.toast(active ? "Category activated" : "Category deactivated");
        await loadCategories();
    } catch (error) { Alerts.show("Category was not changed", error.message, "error"); }
    finally { setCategoryBusy(false); }
}

async function hideCategory(category) {
    if (changingCategory) return;
    setCategoryBusy(true);
    try {
        const result = await Alerts.confirm("Hide on this browser?", category.name + " will be hidden in this browser’s category list. Its saved status and products will stay the same.");
        if (!result.isConfirmed) return;
        const next = new Set(hiddenCategoryIds);
        next.add(String(category.id));
        localStorage.setItem(hiddenStorageKey, [...next].join(","));
        hiddenCategoryIds = next;
        showFilteredCategories();
        Alerts.toast("Category hidden on this browser");
    } catch (error) { Alerts.show("Could not hide category", "Browser storage is unavailable. Please retry.", "error"); }
    finally { setCategoryBusy(false); }
}

document.getElementById("restore-hidden-categories").addEventListener("click", () => {
    try { localStorage.removeItem(hiddenStorageKey); hiddenCategoryIds.clear(); showFilteredCategories(); Alerts.toast("Hidden categories restored"); }
    catch (error) { Alerts.show("Could not restore categories", "Browser storage is unavailable. Please retry.", "error"); }
});
for (const input of [searchInput, statusFilter, sortInput]) input.addEventListener(input === searchInput ? "input" : "change", showFilteredCategories);
document.getElementById("clearCategoryFilters").addEventListener("click", () => {searchInput.value = ""; statusFilter.value = ""; sortInput.value = "newest"; showFilteredCategories();});
document.querySelectorAll("[data-category-view]").forEach(button => button.addEventListener("click", () => {
    grid.classList.toggle("is-list", button.dataset.categoryView === "list");
    document.querySelectorAll("[data-category-view]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
}));
document.getElementById("addCategoryBtn").addEventListener("click", () => openCategoryForm());
document.getElementById("refreshCategoriesBtn").addEventListener("click", loadCategories);
document.getElementById("retryCategoriesBtn").addEventListener("click", loadCategories);
loadCategories();
