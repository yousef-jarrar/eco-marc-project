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
            if (isset($_GET["stats"])) {
                $data = $review->getStatistics();
                
            } elseif (isset($_GET["id"])) {
                $id = filter_var($_GET["id"], FILTER_VALIDATE_INT);
                
                if (!$id || $id <= 0) {
                    http_response_code(400);
                    echo json_encode([
                        "success" => false,
                        "message" => "Invalid review ID"
                    ]);
                    break;
                }
                
                $data = $review->getReviewById($id);
                
                if ($data === false) {
                    http_response_code(404);
                    echo json_encode([
                        "success" => false,
                        "message" => "Review not found"
                    ]);
                    break;
                }
                
            } else {
                $data = $review->getAllReviews();
            }
                
            echo json_encode([
                "success" => true,
                "data" => $data
            ]);
             break;
        case "PATCH":
            $body = json_decode(file_get_contents("php://input"), true);

            $id = filter_var($body["id"] ?? null, FILTER_VALIDATE_INT);
            $status = $body["status"] ?? null;

            if (!$id || $id <= 0 || !in_array($status, ["pending", "approved", "hidden"], true)) {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "Invalid ID or status"]);
                break;
            }

            if (!$review->getReviewById($id)) {
                http_response_code(404);
                echo json_encode(["success" => false, "message" => "Review not found"]);
                break;
            }

            $review->updateStatus($id, $status);

            echo json_encode([
                "success" => true,
                "message" => "Review status updated successfully"
            ]);
            break;

        default:
            header("Allow: GET, PATCH");
            http_response_code(405);
            echo json_encode([
                "success" => false,
                "message" => "Method not allowed"
            ]);
            break;
        case "DELETE":
            $id = filter_var($_GET["id"] ?? null, FILTER_VALIDATE_INT);

            if (!$id || $id <= 0) {
                http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Invalid review ID"
                ]);
                break;
            }

            if (!$review->deleteReview($id)) {
                http_response_code(404);
                echo json_encode([
                    "success" => false,
                    "message" => "Review not found"
                ]);
                break;
            }

            echo json_encode([
                "success" => true,
                "message" => "Review deleted successfully"
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