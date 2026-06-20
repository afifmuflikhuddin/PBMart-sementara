/* ================================================================
   PURBALINGGA MART — orders.js
   Order history: list, status, invoice link, admin/seller views
   ================================================================ */
'use strict';

(function () {

  const fmt     = n => 'Rp ' + Number(n).toLocaleString('id-ID');
  const fmtDate = d => new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const STATUS_CFG = {
    pending:  { label: 'Menunggu',   cls: 'os-pending',  icon: '⏳' },
    diproses: { label: 'Diproses',   cls: 'os-process',  icon: '🔄' },
    dikirim:  { label: 'Dikirim',    cls: 'os-sent',     icon: '🚚' },
    selesai:  { label: 'Selesai',    cls: 'os-done',     icon: '✅' },
  };

  const SHIPPING_ICONS = {
    regular: '🚛', express: '⚡', seller: '🛵', pickup: '🤝',
  };
  function shippingIcon(type) {
    return SHIPPING_ICONS[type] || '🚛';
  }

  // Escape single quotes so product names are safe inside onclick="...('name')" handlers
  // (backslash-escape, not HTML entity — entities decode before the JS string is parsed)
  function escAttr(str) {
    return String(str || '').replace(/'/g, "\\'");
  }

  let activeFilter = 'all';
  let searchQuery  = '';

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    if (!PM_AUTH.isLoggedIn()) {
      window.location.href = 'login.html?required=buyer';
      return;
    }

    const user = PM_AUTH.getCurrentUser();

    if (user.role === 'admin') {
      renderAdminOrders();
    } else if (user.role === 'seller') {
      renderSellerOrders(user.username);
    } else {
      renderBuyerOrders(user.id);
    }

    bindFilters();
    bindSearch();
  }

  /* ── BUYER ORDERS ────────────────────────────────────────── */
  function renderBuyerOrders(buyerId) {
    const txns = PM_TX.getByBuyer(buyerId);

    // Update page heading
    setTxt('orders-heading', 'Pesanan Saya');
    setTxt('orders-sub',     `${txns.length} total transaksi`);

    renderOrderStats(txns);
    renderOrderList(txns, 'buyer');
  }

  /* ── SELLER ORDERS ───────────────────────────────────────── */
  function renderSellerOrders(sellerUsername) {
    const txns = PM_TX.getBySeller(sellerUsername);
    setTxt('orders-heading', 'Pesanan Masuk');
    setTxt('orders-sub',     `${txns.length} transaksi masuk`);
    renderOrderStats(txns);
    renderOrderList(txns, 'seller');
    showSellerChangeStatus();
  }

  function showSellerChangeStatus() {
    document.querySelectorAll('.ord-status-change').forEach(el => el.style.display = 'flex');
  }

  /* ── ADMIN ORDERS ────────────────────────────────────────── */
  function renderAdminOrders() {
    const txns = PM_TX.getAll();
    setTxt('orders-heading', 'Semua Transaksi');
    setTxt('orders-sub',     `${txns.length} transaksi marketplace`);
    renderOrderStats(txns);
    renderOrderList(txns, 'admin');
    document.getElementById('orders-stats-extra')?.classList.remove('hidden');
    renderAdminStats(txns);
  }

  /* ── Stats bar ───────────────────────────────────────────── */
  function renderOrderStats(txns) {
    const byStatus = {};
    txns.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
    const revenue = txns.reduce((s, t) => s + t.total, 0);

    setTxt('stat-total-orders',   txns.length);
    setTxt('stat-pending-orders', byStatus.pending || 0);
    setTxt('stat-done-orders',    byStatus.selesai || 0);
    setTxt('stat-revenue',        fmt(revenue));
  }

  /* ── Admin stats ─────────────────────────────────────────── */
  function renderAdminStats(txns) {
    const el = document.getElementById('admin-tx-stats');
    if (!el) return;
    const topSellers = {};
    txns.forEach(t => {
      t.products.forEach(p => {
        topSellers[p.storeName] = (topSellers[p.storeName] || 0) + p.subtotal;
      });
    });
    const sorted = Object.entries(topSellers).sort((a, b) => b[1] - a[1]).slice(0, 5);
    el.innerHTML = `<div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:10px">🏆 Top Seller Revenue</div>` +
      sorted.map(([name, rev]) => `
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px">
          <span style="color:#475569;font-weight:600">${name}</span>
          <span style="color:#e8a020;font-weight:800">${fmt(rev)}</span>
        </div>`).join('');
  }

  /* ── Render order list ───────────────────────────────────── */
  function renderOrderList(txns, role) {
    const el = document.getElementById('orders-list');
    if (!el) return;

    // Apply filter
    let filtered = [...txns];
    if (activeFilter !== 'all') filtered = filtered.filter(t => t.status === activeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.transactionId.toLowerCase().includes(q) ||
        t.products.some(p => p.name.toLowerCase().includes(q)) ||
        t.buyerName?.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      el.innerHTML = `
        <div class="ord-empty">
          <div class="ord-empty-icon">📋</div>
          <div class="ord-empty-title">Tidak Ada Pesanan</div>
          <div class="ord-empty-desc">${activeFilter !== 'all' ? 'Tidak ada pesanan dengan status ini.' : 'Belum ada transaksi yang tercatat.'}</div>
          ${role === 'buyer' ? `<a href="index.html" class="ord-empty-btn">Mulai Belanja →</a>` : ''}
        </div>`;
      return;
    }

    el.innerHTML = filtered.map(t => renderOrderCard(t, role)).join('');

    // Bind status change buttons (seller/admin)
    el.querySelectorAll('.ord-next-status-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const txId      = btn.dataset.txid;
        const newStatus = btn.dataset.next;
        changeStatus(txId, newStatus, role === 'admin' ? txns : PM_TX.getBySeller(PM_AUTH.getCurrentUser().username));
      });
    });
  }

  function renderOrderCard(t, role) {
    const s       = STATUS_CFG[t.status] || STATUS_CFG.pending;
    const preview = t.products.slice(0, 2);
    const more    = t.products.length - 2;
    const nextStatus = { pending: 'diproses', diproses: 'dikirim', dikirim: 'selesai' };
    const nextLabel  = { pending: '→ Proses', diproses: '→ Kirim', dikirim: '→ Selesai' };
    const showChange  = (role === 'seller' || role === 'admin') && t.status !== 'selesai';
    const canReview   = role === 'buyer' && t.status === 'selesai';

    return `
      <div class="ord-card" data-txid="${t.transactionId}">
        <div class="ord-card-head">
          <div class="ord-card-head-left">
            <span class="ord-status-badge ${s.cls}">${s.icon} ${s.label}</span>
            <span class="ord-txid">${t.transactionId}</span>
          </div>
          <div class="ord-card-head-right">
            <span class="ord-date">${fmtDate(t.createdAt)}</span>
          </div>
        </div>

        <div class="ord-products">
          ${preview.map(p => `
            <div class="ord-prod-row">
              <img src="${p.image}" alt="${p.name}"
                   onerror="this.src='https://picsum.photos/seed/${p.productId}/80/80'">
              <div class="ord-prod-info">
                <div class="ord-prod-name">${p.name}</div>
                <div class="ord-prod-meta">🏪 ${p.storeName} · ${fmt(p.price)} × ${p.qty}</div>
                ${p.shippingLabel ? `<div class="ord-prod-ship">${shippingIcon(p.shippingType)} ${p.shippingLabel}${p.perishable ? ' · 🌿 Cepat Basi' : ''}</div>` : ''}
                ${canReview ? (
                  p.reviewed
                    ? `<span class="ord-reviewed-badge">✅ Sudah Diulas</span>`
                    : `<button class="ord-btn-review" onclick="PM_ORDERS.openReview('${t.transactionId}','${p.productId}','${escAttr(p.name)}')">⭐ Tulis Ulasan</button>`
                ) : ''}
              </div>
              <div class="ord-prod-sub">${fmt(p.subtotal)}</div>
            </div>`).join('')}
          ${more > 0 ? `<div class="ord-more-items">+ ${more} produk lainnya</div>` : ''}
        </div>

        ${role !== 'buyer' ? `
          <div class="ord-buyer-info">
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${t.buyerName} · ${t.address.city || ''} · ${t.address.phone || ''}
          </div>` : ''}

        <div class="ord-card-foot">
          <div class="ord-payment">
            <span class="ord-pay-method">${t.paymentMethod?.toUpperCase()}</span>
            ${t.shippingLabel ? `<span class="ord-pay-method" style="background:#fff8e8;color:#c98310">🚚 ${t.shippingLabel}</span>` : ''}
            <span class="ord-total-label">Total: <strong class="ord-total">${fmt(t.total)}</strong></span>
          </div>
          <div class="ord-actions">
            ${showChange ? `
              <button class="ord-btn ord-btn-status ord-next-status-btn"
                      data-txid="${t.transactionId}"
                      data-next="${nextStatus[t.status]}">
                ${nextLabel[t.status] || ''}
              </button>` : ''}
            ${(role === 'seller' || role === 'admin') && (t.status === 'diproses' || t.status === 'dikirim') ? `
              <button class="ord-btn ord-btn-resi ${t.resi ? 'ord-btn-resi-set' : ''}"
                      onclick="PM_ORDERS.openResiModal('${t.transactionId}')">
                ${t.resi ? '📦 Resi: ' + (t.ekspedisi ? t.ekspedisi + ' ' : '') + t.resi : '📦 Input Resi'}
              </button>` : ''}
            <a href="invoice.html?id=${t.transactionId}" class="ord-btn ord-btn-invoice">
              🧾 Invoice
            </a>
            <button class="ord-btn ord-btn-print" onclick="PM_ORDERS.printInvoice('${t.transactionId}')">
              🖨️ Print
            </button>
          </div>
        </div>
      </div>`;
  }

  /* ── Change status ───────────────────────────────────────── */
  function changeStatus(txId, newStatus, txns) {
    const ok = PM_TX.updateStatus(txId, newStatus,
      newStatus === 'diproses' ? 'Seller sedang memproses pesanan' :
      newStatus === 'dikirim'  ? 'Pesanan telah dikirim' :
      newStatus === 'selesai'  ? 'Pesanan telah selesai' : '');

    if (!ok) { PM_AUTH.toast('Gagal mengubah status', 'err'); return; }
    PM_AUTH.toast(`✅ Status diubah ke: ${newStatus}`, 'ok');

    // Re-render
    renderOrderList(txns || PM_TX.getAll(), PM_AUTH.getCurrentUser().role);
    renderOrderStats(txns || PM_TX.getAll());
  }

  /* ── Open review modal ──────────────────────────────────── */
  function openReview(transactionId, productId, productName) {
    // Remove any existing review modal
    document.getElementById('pm-review-modal')?.remove();

    const user = PM_AUTH.getCurrentUser();
    if (!user) { PM_AUTH.showLoginModal(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'pm-review-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:grid;place-items:center;padding:20px;backdrop-filter:blur(4px)';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:28px;max-width:440px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.15);font-family:'Poppins',sans-serif">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
          <h3 style="font-size:16px;font-weight:800;color:#1e293b;margin:0">⭐ Beri Ulasan</h3>
          <button onclick="document.getElementById('pm-review-modal').remove()"
                  style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:20px;line-height:1">✕</button>
        </div>
        <div style="font-size:13px;font-weight:600;color:#1e293b;margin-bottom:14px;padding:10px 14px;background:#f8fafc;border-radius:9px;border:1px solid #e2e8f0">
          📦 ${productName}
        </div>
        <div style="margin-bottom:14px">
          <div style="font-size:12.5px;font-weight:600;color:#475569;margin-bottom:8px">Rating</div>
          <div id="pm-rv-stars" data-rating="0" style="display:flex;gap:6px">
            ${[1,2,3,4,5].map(n =>
              `<button data-val="${n}" onclick="(function(btn){
                const wrap=document.getElementById('pm-rv-stars');
                wrap.dataset.rating=btn.dataset.val;
                wrap.querySelectorAll('button').forEach((b,i)=>{b.style.color=i<btn.dataset.val?'#f59e0b':'#d1d5db';b.style.fontSize='28px'});
              })(this)" style="font-size:28px;background:none;border:none;cursor:pointer;color:#d1d5db;padding:0;transition:color .15s">★</button>`
            ).join('')}
          </div>
          <div id="pm-rv-star-err" style="display:none;color:#ef4444;font-size:12px;margin-top:4px">Pilih rating bintang.</div>
        </div>
        <div style="margin-bottom:18px">
          <div style="font-size:12.5px;font-weight:600;color:#475569;margin-bottom:6px">Komentar <span style="color:#94a3b8;font-weight:400">(opsional)</span></div>
          <textarea id="pm-rv-comment" maxlength="400" rows="3"
            placeholder="Ceritakan pengalaman Anda dengan produk ini..."
            style="width:100%;border:1.5px solid #e2e8f0;border-radius:9px;padding:10px 12px;font-size:13px;font-family:'Poppins',sans-serif;resize:vertical;outline:none;box-sizing:border-box;color:#1e293b"></textarea>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('pm-review-modal').remove()"
                  style="flex:1;padding:10px;border:1.5px solid #e2e8f0;border-radius:9px;background:#f8fafc;color:#64748b;font-size:13px;font-weight:600;cursor:pointer;font-family:'Poppins',sans-serif">
            Batal
          </button>
          <button onclick="PM_ORDERS._doSubmitReview('${transactionId}','${productId}')"
                  style="flex:2;padding:10px;background:#e8a020;border:none;border-radius:9px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'Poppins',sans-serif">
            Kirim Ulasan
          </button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  /* ── Do submit review (from modal) ──────────────────────── */
  function _doSubmitReview(transactionId, productId) {
    const user    = PM_AUTH.getCurrentUser();
    const wrap    = document.getElementById('pm-rv-stars');
    const rating  = parseInt(wrap?.dataset.rating || '0');
    const errEl   = document.getElementById('pm-rv-star-err');
    const comment = document.getElementById('pm-rv-comment')?.value.trim();

    if (errEl) errEl.style.display = 'none';
    if (!rating) {
      if (errEl) errEl.style.display = 'block';
      return;
    }

    const result = PM_DB.addReview({
      transactionId, productId,
      buyerId:     user.id,
      buyerName:   user.name,
      buyerAvatar: user.avatar || '',
      rating, comment,
    });

    if (!result.ok) { PM_AUTH.toast(result.msg, 'err'); return; }

    document.getElementById('pm-review-modal')?.remove();
    PM_AUTH.toast('✅ Ulasan berhasil dikirim!', 'ok');
    init(); // Re-render orders list to show "Sudah Diulas"
  }

  /* ── Resi / Tracking Modal ──────────────────────────────── */
  function openResiModal(transactionId) {
    const tx  = PM_TX.getById(transactionId);
    if (!tx) return;

    document.getElementById('pm-resi-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'pm-resi-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:grid;place-items:center;padding:20px;backdrop-filter:blur(4px)';

    const ekspedisiOptions = ['JNE','J&T','SiCepat','Anteraja','Pos Indonesia','Ninja Xpress','Tiki','GoSend','GrabExpress','Seller Sendiri'].map(e =>
      `<option value="${e}" ${tx.ekspedisi === e ? 'selected' : ''}>${e}</option>`
    ).join('');

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:28px;max-width:420px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.15);font-family:'Poppins',sans-serif">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
          <h3 style="font-size:15px;font-weight:800;color:#1e293b;margin:0">📦 Input No. Resi</h3>
          <button onclick="document.getElementById('pm-resi-modal').remove()" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:20px">✕</button>
        </div>
        <div style="font-size:12.5px;color:#64748b;background:#f8fafc;border-radius:9px;padding:10px 14px;margin-bottom:16px;font-family:monospace">${tx.transactionId}</div>
        <div style="margin-bottom:12px">
          <label style="font-size:12.5px;font-weight:600;color:#475569;display:block;margin-bottom:5px">Ekspedisi</label>
          <select id="pm-resi-ekspedisi" style="width:100%;height:42px;border:1.5px solid #e2e8f0;border-radius:9px;padding:0 12px;font-size:13px;font-family:'Poppins',sans-serif;background:#fff;outline:none">
            <option value="">-- Pilih Ekspedisi --</option>
            ${ekspedisiOptions}
          </select>
        </div>
        <div style="margin-bottom:20px">
          <label style="font-size:12.5px;font-weight:600;color:#475569;display:block;margin-bottom:5px">Nomor Resi</label>
          <input id="pm-resi-input" type="text" value="${tx.resi || ''}"
            placeholder="Contoh: JNE1234567890"
            style="width:100%;height:42px;border:1.5px solid #e2e8f0;border-radius:9px;padding:0 14px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;box-sizing:border-box"/>
          <div style="font-size:11.5px;color:#94a3b8;margin-top:4px">Masukkan no. resi dari ekspedisi</div>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('pm-resi-modal').remove()" style="flex:1;padding:11px;border:1.5px solid #e2e8f0;border-radius:9px;background:#f8fafc;color:#64748b;font-size:13px;font-weight:600;cursor:pointer;font-family:'Poppins',sans-serif">Batal</button>
          <button onclick="PM_ORDERS._saveResi('${transactionId}')" style="flex:2;padding:11px;background:#e8a020;border:none;border-radius:9px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'Poppins',sans-serif">📦 Simpan Resi</button>
        </div>
      </div>`;

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function _saveResi(transactionId) {
    const resi      = document.getElementById('pm-resi-input')?.value.trim();
    const ekspedisi = document.getElementById('pm-resi-ekspedisi')?.value;
    if (!resi) { PM_AUTH.toast('Masukkan nomor resi terlebih dahulu', 'err'); return; }

    const ok = PM_TX.updateResi(transactionId, resi, ekspedisi);
    if (!ok) { PM_AUTH.toast('Transaksi tidak ditemukan', 'err'); return; }

    document.getElementById('pm-resi-modal')?.remove();
    PM_AUTH.toast(`✅ Resi ${ekspedisi ? ekspedisi + ' ' : ''}${resi} berhasil disimpan!`, 'ok');
    init(); // re-render
  }

  /* ── Print invoice ───────────────────────────────────────── */
  function printInvoice(txId) {
    sessionStorage.setItem('pm_last_tx', txId);
    window.open(`invoice.html?id=${txId}`, '_blank');
  }

  /* ── Bind filters ────────────────────────────────────────── */
  function bindFilters() {
    document.querySelectorAll('.ord-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ord-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        init();
      });
    });
  }

  /* ── Bind search ─────────────────────────────────────────── */
  function bindSearch() {
    const inp = document.getElementById('orders-search');
    if (!inp) return;
    let timer;
    inp.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        searchQuery = inp.value.trim();
        init();
      }, 300);
    });
  }

  function setTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ── Expose ──────────────────────────────────────────────── */
  window.PM_ORDERS = { printInvoice, changeStatus, openReview, _doSubmitReview, openResiModal, _saveResi };
  document.addEventListener('DOMContentLoaded', init);

})();
