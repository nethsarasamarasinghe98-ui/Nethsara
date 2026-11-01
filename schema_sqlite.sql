-- ============================================================
-- Database: ruhunu_products.db (SQLite 3)
-- System: RUHUNU PRODUCTS - Billing & Invoicing Suite
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- 1. Table structure for table `users`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `activity_history`;
DROP TABLE IF EXISTS `invoice_items`;
DROP TABLE IF EXISTS `invoices`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `settings`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
    `id` TEXT PRIMARY KEY,
    `username` TEXT NOT NULL UNIQUE,
    `password` TEXT NOT NULL,
    `role` TEXT NOT NULL DEFAULT 'user' CHECK (`role` IN ('admin', 'user')),
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 2. Table structure for table `settings`
-- ------------------------------------------------------------
CREATE TABLE `settings` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `company_name` TEXT NOT NULL DEFAULT 'RUHUNU PRODUCTS',
    `logo` TEXT,
    `address_line1` TEXT DEFAULT 'Main Street, Matara',
    `address_line2` TEXT DEFAULT 'Southern Province, Sri Lanka',
    `phone` TEXT DEFAULT '',
    `mobile_number` TEXT DEFAULT '+94 41 222 3333',
    `whatsapp_number` TEXT DEFAULT '+94 71 234 5678',
    `email` TEXT DEFAULT 'info@ruhunupurchases.com',
    `footer_note` TEXT DEFAULT 'Thank you for your business!',
    `terms_info` TEXT DEFAULT 'Please make cheques payable to Ruhunu Products.',
    `bank_name` TEXT DEFAULT 'Bank of Ceylon (BOC)',
    `account_name` TEXT DEFAULT 'Ruhunu Products',
    `account_number` TEXT DEFAULT '0012345678',
    `branch_name` TEXT DEFAULT 'Matara City Branch',
    `bank_details_position` TEXT DEFAULT 'left' CHECK (`bank_details_position` IN ('left', 'center', 'right')),
    `theme` TEXT DEFAULT 'light' CHECK (`theme` IN ('light', 'dark')),
    `header_color` TEXT DEFAULT '#16a34a',
    `logo_size` INTEGER DEFAULT 60,
    `watermark_image` TEXT,
    `watermark_size` INTEGER DEFAULT 50,
    `watermark_opacity` INTEGER DEFAULT 10,
    `logo_position` TEXT DEFAULT 'left' CHECK (`logo_position` IN ('left', 'right', 'top')),
    `company_details_alignment` TEXT DEFAULT 'left' CHECK (`company_details_alignment` IN ('left', 'center', 'right')),
    `empty_rows_count` INTEGER DEFAULT 4,
    `margin_top` INTEGER DEFAULT 0,
    `margin_right` INTEGER DEFAULT 20,
    `margin_bottom` INTEGER DEFAULT 20,
    `margin_left` INTEGER DEFAULT 20,
    `invoice_numbering_mode` TEXT DEFAULT 'auto' CHECK (`invoice_numbering_mode` IN ('auto', 'manual')),
    `auto_start_number` INTEGER DEFAULT 1,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 3. Table structure for table `customers`
