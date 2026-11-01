// ============================================================
// RUHUNU PRODUCTS - Billing & Invoicing Suite
// Local Backend Server with instant SQLite persistence
// Zero external npm dependencies required (uses node:sqlite)
// ============================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite');
const JSON_PATH = path.join(__dirname, 'database.json');
const SCHEMA_PATH = path.join(__dirname, 'schema_sqlite.sql');

// Initialize Database connection
let db;
try {
    const exists = fs.existsSync(DB_PATH);
    db = new DatabaseSync(DB_PATH);
    if (!exists && fs.existsSync(SCHEMA_PATH)) {
        console.log('[DB] Initializing new SQLite database from schema...');
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
        db.exec(schema);
    }
    console.log(`[DB] Connected to SQLite database: ${DB_PATH}`);
} catch (err) {
    console.error('[DB ERROR] Failed to open SQLite database:', err);
    process.exit(1);
}

// Helper: sync SQLite to database.json as human-readable backup
function syncToJsonFile() {
    try {
        const data = getAllData();
        fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.warn('[BACKUP] Failed to write database.json:', e.message);
    }
}

// Read all database records in app.js format
function getAllData() {
    // 1. Users
    const users = db.prepare('SELECT id, username, password, role FROM users').all();

    // 2. Settings
    const sRow = db.prepare('SELECT * FROM settings WHERE id = 1').get() || {};
    const settings = {
        companyName: sRow.company_name || 'RUHUNU PRODUCTS',
        logo: sRow.logo || '',
        address: '',
        addressLine1: sRow.address_line1 || '',
        addressLine2: sRow.address_line2 || '',
        phone: sRow.phone || '',
        mobileNumber: sRow.mobile_number || '',
        whatsappNumber: sRow.whatsapp_number || '',
        email: sRow.email || '',
        footerNote: sRow.footer_note || 'Thank you for your business!',
        termsInfo: sRow.terms_info || 'Please make cheques payable to Ruhunu Products.',
        bankDetails: {
            bankName: sRow.bank_name || '',
            accountName: sRow.account_name || '',
            accountNumber: sRow.account_number || '',
            branchName: sRow.branch_name || '',
            position: sRow.bank_details_position || 'left'
        },
        theme: sRow.theme || 'light',
        headerColor: sRow.header_color || '#16a34a',
        logoSize: sRow.logo_size !== undefined ? sRow.logo_size : 60,
        watermarkImage: sRow.watermark_image || '',
        watermarkSize: sRow.watermark_size !== undefined ? sRow.watermark_size : 50,
        watermarkOpacity: sRow.watermark_opacity !== undefined ? sRow.watermark_opacity : 10,
        logoPosition: sRow.logo_position || 'left',
        companyDetailsAlignment: sRow.company_details_alignment || 'left',
        emptyRowsCount: sRow.empty_rows_count !== undefined ? sRow.empty_rows_count : 4,
        margins: {
            top: sRow.margin_top || 0,
            right: sRow.margin_right || 20,
            bottom: sRow.margin_bottom || 20,
            left: sRow.margin_left || 20
        },
        invoiceNumberingMode: sRow.invoice_numbering_mode || 'auto',
        autoStartNumber: sRow.auto_start_number || 1
    };

    // 3. Products
    const products = db.prepare('SELECT id, code, name, price FROM products ORDER BY name ASC').all();

    // 4. Customers
    const cRows = db.prepare('SELECT id, name, phone, email, address_line1, address_line2 FROM customers ORDER BY name ASC').all();
    const customers = cRows.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        addressLine1: c.address_line1 || '',
        addressLine2: c.address_line2 || ''
    }));

    // 5. Invoices & Line Items
    const iRows = db.prepare('SELECT * FROM invoices ORDER BY date DESC').all();
    const getItems = db.prepare('SELECT product_id, description, qty, price FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC');
    const invoices = iRows.map(inv => {
        const rawItems = getItems.all(inv.id);
        const items = rawItems.map(it => ({
            productId: it.product_id || '',
            description: it.description || '',
            qty: Number(it.qty) || 1,
            price: Number(it.price) || 0
        }));
        return {
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            customerId: inv.customer_id || '',
            date: inv.date,
            shippingFee: Number(inv.shipping_fee) || 0,
            hideBankDetails: Boolean(inv.hide_bank_details),
            subtotal: Number(inv.subtotal) || 0,
            taxRate: Number(inv.tax_rate) || 0,
            total: Number(inv.total) || 0,
            amountPaid: Number(inv.amount_paid) || 0,
            balance: Number(inv.balance) || 0,
            status: inv.status || 'Unpaid',
            manualInvoiceNumber: inv.manual_invoice_number || '',
            items: items
        };
    });

    // 6. Activity History
    const history = db.prepare('SELECT id, action, details, user, date FROM activity_history ORDER BY date DESC LIMIT 500').all();

    return { users, settings, products, customers, invoices, history };
}

