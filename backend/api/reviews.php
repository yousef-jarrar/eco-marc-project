<?php
header("Content-Type: application/json; charset=utf-8");

require_once __DIR__ . "/../config/db.php";
require_once __DIR__ . "/../classes/Review.php";

try {
    $db = new Database();
    $review = new Review($db->connect());

    $method = $_SERVER["REQUEST_METHOD"];

    switch ($method) {
        case "GET":
            $data = $review->getAllReviews();

            echo json_encode([
                "success" => true,
                "data" => $data
            ]);
            break;

        case "POST":
            
        default:
            header("Allow: GET");
            http_response_code(405);

            echo json_encode([
                "success" => false,
                "message" => "Method not allowed"
            ]);
            break;
    }

} catch (Throwable $e) {
    error_log($e->getMessage());
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Internal server error"
    ]);
}