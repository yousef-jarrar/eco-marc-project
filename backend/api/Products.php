
<?php

header("Content-Type: application/json");

require_once __DIR__ . "/../classes/Products.php";

try {

    $products = new Product();

    $method = $_SERVER["REQUEST_METHOD"];

    if (isset($_GET["id"])) {
        $id = (int) $_GET["id"];
    } else {
        $id = 0;
    }

    $data = json_decode(file_get_contents("php://input"), true);

    switch ($method) {

      case "GET":

    if (isset($_GET["category_id"])) {

        $categoryId = $_GET["category_id"];

        if (!ctype_digit((string) $categoryId) || (int) $categoryId < 1) {
            http_response_code(400);
            echo json_encode([
                "message" => "Invalid category_id"
            ]);
            break;
        }

        if (!$products->categoryExists((int) $categoryId)) {
            http_response_code(404);
            echo json_encode([
                "message" => "Category not found"
            ]);
            break;
        }

        echo json_encode(
            $products->getProductsByCategory((int) $categoryId)
        );

    } elseif ($id > 0) {

        $product = $products->getProduct($id);

        if (!$product) {
            http_response_code(404);
            echo json_encode([
                "message" => "Product not found"
            ]);
            break;
        }

        echo json_encode($product);

    } else {

        echo json_encode($products->getProducts());

    }

    break;
              case "POST":

            $name = trim($_POST["name"] ?? "");
            $price = $_POST["price"] ?? "";
            $categoryId = $_POST["category_id"] ?? "";

            $discountId = $_POST["discount_id"] ?? "";
            $description = $_POST["description"] ?? null;
            $isActive = $_POST["is_active"] ?? 1;

            if (
                $name === "" ||
                $price === "" ||
                !is_numeric($price) ||
                (float) $price < 0 ||
                !ctype_digit((string) $categoryId) ||
                (int) $categoryId < 1
            ) {
                http_response_code(400);

                echo json_encode([
                    "message" => "Name, valid price and category_id are required"
                ]);

                break;
            }

            if (!in_array((string) $isActive, ["0", "1"], true)
                && !in_array($isActive, [0, 1], true)) {

                http_response_code(400);

                echo json_encode([
                    "message" => "is_active must be 0 or 1"
                ]);

                break;
            }

            if (!$products->categoryExists((int) $categoryId)) {

                http_response_code(400);

                echo json_encode([
                    "message" => "Category not found"
                ]);

                break;
            }

            if ($discountId !== "" && $discountId !== null) {

                if (
                    !ctype_digit((string) $discountId) ||
                    (int) $discountId < 1 ||
                    !$products->discountExists((int) $discountId)
                ) {
                    http_response_code(400);

                    echo json_encode([
                        "message" => "Discount not found"
                    ]);

                    break;
                }

            } else {

                $discountId = null;

            }

            // Check uploaded image
            if (
                !isset($_FILES["image"]) ||
                $_FILES["image"]["error"] !== UPLOAD_ERR_OK
            ) {
                http_response_code(400);

                echo json_encode([
                    "message" => "Please upload an image using the image field"
                ]);

                break;
            }

            $image = $_FILES["image"];

            // Maximum image size: 5 MB
            if ($image["size"] > 5 * 1024 * 1024) {

                http_response_code(400);

                echo json_encode([
                    "message" => "Image must be 5 MB or smaller"
                ]);

                break;
            }

            // Verify actual image type
            $imageInfo = @getimagesize($image["tmp_name"]);

            if ($imageInfo === false) {

                http_response_code(400);

                echo json_encode([
                    "message" => "Uploaded file is not a valid image"
                ]);

                break;
            }

            $mime = $imageInfo["mime"];

            $allowedTypes = [
                "image/jpeg" => "jpg",
                "image/png"  => "png",
                "image/webp" => "webp",
                "image/gif"  => "gif"
            ];

            if (!isset($allowedTypes[$mime])) {

                http_response_code(400);

                echo json_encode([
                    "message" => "Only JPG, PNG, WEBP and GIF images are allowed"
                ]);

                break;
            }

            // Save image inside project/assets/products
            $uploadDirectory = dirname(__DIR__, 2)
                . DIRECTORY_SEPARATOR . "assets"
                . DIRECTORY_SEPARATOR . "products";

            if (
                !is_dir($uploadDirectory) &&
                !mkdir($uploadDirectory, 0755, true)
            ) {
                throw new RuntimeException("Could not create image directory");
            }

            $fileName = uniqid("product_", true)
                . "." . $allowedTypes[$mime];

            $destination = $uploadDirectory
                . DIRECTORY_SEPARATOR . $fileName;

            if (!move_uploaded_file($image["tmp_name"], $destination)) {

                http_response_code(500);

                echo json_encode([
                    "message" => "Could not save uploaded image"
                ]);

                break;
            }

            // Relative path saved in database
            $imagePath = "assets/products/" . $fileName;

            $data = [
                "name" => $name,
                "description" => $description,
                "price" => $price,
                "category_id" => (int) $categoryId,
                "discount_id" => $discountId === null
                    ? null
                    : (int) $discountId,
                "is_active" => (int) $isActive
            ];

            $newId = $products->createProduct($data, $imagePath);

            http_response_code(201);

            echo json_encode([
                "message" => "Product created successfully",
                "id" => $newId,
                "image_url" => $imagePath
            ]);

            break;
            case "PUT":

            if ($id < 1 || !$products->productExists($id)) {

                http_response_code(404);

                echo json_encode([
                    "message" => "Product not found"
                ]);

                break;
            }

            $data = json_decode(
                file_get_contents("php://input"),
                true
            );

            if (!is_array($data)) {

                http_response_code(400);

                echo json_encode([
                    "message" => "Send valid JSON data"
                ]);

                break;
            }

            $name = trim($data["name"] ?? "");
            $price = $data["price"] ?? "";
            $categoryId = $data["category_id"] ?? "";

            $discountId = $data["discount_id"] ?? null;
            $isActive = $data["is_active"] ?? 1;

            if (
                $name === "" ||
                $price === "" ||
                !is_numeric($price) ||
                (float) $price < 0 ||
                !ctype_digit((string) $categoryId) ||
                (int) $categoryId < 1
            ) {
                http_response_code(400);

                echo json_encode([
                    "message" => "Name, valid price and category_id are required"
                ]);

                break;
            }

            if (!$products->categoryExists((int) $categoryId)) {

                http_response_code(400);

                echo json_encode([
                    "message" => "Category not found"
                ]);

                break;
            }

            if ($discountId !== null && $discountId !== "") {

                if (
                    !ctype_digit((string) $discountId) ||
                    (int) $discountId < 1 ||
                    !$products->discountExists((int) $discountId)
                ) {
                    http_response_code(400);

                    echo json_encode([
                        "message" => "Discount not found"
                    ]);

                    break;
                }

                $discountId = (int) $discountId;

            } else {

                $discountId = null;

            }

            if (!in_array($isActive, [0, 1, "0", "1"], true)) {

                http_response_code(400);

                echo json_encode([
                    "message" => "is_active must be 0 or 1"
                ]);

                break;
            }

            $updateData = [
                "name" => $name,
                "description" => $data["description"] ?? null,
                "price" => $price,
                "category_id" => (int) $categoryId,
                "discount_id" => $discountId,
                "is_active" => (int) $isActive
            ];

            $products->updateProduct($id, $updateData);

            echo json_encode([
                "message" => "Product updated successfully",
                "product" => $products->getProduct($id)
            ]);

            break;

  case "DELETE":

            if ($id < 1 || !$products->productExists($id)) {

                http_response_code(404);

                echo json_encode([
                    "message" => "Product not found"
                ]);

                break;
            }

            $products->deleteProduct($id);

            echo json_encode([
                "message" => "Product deleted successfully"
            ]);

            break;

        default:

            http_response_code(405);
            echo json_encode([
                "message" => "Method not allowed"
            ]);
    }


} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "message" => "Database error"
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "message" => "Server error"
    ]);
}
?>
