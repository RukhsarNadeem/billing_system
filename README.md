# 🎂 Sweet Bills — Cake Store Billing System

## Project Structure

```
cake_billing/
├── app.py                  ← Flask backend (Python)
├── data.json               ← Database (users, products, bills)
├── requirements.txt        ← Python dependencies
├── templates/
│   ├── login.html          ← Login page
│   ├── billing.html        ← Main billing page
│   └── history.html        ← Bill history page
└── static/
    ├── css/
    │   └── style.css       ← All styling
    └── js/
        ├── login.js        ← Login logic
        ├── billing.js      ← Billing/cart logic
        └── history.js      ← History page logic
```

## Setup & Run

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the server
```bash
python app.py
```

### 3. Open in browser
```
http://localhost:5000
```

## Login Credentials

| Username | Password | Role    |
|----------|----------|---------|
| admin    | admin123 | Admin   |
| cashier  | cash123  | Cashier |

## Features

- **Secure login** — session-based auth, redirects if not logged in
- **25 products** across 5 categories (Cakes, Pastries, Cupcakes, Muffins, Special)
- **Smart cart** — add, remove, adjust quantities
- **Discounts & tax** — 5% tax auto-calculated
- **3 payment methods** — Cash, Card, Online
- **Bill receipt** — printable receipt with bill ID
- **Bill history** — searchable table of all past bills
- **Revenue dashboard** — today's and total stats

## Data Storage

All data is stored in `data.json`:
- `users` — login credentials
- `products` — cake store menu
- `bills` — all generated bills (appended on each sale)

To add products, edit `data.json` and add entries to the `"products"` array.
To add users, edit `data.json` and add entries to the `"users"` array.
