
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

            if ($id > 0) {

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