-- ------------------------------------------------------------
CREATE TABLE `customers` (
    `id` TEXT PRIMARY KEY,
    `name` TEXT NOT NULL,
    `phone` TEXT,
    `email` TEXT,
    `address_line1` TEXT,
    `address_line2` TEXT,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX `idx_customers_name` ON `customers` (`name`);

-- ------------------------------------------------------------
-- 4. Table structure for table `products`
-- ------------------------------------------------------------
CREATE TABLE `products` (
    `id` TEXT PRIMARY KEY,
    `code` TEXT,
    `name` TEXT NOT NULL,
    `price` REAL NOT NULL DEFAULT 0.0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX `idx_products_code` ON `products` (`code`);

-- ------------------------------------------------------------
-- 5. Table structure for table `invoices`
-- ------------------------------------------------------------
CREATE TABLE `invoices` (
    `id` TEXT PRIMARY KEY,
    `invoice_number` TEXT NOT NULL UNIQUE,
    `customer_id` TEXT,
    `date` TEXT NOT NULL,
    `shipping_fee` REAL NOT NULL DEFAULT 0.0,
    `hide_bank_details` INTEGER NOT NULL DEFAULT 0,
    `subtotal` REAL NOT NULL DEFAULT 0.0,
    `tax_rate` REAL NOT NULL DEFAULT 0.0,
    `total` REAL NOT NULL DEFAULT 0.0,
    `amount_paid` REAL NOT NULL DEFAULT 0.0,
    `balance` REAL NOT NULL DEFAULT 0.0,
    `status` TEXT NOT NULL DEFAULT 'Unpaid' CHECK (`status` IN ('Paid', 'Partial', 'Unpaid')),
    `manual_invoice_number` TEXT,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX `idx_invoices_date` ON `invoices` (`date`);
CREATE INDEX `idx_invoices_customer_id` ON `invoices` (`customer_id`);
CREATE INDEX `idx_invoices_status` ON `invoices` (`status`);

-- ------------------------------------------------------------
-- 6. Table structure for table `invoice_items`
-- ------------------------------------------------------------
CREATE TABLE `invoice_items` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `invoice_id` TEXT NOT NULL,
    `product_id` TEXT,
    `description` TEXT NOT NULL,
    `qty` REAL NOT NULL DEFAULT 1.0,
    `price` REAL NOT NULL DEFAULT 0.0,
    `line_total` REAL GENERATED ALWAYS AS (`qty` * `price`) STORED,
    FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX `idx_invoice_items_invoice_id` ON `invoice_items` (`invoice_id`);

-- ------------------------------------------------------------
-- 7. Table structure for table `activity_history`
-- ------------------------------------------------------------
CREATE TABLE `activity_history` (
    `id` TEXT PRIMARY KEY,
    `action` TEXT NOT NULL,
    `details` TEXT,
    `user` TEXT NOT NULL DEFAULT 'System',
    `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX `idx_history_date` ON `activity_history` (`date`);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO `users` (`id`, `username`, `password`, `role`) VALUES
('usr_admin_001', 'admin', 'password', 'admin'),
('usr_user_002', 'user', 'password', 'user');

INSERT INTO `settings` (
    `id`, `company_name`, `logo`, `address_line1`, `address_line2`,
    `phone`, `mobile_number`, `whatsapp_number`, `email`,
    `footer_note`, `terms_info`, `bank_name`, `account_name`,
    `account_number`, `branch_name`, `bank_details_position`,
    `theme`, `header_color`, `logo_size`, `watermark_image`,
    `watermark_size`, `watermark_opacity`, `logo_position`,
    `company_details_alignment`, `empty_rows_count`,
    `margin_top`, `margin_right`, `margin_bottom`, `margin_left`,
    `invoice_numbering_mode`, `auto_start_number`
) VALUES (
    1,
    'RUHUNU PRODUCTS',
    'logo.png',
    'Main Street, Matara',
    'Southern Province, Sri Lanka',
    '',
    '+94 41 222 3333',
    '+94 71 234 5678',
    'info@ruhunupurchases.com',
    'Thank you for your business!',
    'Please make cheques payable to Ruhunu Products.',
    'Bank of Ceylon (BOC)',
    'Ruhunu Products',
    '0012345678',
    'Matara City Branch',
    'left',
    'light',
    '#16a34a',
    60,
    '',
    50,
    10,
    'left',
    'left',
    4,
    0,
    20,
    20,
    20,
    'auto',
    1
);

INSERT INTO `products` (`id`, `code`, `name`, `price`) VALUES
('prod_001', 'RP-CP100', 'Ruhunu Chilli Powder 100g', 180.00),
('prod_002', 'RP-CR100', 'Ruhunu Curry Powder 100g', 190.00),
('prod_003', 'RP-TP050', 'Ruhunu Turmeric Powder 50g', 150.00),
('prod_004', 'RP-BP100', 'Ruhunu Black Pepper Powder 100g', 320.00),
('prod_005', 'RP-RD500', 'Ruhunu Roasted Rice Flour 500g', 220.00);

INSERT INTO `customers` (`id`, `name`, `phone`, `email`, `address_line1`, `address_line2`) VALUES
('cust_001', 'Perera Super Center', '+94 77 123 4567', 'pererastores@gmail.com', 'No. 45, Galle Road', 'Matara'),
('cust_002', 'Southern Grocery Mart', '+94 71 987 6543', 'southerngrocery@gmail.com', 'Station Road', 'Weligama'),
('cust_003', 'Ruhunu Traders', '+94 41 555 7890', 'ruhunu.traders@outlook.com', 'Kandy Road', 'Akuressa');

INSERT INTO `invoices` (
    `id`, `invoice_number`, `customer_id`, `date`,
    `shipping_fee`, `hide_bank_details`, `subtotal`,
    `tax_rate`, `total`, `amount_paid`, `balance`, `status`, `manual_invoice_number`
) VALUES (
    'inv_001', 'INV-2026-0001', 'cust_001', '2026-11-02',
    150.00, 0, 7000.00,
    0.00, 7150.00, 7150.00, 0.00, 'Paid', ''
);

INSERT INTO `invoice_items` (`invoice_id`, `product_id`, `description`, `qty`, `price`) VALUES
('inv_001', 'prod_001', 'Ruhunu Chilli Powder 100g', 20.00, 180.00),
('inv_001', 'prod_002', 'Ruhunu Curry Powder 100g', 10.00, 190.00),
('inv_001', 'prod_004', 'Ruhunu Black Pepper Powder 100g', 5.00, 320.00);

INSERT INTO `activity_history` (`id`, `action`, `details`, `user`, `date`) VALUES
('act_001', 'System Init', 'System database initialized successfully', 'System', '2026-11-02 01:00:00'),
('act_002', 'Create Invoice', 'Created new invoice: INV-2026-0001', 'admin', '2026-11-02 01:30:00');
