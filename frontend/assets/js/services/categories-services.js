const API_URL = "http://localhost/eco-marc-project/backend/api/categories.php";

export async function getAllCategories() {
    const response = await fetch(API_URL);

    if (!response.ok) {
        throw new Error("Failed to load categories");
    }

    return await response.json();
}

export async function getCategoryById(id) {
    const response = await fetch(`${API_URL}?id=${id}`);

    if (!response.ok) {
        throw new Error("Failed to load category");
    }

    return await response.json();
}

export async function getCategoryProducts(id) {
    const response = await fetch(`${API_URL}?id=${id}&action=products`);

    if (!response.ok) {
        throw new Error("Failed to load category products");
    }

    return await response.json();
}

export async function createCategory(name, image_url) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: name,
            image_url: image_url
        })
    });

    if (!response.ok) {
        throw new Error("Failed to create category");
    }

    return await response.json();
}

export async function updateCategory(id, name, image_url) {
    const response = await fetch(API_URL, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: id,
            name: name,
            image_url: image_url
        })
    });

    if (!response.ok) {
        throw new Error("Failed to update category");
    }

    return await response.json();
}

export async function deleteCategory(id) {
    const response = await fetch(API_URL, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: id
        })
    });

    if (!response.ok) {
        throw new Error("Failed to delete category");
    }

    return await response.json();
}