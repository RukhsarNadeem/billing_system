from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import json
import os
from datetime import datetime
from functools import wraps

app = Flask(__name__)
app.secret_key = "cake_billing_secret_2024"

# Always find data.json next to app.py, no matter where you run from
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data.json")

# ─── Helpers ────────────────────────────────────────────────
def load_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

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

        data = load_data()
        user = next(
            (u for u in data["users"] if u["username"] == username and u["password"] == password),
            None
        )

        if user:
            session["user"] = {
                "username": user["username"],
                "name": user["name"],
                "role": user["role"]
            }
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
    data = load_data()
    return jsonify(data["products"])

# ─── Bills API ───────────────────────────────────────────────
@app.route("/api/bills", methods=["GET"])
@login_required
def api_get_bills():
    data = load_data()
    return jsonify(data["bills"])

@app.route("/api/bills", methods=["POST"])
@login_required
def api_create_bill():
    try:
        body = request.get_json(force=True, silent=True) or {}
        data = load_data()

        existing_nums = []
        for b in data["bills"]:
            try:
                existing_nums.append(int(b["id"].split("-")[1]))
            except Exception:
                pass
        next_num = (max(existing_nums) + 1) if existing_nums else 1
        bill_id = f"BILL-{next_num:04d}"

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

        data["bills"].append(bill)
        save_data(data)
        return jsonify({"success": True, "bill": bill})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/bills/<bill_id>", methods=["GET"])
@login_required
def api_get_bill(bill_id):
    data = load_data()
    bill = next((b for b in data["bills"] if b["id"] == bill_id), None)
    if bill:
        return jsonify(bill)
    return jsonify({"error": "Bill not found"}), 404

@app.route("/api/summary")
@login_required
def api_summary():
    data = load_data()
    bills = data["bills"]
    today = datetime.now().strftime("%Y-%m-%d")
    today_bills = [b for b in bills if b["created_at"].startswith(today)]

    return jsonify({
        "total_bills": len(bills),
        "today_bills": len(today_bills),
        "today_revenue": round(sum(b["total"] for b in today_bills), 2),
        "total_revenue": round(sum(b["total"] for b in bills), 2)
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)