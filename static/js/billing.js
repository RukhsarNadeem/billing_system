// billing.js — Sweet Bills Main Billing Logic

let products = [];
let cart = [];
let activeCategory = 'All';
let selectedPayment = 'Cash';

// ── Init ─────────────────────────────────────────────
async function init() {
  setCurrentDate();
  await loadProducts();
  await loadStats();
  setupListeners();
}

function setCurrentDate() {
  const el = document.getElementById('currentDate');
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

async function loadProducts() {
  const res = await fetch('/api/products');
  products = await res.json();
  buildCategoryTabs();
  renderProducts();
}

async function loadStats() {
  const res = await fetch('/api/summary');
  const data = await res.json();
  document.getElementById('todayBills').textContent = data.today_bills;
  document.getElementById('todayRevenue').textContent = 'Rs. ' + data.today_revenue.toLocaleString();
}

// ── Categories ───────────────────────────────────────
function buildCategoryTabs() {
  const cats = ['All', ...new Set(products.map(p => p.category))];
  const container = document.getElementById('categoryTabs');
  container.innerHTML = cats.map(c => `
    <button class="cat-tab ${c === 'All' ? 'active' : ''}" data-cat="${c}">${c}</button>
  `).join('');
  container.addEventListener('click', e => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProducts();
  });
}

// ── Render Products ──────────────────────────────────
function renderProducts(query = '') {
  const grid = document.getElementById('productsGrid');
  let filtered = products;
  if (activeCategory !== 'All') filtered = filtered.filter(p => p.category === activeCategory);
  if (query) filtered = filtered.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));

  if (!filtered.length) {
    grid.innerHTML = '<div style="text-align:center;color:#bbb;padding:2rem;font-size:13px;">No products found 🔍</div>';
    return;
  }
  grid.innerHTML = filtered.map(p => `
    <div class="product-card" onclick="addToCart(${p.id})" title="${p.name}">
      <span class="product-emoji">${p.emoji}</span>
      <div class="product-name">${p.name}</div>
      <div class="product-price">Rs. ${p.price.toLocaleString()}</div>
      <div class="product-cat">${p.category}</div>
    </div>
  `).join('');
}

// ── Cart Logic ───────────────────────────────────────
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const existing = cart.find(i => i.id === productId);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  renderCart();
  updateTotals();
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== productId);
  renderCart();
  updateTotals();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  renderCart();
  updateTotals();
}

function renderCart() {
  const container = document.getElementById('cartItems');
  if (!cart.length) {
    container.innerHTML = '<div class="cart-empty">No items yet — pick from the menu! 🍰</div>';
    return;
  }
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <span class="ci-emoji">${item.emoji}</span>
      <div class="ci-info">
        <div class="ci-name">${item.name}</div>
        <div class="ci-price">Rs. ${(item.price * item.qty).toLocaleString()}</div>
      </div>
      <div class="ci-controls">
        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id}, +1)">+</button>
        <button class="ci-remove" onclick="removeFromCart(${item.id})">🗑</button>
      </div>
    </div>
  `).join('');
}

function updateTotals() {
  const discount = parseFloat(document.getElementById('discountInput').value) || 0;
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round((subtotal - discount) * 0.05);
  const total = subtotal - discount + tax;

  document.getElementById('subtotal').textContent = 'Rs. ' + subtotal.toLocaleString();
  document.getElementById('taxAmt').textContent = 'Rs. ' + tax.toLocaleString();
  document.getElementById('totalAmt').textContent = 'Rs. ' + total.toLocaleString();
}

// ── Generate Bill ────────────────────────────────────
async function generateBill() {
  if (!cart.length) {
    alert('Please add items to the cart first.');
    return;
  }
  const discount = parseFloat(document.getElementById('discountInput').value) || 0;
  const payload = {
    customer_name: document.getElementById('customerName').value || 'Walk-in Customer',
    customer_phone: document.getElementById('customerPhone').value || '',
    items: cart.map(i => ({ id: i.id, name: i.name, emoji: i.emoji, price: i.price, qty: i.qty })),
    discount,
    payment_method: selectedPayment
  };

  const btn = document.getElementById('generateBill');
  btn.disabled = true; btn.textContent = 'Generating…';

  try {
    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showReceipt(data.bill);
      loadStats();
    } else {
      alert('Failed to generate bill.');
    }
  } catch (err) {
    alert('Server error.');
  } finally {
    btn.disabled = false; btn.textContent = 'Generate Bill 🧾';
  }
}

function showReceipt(bill) {
  const itemsHtml = bill.items.map(i => `
    <tr>
      <td>${i.emoji} ${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td>Rs. ${i.price.toLocaleString()}</td>
      <td>Rs. ${(i.price * i.qty).toLocaleString()}</td>
    </tr>
  `).join('');

  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-header">
      <h2>🎂 Sweet Bills</h2>
      <p>Cake Store | Freshly Baked with Love</p>
    </div>
    <hr class="receipt-divider"/>
    <div class="receipt-meta">
      <span><strong>Bill:</strong> ${bill.id}</span>
      <span>${bill.created_at}</span>
    </div>
    <div class="receipt-meta">
      <span><strong>Customer:</strong> ${bill.customer_name}</span>
      <span>${bill.customer_phone || ''}</span>
    </div>
    <div class="receipt-meta">
      <span><strong>Cashier:</strong> ${bill.cashier}</span>
      <span><strong>Payment:</strong> ${bill.payment_method}</span>
    </div>
    <hr class="receipt-divider"/>
    <table>
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <hr class="receipt-divider"/>
    <div class="receipt-totals">
      <div class="rtotal-row"><span>Subtotal</span><span>Rs. ${bill.subtotal.toLocaleString()}</span></div>
      <div class="rtotal-row"><span>Discount</span><span>− Rs. ${bill.discount.toLocaleString()}</span></div>
      <div class="rtotal-row"><span>Tax (5%)</span><span>Rs. ${bill.tax.toLocaleString()}</span></div>
      <div class="rtotal-row grand"><span>TOTAL</span><span>Rs. ${bill.total.toLocaleString()}</span></div>
    </div>
    <div class="receipt-footer">Thank you for visiting Sweet Bills! 🍰<br/>Come back soon!</div>
  `;
  document.getElementById('billModal').classList.add('open');
}

// ── Event Listeners ──────────────────────────────────
function setupListeners() {
  // Search
  document.getElementById('searchBox').addEventListener('input', e => renderProducts(e.target.value));

  // Discount
  document.getElementById('discountInput').addEventListener('input', updateTotals);

  // Payment
  document.querySelectorAll('.pm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pm-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPayment = btn.dataset.method;
    });
  });

  // Clear cart
  document.getElementById('clearCart').addEventListener('click', () => {
    if (!cart.length) return;
    if (confirm('Clear all items?')) { cart = []; renderCart(); updateTotals(); }
  });

  // Generate bill
  document.getElementById('generateBill').addEventListener('click', generateBill);

  // Modal close
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('billModal').classList.remove('open');
  });

  // New bill
  document.getElementById('newBillBtn').addEventListener('click', () => {
    document.getElementById('billModal').classList.remove('open');
    cart = [];
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('discountInput').value = '0';
    renderCart();
    updateTotals();
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  });
}

// ── Start ─────────────────────────────────────────────
init();
