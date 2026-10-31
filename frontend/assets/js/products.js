"use strict";

         
        const PRODUCTS_API = AdminConfig.apiBase + "Products.php";
        const CATEGORIES_API = AdminConfig.apiBase + "categories.php";
        const DISCOUNTS_API = AdminConfig.apiBase + "discounts.php";
        const IMAGE_BASE_PATH = "../../";

         
        const productsTableBody =
            document.getElementById("productsTableBody");

        const productForm =
            document.getElementById("productForm");

        const productModal =
            document.getElementById("productModal");

        const variantsContainer =
            document.getElementById("variantsContainer");

        const tableMessage =
            document.getElementById("tableMessage");

        const formMessage =
            document.getElementById("formMessage");

        const productImagesInput =
            document.getElementById("productImages");

         
        let products = [];
        let categories = [];
        let discounts = [];

        let currentPage = 1;
        let pageSize = 10;
        let catalogLoading = false;

        let existingImages = [];
        let selectedImages = [];

        let isSaving = false;

      

        async function getJson(url, options = {}) {
            if ((options.method || "GET").toUpperCase() === "GET" && (String(url).startsWith(PRODUCTS_API) || String(url).startsWith(CATEGORIES_API))) {
                const requestUrl = new URL(url);
                requestUrl.searchParams.set("admin", "1");
                url = requestUrl.href;
            }
            const response = await EcoAuth.fetch(url, options);
            const responseText = await response.text();

            let data;

            try {
                data = responseText
                    ? JSON.parse(responseText)
                    : {};
            } catch (error) {
                throw new Error(
                    "The server returned an invalid response. Check your PHP API."
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Request failed."
                );
            }

            if (
                data &&
                typeof data === "object" &&
                !Array.isArray(data) &&
                data.success === false
            ) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "The operation failed."
                );
            }

            return data;
        }

        function getArray(data) {
            if (Array.isArray(data)) {
                return data;
            }

            if (Array.isArray(data.data)) {
                return data.data;
            }

            if (Array.isArray(data.products)) {
                return data.products;
            }

            if (Array.isArray(data.categories)) {
                return data.categories;
            }

            if (Array.isArray(data.discounts)) {
                return data.discounts;
            }

            return [];
        }

        function showMessage(element, message, type = "success") {
            element.textContent = message;
            element.className = "message show " + type;
    if (type === "error") Alerts.show("Products", message, "error");
    else Alerts.toast(message);
        }

        function hideMessage(element) {
            element.textContent = "";
            element.className = "message";
        }

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
            const variants = getVariants(product);
            return variants.length ? variants.reduce((total, variant) => total + (Number(variant.quantity) || 0), 0) : Number(product.quantity) || 0;
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

                return image.image_url
                    || image.image_path
                    || image.url
                    || image.path
                    || "";
            }).filter(Boolean);
        }

        function imageUrl(path) {
            if (!path) {
                return "";
            }

            if (/^https?:\/\//i.test(path)) {
                return path;
            }

            if (path.startsWith("data:")) {
                return path;
            }

            return IMAGE_BASE_PATH + String(path).replace(/^\/+/, "");
        }

        function getCategoryId(product) {
            return product.category_id
                ?? product.categoryId
                ?? "";
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

      

        async function loadCategories() {
            const data = await getJson(CATEGORIES_API);

            categories = getArray(data);

            const select =
                document.getElementById("productCategory");

            select.innerHTML =
                '<option value="">Select category</option>';

            categories.forEach(function (category) {
                const option = document.createElement("option");

                option.value = category.id;
                option.textContent = category.name;

                select.appendChild(option);
            });
        }

   

        async function loadDiscounts() {
            const select =
                document.getElementById("productDiscount");

            select.innerHTML =
                '<option value="">No discount</option>';

            try {
                const data = await getJson(DISCOUNTS_API);

                discounts = getArray(data);
                const pages = Number(data.pagination?.total_pages) || 1;
                for (let page = 2; page <= pages; page++) {
                    const next = await getJson(`${DISCOUNTS_API}?page=${page}`);
                    discounts.push(...getArray(next));
                }

                discounts = discounts.filter(discount => discount.type === "normal" && Number(discount.is_active) === 1);
                discounts.forEach(function (discount) {
                    const option = document.createElement("option");

                    option.value = discount.id;

                    option.textContent =
                        `${discount.name || "Discount #" + discount.id} (${Number(discount.percentage)}%)`;

                    select.appendChild(option);
                });
            } catch (error) {
                console.warn(
                    "Could not load discounts:",
                    error.message
                );
            }
        }

       

        function setCatalogBusy(busy) {
            catalogLoading = busy;
            document.querySelectorAll('.catalog-heading-actions button,.catalog-panel input,.catalog-panel select,.catalog-panel button').forEach(control => control.disabled = busy);
            document.querySelector('.catalog-panel').setAttribute('aria-busy', String(busy));
            if (!busy) {
                const pages = Math.max(1, Math.ceil(getFilteredProducts().length / pageSize));
                document.getElementById('prevPageBtn').disabled = currentPage <= 1;
                document.getElementById('nextPageBtn').disabled = currentPage >= pages;
            }
        }

        function stockState(product) {
            if (quantityOf(product) <= 0) return 'out';
            return getVariants(product).some(variant => Number(variant.quantity) <= 5) ? 'low' : 'available';
        }

        async function loadProducts() {
            if (catalogLoading) return;
            setCatalogBusy(true);
            productsTableBody.innerHTML = '<tr><td colspan="5" class="empty-state"><span class="spinner"></span><p>Loading your collection…</p></td></tr>';
            hideMessage(tableMessage);
            document.getElementById('retryProductsBtn').hidden = true;
            try {
                const data = await getJson(PRODUCTS_API);
                products = getArray(data);
                currentPage = 1;
                renderProducts();
                document.getElementById('catalogUpdated').textContent = 'Active product listings · Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
            } catch (error) {
                products = [];
                productsTableBody.innerHTML = '<tr><td colspan="5" class="empty-state"><h3>Products could not load</h3><p>Retry the connection to continue.</p></td></tr>';
                tableMessage.textContent = error.message;
                tableMessage.className = 'message show error';
                document.getElementById('retryProductsBtn').hidden = false;
                document.getElementById('paginationInfo').textContent = 'Products unavailable';
                document.getElementById('catalogResultCount').textContent = 'Unavailable';
                ['catalogTotal','catalogLow','catalogOut'].forEach(id => document.getElementById(id).textContent = '—');
            } finally {setCatalogBusy(false);}
        }

        function getFilteredProducts() {
            const productSearch =
                document.getElementById("filterProduct")
                    .value.trim().toLowerCase();

            const categorySearch =
                document.getElementById("filterCategory")
                    .value.trim().toLowerCase();

            const colorSearch =
                document.getElementById("filterColor")
                    .value.trim().toLowerCase();

            const sizeSearch =
                document.getElementById("filterSize")
                    .value.trim().toLowerCase();

            return products.filter(function (product) {
                const productName =
                    String(product.name ?? "").toLowerCase();

                const productId =
                    String(product.id ?? "").toLowerCase();

                const categoryName =
                    String(getCategoryName(product)).toLowerCase();

                const categoryId =
                    String(getCategoryId(product)).toLowerCase();

                const variants = getVariants(product);

                const matchesProduct =
                    !productSearch ||
                    productName.includes(productSearch) ||
                    productId.includes(productSearch);

                const matchesCategory =
                    !categorySearch ||
                    categoryId === categorySearch;

                const matchesVariant = (!colorSearch && !sizeSearch) || variants.some(variant =>
                    (!colorSearch || String(variant.color || '').toLowerCase() === colorSearch) &&
                    (!sizeSearch || String(variant.size || '').toLowerCase() === sizeSearch)
                );

                const stock = document.getElementById('filterStock').value;
                const gender = document.getElementById('filterGender').value;
                const matchesStock = !stock || stockState(product) === stock;
                const matchesGender = !gender || (gender === 'unset' ? !product.gender : product.gender === gender);
                return matchesStock && matchesGender && matchesProduct &&
                    matchesCategory &&
                    matchesVariant;
            });
        }

   
        function populateProductFilters() {
            const variants = products.flatMap(getVariants);
            const options = {
                filterCategory: categories.map(category => [String(category.id), category.name]),
                filterColor: [...new Set(variants.map(variant => String(variant.color).toLowerCase()))].sort().map(value => [value, value]),
                filterSize: [...new Set(variants.map(variant => String(variant.size)))].sort((a,b) => a.localeCompare(b, undefined, {numeric:true})).map(value => [value, value])
            };
            for (const id of Object.keys(options)) {
                const select = document.getElementById(id);
                if (!select || select.tagName !== "SELECT") continue;
                const value = select.value;
                select.replaceChildren(new Option(id === "filterCategory" ? "All Categories" : id === "filterColor" ? "All Colors" : "All Sizes", ""));
                for (const [key, label] of options[id]) select.add(new Option(label, key));
                select.value = options[id].some(option => option[0] === value) ? value : "";
                if (id === "filterColor") ColorSelect.enhance(select);
            }
        }

        function renderProducts() {
            populateProductFilters();
            const filtered = getFilteredProducts();
            const sort = document.getElementById('filterSort').value;
            filtered.sort((a,b) => sort === 'name' ? String(a.name).localeCompare(String(b.name)) : sort === 'price-low' ? Number(a.price)-Number(b.price) : sort === 'price-high' ? Number(b.price)-Number(a.price) : Number(b.id)-Number(a.id));
            const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
            currentPage = Math.min(currentPage, pages);
            const start = (currentPage - 1) * pageSize;
            const palette = {black:'#202020',white:'#fff',gray:'#969696',red:'#a43c3c',blue:'#476a8d',navy:'#202e45',green:'#466651',yellow:'#c9ac44',orange:'#bf7e43',pink:'#d599ad',purple:'#8a6b9d',brown:'#775741',beige:'#d6c7b0',other:'#b7b3aa'};
            productsTableBody.innerHTML = filtered.slice(start, start+pageSize).map(product => {
                const images = getProductImages(product);
                const src = images[0] ? imageUrl(images[0]) : '';
                const variants = getVariants(product);
                const colors = [...new Set(variants.map(variant => String(variant.color || '').toLowerCase()).filter(Boolean))];
                const sizes = [...new Set(variants.map(variant => variant.size).filter(Boolean))];
                const state = stockState(product);
                const low = variants.filter(variant => Number(variant.quantity) <= 5).length;
                const gender = {men:'Men',women:'Women',unisex:'Unisex'}[product.gender] || 'Not set';
                return `<tr data-product-id="${Number(product.id)}">
                    <td data-label="Product"><div class="product-cell"><span class="catalog-thumb"><i class="fa-regular fa-image" aria-hidden="true"></i>${src ? `<img class="product-image" src="${escapeHtml(src)}" alt="" loading="lazy">` : ''}</span><div><a href="ProductDetails.html?id=${Number(product.id)}" class="product-name">${escapeHtml(product.name)}</a><div class="product-category">${escapeHtml(getCategoryName(product))}</div><div class="product-id">#${Number(product.id)} · ${gender}</div></div></div></td>
                    <td data-label="Price"><strong class="catalog-price">${Number(product.price || 0).toFixed(2)}</strong><span class="catalog-currency">JOD · Base price</span></td>
                    <td data-label="Inventory"><span class="catalog-stock ${state}">${state === 'out' ? 'Out of stock' : state === 'low' ? 'Needs restock' : 'In stock'}</span><span class="catalog-stock-note">${quantityOf(product)} units${state === 'low' ? ' · '+low+' low-stock '+(low === 1 ? 'variant' : 'variants') : ''}</span></td>
                    <td data-label="Variants"><span class="catalog-variant-count">${variants.length} ${variants.length === 1 ? 'variant' : 'variants'}</span><div class="catalog-swatches">${colors.slice(0,5).map(color => `<span style="background:${palette[color] || palette.other}" title="${escapeHtml(color)}" role="img" aria-label="${escapeHtml(color)}"></span>`).join('')}${colors.length>5 ? '<small>+'+(colors.length-5)+'</small>' : ''}</div><span class="catalog-size-note">${escapeHtml(sizes.slice(0,4).join(' · '))}${sizes.length>4 ? ' +'+(sizes.length-4) : ''}</span></td>
                    <td data-label="Actions"><div class="actions"><button type="button" class="action-btn view-btn" aria-label="View ${escapeHtml(product.name)}" title="View product" data-action="view" data-id="${Number(product.id)}"><i class="fa-regular fa-eye" aria-hidden="true"></i></button><button type="button" class="action-btn" aria-label="Edit ${escapeHtml(product.name)}" title="Edit product" data-action="edit" data-id="${Number(product.id)}"><i class="fa-solid fa-pen" aria-hidden="true"></i><span>Edit</span></button><button type="button" class="action-btn catalog-delete" aria-label="Delete ${escapeHtml(product.name)}" title="Delete product" data-action="delete" data-id="${Number(product.id)}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></div></td>
                </tr>`;
            }).join('') || '<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-box-open" aria-hidden="true"></i><h3>'+ (products.length ? 'No products match this view' : 'Start your collection') +'</h3><p>'+ (products.length ? 'Try another search or reset your filters.' : 'Add your first product to get started.') +'</p></td></tr>';
            productsTableBody.querySelectorAll('img').forEach(image => image.addEventListener('error', () => image.hidden = true));
            document.getElementById('catalogTotal').textContent = products.length;
            document.getElementById('catalogLow').textContent = products.filter(product => stockState(product) === 'low').length;
            document.getElementById('catalogOut').textContent = products.filter(product => stockState(product) === 'out').length;
            document.getElementById('catalogResultCount').textContent = filtered.length+' of '+products.length+' products';
            document.querySelectorAll('[data-catalog-stock]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.catalogStock === document.getElementById('filterStock').value)));
            document.getElementById('paginationInfo').textContent = `${filtered.length ? start+1 : 0}–${Math.min(start+pageSize,filtered.length)} of ${filtered.length} · Page ${currentPage} of ${pages}`;
            document.getElementById('prevPageBtn').disabled = catalogLoading || currentPage <= 1;
            document.getElementById('nextPageBtn').disabled = catalogLoading || currentPage >= pages;
        }

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

            quantityInput.value = String(totalVariants);

            const productQuantity =
                quantityInput.value.trim() === ""
                    ? 0
                    : Number(quantityInput.value);

            const summary =
                document.getElementById("stockSummary");

            document.getElementById(
                "totalVariantQuantity"
            ).textContent = `${totalVariants} units · ${variants.length} ${variants.length === 1 ? "variant" : "variants"}`;

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

                    <select class="field variant-color" required>${colorOptions(color)}</select>
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
            const rowId = ++variantRowId;
            row.querySelectorAll(".form-group").forEach((group,index)=>{const input=group.querySelector("input,select");input.id="variant-"+rowId+"-"+index;group.querySelector("label").htmlFor=input.id;});
            ColorSelect.enhance(row.querySelector(".variant-color"));

            row.querySelector(".variant-quantity").addEventListener(
                "input",
                updateTotalVariantQuantity
            );

            row.querySelector(".variant-size").addEventListener(
                "change",
                updateTotalVariantQuantity
            );

            row.querySelector(".variant-color").addEventListener(
                "change",
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

        function validateVariants(variants) {
            if (variants.length === 0) {
                return "Please add at least one product variant.";
            }

            const combinations = new Set();
            const allowedColors = ["black", "white", "gray", "red", "blue", "navy", "green", "yellow", "orange", "pink", "purple", "brown", "beige", "other"];

            for (const variant of variants) {
                if (!variant.size || !variant.color.trim()) {
                    return "Please select a size and color for every variant.";
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

                if (combinations.has(combination)) {
                    return "Each size and color combination must be unique.";
                }

                combinations.add(combination);
            }

            return "";
        }

         
         
         

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

            document.getElementById(
                "totalVariantQuantity"
            ).textContent = "0 / 0";

            document.getElementById("stockSummary").classList.remove(
                "match",
                "mismatch"
            );

            previewUrls.forEach(url=>URL.revokeObjectURL(url)); previewUrls=[];
            ColorSelect.refresh(defaultColor);
            renderImagePreview();
            hideMessage(formMessage);

            isSaving = false;

            document.getElementById("saveProductBtn").disabled = false;
        }

        function openModal() {
            editorReturnFocus=document.activeElement;
            editorInitialState=editorState();
            productModal.classList.add("open");
            document.body.classList.add("product-editor-open");
            requestAnimationFrame(()=>document.getElementById("productName").focus());
        }

        async function closeModal() {
            if (isSaving || Swal.isVisible()) return;
            if (editorState() !== editorInitialState) {
                const answer=await Alerts.confirm("Discard changes?", "Your product changes have not been saved.");
                if (!answer.isConfirmed) return;
            }
            finishEditorClose();
        }

        function openAddForm() {
            resetForm();

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
                showMessage(
                    tableMessage,
                    "Product not found.",
                    "error"
                );
                return;
            }

            resetForm();
            document.getElementById("modalTitle").textContent =
                "Edit Product";

            document.getElementById("saveProductBtn").textContent =
                "Save Changes";

            document.getElementById("productId").value =
                product.id;

            document.getElementById("productName").value =
                product.name ?? "";

            document.getElementById("productCategory").value =
                getCategoryId(product);

            document.getElementById("productGender").value = product.gender || "";
            document.getElementById("productPrice").value =
                product.price ?? "";

            document.getElementById("productQuantity").value =
                quantityOf(product);

            document.getElementById("productDescription").value =
                product.description ?? "";

            document.getElementById("productDiscount").value =
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

         
         
         

        function renderImagePreview() {
            const preview =
                document.getElementById("imagePreview");

            previewUrls.forEach(url=>URL.revokeObjectURL(url)); previewUrls=[];
            document.getElementById("editorImageCount").textContent = existingImages.length+selectedImages.length ? `${existingImages.length+selectedImages.length} images · ${selectedImages.length} new` : "No images selected";
            const existingHtml = existingImages.map(
                function (image, index) {
                    return `
                        <div class="preview-item">
                            <img
                                src="${escapeHtml(imageUrl(image))}"
                                alt="Product image"
                            ><span class="preview-caption">Current image ${index+1}</span>

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
                    previewUrls.push(localUrl);

                    return `
                        <div class="preview-item">
                            <img
                                src="${localUrl}"
                                alt="${escapeHtml(file.name)}"
                            ><span class="preview-caption" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>

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

         
         
         

        async function saveProduct(event) {
            event.preventDefault();

            if (isSaving) {
                return;
            }

            hideMessage(formMessage);

            const quantityInput =
                document.getElementById("productQuantity");

            const productQuantity =
                Number(quantityInput.value);

            const variants = readVariants();

            const variantError =
                validateVariants(variants);

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

            const priceInput =
                document.getElementById("productPrice");

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
                !document.getElementById("productCategory").value
            ) {
                showMessage(
                    formMessage,
                    "Please fill in all required product fields.",
                    "error"
                );
                return;
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

            const saveButton =
                document.getElementById("saveProductBtn");

            isSaving = true;

            saveButton.disabled = true;
            saveButton.textContent = "Saving...";

            try {
                await getJson(PRODUCTS_API, {
                    method: "POST",
                    body: formData
                });

                finishEditorClose();

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
                showMessage(
                    formMessage,
                    error.message,
                    "error"
                );

            } finally {
                isSaving = false;

                saveButton.disabled = false;

                saveButton.textContent = wasEditing
                    ? "Save Changes"
                    : "Save Product";
            }
        }

         
         
         

        async function deleteProduct(id) {
            const product = products.find(function (item) {
                return String(item.id) === String(id);
            });

            if (!product) {
                showMessage(
                    tableMessage,
                    "Product not found.",
                    "error"
                );
                return;
            }

            const confirmed = await Alerts.confirm("Delete this product?", "This removes " + product.name + " from your store.");

    if (!confirmed.isConfirmed) {
                return;
            }

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
                showMessage(
                    tableMessage,
                    error.message,
                    "error"
                );
            }
        }

         
         
         

        function viewProduct(id) {
            window.location.href =
                "ProductDetails.html?id=" +
                encodeURIComponent(id);
        }

         
         
         

         
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
                addVariantRow({color:defaultColor.value});
            }
        );

         
        document.getElementById("productQuantity").addEventListener(
            "input",
            updateTotalVariantQuantity
        );

         
        productForm.addEventListener(
            "submit",
            saveProduct
        );

         
        [
            "filterProduct",
            "filterCategory",
            "filterColor",
            "filterSize",
            "filterGender",
            "filterSort"
        ].forEach(function (id) {
            document.getElementById(id).addEventListener(
                id === "filterColor" ? "change" : "input",
                function () {
                    if (catalogLoading) return;
                    currentPage = 1;
                    renderProducts();
                }
            );
        });

         
        document.getElementById("clearFiltersBtn").addEventListener(
            "click",
            function () {
                document.getElementById("filterProduct").value = "";
                document.getElementById("filterCategory").value = "";
                document.getElementById("filterColor").value = "";
                document.getElementById("filterSize").value = "";
                document.getElementById("filterGender").value = "";
                document.getElementById("filterStock").value = "";
                document.getElementById("filterSort").value = "newest";

                currentPage = 1;

                renderProducts();
            }
        );

         
        document.getElementById("prevPageBtn").addEventListener(
            "click",
            function () {
                if (currentPage > 1) {
                    currentPage--;
                    renderProducts();
                }
            }
        );

         
        document.getElementById("nextPageBtn").addEventListener(
            "click",
            function () {
                const totalPages = Math.max(
                    1,
                    Math.ceil(
                        getFilteredProducts().length / pageSize
                    )
                );

                if (currentPage < totalPages) {
                    currentPage++;
                    renderProducts();
                }
            }
        );

         
        productsTableBody.addEventListener(
            "click",
            function (event) {
                const button = event.target.closest(
                    "button[data-action]"
                );

                if (!button) {
                    return;
                }

                const id = button.dataset.id;
                const action = button.dataset.action;

                if (action === "view") {
                    viewProduct(id);
                } else if (action === "edit") {
                    openEditForm(id);
                } else if (action === "delete") {
                    deleteProduct(id);
                }
            }
        );

         
        productImagesInput.addEventListener(
            "change",
            function (event) {
                addSelectedImages(Array.from(event.target.files || []));
            }
        );

         
        document.getElementById("imagePreview").addEventListener(
            "click",
            function (event) {
                const button = event.target.closest(
                    "button[data-image-type]"
                );

                if (!button) {
                    return;
                }

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

         
         
         

        async function initPage() {
            try {
                await Promise.all([
                    loadCategories(),
                    loadDiscounts()
                ]);

            } catch (error) {
                showMessage(
                    tableMessage,
                    error.message,
                    "error"
                );
            }

            await loadProducts();
        }

        const allowedProductColors = ['black','white','gray','red','blue','navy','green','yellow','orange','pink','purple','brown','beige','other'];
        let variantRowId = 0, previewUrls = [], editorInitialState = '', editorReturnFocus = null;
        const defaultColor = document.getElementById('variantDefaultColor');
        function colorOptions(selected = '') {
            return '<option value="">Choose color</option>' + allowedProductColors.map(color => '<option value="' + color + '"' + (color === selected.toLowerCase() ? ' selected' : '') + '>' + color[0].toUpperCase() + color.slice(1) + '</option>').join('');
        }
        defaultColor.innerHTML = colorOptions();
        ColorSelect.enhance(defaultColor);
        function editorState() {
            const fields = ['productName','productCategory','productGender','productPrice','productDescription','productDiscount'].map(id => document.getElementById(id).value);
            return JSON.stringify({fields, variants:readVariants(), existing:existingImages, selected:selectedImages.map(file=>[file.name,file.size,file.lastModified])});
        }
        function finishEditorClose() {
            ColorSelect.close();
            productModal.classList.remove('open');
            document.body.classList.remove('product-editor-open');
            if (editorReturnFocus?.isConnected) editorReturnFocus.focus();
        }
        function syncSelectedFiles() {
            const transfer = new DataTransfer();
            selectedImages.forEach(file => transfer.items.add(file));
            productImagesInput.files = transfer.files;
        }
        function addSelectedImages(files) {
            const combined = [...selectedImages];
            for (const file of files) {
                if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
                    syncSelectedFiles();
                    Alerts.show('Check your images','Use JPG, PNG, WebP or GIF images, each 5 MB or less.','error');
                    return;
                }
                if (!combined.some(old=>old.name===file.name&&old.size===file.size&&old.lastModified===file.lastModified)) combined.push(file);
            }
            if (combined.length > 5) { syncSelectedFiles(); Alerts.show('Too many images','Add up to 5 new images at a time. Remove a selected image to choose another.','warning'); return; }
            selectedImages = combined;
            syncSelectedFiles();
            renderImagePreview();
        }
        const uploadArea = document.getElementById('editorUpload');
        uploadArea.addEventListener('dragover', event => { event.preventDefault(); uploadArea.classList.add('is-dragging'); });
        uploadArea.addEventListener('dragleave', event => { if (!uploadArea.contains(event.relatedTarget)) uploadArea.classList.remove('is-dragging'); });
        uploadArea.addEventListener('drop', event => { event.preventDefault(); uploadArea.classList.remove('is-dragging'); addSelectedImages(Array.from(event.dataTransfer.files)); });
        document.getElementById('productCategory').addEventListener('change', event => {
            const name = event.target.selectedOptions[0]?.textContent.toLowerCase() || '';
            document.getElementById('variantPreset').value = /footwear|shoe/.test(name) ? 'shoes' : /accessor|fragrance|bag|watch|jewel/.test(name) ? 'one' : 'clothing';
        });
        document.getElementById('addSizesBtn').addEventListener('click', () => {
            const color = defaultColor.value;
            const input = document.getElementById('variantDefaultQuantity');
            const quantity = Number(input.value);
            if (!color) { Alerts.show('Choose a color','Select the color to use for these sizes.','info').then(()=>defaultColor.parentElement.querySelector('.eco-color-trigger').focus()); return; }
            if (input.value.trim()==='' || !Number.isInteger(quantity) || quantity < 0) { Alerts.show('Check the quantity','Units per size must be a whole number of zero or more.','error').then(()=>input.focus()); return; }
            const ranges = { clothing:['XS','S','M','L','XL','XXL'], shoes:['36','37','38','39','40','41','42','43','44','45','46'], one:['ONE_SIZE'] };
            const sizes = ranges[document.getElementById('variantPreset').value];
            const existing = new Set(readVariants().map(variant=>variant.size+'|'+variant.color));
            [...variantsContainer.querySelectorAll('.variant-row')].forEach(row=>{if(!row.querySelector('.variant-size').value&&!row.querySelector('.variant-color').value&&!Number(row.querySelector('.variant-quantity').value))row.remove();});
            let added = 0;
            sizes.forEach(size=>{if(!existing.has(size+'|'+color)){addVariantRow({size,color,quantity});added++;}});
            updateTotalVariantQuantity();
            if (!added) Alerts.toast('These sizes and this color are already added.','info');
        });
        document.addEventListener('keydown', event => {
            if (!productModal.classList.contains('open') || event.defaultPrevented || Swal.isVisible()) return;
            if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
            if (event.key !== 'Tab') return;
            const elements = [...productModal.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);
            const first = elements[0], last = elements[elements.length-1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        });

        initPage();



document.querySelectorAll('[data-catalog-stock]').forEach(button => button.addEventListener('click', () => {
    document.getElementById('filterStock').value = button.dataset.catalogStock;
    currentPage = 1;
    renderProducts();
}));
document.getElementById('catalogPageSize').addEventListener('change', event => {pageSize = Number(event.target.value); currentPage = 1; renderProducts();});
document.getElementById('refreshProductsBtn').addEventListener('click', loadProducts);
document.getElementById('retryProductsBtn').addEventListener('click', initPage);
