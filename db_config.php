<?php
// ============================================================
// Database Configuration for Live Web Hosting (cPanel / Apache / PHP)
// System: RUHUNU PRODUCTS Billing Suite
// ============================================================

define('DB_HOST', 'localhost');              // Database host (usually localhost on cPanel)
define('DB_NAME', 'ruhunu_products_db');     // Database name created in cPanel / MySQL
define('DB_USER', 'root');                   // Your MySQL username
define('DB_PASS', '');                       // Your MySQL password
define('DB_CHARSET', 'utf8mb4');

function getDbConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Database connection failed: ' . $e->getMessage(),
                'hint' => 'Please check your database credentials in db_config.php and ensure database.sql is imported.'
            ]);
            exit;
        }
    }
    return $pdo;
}
