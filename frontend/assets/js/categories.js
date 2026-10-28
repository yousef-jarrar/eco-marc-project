import {
    getAllCategories,
    getCategoryProducts,
    createCategory,
    updateCategory,
    getCategoryById,
    deleteCategory
} from "./services/categories-services.js";

console.log("Categories JS loaded successfully");

const tableBody = document.getElementById("categoriesTableBody");
const searchInput = document.getElementById("searchCategory");

const addCategoryBtn = document.getElementById("addCategoryBtn");
const categoryDialog = document.getElementById("categoryDialog");
const categoryForm = document.getElementById("categoryForm");

const categoryId = document.getElementById("categoryId");
const categoryName = document.getElementById("categoryName");
const categoryImage = document.getElementById("categoryImage");

const formTitle = document.getElementById("formTitle");
const cancelCategoryBtn = document.getElementById("cancelCategoryBtn");

let categories = [];

async function loadCategories() {
    try {
        categories = await getAllCategories();
        displayCategories(categories);
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = "";

        const row = tableBody.insertRow();
        const cell = row.insertCell();

        cell.colSpan = 4;
        cell.textContent = "Failed to load categories";
    }
}

function displayCategories(data) {
    tableBody.innerHTML = "";

    if (data.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();

        cell.colSpan = 4;
        cell.textContent = "No categories found";

        return;
    }

    data.forEach(category => {
        const row = document.createElement("tr");

        const categoryCell = document.createElement("td");
        const categoryInfo = document.createElement("div");

        categoryInfo.className = "category-info";

        if (category.image_url) {
            const img = document.createElement("img");

            img.src = category.image_url;
            img.alt = category.name;

            categoryInfo.appendChild(img);
        }

        const name = document.createElement("span");

        name.textContent = category.name;

        categoryInfo.appendChild(name);
        categoryCell.appendChild(categoryInfo);

        const productsCell = document.createElement("td");

        productsCell.textContent = "Loading...";

        getCategoryProducts(category.id)
            .then(products => {
                productsCell.textContent = Array.isArray(products)
                    ? products.length
                    : "—";
            })
            .catch(error => {
                console.error(error);
                productsCell.textContent = "—";
            });

        const statusCell = document.createElement("td");
        statusCell.textContent = "—";

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");

        actions.className = "category-actions";

        const editBtn = document.createElement("button");

        editBtn.textContent = "Edit";
        editBtn.type = "button";

        editBtn.addEventListener("click", () => {
            openEditCategory(category);
        });

        const deleteBtn = document.createElement("button");

        deleteBtn.textContent = "Delete";
        deleteBtn.type = "button";

        deleteBtn.addEventListener("click", () => {
            removeCategory(category.id);
        });

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        actionsCell.appendChild(actions);

        row.appendChild(categoryCell);
        row.appendChild(productsCell);
        row.appendChild(statusCell);
        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });
}

searchInput.addEventListener("input", () => {
    const searchValue = searchInput.value.toLowerCase();

    const filteredCategories = categories.filter(category =>
        category.name.toLowerCase().includes(searchValue)
    );

    displayCategories(filteredCategories);
});

addCategoryBtn.addEventListener("click", () => {
    categoryForm.reset();

    categoryId.value = "";
    formTitle.textContent = "Add Category";

    categoryDialog.showModal();
});

function openEditCategory(category) {
    categoryId.value = category.id;
    categoryName.value = category.name;
    categoryImage.value = category.image_url || "";

    formTitle.textContent = "Edit Category";

    categoryDialog.showModal();
}

cancelCategoryBtn.addEventListener("click", () => {
    categoryDialog.close();
});

categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = categoryId.value;
    const name = categoryName.value.trim();
    const image_url = categoryImage.value.trim();

    try {
        let result;

        if (id) {
            result = await updateCategory(id, name, image_url);
        } else {
            result = await createCategory(name, image_url);
        }

        if (result.seccses === false) {
            alert(result.massage || "Operation failed");
            return;
        }

        categoryDialog.close();

        await loadCategories();

    } catch (error) {
        console.error(error);
        alert("Something went wrong");
    }
});

async function removeCategory(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this category?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const result = await deleteCategory(id);

        if (result.seccses === false) {
            alert(result.massage || "Delete failed");
            return;
        }

        await loadCategories();

    } catch (error) {
        console.error(error);
        alert("Failed to delete category");
    }
}

loadCategories();