// Database Mutators
function upsertCustomer(c) {
    const stmt = db.prepare(`
        INSERT INTO customers (id, name, phone, email, address_line1, address_line2, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            phone = excluded.phone,
            email = excluded.email,
            address_line1 = excluded.address_line1,
            address_line2 = excluded.address_line2,
            updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(c.id, c.name, c.phone || '', c.email || '', c.addressLine1 || '', c.addressLine2 || '');
    syncToJsonFile();
}

function deleteCustomer(id) {
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    syncToJsonFile();
}

function upsertProduct(p) {
    const stmt = db.prepare(`
        INSERT INTO products (id, code, name, price, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            code = excluded.code,
            name = excluded.name,
            price = excluded.price,
            updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(p.id, p.code || '', p.name, Number(p.price) || 0);
    syncToJsonFile();
}

function deleteProduct(id) {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    syncToJsonFile();
}

function upsertInvoice(inv) {
    // Upsert Invoice Header
    const invStmt = db.prepare(`
        INSERT INTO invoices (
            id, invoice_number, customer_id, date, shipping_fee, hide_bank_details,
            subtotal, tax_rate, total, amount_paid, balance, status, manual_invoice_number, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            invoice_number = excluded.invoice_number,
            customer_id = excluded.customer_id,
            date = excluded.date,
            shipping_fee = excluded.shipping_fee,
            hide_bank_details = excluded.hide_bank_details,
            subtotal = excluded.subtotal,
            tax_rate = excluded.tax_rate,
            total = excluded.total,
            amount_paid = excluded.amount_paid,
            balance = excluded.balance,
            status = excluded.status,
            manual_invoice_number = excluded.manual_invoice_number,
            updated_at = CURRENT_TIMESTAMP
    `);

    invStmt.run(
        inv.id,
        inv.invoiceNumber,
        inv.customerId || null,
        inv.date,
        Number(inv.shippingFee) || 0,
        inv.hideBankDetails ? 1 : 0,
        Number(inv.subtotal) || 0,
        Number(inv.taxRate) || 0,
        Number(inv.total) || 0,
        Number(inv.amountPaid) || 0,
        Number(inv.balance) || 0,
        inv.status || 'Unpaid',
        inv.manualInvoiceNumber || ''
    );

    // Replace items
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(inv.id);
    if (Array.isArray(inv.items)) {
        const itemStmt = db.prepare(`
            INSERT INTO invoice_items (invoice_id, product_id, description, qty, price)
            VALUES (?, ?, ?, ?, ?)
        `);
        for (const item of inv.items) {
            if (item.productId || item.description) {
                itemStmt.run(
                    inv.id,
                    item.productId || null,
                    item.description || '',
                    Number(item.qty) || 1,
                    Number(item.price) || 0
                );
            }
        }
    }
    syncToJsonFile();
}

function deleteInvoice(id) {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
    syncToJsonFile();
}

function updateSettings(s) {
    const stmt = db.prepare(`
        INSERT INTO settings (
            id, company_name, logo, address_line1, address_line2, phone, mobile_number,
            whatsapp_number, email, footer_note, terms_info, bank_name, account_name,
            account_number, branch_name, bank_details_position, theme, header_color,
            logo_size, watermark_image, watermark_size, watermark_opacity, logo_position,
            company_details_alignment, empty_rows_count, margin_top, margin_right,
            margin_bottom, margin_left, invoice_numbering_mode, auto_start_number, updated_at
        ) VALUES (
            1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
            company_name = excluded.company_name,
            logo = excluded.logo,
            address_line1 = excluded.address_line1,
            address_line2 = excluded.address_line2,
            phone = excluded.phone,
            mobile_number = excluded.mobile_number,
            whatsapp_number = excluded.whatsapp_number,
            email = excluded.email,
            footer_note = excluded.footer_note,
            terms_info = excluded.terms_info,
            bank_name = excluded.bank_name,
            account_name = excluded.account_name,
            account_number = excluded.account_number,
            branch_name = excluded.branch_name,
            bank_details_position = excluded.bank_details_position,
            theme = excluded.theme,
            header_color = excluded.header_color,
            logo_size = excluded.logo_size,
            watermark_image = excluded.watermark_image,
            watermark_size = excluded.watermark_size,
            watermark_opacity = excluded.watermark_opacity,
            logo_position = excluded.logo_position,
            company_details_alignment = excluded.company_details_alignment,
            empty_rows_count = excluded.empty_rows_count,
            margin_top = excluded.margin_top,
            margin_right = excluded.margin_right,
            margin_bottom = excluded.margin_bottom,
            margin_left = excluded.margin_left,
            invoice_numbering_mode = excluded.invoice_numbering_mode,
            auto_start_number = excluded.auto_start_number,
            updated_at = CURRENT_TIMESTAMP
    `);

    const b = s.bankDetails || {};
    const m = s.margins || {};
    stmt.run(
        s.companyName || 'RUHUNU PRODUCTS',
        s.logo || '',
        s.addressLine1 || '',
        s.addressLine2 || '',
        s.phone || '',
        s.mobileNumber || '',
        s.whatsappNumber || '',
        s.email || '',
        s.footerNote || '',
        s.termsInfo || '',
        b.bankName || '',
        b.accountName || '',
        b.accountNumber || '',
        b.branchName || '',
        b.position || 'left',
        s.theme || 'light',
        s.headerColor || '#16a34a',
        Number(s.logoSize) || 60,
        s.watermarkImage || '',
        Number(s.watermarkSize) || 50,
        Number(s.watermarkOpacity) || 10,
        s.logoPosition || 'left',
        s.companyDetailsAlignment || 'left',
        Number(s.emptyRowsCount) || 4,
        Number(m.top) || 0,
        Number(m.right) || 20,
        Number(m.bottom) || 20,
        Number(m.left) || 20,
        s.invoiceNumberingMode || 'auto',
        Number(s.autoStartNumber) || 1
    );
    syncToJsonFile();
}

function upsertUser(u) {
    const stmt = db.prepare(`
        INSERT INTO users (id, username, password, role, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            password = excluded.password,
            role = excluded.role,
            updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(u.id, u.username, u.password, u.role || 'user');
    syncToJsonFile();
}

function deleteUser(id) {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    syncToJsonFile();
}

function insertHistory(h) {
    const stmt = db.prepare(`
        INSERT INTO activity_history (id, action, details, user, date)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(h.id, h.action, h.details || '', h.user || 'System', h.date || new Date().toISOString());
    syncToJsonFile();
}

// Full State Sync function
function fullSync(payload) {
    if (payload.settings) updateSettings(payload.settings);
    if (Array.isArray(payload.customers)) {
        const ids = payload.customers.map(c => c.id).filter(Boolean);
        if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            db.prepare(`DELETE FROM customers WHERE id NOT IN (${placeholders})`).run(...ids);
        }
        for (const c of payload.customers) upsertCustomer(c);
    }
    if (Array.isArray(payload.products)) {
        const ids = payload.products.map(p => p.id).filter(Boolean);
        if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            db.prepare(`DELETE FROM products WHERE id NOT IN (${placeholders})`).run(...ids);
        }
        for (const p of payload.products) upsertProduct(p);
    }
    if (Array.isArray(payload.invoices)) {
        const ids = payload.invoices.map(i => i.id).filter(Boolean);
        if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            db.prepare(`DELETE FROM invoice_items WHERE invoice_id NOT IN (${placeholders})`).run(...ids);
            db.prepare(`DELETE FROM invoices WHERE id NOT IN (${placeholders})`).run(...ids);
        }
        for (const inv of payload.invoices) upsertInvoice(inv);
    }
    if (Array.isArray(payload.users)) {
        const ids = payload.users.map(u => u.id).filter(Boolean);
        if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            db.prepare(`DELETE FROM users WHERE id NOT IN (${placeholders})`).run(...ids);
        }
        for (const u of payload.users) upsertUser(u);
    }
    if (Array.isArray(payload.history) && payload.history.length > 0) {
        for (const h of payload.history.slice(0, 10)) {
            const exists = db.prepare('SELECT 1 FROM activity_history WHERE id = ?').get(h.id);
            if (!exists) insertHistory(h);
        }
    }
    syncToJsonFile();
}

