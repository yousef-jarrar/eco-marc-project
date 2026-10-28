
<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../config/db.php";

try {

    $db = new Database();
    $connect = $db->connect();

    $sql = "SELECT id, name, percentage FROM discounts";

    $discounts = $connect->query($sql)->fetchAll();

    echo json_encode($discounts);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "message" => "Could not get discounts"
    ]);

}
?>
