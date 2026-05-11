// history.js — Bill History Page

let allBills = [];

async function init() {
  await loadSummary();
  await loadBills();
  setupListeners();
}

async function loadSummary() {
  const res = await fetch('/api/summary');
  const data = await res.json();
  document.getElementById('sTotalBills').textContent = data.total_bills;
  document.getElementById('sTodayBills').textContent = data.today_bills;
  document.getElementById('sTodayRevenue').textContent = 'Rs. ' + data.today_revenue.toLocaleString();
  document.getElementById('sTotalRevenue').textContent = 'Rs. ' + data.total_revenue.toLocaleString();
}

async function loadBills() {
  const res = await fetch('/api/bills');
  allBills = await res.json();
  allBills.reverse(); // newest first
  renderBills(allBills);
}

function renderBills(bills) {
  const tbody = document.getElementById('billsBody');
  if (!bills.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No bills found.</td></tr>';
    return;
  }
  tbody.innerHTML = bills.map(b => {
    const pm = b.payment_method.toLowerCase();
    const pmClass = pm === 'cash' ? 'pm-cash' : pm === 'card' ? 'pm-card' : 'pm-online';
    return `
      <tr>
        <td><strong>${b.id}</strong></td>
        <td>${b.customer_name}</td>
        <td>${b.items.length} item${b.items.length > 1 ? 's' : ''}</td>
        <td><strong>Rs. ${b.total.toLocaleString()}</strong></td>
        <td><span class="pm-badge ${pmClass}">${b.payment_method}</span></td>
        <td>${b.cashier}</td>
        <td>${b.created_at}</td>
        <td><button class="btn-view" onclick="viewBill('${b.id}')">View</button></td>
      </tr>
    `;
  }).join('');
}

async function viewBill(billId) {
  const res = await fetch(`/api/bills/${billId}`);
  const bill = await res.json();

  const itemsHtml = bill.items.map(i => `
    <tr>
      <td>${i.emoji} ${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td>Rs. ${i.price.toLocaleString()}</td>
      <td>Rs. ${(i.price * i.qty).toLocaleString()}</td>
    </tr>
  `).join('');

  document.getElementById('detailContent').innerHTML = `
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
    <div class="receipt-footer">Thank you for visiting Sweet Bills! 🍰</div>
  `;
  document.getElementById('detailModal').classList.add('open');
}

function setupListeners() {
  document.getElementById('historySearch').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const filtered = allBills.filter(b =>
      b.id.toLowerCase().includes(q) ||
      b.customer_name.toLowerCase().includes(q) ||
      b.cashier.toLowerCase().includes(q)
    );
    renderBills(filtered);
  });

  document.getElementById('closeDetail').addEventListener('click', () => {
    document.getElementById('detailModal').classList.remove('open');
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  });
}

init();
