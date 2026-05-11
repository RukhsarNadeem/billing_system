from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import json
import os
import pyodbc
from datetime import datetime
from functools import wraps

app = Flask(__name__)
app.secret_key = "cake_billing_secret_2024"

# ─── Azure SQL Connection ────────────────────────────────────
DB_PASSWORD = "Sw33tB!lls@Secure#2024"

CONNECTION_STRING = (
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=tcp:responseserver.database.windows.net,1433;"
    "Database=database;"
    "Uid=serveradmin;"
    f"Pwd={DB_PASSWORD};"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
    "Connection Timeout=30;"
)

def get_db():
    """Return a new database connection."""
    return pyodbc.connect(CONNECTION_STRING)

# ─── DB Setup — run once to create tables ───────────────────
def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
        CREATE TABLE users (
            id INT IDENTITY PRIMARY KEY,
            username NVARCHAR(100) UNIQUE NOT NULL,
            password NVARCHAR(100) NOT NULL,
            name NVARCHAR(200) NOT NULL,
            role NVARCHAR(50) NOT NULL
        )
    """)

    cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='products' AND xtype='U')
        CREATE TABLE products (
            id INT IDENTITY PRIMARY KEY,
            name NVARCHAR(200) NOT NULL,
            category NVARCHAR(100) NOT NULL,
            price FLOAT NOT NULL,
            unit NVARCHAR(50),
            emoji NVARCHAR(10)
        )
    """)

    cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='bills' AND xtype='U')
        CREATE TABLE bills (
            id NVARCHAR(20) PRIMARY KEY,
            customer_name NVARCHAR(200),
            customer_phone NVARCHAR(50),
            items NVARCHAR(MAX),
            subtotal FLOAT,
            discount FLOAT,
            tax FLOAT,
            total FLOAT,
            payment_method NVARCHAR(50),
            cashier NVARCHAR(200),
            created_at NVARCHAR(30)
        )
    """)

    # Seed default users if not exists
    cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
            ("admin", "admin123", "Admin User", "admin")
        )
        cursor.execute(
            "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
            ("cashier", "cash123", "Jane Cashier", "cashier")
        )

    conn.commit()
    conn.close()

# ─── Auth decorator ──────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated

# ─── Pages ──────────────────────────────────────────────────
@app.route("/")
def index():
    if "user" in session:
        return redirect(url_for("billing_page"))
    return redirect(url_for("login_page"))

@app.route("/login")
def login_page():
    if "user" in session:
        return redirect(url_for("billing_page"))
    return render_template("login.html")

@app.route("/billing")
@login_required
def billing_page():
    return render_template("billing.html", user=session["user"])

@app.route("/history")
@login_required
def history_page():
    return render_template("history.html", user=session["user"])

# ─── Auth API ────────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
def api_login():
    try:
        body = request.get_json(force=True, silent=True) or {}
        username = body.get("username", "").strip()
        password = body.get("password", "").strip()

        if not username or not password:
            return jsonify({"success": False, "message": "Username and password are required"}), 400

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT username, name, role FROM users WHERE username = ? AND password = ?",
            (username, password)
        )
        row = cursor.fetchone()
        conn.close()

        if row:
            session["user"] = {"username": row[0], "name": row[1], "role": row[2]}
            return jsonify({"success": True, "redirect": "/billing"})

        return jsonify({"success": False, "message": "Invalid username or password"}), 401

    except Exception as e:
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"success": True})

# ─── Products API ────────────────────────────────────────────
@app.route("/api/products")
@login_required
def api_products():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, category, price, unit, emoji FROM products ORDER BY category, name")
        rows = cursor.fetchall()
        conn.close()
        products = [
            {"id": r[0], "name": r[1], "category": r[2], "price": r[3], "unit": r[4], "emoji": r[5]}
            for r in rows
        ]
        return jsonify(products)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── Bills API ───────────────────────────────────────────────
@app.route("/api/bills", methods=["GET"])
@login_required
def api_get_bills():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, customer_name, customer_phone, items, subtotal,
                   discount, tax, total, payment_method, cashier, created_at
            FROM bills ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        bills = []
        for r in rows:
            bills.append({
                "id": r[0], "customer_name": r[1], "customer_phone": r[2],
                "items": json.loads(r[3]),
                "subtotal": r[4], "discount": r[5], "tax": r[6], "total": r[7],
                "payment_method": r[8], "cashier": r[9], "created_at": r[10]
            })
        return jsonify(bills)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/bills", methods=["POST"])
@login_required
def api_create_bill():
    try:
        body = request.get_json(force=True, silent=True) or {}
        conn = get_db()
        cursor = conn.cursor()

        # Generate next bill ID
        cursor.execute("SELECT COUNT(*) FROM bills")
        count = cursor.fetchone()[0]
        bill_id = f"BILL-{(count + 1):04d}"

        items = body.get("items", [])
        subtotal = sum(i["price"] * i["qty"] for i in items)
        discount = float(body.get("discount", 0))
        taxable = max(subtotal - discount, 0)
        tax = round(taxable * 0.05, 2)
        total = round(taxable + tax, 2)

        bill = {
            "id": bill_id,
            "customer_name": body.get("customer_name", "Walk-in Customer"),
            "customer_phone": body.get("customer_phone", ""),
            "items": items,
            "subtotal": subtotal,
            "discount": discount,
            "tax": tax,
            "total": total,
            "payment_method": body.get("payment_method", "Cash"),
            "cashier": session["user"]["name"],
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        cursor.execute(
            """INSERT INTO bills
               (id, customer_name, customer_phone, items, subtotal, discount, tax, total, payment_method, cashier, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (bill["id"], bill["customer_name"], bill["customer_phone"],
             json.dumps(bill["items"]), bill["subtotal"], bill["discount"],
             bill["tax"], bill["total"], bill["payment_method"],
             bill["cashier"], bill["created_at"])
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "bill": bill})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/bills/<bill_id>", methods=["GET"])
@login_required
def api_get_bill(bill_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT id, customer_name, customer_phone, items, subtotal,
                      discount, tax, total, payment_method, cashier, created_at
               FROM bills WHERE id = ?""",
            (bill_id,)
        )
        r = cursor.fetchone()
        conn.close()
        if r:
            return jsonify({
                "id": r[0], "customer_name": r[1], "customer_phone": r[2],
                "items": json.loads(r[3]),
                "subtotal": r[4], "discount": r[5], "tax": r[6], "total": r[7],
                "payment_method": r[8], "cashier": r[9], "created_at": r[10]
            })
        return jsonify({"error": "Bill not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/summary")
@login_required
def api_summary():
    try:
        conn = get_db()
        cursor = conn.cursor()
        today = datetime.now().strftime("%Y-%m-%d")

        cursor.execute("SELECT COUNT(*) FROM bills")
        total_bills = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*), ISNULL(SUM(total), 0) FROM bills WHERE created_at LIKE ?",
            (today + "%",)
        )
        row = cursor.fetchone()
        today_bills = row[0]
        today_revenue = round(float(row[1]), 2)

        cursor.execute("SELECT ISNULL(SUM(total), 0) FROM bills")
        total_revenue = round(float(cursor.fetchone()[0]), 2)

        conn.close()
        return jsonify({
            "total_bills": total_bills,
            "today_bills": today_bills,
            "today_revenue": today_revenue,
            "total_revenue": total_revenue
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    init_db()   # Creates tables automatically on first run
    app.run(debug=True, port=5000)
