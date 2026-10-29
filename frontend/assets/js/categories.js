import {
    getAllCategories,
    getCategoryProducts,
    createCategory,
    updateCategory,
    deleteCategory
} from "./services/categories-services.js?v=20261029-cloudinary";

const tableBody = document.getElementById("categoriesTableBody");
const searchInput = document.getElementById("searchCategory");
const addCategoryButton = document.getElementById("addCategoryBtn");
let categories = [];
let changingCategory = false;

function setCategoryBusy(busy) {
    changingCategory = busy;
    addCategoryButton.disabled = busy;
    for (const button of tableBody.querySelectorAll("button")) button.disabled = busy;
}

async function loadCategories() {
    try {
        categories = await getAllCategories();
        showFilteredCategories();
    } catch (error) {
        tableBody.innerHTML = "";
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.textContent = "Categories could not load. Refresh to retry.";
        Alerts.show("Categories are unavailable", error.message, "error");
    }
}

function displayCategories(data) {
    tableBody.innerHTML = "";
    if (data.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.textContent = "No categories found.";
        return;
    }

    for (const category of data) {
        const row = document.createElement("tr");
        const categoryCell = document.createElement("td");
        const categoryInfo = document.createElement("div");
        categoryInfo.className = "category-info";

        if (category.image_url) {
            const image = document.createElement("img");
            image.src = category.image_url;
            image.alt = category.name;
            image.addEventListener("error", function () { image.hidden = true; });
            categoryInfo.appendChild(image);
        }

        const name = document.createElement("span");
        name.textContent = category.name;
        categoryInfo.appendChild(name);
        categoryCell.appendChild(categoryInfo);

        const productsCell = document.createElement("td");
        productsCell.textContent = "Loading…";
        getCategoryProducts(category.id).then(function (products) {
            if (Array.isArray(products)) productsCell.textContent = products.length;
            else productsCell.textContent = "—";
        }).catch(function () {
            productsCell.textContent = "—";
        });

        const statusCell = document.createElement("td");
        const status = String(category.status || "").toLowerCase();
        if (status === "active" || status === "inactive") {
            const badge = document.createElement("span");
            badge.className = "category-status category-status--" + status;
            badge.textContent = status === "active" ? "Active" : "Inactive";
            statusCell.appendChild(badge);
        } else statusCell.textContent = "—";
        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "category-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.className = "category-edit-button";
        editButton.disabled = changingCategory;
        editButton.setAttribute("aria-label", "Edit " + category.name);
        editButton.addEventListener("click", function () { openCategoryForm(category); });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.className = "category-delete-button";
        deleteButton.disabled = changingCategory;
        deleteButton.setAttribute("aria-label", "Delete " + category.name);
        deleteButton.addEventListener("click", function () { removeCategory(category); });

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        actionsCell.appendChild(actions);
        row.append(categoryCell, productsCell, statusCell, actionsCell);
        tableBody.appendChild(row);
    }
}

function showFilteredCategories() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = [];
    for (const category of categories) {
        if (category.name.toLowerCase().includes(query)) filtered.push(category);
    }
    displayCategories(filtered);
}

