/* ================================================================
   PURBALINGGA MART — admin.js
   Admin panel: manage all products, sellers, stats
   ================================================================ */
'use strict';

(function () {

  const fmt = n => 'Rp ' + Number(n).toLocaleString('id-ID');

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    if (!PM_AUTH.requireRole('admin')) return;
    renderAdminDashboard();
    renderAdminProducts();
    renderAdminSellers();
    renderAdminCommission();

    // Refresh on DB changes
    window.addEventListener('storage', e => {
      if (e.key === 'pm_products' || e.key === 'pm_auth_users') {
        renderAdminDashboard();
        renderAdminProducts();
        renderAdminSellers();
      }
      if (e.key === 'pm_transactions') {
        renderAdminDashboard();
        renderAdminCommission();
      }
    });
  }

  /* ================================================================
     DASHBOARD STATS
     ================================================================ */
  function renderAdminDashboard() {
    const stats    = PM_DB.getStats();
    const users    = PM_AUTH.getUsers();
    const sellers  = users.filter(u => u.role === 'seller');
    const buyers   = users.filter(u => u.role === 'buyer');
    const products = PM_DB.getProducts();
    const promo    = PM_DB.getPromo();

    // Summary cards
    setStat('adm-total-products',  stats.total);
    setStat('adm-active-products', stats.active);
    setStat('adm-total-sellers',   sellers.length);
    setStat('adm-total-buyers',    buyers.length);
    setStat('adm-total-promo',     promo.length);
    setStat('adm-total-categories',stats.categories);
    setStat('adm-total-locations', stats.locations);

    // Estimated revenue
    const revenue = products.reduce((s, p) => s + (p.sold || 0) * p.price, 0);
    setStat('adm-est-revenue', fmt(revenue));

    // Top categories chart (text-based)
    const catEl = document.getElementById('adm-cat-breakdown');
    if (catEl) {
      const cats = {};
      products.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
      catEl.innerHTML = Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, cnt]) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="font-size:13px;color:#1e293b;min-width:100px;text-transform:capitalize">${cat}</span>
            <div style="flex:1;background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden">
              <div style="width:${Math.round(cnt/products.length*100)}%;height:100%;background:#e8a020;border-radius:4px;transition:width .6s ease"></div>
            </div>
            <span style="font-size:12px;color:#64748b;min-width:30px;text-align:right">${cnt}</span>
          </div>`).join('');
    }
  }

  function setStat(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ================================================================
     ALL PRODUCTS TABLE
     ================================================================ */
  function renderAdminProducts(filter = '') {
    const el = document.getElementById('admin-products-list');
    if (!el) return;

    let products = PM_DB.getProducts();
    if (filter) {
      const q = filter.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.storeName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    if (products.length === 0) {
      el.innerHTML = `<div class="pm-empty-state" style="padding:40px">
        <div class="pm-empty-icon">📦</div>
        <div class="pm-empty-title">Tidak Ada Produk</div>
      </div>`;
      return;
    }

    el.innerHTML = `
      <div style="overflow-x:auto">
        <table class="sp-table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Toko / Seller</th>
              <th>Kategori</th>
              <th>Harga</th>
              <th>Stok</th>
              <th>Terjual</th>
              <th>Status</th>
              <th>Aksi Admin</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <img src="${p.image}" alt="${p.name}"
                         onerror="this.src='https://picsum.photos/seed/${p.id}/80/80'"
                         style="width:42px;height:42px;border-radius:8px;object-fit:cover;flex-shrink:0">
                    <div style="font-weight:600;font-size:13px;color:#1e293b">${p.name}</div>
                  </div>
                </td>
                <td style="font-size:12.5px;color:#64748b">${p.storeName || '-'}</td>
                <td><span class="sp-cat-tag">${p.category}</span></td>
                <td style="font-weight:700;color:#e8a020;font-size:13px">${fmt(p.price)}</td>
                <td style="font-weight:600;font-size:13px">${p.stock}</td>
                <td style="font-weight:600;font-size:13px">${p.sold}</td>
                <td>
                  <span class="sp-status ${p.status === 'active' ? 'sp-active' : 'sp-suspended'}">
                    ${p.status}
                  </span>
                </td>
                <td>
                  <div style="display:flex;gap:5px;flex-wrap:wrap">
                    ${p.status === 'active'
                      ? `<button class="sp-btn sp-btn-suspend" onclick="PM_ADMIN.suspendProduct('${p.id}')">⏸ Suspend</button>`
                      : `<button class="sp-btn sp-btn-edit" onclick="PM_ADMIN.activateProduct('${p.id}')">▶ Aktifkan</button>`
                    }
                    <button class="sp-btn sp-btn-del" onclick="PM_ADMIN.deleteProduct('${p.id}')">🗑 Hapus</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ================================================================
     SELLERS TABLE
     ================================================================ */
  function renderAdminSellers() {
    const el = document.getElementById('admin-sellers-list');
    if (!el) return;

    const sellers = PM_AUTH.getUsers().filter(u => u.role === 'seller');
    if (sellers.length === 0) {
      el.innerHTML = `<div class="pm-empty-state" style="padding:40px">
        <div class="pm-empty-icon">🏪</div>
        <div class="pm-empty-title">Belum Ada Seller</div>
      </div>`;
      return;
    }

    el.innerHTML = `
      <div style="overflow-x:auto">
        <table class="sp-table">
          <thead>
            <tr>
              <th>Seller</th>
              <th>Toko</th>
              <th>Kategori</th>
              <th>Lokasi</th>
              <th>Produk</th>
              <th>Total Terjual</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${sellers.map(s => {
              const products = PM_DB.getProductsBySeller(s.username);
              const totalSold = products.reduce((sum, p) => sum + (p.sold || 0), 0);
              return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <img src="${s.avatar || 'https://picsum.photos/seed/default/80/80'}" alt="${s.name}"
                         style="width:36px;height:36px;border-radius:50%;object-fit:cover">
                    <div>
                      <div style="font-weight:600;font-size:13px">${s.name}</div>
                      <div style="font-size:11px;color:#94a3b8">@${s.username}</div>
                    </div>
                  </div>
                </td>
                <td style="font-weight:600;font-size:13px">${s.storeName || '-'}</td>
                <td><span class="sp-cat-tag">${s.category || '-'}</span></td>
                <td style="font-size:12.5px;color:#64748b">📍 ${s.location || '-'}</td>
                <td style="font-weight:600">${products.length}</td>
                <td style="font-weight:600">${totalSold}</td>
                <td><span class="sp-status sp-active">active</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ── Product actions ─────────────────────────────────────── */
  function suspendProduct(id) {
    const p = PM_DB.getProductById(id);
    if (!confirm(`Suspend produk "${p?.name}"?`)) return;
    PM_DB.suspendProduct(id);
    PM_AUTH.toast('⏸ Produk disuspend.', 'warn');
    renderAdminProducts();
    renderAdminDashboard();
  }

  function activateProduct(id) {
    PM_DB.activateProduct(id);
    PM_AUTH.toast('▶ Produk diaktifkan!', 'ok');
    renderAdminProducts();
    renderAdminDashboard();
  }

  function deleteProduct(id) {
    const p = PM_DB.getProductById(id);
    if (!confirm(`Hapus permanen produk "${p?.name}"?`)) return;
    PM_DB.deleteProduct(id);
    PM_AUTH.toast('🗑️ Produk dihapus.', 'warn');
    renderAdminProducts();
    renderAdminDashboard();
  }

  /* ================================================================
     COMMISSION REPORT
     ================================================================ */
  function renderAdminCommission() {
    const el = document.getElementById('admin-commission-section');
    if (!el) return;

    const report = PM_TX.getCommissionReport();
    const feeRate = 2; // persen — sesuai dengan serviceFee di transaction.js

    el.innerHTML = `
      <!-- Summary cards -->
      <div class="adm-commission-cards">
        <div class="adm-comm-card">
          <div class="adm-comm-card-icon">💰</div>
          <div class="adm-comm-card-label">Total Komisi Diterima</div>
          <div class="adm-comm-card-value">${fmt(report.totalFee)}</div>
          <div class="adm-comm-card-sub">dari ${report.totalTx} transaksi</div>
        </div>
        <div class="adm-comm-card">
          <div class="adm-comm-card-icon">🛒</div>
          <div class="adm-comm-card-label">Total GMV (Subtotal)</div>
          <div class="adm-comm-card-value">${fmt(report.totalGmv)}</div>
          <div class="adm-comm-card-sub">nilai barang tanpa ongkir</div>
        </div>
        <div class="adm-comm-card">
          <div class="adm-comm-card-icon">📊</div>
          <div class="adm-comm-card-label">Tarif Service Fee</div>
          <div class="adm-comm-card-value">${feeRate}%</div>
          <div class="adm-comm-card-sub">dari subtotal produk</div>
        </div>
        <div class="adm-comm-card">
          <div class="adm-comm-card-icon">🏪</div>
          <div class="adm-comm-card-label">Seller Aktif Berkontribusi</div>
          <div class="adm-comm-card-value">${report.sellers.length}</div>
          <div class="adm-comm-card-sub">seller dengan transaksi</div>
        </div>
      </div>

      <!-- Monthly breakdown -->
      <div class="adm-comm-block">
        <div class="adm-comm-block-title">📅 Komisi per Bulan</div>
        ${report.months.length === 0
          ? `<div class="pm-empty-state" style="padding:30px">
               <div class="pm-empty-icon">📭</div>
               <div class="pm-empty-title">Belum ada transaksi</div>
             </div>`
          : `<div style="overflow-x:auto">
              <table class="sp-table">
                <thead>
                  <tr>
                    <th>Bulan</th>
                    <th>Transaksi</th>
                    <th>GMV</th>
                    <th>Komisi Platform (2%)</th>
                    <th>Visualisasi</th>
                  </tr>
                </thead>
                <tbody>
                  ${(() => {
                    const maxFee = Math.max(...report.months.map(m => m.totalFee), 1);
                    return report.months.map(m => `
                      <tr>
                        <td style="font-weight:600;font-size:13px">${m.label}</td>
                        <td style="font-size:13px">${m.totalTx} order</td>
                        <td style="font-size:13px;color:#64748b">${fmt(m.totalGmv)}</td>
                        <td style="font-weight:700;color:#e8a020;font-size:14px">${fmt(m.totalFee)}</td>
                        <td style="min-width:120px">
                          <div style="background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden">
                            <div style="width:${Math.round(m.totalFee / maxFee * 100)}%;height:100%;background:#e8a020;border-radius:4px;transition:width .6s ease"></div>
                          </div>
                        </td>
                      </tr>`).join('');
                  })()}
                </tbody>
              </table>
            </div>`
        }
      </div>

      <!-- Per-seller breakdown -->
      <div class="adm-comm-block">
        <div class="adm-comm-block-title">🏪 Komisi per Seller</div>
        ${report.sellers.length === 0
          ? `<div class="pm-empty-state" style="padding:30px">
               <div class="pm-empty-icon">📭</div>
               <div class="pm-empty-title">Belum ada data seller</div>
             </div>`
          : `<div style="overflow-x:auto">
              <table class="sp-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Toko / Seller</th>
                    <th>Transaksi</th>
                    <th>GMV Seller</th>
                    <th>Komisi Platform</th>
                    <th>Kontribusi</th>
                  </tr>
                </thead>
                <tbody>
                  ${report.sellers.map((s, i) => `
                    <tr>
                      <td style="font-size:13px;color:#94a3b8;font-weight:600">${i + 1}</td>
                      <td>
                        <div style="font-weight:600;font-size:13px">${s.storeName || s.username}</div>
                        <div style="font-size:11px;color:#94a3b8">@${s.username}</div>
                      </td>
                      <td style="font-size:13px">${s.totalTx} order</td>
                      <td style="font-size:13px;color:#64748b">${fmt(s.totalGmv)}</td>
                      <td style="font-weight:700;color:#e8a020;font-size:14px">${fmt(s.totalFee)}</td>
                      <td style="font-size:12px;color:#64748b">
                        ${report.totalFee > 0 ? Math.round(s.totalFee / report.totalFee * 100) : 0}%
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>

      <!-- Catatan pajak informatif -->
      <div class="adm-comm-tax-note">
        <div style="font-weight:600;margin-bottom:6px">📋 Catatan Pajak Platform</div>
        <div style="font-size:13px;line-height:1.7;color:#64748b">
          Pendapatan komisi platform (service fee) merupakan omzet Purbalingga Mart sebagai pengelola.
          Jika total omzet komisi <strong>&lt; Rp 500 juta/tahun</strong>: dikenakan PPh Final <strong>0,5%</strong> dari total komisi yang diterima (bukan dari total GMV).
          Laporan ini hanya sebagai referensi pencatatan internal — konsultasikan dengan konsultan pajak untuk pelaporan resmi.
        </div>
        ${report.totalFee > 0 ? `
        <div style="margin-top:12px;padding:10px 14px;background:#fff7ed;border-radius:8px;border:1px solid #fed7aa;font-size:13px">
          💡 Estimasi PPh Final 0,5% dari total komisi saat ini:
          <strong style="color:#c2410c">${fmt(Math.round(report.totalFee * 0.005))}</strong>
          (dari total komisi ${fmt(report.totalFee)})
        </div>` : ''}
      </div>
    `;
  }

  /* ── Expose ──────────────────────────────────────────────── */
  window.PM_ADMIN = { init, renderAdminProducts, renderAdminSellers, renderAdminCommission, suspendProduct, activateProduct, deleteProduct };
  document.addEventListener('DOMContentLoaded', init);

})();
