<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../classes/Products.php";

try {
    $products = new Product();

    $method = $_SERVER["REQUEST_METHOD"];

    $id = isset($_GET["id"]) ? (int) $_GET["id"] : 0;

    // GET: Get products or one product
    if ($method === "GET") {

        if (isset($_GET["category_id"])) {
            $categoryId = (int) $_GET["category_id"];

            if (
                $categoryId <= 0 ||
                !$products->categoryExists($categoryId)
            ) {
                http_response_code(400);
                echo json_encode(["message" => "Invalid category"]);
                exit;
            }

            echo json_encode(
                $products->getProductsByCategory($categoryId)
            );
            exit;
        }

        if ($id > 0) {
            $product = $products->getProduct($id);

            if (!$product) {
                http_response_code(404);
                echo json_encode(["message" => "Product not found"]);
                exit;
            }

            echo json_encode($product);
            exit;
        }

        echo json_encode($products->getProducts());
        exit;
    }

    // POST: Create or update product
    if ($method === "POST") {

        $id = isset($_POST["id"]) ? (int) $_POST["id"] : 0;

        $name = trim($_POST["name"] ?? "");
        $description = trim($_POST["description"] ?? "");
        $price = $_POST["price"] ?? "";
        $quantity = $_POST["quantity"] ?? "";
        $categoryId = (int) ($_POST["category_id"] ?? 0);
        $discountId = $_POST["discount_id"] ?? "";

        $isActive = isset($_POST["is_active"])
            ? (int) $_POST["is_active"]
            : 1;

        // Validate product details
        if (
            $name === "" ||
            $price === "" ||
            !is_numeric($price) ||
            (float) $price < 0 ||
            filter_var($quantity, FILTER_VALIDATE_INT) === false ||
            (int) $quantity < 0 ||
            $categoryId <= 0
        ) {
            http_response_code(400);

            echo json_encode([
                "message" => "Enter a valid name, price, quantity and category"
            ]);

            exit;
        }

        if (!$products->categoryExists($categoryId)) {
            http_response_code(400);
            echo json_encode(["message" => "Category not found"]);
            exit;
        }

        // Validate discount
        if ($discountId === "") {
            $discountId = null;
        } else {
            $discountId = (int) $discountId;

            if (!$products->discountExists($discountId)) {
                http_response_code(400);
                echo json_encode(["message" => "Discount not found"]);
                exit;
            }
        }

        // Validate status
        if (!in_array($isActive, [0, 1], true)) {
            http_response_code(400);
            echo json_encode(["message" => "Invalid product status"]);
            exit;
        }

        // Check product when editing
        if ($id > 0 && !$products->productExists($id)) {
            http_response_code(404);
            echo json_encode(["message" => "Product not found"]);
            exit;
        }

        // Read variants from the form
        $variants = json_decode($_POST["variants"] ?? "[]", true);

        if (!is_array($variants) || count($variants) === 0) {
            http_response_code(400);

            echo json_encode([
                "message" => "Add at least one product variant"
            ]);

            exit;
        }

        $allowedSizes = [
            "XS", "S", "M", "L", "XL", "XXL",
            "36", "37", "38", "39", "40", "41",
            "42", "43", "44", "45", "46", "ONE_SIZE"
        ];

        $allowedColors = [
            "black", "white", "gray", "red", "blue",
            "navy", "green", "yellow", "orange", "pink",
            "purple", "brown", "beige", "other"
        ];

        $cleanVariants = [];
        $usedVariants = [];
        $totalVariantQuantity = 0;

        foreach ($variants as $variant) {
            $size = $variant["size"] ?? "";
            $color = $variant["color"] ?? "";
            $variantQuantity = $variant["quantity"] ?? "";

            if (
                !in_array($size, $allowedSizes, true) ||
                !in_array($color, $allowedColors, true) ||
                filter_var(
                    $variantQuantity,
                    FILTER_VALIDATE_INT
                ) === false ||
                (int) $variantQuantity < 0
            ) {
                http_response_code(400);

                echo json_encode([
                    "message" => "Check variant size, color and quantity"
                ]);

                exit;
            }

            $variantKey = $size . "_" . $color;

            if (isset($usedVariants[$variantKey])) {
                http_response_code(400);

                echo json_encode([
                    "message" => "The same size and color cannot be repeated"
                ]);

                exit;
            }

            $usedVariants[$variantKey] = true;

            $variantQuantity = (int) $variantQuantity;
            $totalVariantQuantity += $variantQuantity;

            $cleanVariants[] = [
                "size" => $size,
                "color" => $color,
                "quantity" => $variantQuantity
            ];
        }

        // The sum of variant quantities must equal the product quantity
        $productQuantity = (int) $quantity;

        if ($totalVariantQuantity !== $productQuantity) {
            http_response_code(400);

            echo json_encode([
                "message" => "Product quantity is " .
                    $productQuantity .
                    ", but variants total is " .
                    $totalVariantQuantity .
                    ". The quantities must match."
            ]);

            exit;
        }

        // Prepare image upload directory
        $imagePaths = [];

        $uploadDirectory = dirname(__DIR__, 2)
            . DIRECTORY_SEPARATOR . "assets"
            . DIRECTORY_SEPARATOR . "products";

        if (!is_dir($uploadDirectory)) {
            mkdir($uploadDirectory, 0777, true);
        }

        if (
            !is_dir($uploadDirectory) ||
            !is_writable($uploadDirectory)
        ) {
            http_response_code(500);

            echo json_encode([
                "message" => "Product images folder is not writable"
            ]);

            exit;
        }

        // Process uploaded images
        if (isset($_FILES["images"])) {
            $files = $_FILES["images"];

            for ($i = 0; $i < count($files["name"]); $i++) {

                if ($files["error"][$i] === UPLOAD_ERR_NO_FILE) {
                    continue;
                }

                if ($files["error"][$i] !== UPLOAD_ERR_OK) {
                    http_response_code(400);

                    echo json_encode([
                        "message" => "An image could not be uploaded"
                    ]);

                    exit;
                }

                if ($files["size"][$i] > 5 * 1024 * 1024) {
                    http_response_code(400);

                    echo json_encode([
                        "message" => "Each image must be 5MB or less"
                    ]);

                    exit;
                }

                $imageInfo = getimagesize($files["tmp_name"][$i]);

                if ($imageInfo === false) {
                    http_response_code(400);

                    echo json_encode([
                        "message" => "Uploaded file is not a valid image"
                    ]);

                    exit;
                }

                $mime = $imageInfo["mime"];

                $extensions = [
                    "image/jpeg" => "jpg",
                    "image/png" => "png",
                    "image/webp" => "webp",
                    "image/gif" => "gif"
                ];

                if (!isset($extensions[$mime])) {
                    http_response_code(400);

                    echo json_encode([
                        "message" => "Only JPG, PNG, WEBP and GIF images are allowed"
                    ]);

                    exit;
                }

                $fileName = uniqid("product_", true)
                    . "." . $extensions[$mime];

                $destination = $uploadDirectory
                    . DIRECTORY_SEPARATOR . $fileName;

                if (!move_uploaded_file(
                    $files["tmp_name"][$i],
                    $destination
                )) {
                    http_response_code(500);

                    echo json_encode([
                        "message" => "Could not save product image"
                    ]);

                    exit;
                }

                $imagePaths[] = "assets/products/" . $fileName;
            }
        }

        // A new product must have at least one image
        if ($id === 0 && count($imagePaths) === 0) {
            http_response_code(400);

            echo json_encode([
                "message" => "Upload at least one product image"
            ]);

            exit;
        }

        // Data sent to the Product class
        $data = [
            "name" => $name,
            "description" => $description,
            "price" => (float) $price,
            "quantity" => $productQuantity,
            "category_id" => $categoryId,
            "discount_id" => $discountId,
            "is_active" => $isActive
        ];

        // Update product
        if ($id > 0) {
            $products->updateProduct(
                $id,
                $data,
                $imagePaths,
                $cleanVariants
            );

            echo json_encode([
                "message" => "Product updated successfully",
                "id" => $id
            ]);

            exit;
        }

        // Create product
        $newId = $products->createProduct(
            $data,
            $imagePaths,
            $cleanVariants
        );

        http_response_code(201);

        echo json_encode([
            "message" => "Product created successfully",
            "id" => $newId
        ]);

        exit;
    }

    // DELETE: Soft delete product
    if ($method === "DELETE") {

        if ($id <= 0 || !$products->productExists($id)) {
            http_response_code(404);
            echo json_encode(["message" => "Product not found"]);
            exit;
        }

        $products->deleteProduct($id);

        echo json_encode([
            "message" => "Product deleted successfully"
        ]);

        exit;
    }

    http_response_code(405);

    echo json_encode([
        "message" => "Method not allowed"
    ]);

} catch (PDOException $e) {
    http_response_code(500);

    echo json_encode([
        "message" => "Database error",
        "error" => $e->getMessage()
    ]);

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        "message" => "Server error",
        "error" => $e->getMessage()
    ]);
}
