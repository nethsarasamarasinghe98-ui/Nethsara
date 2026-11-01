# ============================================================
# RUHUNU PRODUCTS - Billing & Invoicing Suite
# Local Python Backend Server with instant SQLite persistence
# Zero external pip dependencies required (built-in http.server & sqlite3)
# ============================================================

import http.server
import json
import os
import sqlite3
import sys
import urllib.parse

PORT = int(os.environ.get("PORT", 3000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.sqlite")
JSON_PATH = os.path.join(BASE_DIR, "database.json")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema_sqlite.sql")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    if not os.path.exists(DB_PATH) and os.path.exists(SCHEMA_PATH):
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            sql = f.read()
        conn = get_db()
        conn.executescript(sql)
        conn.commit()
        conn.close()

init_db()

def get_all_data():
    conn = get_db()
    c = conn.cursor()

    # 1. Users
    c.execute("SELECT id, username, password, role FROM users")
    users = [dict(r) for r in c.fetchall()]

    # 2. Settings
    c.execute("SELECT * FROM settings WHERE id = 1")
    s_row = c.fetchone()
    s_dict = dict(s_row) if s_row else {}
    settings = {
        "companyName": s_dict.get("company_name") or "RUHUNU PRODUCTS",
        "logo": s_dict.get("logo") or "",
        "address": "",
        "addressLine1": s_dict.get("address_line1") or "",
        "addressLine2": s_dict.get("address_line2") or "",
        "phone": s_dict.get("phone") or "",
        "mobileNumber": s_dict.get("mobile_number") or "",
        "whatsappNumber": s_dict.get("whatsapp_number") or "",
        "email": s_dict.get("email") or "",
        "footerNote": s_dict.get("footer_note") or "Thank you for your business!",
        "termsInfo": s_dict.get("terms_info") or "Please make cheques payable to Ruhunu Products.",
        "bankDetails": {
            "bankName": s_dict.get("bank_name") or "",
            "accountName": s_dict.get("account_name") or "",
            "accountNumber": s_dict.get("account_number") or "",
            "branchName": s_dict.get("branch_name") or "",
            "position": s_dict.get("bank_details_position") or "left",
        },
        "theme": s_dict.get("theme") or "light",
        "headerColor": s_dict.get("header_color") or "#16a34a",
        "logoSize": s_dict.get("logo_size", 60),
        "watermarkImage": s_dict.get("watermark_image") or "",
        "watermarkSize": s_dict.get("watermark_size", 50),
        "watermarkOpacity": s_dict.get("watermark_opacity", 10),
        "logoPosition": s_dict.get("logo_position") or "left",
        "companyDetailsAlignment": s_dict.get("company_details_alignment") or "left",
        "emptyRowsCount": s_dict.get("empty_rows_count", 4),
        "margins": {
            "top": s_dict.get("margin_top", 0),
            "right": s_dict.get("margin_right", 20),
            "bottom": s_dict.get("margin_bottom", 20),
            "left": s_dict.get("margin_left", 20),
        },
        "invoiceNumberingMode": s_dict.get("invoice_numbering_mode") or "auto",
        "autoStartNumber": s_dict.get("auto_start_number", 1),
    }

    # 3. Products
    c.execute("SELECT id, code, name, price FROM products ORDER BY name ASC")
    products = [dict(r) for r in c.fetchall()]

    # 4. Customers
    c.execute("SELECT id, name, phone, email, address_line1, address_line2 FROM customers ORDER BY name ASC")
    customers = [
        {
            "id": r["id"],
            "name": r["name"],
            "phone": r["phone"] or "",
            "email": r["email"] or "",
            "addressLine1": r["address_line1"] or "",
            "addressLine2": r["address_line2"] or "",
        }
        for r in c.fetchall()
    ]

    # 5. Invoices & Line items
    c.execute("SELECT * FROM invoices ORDER BY date DESC")
    inv_rows = c.fetchall()
    invoices = []
    for r in inv_rows:
        inv_id = r["id"]
        c.execute("SELECT product_id, description, qty, price FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC", (inv_id,))
        raw_items = c.fetchall()
        items = [
            {
                "productId": it["product_id"] or "",
                "description": it["description"] or "",
                "qty": float(it["qty"] or 1),
                "price": float(it["price"] or 0),
            }
            for it in raw_items
        ]
        invoices.append({
            "id": r["id"],
            "invoiceNumber": r["invoice_number"],
            "customerId": r["customer_id"] or "",
            "date": r["date"],
            "shippingFee": float(r["shipping_fee"] or 0),
            "hideBankDetails": bool(r["hide_bank_details"]),
            "subtotal": float(r["subtotal"] or 0),
            "taxRate": float(r["tax_rate"] or 0),
            "total": float(r["total"] or 0),
            "amountPaid": float(r["amount_paid"] or 0),
            "balance": float(r["balance"] or 0),
            "status": r["status"] or "Unpaid",
            "manualInvoiceNumber": r["manual_invoice_number"] or "",
            "items": items,
        })

    # 6. History
    c.execute("SELECT id, action, details, user, date FROM activity_history ORDER BY date DESC LIMIT 500")
    history = [dict(r) for r in c.fetchall()]

    conn.close()
    return {"users": users, "settings": settings, "products": products, "customers": customers, "invoices": invoices, "history": history}

def sync_to_json():
    try:
        data = get_all_data()
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"[BACKUP] Failed to write database.json: {e}")

def upsert_customer(c_data):
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO customers (id, name, phone, email, address_line1, address_line2, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            phone = excluded.phone,
            email = excluded.email,
            address_line1 = excluded.address_line1,
            address_line2 = excluded.address_line2,
            updated_at = CURRENT_TIMESTAMP
    """, (c_data.get("id"), c_data.get("name"), c_data.get("phone", ""), c_data.get("email", ""), c_data.get("addressLine1", ""), c_data.get("addressLine2", "")))
    conn.commit()
    conn.close()
    sync_to_json()

def delete_customer(c_id):
    conn = get_db()
    conn.execute("DELETE FROM customers WHERE id = ?", (c_id,))
    conn.commit()
    conn.close()
    sync_to_json()

def upsert_product(p_data):
    conn = get_db()
    conn.execute("""
        INSERT INTO products (id, code, name, price, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            code = excluded.code,
            name = excluded.name,
            price = excluded.price,
            updated_at = CURRENT_TIMESTAMP
    """, (p_data.get("id"), p_data.get("code", ""), p_data.get("name"), float(p_data.get("price", 0))))
    conn.commit()
    conn.close()
    sync_to_json()

def delete_product(p_id):
    conn = get_db()
    conn.execute("DELETE FROM products WHERE id = ?", (p_id,))
    conn.commit()
    conn.close()
    sync_to_json()

def upsert_invoice(inv):
    conn = get_db()
    conn.execute("""
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
    """, (
        inv.get("id"),
        inv.get("invoiceNumber"),
        inv.get("customerId") or None,
        inv.get("date"),
        float(inv.get("shippingFee") or 0),
        1 if inv.get("hideBankDetails") else 0,
        float(inv.get("subtotal") or 0),
        float(inv.get("taxRate") or 0),
        float(inv.get("total") or 0),
        float(inv.get("amountPaid") or 0),
        float(inv.get("balance") or 0),
        inv.get("status") or "Unpaid",
        inv.get("manualInvoiceNumber", ""),
    ))

    conn.execute("DELETE FROM invoice_items WHERE invoice_id = ?", (inv.get("id"),))
    items = inv.get("items", [])
    if isinstance(items, list):
        for item in items:
            if item.get("productId") or item.get("description"):
                conn.execute("""
                    INSERT INTO invoice_items (invoice_id, product_id, description, qty, price)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    inv.get("id"),
                    item.get("productId") or None,
                    item.get("description", ""),
                    float(item.get("qty") or 1),
                    float(item.get("price") or 0),
                ))

    conn.commit()
    conn.close()
    sync_to_json()

def delete_invoice(inv_id):
    conn = get_db()
    conn.execute("DELETE FROM invoice_items WHERE invoice_id = ?", (inv_id,))
    conn.execute("DELETE FROM invoices WHERE id = ?", (inv_id,))
    conn.commit()
    conn.close()
    sync_to_json()

def update_settings(s):
    b = s.get("bankDetails") or {}
    m = s.get("margins") or {}
    conn = get_db()
    conn.execute("""
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
    """, (
        s.get("companyName") or "RUHUNU PRODUCTS",
        s.get("logo") or "",
        s.get("addressLine1") or "",
        s.get("addressLine2") or "",
        s.get("phone") or "",
        s.get("mobileNumber") or "",
        s.get("whatsappNumber") or "",
        s.get("email") or "",
        s.get("footerNote") or "",
        s.get("termsInfo") or "",
        b.get("bankName") or "",
        b.get("accountName") or "",
        b.get("accountNumber") or "",
        b.get("branchName") or "",
        b.get("position") or "left",
        s.get("theme") or "light",
        s.get("headerColor") or "#16a34a",
        int(s.get("logoSize", 60)),
        s.get("watermarkImage") or "",
        int(s.get("watermarkSize", 50)),
        int(s.get("watermarkOpacity", 10)),
        s.get("logoPosition") or "left",
        s.get("companyDetailsAlignment") or "left",
        int(s.get("emptyRowsCount", 4)),
        int(m.get("top", 0)),
        int(m.get("right", 20)),
        int(m.get("bottom", 20)),
        int(m.get("left", 20)),
        s.get("invoiceNumberingMode") or "auto",
        int(s.get("autoStartNumber", 1)),
    ))
    conn.commit()
    conn.close()
    sync_to_json()

def upsert_user(u):
    conn = get_db()
    conn.execute("""
        INSERT INTO users (id, username, password, role, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            password = excluded.password,
            role = excluded.role,
            updated_at = CURRENT_TIMESTAMP
    """, (u.get("id"), u.get("username"), u.get("password"), u.get("role", "user")))
    conn.commit()
    conn.close()
    sync_to_json()

def delete_user(u_id):
    conn = get_db()
    conn.execute("DELETE FROM users WHERE id = ?", (u_id,))
    conn.commit()
    conn.close()
    sync_to_json()

def insert_history(h):
    conn = get_db()
    conn.execute("""
        INSERT INTO activity_history (id, action, details, user, date)
        VALUES (?, ?, ?, ?, ?)
    """, (h.get("id"), h.get("action"), h.get("details", ""), h.get("user", "System"), h.get("date")))
    conn.commit()
    conn.close()
    sync_to_json()

def full_sync(payload):
    conn = get_db()
    if "settings" in payload and payload["settings"]:
        update_settings(payload["settings"])
    if "customers" in payload and isinstance(payload["customers"], list):
        ids = [c["id"] for c in payload["customers"] if c.get("id")]
        if ids:
            placeholders = ",".join("?" for _ in ids)
            conn.execute(f"DELETE FROM customers WHERE id NOT IN ({placeholders})", ids)
            conn.commit()
        for c in payload["customers"]:
            upsert_customer(c)
    if "products" in payload and isinstance(payload["products"], list):
        ids = [p["id"] for p in payload["products"] if p.get("id")]
        if ids:
            placeholders = ",".join("?" for _ in ids)
            conn.execute(f"DELETE FROM products WHERE id NOT IN ({placeholders})", ids)
            conn.commit()
        for p in payload["products"]:
            upsert_product(p)
    if "invoices" in payload and isinstance(payload["invoices"], list):
        ids = [inv["id"] for inv in payload["invoices"] if inv.get("id")]
        if ids:
            placeholders = ",".join("?" for _ in ids)
            conn.execute(f"DELETE FROM invoice_items WHERE invoice_id NOT IN ({placeholders})", ids)
            conn.execute(f"DELETE FROM invoices WHERE id NOT IN ({placeholders})", ids)
            conn.commit()
        for inv in payload["invoices"]:
            upsert_invoice(inv)
    if "users" in payload and isinstance(payload["users"], list):
        ids = [u["id"] for u in payload["users"] if u.get("id")]
        if ids:
            placeholders = ",".join("?" for _ in ids)
            conn.execute(f"DELETE FROM users WHERE id NOT IN ({placeholders})", ids)
            conn.commit()
        for u in payload["users"]:
            upsert_user(u)
    if "history" in payload and isinstance(payload["history"], list) and len(payload["history"]) > 0:
        for h in payload["history"][:10]:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM activity_history WHERE id = ?", (h.get("id"),))
            if not cur.fetchone():
                insert_history(h)
    conn.close()
    sync_to_json()

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def read_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            raw = self.rfile.read(content_length).decode("utf-8")
            return json.loads(raw)
        return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        pathname = parsed.path

        if pathname == "/api/status":
            return self.send_json(200, {"status": "ok", "database": "connected"})
        elif pathname == "/api/data":
            try:
                data = get_all_data()
                return self.send_json(200, data)
            except Exception as e:
                return self.send_json(500, {"error": str(e)})

        # Static files
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        pathname = parsed.path

        try:
            body = self.read_body()
            if pathname == "/api/sync":
                full_sync(body)
                return self.send_json(200, {"success": True, "message": "Synced to database"})
            elif pathname == "/api/customers":
                upsert_customer(body)
                return self.send_json(200, {"success": True, "customer": body})
            elif pathname == "/api/products":
                upsert_product(body)
                return self.send_json(200, {"success": True, "product": body})
            elif pathname == "/api/invoices":
                upsert_invoice(body)
                return self.send_json(200, {"success": True, "invoice": body})
            elif pathname == "/api/settings":
                update_settings(body)
                return self.send_json(200, {"success": True, "settings": body})
            elif pathname == "/api/users":
                upsert_user(body)
                return self.send_json(200, {"success": True, "user": body})
            elif pathname == "/api/history":
                insert_history(body)
                return self.send_json(200, {"success": True, "history": body})
            else:
                return self.send_json(404, {"error": "Endpoint not found"})
        except Exception as e:
            return self.send_json(500, {"error": str(e)})

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/settings":
            try:
                body = self.read_body()
                update_settings(body)
                return self.send_json(200, {"success": True, "settings": body})
            except Exception as e:
                return self.send_json(500, {"error": str(e)})
        return self.send_json(404, {"error": "Endpoint not found"})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        pathname = parsed.path
        try:
            if pathname.startswith("/api/customers/"):
                c_id = pathname.replace("/api/customers/", "")
                delete_customer(c_id)
                return self.send_json(200, {"success": True, "id": c_id})
            elif pathname.startswith("/api/products/"):
                p_id = pathname.replace("/api/products/", "")
                delete_product(p_id)
                return self.send_json(200, {"success": True, "id": p_id})
            elif pathname.startswith("/api/invoices/"):
                inv_id = pathname.replace("/api/invoices/", "")
                delete_invoice(inv_id)
                return self.send_json(200, {"success": True, "id": inv_id})
            elif pathname.startswith("/api/users/"):
                u_id = pathname.replace("/api/users/", "")
                delete_user(u_id)
                return self.send_json(200, {"success": True, "id": u_id})
            else:
                return self.send_json(404, {"error": "Endpoint not found"})
        except Exception as e:
            return self.send_json(500, {"error": str(e)})

if __name__ == "__main__":
    os.chdir(BASE_DIR)
    print("========================================================")
    print(f" RUHUNU PRODUCTS Billing Suite (Python Server)")
    print(f" Web Application: http://localhost:{PORT}")
    print(f" Database: SQLite ({DB_PATH})")
    print("========================================================")
    httpd = http.server.HTTPServer(("", PORT), RequestHandler)
    httpd.serve_forever()
