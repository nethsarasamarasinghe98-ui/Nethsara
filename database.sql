-- ============================================================
-- Database: ruhunu_products_db
-- System: RUHUNU PRODUCTS - Billing & Invoicing Suite
-- Target RDBMS: MySQL 8.0+ / MariaDB 10.4+ / phpMyAdmin compatible
-- Character Set: utf8mb4 / utf8mb4_unicode_ci
-- Created on: 2026-11-02
-- ============================================================

CREATE DATABASE IF NOT EXISTS `ruhunu_products_db`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `ruhunu_products_db`;

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
    `id` VARCHAR(50) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. Table structure for table `settings` (Company & Invoice Template)
-- ------------------------------------------------------------
CREATE TABLE `settings` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `company_name` VARCHAR(255) NOT NULL DEFAULT 'RUHUNU PRODUCTS',
    `logo` LONGTEXT NULL COMMENT 'Base64 image string or URL',
    `address_line1` VARCHAR(255) DEFAULT 'Main Street, Matara',
    `address_line2` VARCHAR(255) DEFAULT 'Southern Province, Sri Lanka',
    `phone` VARCHAR(50) DEFAULT '',
    `mobile_number` VARCHAR(50) DEFAULT '+94 41 222 3333',
    `whatsapp_number` VARCHAR(50) DEFAULT '+94 71 234 5678',
    `email` VARCHAR(100) DEFAULT 'info@ruhunupurchases.com',
    `footer_note` TEXT DEFAULT 'Thank you for your business!',
    `terms_info` TEXT DEFAULT 'Please make cheques payable to Ruhunu Products.',
    `bank_name` VARCHAR(100) DEFAULT 'Bank of Ceylon (BOC)',
    `account_name` VARCHAR(100) DEFAULT 'Ruhunu Products',
    `account_number` VARCHAR(50) DEFAULT '0012345678',
    `branch_name` VARCHAR(100) DEFAULT 'Matara City Branch',
    `bank_details_position` ENUM('left', 'center', 'right') DEFAULT 'left',
    `theme` ENUM('light', 'dark') DEFAULT 'light',
    `header_color` VARCHAR(20) DEFAULT '#16a34a',
    `logo_size` INT DEFAULT 60,
    `watermark_image` LONGTEXT NULL,
    `watermark_size` INT DEFAULT 50,
    `watermark_opacity` INT DEFAULT 10,
    `logo_position` ENUM('left', 'right', 'top') DEFAULT 'left',
    `company_details_alignment` ENUM('left', 'center', 'right') DEFAULT 'left',
    `empty_rows_count` INT DEFAULT 4,
    `margin_top` INT DEFAULT 0,
    `margin_right` INT DEFAULT 20,
    `margin_bottom` INT DEFAULT 20,
    `margin_left` INT DEFAULT 20,
    `invoice_numbering_mode` ENUM('auto', 'manual') DEFAULT 'auto',
    `auto_start_number` INT DEFAULT 1,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. Table structure for table `customers`
-- ------------------------------------------------------------
CREATE TABLE `customers` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) DEFAULT NULL,
    `email` VARCHAR(100) DEFAULT NULL,
    `address_line1` VARCHAR(255) DEFAULT NULL,
    `address_line2` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_customers_name` (`name`),
    INDEX `idx_customers_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. Table structure for table `products`
