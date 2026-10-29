import {
    getAllCategories,
    getCategoryProducts,
    createCategory,
    updateCategory
} from "./services/categories-services.js";

const tableBody = document.getElementById("categoriesTableBody");
const searchInput = document.getElementById("searchCategory");
const addCategoryButton = document.getElementById("addCategoryBtn");
const hiddenCategoriesStorageKey = "eco-marc-hidden-categories";
const hiddenCategoryIds = new Set(
    (localStorage.getItem(hiddenCategoriesStorageKey) || "")
        .split(",")
        .filter(id => /^[1-9]\d*$/.test(id))
);
let categories = [];
let changingCategory = false;

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
    tableBody.replaceChildren();
    if (data.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.textContent = "No categories found.";
        return;
    }

    for (const category of data) {
        if (hiddenCategoryIds.has(String(category.id))) continue;

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
        const statusBadge=document.createElement("span");
        statusBadge.className = "status " + category.status;

       statusBadge.textContent =
       category.status === "active" ? "Active" : "Inactive";
       statusCell.appendChild(statusBadge);
       
        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "category-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", function () { openCategoryForm(category); });

        const statusButton = document.createElement("button");
        
        statusButton.type = "button";
        statusButton.textContent = "Status";
        
        statusButton.addEventListener("click", function () {
            changeCategoryStatus(category);
        });


        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function () { removeCategory(category.id); });

        actions.appendChild(editButton);
        actions.appendChild(statusButton);
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
        if (
            !hiddenCategoryIds.has(String(category.id)) &&
            category.name.toLowerCase().includes(query)
        ) {
            filtered.push(category);
        }
    }
    displayCategories(filtered);
}

// الإضافة والتعديل يستخدمان نفس نموذج SweetAlert.
async function openCategoryForm(category = null) {
    if (changingCategory) return;
    changingCategory = true;
    let title = "Add category";
    let name = "";
    let image = "";
    let status = "active";
    if (category) {
        title = "Edit category";
        name = category.name;
        image = category.image_url || "";
        status = category.status;
    }

    const fields = `
        <div class="category-alert-form">
            <label for="categoryName">Category name</label>
            <input id="categoryName" type="text" maxlength="100" required value="${escapeHTML(name)}">
            <label for="categoryImage">Image URL</label>
            <input id="categoryImage" type="url" placeholder="https://example.com/image.jpg" value="${escapeHTML(image)}">

        </div>
    `;

    try {
        const result = await Alerts.form(title, fields, async function () {
            const nameInput = document.getElementById("categoryName");
            const imageInput = document.getElementById("categoryImage");
            const categoryName = nameInput.value.trim();
            const imageUrl = imageInput.value.trim();
            

            if (categoryName === "") {
                Alerts.validation("Enter the category name.");
                return false;
            }
            if (imageUrl !== "" && (!imageInput.checkValidity() || !/^https?:\/\//i.test(imageUrl))) {
                Alerts.validation("Enter an HTTP or HTTPS image URL, or leave it empty.");
                return false;
            }

            try {
                if (category) return await updateCategory(category.id, categoryName, imageUrl, status);
                return await createCategory(categoryName, imageUrl, "active");
            } catch (error) {
                // يبقى النموذج مفتوحاً حتى لا نفقد ما كتبه المستخدم.
                Alerts.validation(error.message);
                return false;
            }
        });

        if (result.isConfirmed) {
            Alerts.toast("Category saved");
            await loadCategories();
        }
    } finally {
        changingCategory = false;
    }
}

async function changeCategoryStatus(category) {

    if (changingCategory) return;

    changingCategory = true;

    try {
        const newStatus = category.status === "active"
            ? "inactive"
            : "active";

        const title = newStatus === "active"
            ? "Activate this category?"
            : "Deactivate this category?";

        const confirmed = await Alerts.confirm(
            title,
            "Are you sure you want to change this category status?"
        );

        if (!confirmed.isConfirmed) return;

        await updateCategory(
            category.id,
            category.name,
            category.image_url || "",
            newStatus
        );

        Alerts.toast("Category status updated successfully");

        await loadCategories();

    } catch (error) {
        Alerts.show(
            "Failed to update category status",
            error.message,
            "error"
        );

    } finally {
        changingCategory = false;
    }
}


async function removeCategory(id) {
    if (changingCategory) return;
    changingCategory = true;
    try {
        const category = categories.find(item => String(item.id) === String(id));
        if (!category) return;

        const confirmed = await Alerts.confirm(
            "Hide this category from the page?",
            `${category.name} will be hidden on this browser only. Its database record and products will not change.`
        );
        if (!confirmed.isConfirmed) return;

        hiddenCategoryIds.add(String(id));
        localStorage.setItem(
            hiddenCategoriesStorageKey,
            Array.from(hiddenCategoryIds).join(",")
        );
        showFilteredCategories();
        Alerts.toast("Category hidden on this browser");
    } catch (error) {
        hiddenCategoryIds.delete(String(id));
        Alerts.show(
            "Category could not be hidden",
            error.message || "Browser storage is unavailable. The database was not changed.",
            "error"
        );
    } finally {
        changingCategory = false;
    }
}

searchInput.addEventListener("input", showFilteredCategories);
addCategoryButton.addEventListener("click", function () { openCategoryForm(); });
loadCategories();