// MIME Types
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// HTTP Server
const server = http.createServer((req, res) => {
    // Enable CORS for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Helper: read request JSON body
    const getRequestBody = (callback) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = body ? JSON.parse(body) : {};
                callback(null, data);
            } catch (err) {
                callback(err);
            }
        });
    };

    // Helper: JSON response
    const jsonRes = (statusCode, data) => {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    // ----------------------------------------------------
    // API ROUTING
    // ----------------------------------------------------
    if (pathname.startsWith('/api/')) {
        // GET /api/status
        if (pathname === '/api/status' && req.method === 'GET') {
            return jsonRes(200, { status: 'ok', database: 'connected', time: new Date() });
        }

        // GET /api/data - Full Data Load
        if (pathname === '/api/data' && req.method === 'GET') {
            try {
                const all = getAllData();
                return jsonRes(200, all);
            } catch (err) {
                console.error('[API ERROR] Failed to get data:', err);
                return jsonRes(500, { error: err.message });
            }
        }

        // POST /api/sync - Full/Partial Sync
        if (pathname === '/api/sync' && req.method === 'POST') {
            return getRequestBody((err, body) => {
                if (err) return jsonRes(400, { error: 'Invalid JSON body' });
                try {
                    fullSync(body);
                    return jsonRes(200, { success: true, message: 'Database updated successfully' });
                } catch (e) {
                    console.error('[API ERROR] Sync failed:', e);
                    return jsonRes(500, { error: e.message });
                }
            });
        }

        // CUSTOMERS: POST /api/customers & DELETE /api/customers/:id
        if (pathname === '/api/customers' && req.method === 'POST') {
            return getRequestBody((err, body) => {
                if (err || !body.name) return jsonRes(400, { error: 'Invalid customer data' });
                try {
                    upsertCustomer(body);
                    return jsonRes(200, { success: true, customer: body });
                } catch (e) {
                    return jsonRes(500, { error: e.message });
                }
            });
        }
        if (pathname.startsWith('/api/customers/') && req.method === 'DELETE') {
            const id = pathname.replace('/api/customers/', '');
            try {
                deleteCustomer(id);
                return jsonRes(200, { success: true, id });
            } catch (e) {
                return jsonRes(500, { error: e.message });
            }
        }

        // PRODUCTS: POST /api/products & DELETE /api/products/:id
        if (pathname === '/api/products' && req.method === 'POST') {
            return getRequestBody((err, body) => {
                if (err || !body.name) return jsonRes(400, { error: 'Invalid product data' });
                try {
                    upsertProduct(body);
                    return jsonRes(200, { success: true, product: body });
                } catch (e) {
                    return jsonRes(500, { error: e.message });
                }
            });
        }
        if (pathname.startsWith('/api/products/') && req.method === 'DELETE') {
            const id = pathname.replace('/api/products/', '');
            try {
                deleteProduct(id);
                return jsonRes(200, { success: true, id });
            } catch (e) {
                return jsonRes(500, { error: e.message });
            }
        }

        // INVOICES: POST /api/invoices & DELETE /api/invoices/:id
        if (pathname === '/api/invoices' && req.method === 'POST') {
            return getRequestBody((err, body) => {
                if (err || !body.id) return jsonRes(400, { error: 'Invalid invoice data' });
                try {
                    upsertInvoice(body);
                    return jsonRes(200, { success: true, invoice: body });
                } catch (e) {
                    return jsonRes(500, { error: e.message });
                }
            });
        }
        if (pathname.startsWith('/api/invoices/') && req.method === 'DELETE') {
            const id = pathname.replace('/api/invoices/', '');
            try {
                deleteInvoice(id);
                return jsonRes(200, { success: true, id });
            } catch (e) {
                return jsonRes(500, { error: e.message });
            }
        }

        // SETTINGS: PUT /api/settings
        if (pathname === '/api/settings' && (req.method === 'PUT' || req.method === 'POST')) {
            return getRequestBody((err, body) => {
                if (err) return jsonRes(400, { error: 'Invalid settings data' });
                try {
                    updateSettings(body);
                    return jsonRes(200, { success: true, settings: body });
                } catch (e) {
                    return jsonRes(500, { error: e.message });
                }
            });
        }

        // USERS: POST /api/users & DELETE /api/users/:id
        if (pathname === '/api/users' && req.method === 'POST') {
            return getRequestBody((err, body) => {
                if (err || !body.username) return jsonRes(400, { error: 'Invalid user data' });
                try {
                    upsertUser(body);
                    return jsonRes(200, { success: true, user: body });
                } catch (e) {
                    return jsonRes(500, { error: e.message });
                }
            });
        }
        if (pathname.startsWith('/api/users/') && req.method === 'DELETE') {
            const id = pathname.replace('/api/users/', '');
            try {
                deleteUser(id);
                return jsonRes(200, { success: true, id });
            } catch (e) {
                return jsonRes(500, { error: e.message });
            }
        }

        // HISTORY: POST /api/history
        if (pathname === '/api/history' && req.method === 'POST') {
            return getRequestBody((err, body) => {
                if (err || !body.action) return jsonRes(400, { error: 'Invalid history data' });
                try {
                    insertHistory(body);
                    return jsonRes(200, { success: true, history: body });
                } catch (e) {
                    return jsonRes(500, { error: e.message });
                }
            });
        }

        return jsonRes(404, { error: 'Endpoint not found' });
    }

    // ----------------------------------------------------
    // STATIC FILE SERVING
    // ----------------------------------------------------
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log('========================================================');
    console.log(` RUHUNU PRODUCTS Billing Suite is running!`);
    console.log(` Web Application: http://localhost:${PORT}`);
    console.log(` Database: SQLite (${DB_PATH})`);
    console.log(` Instant Sync: ACTIVE`);
    console.log('========================================================');
});
