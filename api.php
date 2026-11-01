<?php
// ============================================================
// Live Web Hosting REST API for RUHUNU PRODUCTS Billing Suite
// Works on any shared hosting / cPanel / Apache / Nginx with MySQL
// ============================================================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/db_config.php';
$pdo = getDbConnection();

// Determine route
$route = $_GET['route'] ?? '';
if (empty($route)) {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if (preg_match('#(?:/api/|api\.php/)(.+)#', $uri, $matches)) {
        $route = $matches[1];
    } elseif (preg_match('#/api$#', $uri)) {
        $route = 'data';
    }
}
$route = trim($route, '/');
$method = $_SERVER['REQUEST_METHOD'];

function getJsonInput() {
    $raw = file_get_contents('php://input');
    return !empty($raw) ? json_decode($raw, true) : [];
}

try {
    // ----------------------------------------------------
    // GET status
    // ----------------------------------------------------
    if ($route === 'status' && $method === 'GET') {
        echo json_encode(['status' => 'ok', 'database' => 'MySQL Live Connected', 'time' => date('c')]);
        exit;
    }

    // ----------------------------------------------------
    // GET data (Full Data Load)
    // ----------------------------------------------------
    if (($route === 'data' || empty($route)) && $method === 'GET') {
        // Users
        $users = $pdo->query("SELECT id, username, password, role FROM users")->fetchAll();

        // Settings
        $sRow = $pdo->query("SELECT * FROM settings WHERE id = 1")->fetch() ?: [];
        $settings = [
            'companyName' => $sRow['company_name'] ?? 'RUHUNU PRODUCTS',
            'logo' => $sRow['logo'] ?? '',
            'address' => '',
            'addressLine1' => $sRow['address_line1'] ?? '',
            'addressLine2' => $sRow['address_line2'] ?? '',
            'phone' => $sRow['phone'] ?? '',
            'mobileNumber' => $sRow['mobile_number'] ?? '',
            'whatsappNumber' => $sRow['whatsapp_number'] ?? '',
            'email' => $sRow['email'] ?? '',
            'footerNote' => $sRow['footer_note'] ?? 'Thank you for your business!',
            'termsInfo' => $sRow['terms_info'] ?? 'Please make cheques payable to Ruhunu Products.',
            'bankDetails' => [
                'bankName' => $sRow['bank_name'] ?? '',
                'accountName' => $sRow['account_name'] ?? '',
                'accountNumber' => $sRow['account_number'] ?? '',
                'branchName' => $sRow['branch_name'] ?? '',
                'position' => $sRow['bank_details_position'] ?? 'left',
            ],
            'theme' => $sRow['theme'] ?? 'light',
            'headerColor' => $sRow['header_color'] ?? '#16a34a',
            'logoSize' => isset($sRow['logo_size']) ? (int)$sRow['logo_size'] : 60,
            'watermarkImage' => $sRow['watermark_image'] ?? '',
            'watermarkSize' => isset($sRow['watermark_size']) ? (int)$sRow['watermark_size'] : 50,
            'watermarkOpacity' => isset($sRow['watermark_opacity']) ? (int)$sRow['watermark_opacity'] : 10,
            'logoPosition' => $sRow['logo_position'] ?? 'left',
            'companyDetailsAlignment' => $sRow['company_details_alignment'] ?? 'left',
            'emptyRowsCount' => isset($sRow['empty_rows_count']) ? (int)$sRow['empty_rows_count'] : 4,
            'margins' => [
                'top' => isset($sRow['margin_top']) ? (int)$sRow['margin_top'] : 0,
                'right' => isset($sRow['margin_right']) ? (int)$sRow['margin_right'] : 20,
                'bottom' => isset($sRow['margin_bottom']) ? (int)$sRow['margin_bottom'] : 20,
                'left' => isset($sRow['margin_left']) ? (int)$sRow['margin_left'] : 20,
            ],
            'invoiceNumberingMode' => $sRow['invoice_numbering_mode'] ?? 'auto',
            'autoStartNumber' => isset($sRow['auto_start_number']) ? (int)$sRow['auto_start_number'] : 1,
        ];

        // Products
        $products = $pdo->query("SELECT id, code, name, CAST(price AS DECIMAL(10,2)) as price FROM products ORDER BY name ASC")->fetchAll();
        foreach ($products as &$p) { $p['price'] = (float)$p['price']; }

        // Customers
        $cRows = $pdo->query("SELECT id, name, phone, email, address_line1 as addressLine1, address_line2 as addressLine2 FROM customers ORDER BY name ASC")->fetchAll();

        // Invoices with items
        $iRows = $pdo->query("SELECT * FROM invoices ORDER BY date DESC")->fetchAll();
        $itemStmt = $pdo->prepare("SELECT product_id as productId, description, qty, price FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC");
        $invoices = [];
        foreach ($iRows as $inv) {
            $itemStmt->execute([$inv['id']]);
            $rawItems = $itemStmt->fetchAll();
            $items = array_map(function($it) {
                return [
                    'productId' => $it['productId'] ?: '',
                    'description' => $it['description'] ?: '',
                    'qty' => (float)$it['qty'],
                    'price' => (float)$it['price'],
                ];
            }, $rawItems);

            $invoices[] = [
                'id' => $inv['id'],
                'invoiceNumber' => $inv['invoice_number'],
                'customerId' => $inv['customer_id'] ?: '',
                'date' => $inv['date'],
                'shippingFee' => (float)$inv['shipping_fee'],
                'hideBankDetails' => (bool)$inv['hide_bank_details'],
                'subtotal' => (float)$inv['subtotal'],
                'taxRate' => (float)$inv['tax_rate'],
                'total' => (float)$inv['total'],
                'amountPaid' => (float)$inv['amount_paid'],
                'balance' => (float)$inv['balance'],
                'status' => $inv['status'] ?: 'Unpaid',
                'manualInvoiceNumber' => $inv['manual_invoice_number'] ?: '',
                'items' => $items,
            ];
        }

        // History
        $history = $pdo->query("SELECT id, action, details, user, date FROM activity_history ORDER BY date DESC LIMIT 500")->fetchAll();

        echo json_encode([
            'users' => $users,
            'settings' => $settings,
            'products' => $products,
            'customers' => $cRows,
            'invoices' => $invoices,
            'history' => $history
        ]);
        exit;
    }

    // ----------------------------------------------------
    // POST /api/sync (Full / Real-Time Sync)
    // ----------------------------------------------------
    if ($route === 'sync' && $method === 'POST') {
        $body = getJsonInput();

        $pdo->beginTransaction();

        // 1. Settings
        if (!empty($body['settings'])) {
            $s = $body['settings'];
            $b = $s['bankDetails'] ?? [];
            $m = $s['margins'] ?? [];
            $stmt = $pdo->prepare("
                INSERT INTO settings (
                    id, company_name, logo, address_line1, address_line2, phone, mobile_number,
                    whatsapp_number, email, footer_note, terms_info, bank_name, account_name,
                    account_number, branch_name, bank_details_position, theme, header_color,
                    logo_size, watermark_image, watermark_size, watermark_opacity, logo_position,
                    company_details_alignment, empty_rows_count, margin_top, margin_right,
                    margin_bottom, margin_left, invoice_numbering_mode, auto_start_number
                ) VALUES (
                    1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                ) ON DUPLICATE KEY UPDATE
                    company_name = VALUES(company_name),
                    logo = VALUES(logo),
                    address_line1 = VALUES(address_line1),
                    address_line2 = VALUES(address_line2),
                    phone = VALUES(phone),
                    mobile_number = VALUES(mobile_number),
                    whatsapp_number = VALUES(whatsapp_number),
                    email = VALUES(email),
                    footer_note = VALUES(footer_note),
                    terms_info = VALUES(terms_info),
                    bank_name = VALUES(bank_name),
                    account_name = VALUES(account_name),
                    account_number = VALUES(account_number),
                    branch_name = VALUES(branch_name),
                    bank_details_position = VALUES(bank_details_position),
                    theme = VALUES(theme),
                    header_color = VALUES(header_color),
                    logo_size = VALUES(logo_size),
                    watermark_image = VALUES(watermark_image),
                    watermark_size = VALUES(watermark_size),
                    watermark_opacity = VALUES(watermark_opacity),
                    logo_position = VALUES(logo_position),
                    company_details_alignment = VALUES(company_details_alignment),
                    empty_rows_count = VALUES(empty_rows_count),
                    margin_top = VALUES(margin_top),
                    margin_right = VALUES(margin_right),
                    margin_bottom = VALUES(margin_bottom),
                    margin_left = VALUES(margin_left),
                    invoice_numbering_mode = VALUES(invoice_numbering_mode),
                    auto_start_number = VALUES(auto_start_number)
            ");
            $stmt->execute([
                $s['companyName'] ?? 'RUHUNU PRODUCTS',
                $s['logo'] ?? '',
                $s['addressLine1'] ?? '',
                $s['addressLine2'] ?? '',
                $s['phone'] ?? '',
                $s['mobileNumber'] ?? '',
                $s['whatsappNumber'] ?? '',
                $s['email'] ?? '',
                $s['footerNote'] ?? '',
                $s['termsInfo'] ?? '',
                $b['bankName'] ?? '',
                $b['accountName'] ?? '',
                $b['accountNumber'] ?? '',
                $b['branchName'] ?? '',
                $b['position'] ?? 'left',
                $s['theme'] ?? 'light',
                $s['headerColor'] ?? '#16a34a',
                (int)($s['logoSize'] ?? 60),
                $s['watermarkImage'] ?? '',
                (int)($s['watermarkSize'] ?? 50),
                (int)($s['watermarkOpacity'] ?? 10),
                $s['logoPosition'] ?? 'left',
                $s['companyDetailsAlignment'] ?? 'left',
                (int)($s['emptyRowsCount'] ?? 4),
                (int)($m['top'] ?? 0),
                (int)($m['right'] ?? 20),
                (int)($m['bottom'] ?? 20),
                (int)($m['left'] ?? 20),
                $s['invoiceNumberingMode'] ?? 'auto',
                (int)($s['autoStartNumber'] ?? 1),
            ]);
        }

        // 2. Customers
        if (isset($body['customers']) && is_array($body['customers'])) {
            $ids = array_filter(array_column($body['customers'], 'id'));
            if (!empty($ids)) {
                $inQuery = implode(',', array_fill(0, count($ids), '?'));
                $delStmt = $pdo->prepare("DELETE FROM customers WHERE id NOT IN ($inQuery)");
                $delStmt->execute($ids);
            }
            $cStmt = $pdo->prepare("
                INSERT INTO customers (id, name, phone, email, address_line1, address_line2)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name), phone = VALUES(phone), email = VALUES(email),
                    address_line1 = VALUES(address_line1), address_line2 = VALUES(address_line2)
            ");
            foreach ($body['customers'] as $c) {
                $cStmt->execute([
                    $c['id'], $c['name'], $c['phone'] ?? '', $c['email'] ?? '',
                    $c['addressLine1'] ?? '', $c['addressLine2'] ?? ''
                ]);
            }
        }

        // 3. Products
        if (isset($body['products']) && is_array($body['products'])) {
            $ids = array_filter(array_column($body['products'], 'id'));
            if (!empty($ids)) {
                $inQuery = implode(',', array_fill(0, count($ids), '?'));
                $delStmt = $pdo->prepare("DELETE FROM products WHERE id NOT IN ($inQuery)");
                $delStmt->execute($ids);
            }
            $pStmt = $pdo->prepare("
                INSERT INTO products (id, code, name, price)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    code = VALUES(code), name = VALUES(name), price = VALUES(price)
            ");
            foreach ($body['products'] as $p) {
                $pStmt->execute([
                    $p['id'], $p['code'] ?? '', $p['name'], (float)($p['price'] ?? 0)
                ]);
            }
        }

        // 4. Invoices & Items
        if (isset($body['invoices']) && is_array($body['invoices'])) {
            $ids = array_filter(array_column($body['invoices'], 'id'));
            if (!empty($ids)) {
                $inQuery = implode(',', array_fill(0, count($ids), '?'));
                $delStmt = $pdo->prepare("DELETE FROM invoices WHERE id NOT IN ($inQuery)");
                $delStmt->execute($ids);
            }
            $invStmt = $pdo->prepare("
                INSERT INTO invoices (
                    id, invoice_number, customer_id, date, shipping_fee, hide_bank_details,
                    subtotal, tax_rate, total, amount_paid, balance, status, manual_invoice_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    invoice_number = VALUES(invoice_number), customer_id = VALUES(customer_id),
                    date = VALUES(date), shipping_fee = VALUES(shipping_fee),
                    hide_bank_details = VALUES(hide_bank_details), subtotal = VALUES(subtotal),
                    tax_rate = VALUES(tax_rate), total = VALUES(total), amount_paid = VALUES(amount_paid),
                    balance = VALUES(balance), status = VALUES(status), manual_invoice_number = VALUES(manual_invoice_number)
            ");
            $delItemsStmt = $pdo->prepare("DELETE FROM invoice_items WHERE invoice_id = ?");
            $insItemStmt = $pdo->prepare("
                INSERT INTO invoice_items (invoice_id, product_id, description, qty, price)
                VALUES (?, ?, ?, ?, ?)
            ");

            foreach ($body['invoices'] as $inv) {
                $custId = !empty($inv['customerId']) ? $inv['customerId'] : null;
                $invStmt->execute([
                    $inv['id'], $inv['invoiceNumber'], $custId, $inv['date'],
                    (float)($inv['shippingFee'] ?? 0), !empty($inv['hideBankDetails']) ? 1 : 0,
                    (float)($inv['subtotal'] ?? 0), (float)($inv['taxRate'] ?? 0),
                    (float)($inv['total'] ?? 0), (float)($inv['amountPaid'] ?? 0),
                    (float)($inv['balance'] ?? 0), $inv['status'] ?? 'Unpaid',
                    $inv['manualInvoiceNumber'] ?? ''
                ]);

                $delItemsStmt->execute([$inv['id']]);
                if (!empty($inv['items']) && is_array($inv['items'])) {
                    foreach ($inv['items'] as $item) {
                        if (!empty($item['productId']) || !empty($item['description'])) {
                            $prodId = !empty($item['productId']) ? $item['productId'] : null;
                            $insItemStmt->execute([
                                $inv['id'], $prodId, $item['description'] ?? '',
                                (float)($item['qty'] ?? 1), (float)($item['price'] ?? 0)
                            ]);
                        }
                    }
                }
            }
        }

        // 5. Users
        if (isset($body['users']) && is_array($body['users'])) {
            $uStmt = $pdo->prepare("
                INSERT INTO users (id, username, password, role)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    username = VALUES(username), password = VALUES(password), role = VALUES(role)
            ");
            foreach ($body['users'] as $u) {
                $uStmt->execute([
                    $u['id'], $u['username'], $u['password'], $u['role'] ?? 'user'
                ]);
            }
        }

        // 6. History
        if (!empty($body['history']) && is_array($body['history'])) {
            $hStmt = $pdo->prepare("
                INSERT IGNORE INTO activity_history (id, action, details, user, date)
                VALUES (?, ?, ?, ?, ?)
            ");
            foreach (array_slice($body['history'], 0, 10) as $h) {
                $hStmt->execute([
                    $h['id'], $h['action'], $h['details'] ?? '', $h['user'] ?? 'System', $h['date'] ?? date('Y-m-d H:i:s')
                ]);
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Synced to MySQL database successfully']);
        exit;
    }

    // ----------------------------------------------------
    // Granular Endpoints
    // ----------------------------------------------------
    if (strpos($route, 'customers') === 0) {
        if ($method === 'POST') {
            $c = getJsonInput();
            $stmt = $pdo->prepare("
                INSERT INTO customers (id, name, phone, email, address_line1, address_line2)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name), phone = VALUES(phone), email = VALUES(email),
                    address_line1 = VALUES(address_line1), address_line2 = VALUES(address_line2)
            ");
            $stmt->execute([$c['id'], $c['name'], $c['phone'] ?? '', $c['email'] ?? '', $c['addressLine1'] ?? '', $c['addressLine2'] ?? '']);
            echo json_encode(['success' => true]);
            exit;
        } elseif ($method === 'DELETE') {
            $parts = explode('/', $route);
            $id = end($parts);
            $stmt = $pdo->prepare("DELETE FROM customers WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'id' => $id]);
            exit;
        }
    }

    if (strpos($route, 'products') === 0) {
        if ($method === 'POST') {
            $p = getJsonInput();
            $stmt = $pdo->prepare("
                INSERT INTO products (id, code, name, price)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    code = VALUES(code), name = VALUES(name), price = VALUES(price)
            ");
            $stmt->execute([$p['id'], $p['code'] ?? '', $p['name'], (float)($p['price'] ?? 0)]);
            echo json_encode(['success' => true]);
            exit;
        } elseif ($method === 'DELETE') {
            $parts = explode('/', $route);
            $id = end($parts);
            $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'id' => $id]);
            exit;
        }
    }

    if (strpos($route, 'invoices') === 0) {
        if ($method === 'DELETE') {
            $parts = explode('/', $route);
            $id = end($parts);
            $stmt = $pdo->prepare("DELETE FROM invoices WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'id' => $id]);
            exit;
        }
    }

    http_response_code(404);
    echo json_encode(['error' => 'Endpoint not found: ' . $route]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
