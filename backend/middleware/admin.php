<?php
function requireAdmin(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    if (!isset($_SESSION["user_id"])) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Authentication required"
        ]);
        exit;
    }

    if (($_SESSION["role"] ?? null) !== "admin") {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Admin access required"
        ]);
        exit;
    }
}