-- ------------------------------------------------------------
CREATE TABLE `products` (
    `id` VARCHAR(50) NOT NULL,
    `code` VARCHAR(50) DEFAULT NULL,
    `name` VARCHAR(255) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_products_code` (`code`),
    INDEX `idx_products_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. Table structure for table `invoices`
-- ------------------------------------------------------------
CREATE TABLE `invoices` (
    `id` VARCHAR(50) NOT NULL,
    `invoice_number` VARCHAR(50) NOT NULL,
    `customer_id` VARCHAR(50) NULL,
    `date` DATE NOT NULL,
    `shipping_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `hide_bank_details` TINYINT(1) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `amount_paid` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `balance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('Paid', 'Partial', 'Unpaid') NOT NULL DEFAULT 'Unpaid',
    `manual_invoice_number` VARCHAR(50) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_invoice_number` (`invoice_number`),
    INDEX `idx_invoices_date` (`date`),
    INDEX `idx_invoices_customer_id` (`customer_id`),
    INDEX `idx_invoices_status` (`status`),
    CONSTRAINT `fk_invoices_customer` 
        FOREIGN KEY (`customer_id`) 
        REFERENCES `customers` (`id`) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 6. Table structure for table `invoice_items`
-- ------------------------------------------------------------
CREATE TABLE `invoice_items` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `invoice_id` VARCHAR(50) NOT NULL,
    `product_id` VARCHAR(50) NULL,
    `description` VARCHAR(255) NOT NULL,
    `qty` DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `line_total` DECIMAL(12, 2) GENERATED ALWAYS AS (`qty` * `price`) STORED,
    PRIMARY KEY (`id`),
    INDEX `idx_invoice_items_invoice_id` (`invoice_id`),
    INDEX `idx_invoice_items_product_id` (`product_id`),
    CONSTRAINT `fk_items_invoice` 
        FOREIGN KEY (`invoice_id`) 
        REFERENCES `invoices` (`id`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT `fk_items_product` 
        FOREIGN KEY (`product_id`) 
        REFERENCES `products` (`id`) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 7. Table structure for table `activity_history`
-- ------------------------------------------------------------
CREATE TABLE `activity_history` (
    `id` VARCHAR(50) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `details` TEXT DEFAULT NULL,
    `user` VARCHAR(50) NOT NULL DEFAULT 'System',
    `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_history_date` (`date`),
    INDEX `idx_history_user` (`user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Seed Users (Default admin and standard user)
INSERT INTO `users` (`id`, `username`, `password`, `role`) VALUES
('usr_admin_001', 'admin', 'password', 'admin'),
('usr_user_002', 'user', 'password', 'user');

-- Seed Settings
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

-- Seed Sample Products
INSERT INTO `products` (`id`, `code`, `name`, `price`) VALUES
('prod_001', 'RP-CP100', 'Ruhunu Chilli Powder 100g', 180.00),
('prod_002', 'RP-CR100', 'Ruhunu Curry Powder 100g', 190.00),
('prod_003', 'RP-TP050', 'Ruhunu Turmeric Powder 50g', 150.00),
('prod_004', 'RP-BP100', 'Ruhunu Black Pepper Powder 100g', 320.00),
('prod_005', 'RP-RD500', 'Ruhunu Roasted Rice Flour 500g', 220.00);

-- Seed Sample Customers
INSERT INTO `customers` (`id`, `name`, `phone`, `email`, `address_line1`, `address_line2`) VALUES
('cust_001', 'Perera Super Center', '+94 77 123 4567', 'pererastores@gmail.com', 'No. 45, Galle Road', 'Matara'),
('cust_002', 'Southern Grocery Mart', '+94 71 987 6543', 'southerngrocery@gmail.com', 'Station Road', 'Weligama'),
('cust_003', 'Ruhunu Traders', '+94 41 555 7890', 'ruhunu.traders@outlook.com', 'Kandy Road', 'Akuressa');

-- Seed Sample Invoice
INSERT INTO `invoices` (
    `id`, `invoice_number`, `customer_id`, `date`,
    `shipping_fee`, `hide_bank_details`, `subtotal`,
    `tax_rate`, `total`, `amount_paid`, `balance`, `status`, `manual_invoice_number`
) VALUES (
    'inv_001', 'INV-2026-0001', 'cust_001', '2026-11-02',
    150.00, 0, 7000.00,
    0.00, 7150.00, 7150.00, 0.00, 'Paid', ''
);

-- Seed Sample Invoice Items
INSERT INTO `invoice_items` (`invoice_id`, `product_id`, `description`, `qty`, `price`) VALUES
('inv_001', 'prod_001', 'Ruhunu Chilli Powder 100g', 20.00, 180.00),
('inv_001', 'prod_002', 'Ruhunu Curry Powder 100g', 10.00, 190.00),
('inv_001', 'prod_004', 'Ruhunu Black Pepper Powder 100g', 5.00, 320.00);

-- Seed Initial Activity Logs
INSERT INTO `activity_history` (`id`, `action`, `details`, `user`, `date`) VALUES
('act_001', 'System Init', 'System database initialized successfully', 'System', '2026-11-02 01:00:00'),
('act_002', 'Create Invoice', 'Created new invoice: INV-2026-0001', 'admin', '2026-11-02 01:30:00');