// الصورة الحالية تبقى كما هي إلى أن يختار المستخدم استبدالها أو إزالتها.
async function openCategoryForm(category = null) {
    if (changingCategory) return;
    setCategoryBusy(true);
    let previewUrl = null;
    const image = category ? category.image_url || "" : "";
    const title = category ? "Edit category" : "Add category";
    const fields = `
        <div class="category-alert-form">
            <label for="categoryName">Category name</label>
            <input id="categoryName" type="text" maxlength="100" required value="${escapeHTML(category ? category.name : "")}">
            <div class="category-image-editor">
                <div class="category-preview-wrap">
                    <img id="categoryImagePreview" class="category-image-preview" alt="Category image preview" hidden>
                    <span id="categoryImageEmpty">No image selected</span>
                </div>
                <p id="categoryImageStatus" class="category-image-status" aria-live="polite"></p>
                <label for="categoryImageFile">${category ? "Replace image" : "Upload image"}</label>
                <input id="categoryImageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
                <small>JPG, PNG, WEBP or GIF. Maximum 5MB.</small>
                <input id="categoryImage" type="hidden" value="${escapeHTML(image)}">
                <label id="categoryRemoveControl" class="category-remove-image" hidden><input id="categoryRemoveImage" type="checkbox"> Remove image when saving</label>
                <button id="categoryImageRestore" class="category-image-restore" type="button" hidden>Keep current image</button>
            </div>
        </div>
    `;
    try {
        const dialog = Alerts.form(title, fields, async function () {
            const name = document.getElementById("categoryName").value.trim();
            const file = document.getElementById("categoryImageFile").files[0] || null;
            const remove = document.getElementById("categoryRemoveImage").checked;
            if (!name) { Alerts.validation("Enter the category name."); return false; }
            if (file && (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
                Alerts.validation("Use a JPG, PNG, WEBP or GIF image of 5MB or less."); return false;
            }
            try {
                if (category) return await updateCategory(category.id, name, remove ? "" : image, file);
                return await createCategory(name, "", file);
            } catch (error) {
                Alerts.validation(error.message);
                return false;
            }
        });
        const fileInput = document.getElementById("categoryImageFile");
        const remove = document.getElementById("categoryRemoveImage");
        const preview = document.getElementById("categoryImagePreview");
        const restore = document.getElementById("categoryImageRestore");
        const status = document.getElementById("categoryImageStatus");
        function showPreview() {
            if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
            const file = fileInput.files[0];
            let url = remove.checked ? "" : image;
            if (file && !remove.checked && /^image\//.test(file.type)) {
                previewUrl = URL.createObjectURL(file); url = previewUrl;
            }
            preview.hidden = !url;
            document.getElementById("categoryImageEmpty").hidden = Boolean(url);
            if (url) preview.src = url; else preview.removeAttribute("src");
            status.textContent = remove.checked ? "The image will be removed when you save." : file ? "New image selected. Save to replace the current image." : image ? "Current image. Leave unchanged to keep it." : "An image is optional.";
            document.getElementById("categoryRemoveControl").hidden = !image && !file && !remove.checked;
            restore.hidden = !image || (!file && !remove.checked);
        }
        fileInput.addEventListener("change", function () { remove.checked = false; showPreview(); });
        remove.addEventListener("change", function () { if (remove.checked) fileInput.value = ""; showPreview(); });
        restore.addEventListener("click", function () { fileInput.value = ""; remove.checked = false; showPreview(); });
        preview.addEventListener("error", function () {
            preview.hidden = true;
            document.getElementById("categoryImageEmpty").hidden = false;
            document.getElementById("categoryImageEmpty").textContent = "Preview unavailable";
        });
        showPreview();
        const result = await dialog;
        if (result.isConfirmed) {
            Alerts.toast(category ? "Category updated" : "Category added");
            await loadCategories();
        }
    } finally {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setCategoryBusy(false);
    }
}

async function removeCategory(category) {
    if (changingCategory) return;
    setCategoryBusy(true);
    try {
        const products = await getCategoryProducts(category.id);
        if (!Array.isArray(products)) throw new Error("Could not check this category's products. Please try again.");
        if (products.length > 0) {
            await Alerts.show("Category contains products", '"' + category.name + '" contains ' + products.length + ' product(s). Move them to another category before deleting it.', "info");
            return;
        }
        let message = "This category will be permanently removed.";
        if (category.public_id) message += " Its Cloudinary image will also be deleted if it is no longer used.";
        const answer = await Alerts.confirm('Delete "' + category.name + '"?', message);
        if (!answer.isConfirmed) return;
        await deleteCategory(category.id);
        Alerts.toast("Category deleted");
        await loadCategories();
    } catch (error) {
        await Alerts.show("Category was not deleted", error.message, "error");
    } finally { setCategoryBusy(false); }
}

searchInput.addEventListener("input", showFilteredCategories);
addCategoryButton.addEventListener("click", function () { openCategoryForm(); });
loadCategories();
