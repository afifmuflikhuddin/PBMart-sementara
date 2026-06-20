/* ================================================================
   PURBALINGGA MART — checkout.js
   Full checkout: address, payment, voucher, order creation
   ================================================================ */
'use strict';

(function () {

  const fmt = n => 'Rp ' + Number(n).toLocaleString('id-ID');

  /* ── State ───────────────────────────────────────────────── */
  let cart          = [];
  let selectedPayment = '';
  // Shipping is chosen per product group: 'durable' (tahan lama) and 'perishable' (cepat basi)
  let selectedShipping = { durable: 'regular', perishable: 'pickup' };
  let appliedVoucher   = null;
  let shippingCost     = 0; // total of both groups
  let isSubmitting     = false;

  /* ── Toast ───────────────────────────────────────────────── */
  function toast(msg, type = 'ok', dur = 3200) {
    const wrap = document.getElementById('ck-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ck-toast ${type}`;
    const icons = { ok:'✅', err:'❌', warn:'⚠️', info:'ℹ️' };
    el.innerHTML = `<span>${icons[type]||''}</span><span>${msg}</span>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'ckTOut .25s ease forwards';
      setTimeout(() => el.remove(), 250);
    }, dur);
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    // Auth guard
    if (!PM_AUTH.isLoggedIn()) {
      window.location.href = 'login.html?required=buyer&msg=checkout';
      return;
    }

    cart = PM_DB.getCart();

    if (cart.length === 0) {
      renderEmpty();
      return;
    }

    renderProductList();
    loadSavedAddress();
    renderPaymentMethods();
    renderShippingOptions();
    updateSummary();
    bindEvents();
    renderVoucherChips();
  }

  /* ── Render empty state ──────────────────────────────────── */
  function renderEmpty() {
    const page = document.getElementById('ck-page-content');
    if (!page) return;
    page.innerHTML = `
      <div class="ck-empty">
        <div class="ck-empty-icon">🛒</div>
        <div class="ck-empty-title">Keranjang Kamu Kosong</div>
        <div class="ck-empty-desc">Belum ada produk yang dipilih untuk checkout.</div>
        <a href="index.html" class="ck-empty-btn">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
          Kembali Belanja
        </a>
      </div>`;
  }

  /* ── Render product list ─────────────────────────────────── */
  function renderProductList() {
    const el = document.getElementById('ck-product-list');
    if (!el) return;

    // Group by seller
    const groups = {};
    cart.forEach(item => {
      const key = item.storeName || 'Toko';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    el.innerHTML = Object.entries(groups).map(([store, items]) => {
      const product = PM_DB.getProductById(items[0].productId);
      const loc = product?.location || 'Purbalingga';

      return `
        <div class="ck-seller-group">
          <div class="ck-seller-head">
            <img class="ck-seller-avatar" src="https://picsum.photos/seed/${encodeURIComponent(store)}/80/80" alt="${store}">
            <span class="ck-seller-name">🏪 ${store}</span>
            <span class="ck-seller-loc">📍 ${loc}</span>
          </div>
          ${items.map(item => renderProductItem(item)).join('')}
          <div class="ck-note-wrap">
            <div class="ck-note-label">📝 Catatan untuk ${store} (opsional)</div>
            <textarea class="ck-note-field" rows="2" data-store="${store}"
                      placeholder="Contoh: Tolong dikemas rapi, tidak ada syarat khusus..."></textarea>
          </div>
        </div>`;
    }).join('');

    // Bind qty buttons
    el.querySelectorAll('.ck-qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid   = btn.dataset.pid;
        const delta = parseInt(btn.dataset.delta);
        changeQty(pid, delta);
      });
    });
  }

  function renderProductItem(item) {
    const product = PM_DB.getProductById(item.productId);
    const maxQty  = product?.stock || 99;
    return `
      <div class="ck-prod-item" id="ck-item-${item.productId}">
        <img class="ck-prod-img" src="${item.image}"
             onerror="this.src='https://picsum.photos/seed/${item.productId}/140/140'"
             alt="${item.name}">
        <div class="ck-prod-info">
          <div class="ck-prod-name">${item.name}</div>
          <div class="ck-prod-store">🏪 ${item.storeName}</div>
          <div class="ck-prod-price-row">
            <span class="ck-prod-price">${fmt(item.price)}</span>
            <span class="ck-prod-sub">Subtotal: <strong style="color:#e8a020">${fmt(item.price * item.qty)}</strong></span>
          </div>
          <div class="ck-prod-qty">
            <button class="ck-qty-btn" data-pid="${item.productId}" data-delta="-1">−</button>
            <span class="ck-qty-num" id="qty-${item.productId}">${item.qty}</span>
            <button class="ck-qty-btn" data-pid="${item.productId}" data-delta="1" ${item.qty >= maxQty ? 'disabled' : ''}>+</button>
            <span style="font-size:11.5px;color:#94a3b8;margin-left:6px">Stok: ${maxQty}</span>
            <button class="ck-prod-remove" data-pid="${item.productId}">🗑 Hapus</button>
          </div>
        </div>
      </div>`;
  }

  function changeQty(productId, delta) {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;
    const product = PM_DB.getProductById(productId);
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      removeItem(productId);
      return;
    }
    if (product && newQty > product.stock) {
      toast(`Stok tersisa ${product.stock}`, 'warn');
      return;
    }
    item.qty = newQty;
    PM_DB.saveCart(cart);

    // Update qty display
    const qtyEl = document.getElementById(`qty-${productId}`);
    if (qtyEl) qtyEl.textContent = newQty;

    // Update subtotal display
    const itemEl = document.getElementById(`ck-item-${productId}`);
    if (itemEl) {
      const subEl = itemEl.querySelector('.ck-prod-sub strong');
      if (subEl) subEl.textContent = fmt(item.price * newQty);
    }

    updateSummary();
  }

  function removeItem(productId) {
    cart = cart.filter(i => i.productId !== productId);
    PM_DB.saveCart(cart);
    document.getElementById(`ck-item-${productId}`)?.remove();
    updateSummary();
    if (cart.length === 0) renderEmpty();
    toast('Item dihapus dari pesanan', 'warn');
  }

  /* ── Load saved address ──────────────────────────────────── */
  function loadSavedAddress() {
    const saved = PM_TX.getSavedAddress();
    const user  = PM_AUTH.getCurrentUser();

    if (saved) {
      // Show saved address
      const savedBox = document.getElementById('ck-saved-address');
      if (savedBox) {
        savedBox.style.display = 'flex';
        savedBox.querySelector('.ck-saved-addr-name').textContent =
          `${saved.name} · ${saved.phone}`;
        savedBox.querySelector('.ck-saved-addr-detail').textContent =
          `${saved.detail}, ${saved.district}, ${saved.city}, ${saved.province} ${saved.postalCode}`;
      }
      // Pre-fill form
      fillAddressForm(saved);
    } else if (user) {
      // Pre-fill from user profile
      setVal('addr-name',  user.name || '');
      setVal('addr-phone', user.phone || '');
    }

    // Calculate shipping after address loaded
    calcShipping();
  }

  function fillAddressForm(addr) {
    setVal('addr-name',     addr.name     || '');
    setVal('addr-phone',    addr.phone    || '');
    setVal('addr-province', addr.province || '');
    setVal('addr-city',     addr.city     || '');
    setVal('addr-district', addr.district || '');
    setVal('addr-postal',   addr.postalCode || '');
    setVal('addr-detail',   addr.detail   || '');
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  /* ── Render payment methods ──────────────────────────────── */
  function renderPaymentMethods() {
    const methods = [
      { id: 'cod',      icon: '🚚', name: 'COD',           desc: 'Bayar saat paket tiba di tangan Anda' },
      { id: 'transfer', icon: '🏦', name: 'Transfer Bank',  desc: 'BCA · BRI · Mandiri · BNI' },
      { id: 'ewallet',  icon: '💳', name: 'E-Wallet',       desc: 'GoPay · OVO · Dana · ShopeePay' },
      { id: 'qris',     icon: '📱', name: 'QRIS',           desc: 'Scan QR dari semua e-wallet' },
    ];
    const el = document.getElementById('ck-payment-grid');
    if (!el) return;
    el.innerHTML = methods.map(m => `
      <label class="ck-pay-card" for="pay-${m.id}" data-method="${m.id}">
        <input type="radio" name="paymethod" id="pay-${m.id}" value="${m.id}">
        <div class="ck-pay-check"><svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg></div>
        <div class="ck-pay-icon">${m.icon}</div>
        <div class="ck-pay-name">${m.name}</div>
        <div class="ck-pay-desc">${m.desc}</div>
      </label>`).join('');

    el.querySelectorAll('.ck-pay-card').forEach(card => {
      card.addEventListener('click', () => {
        el.querySelectorAll('.ck-pay-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedPayment = card.dataset.method;
        card.querySelector('input').checked = true;
        showPaymentDetail(selectedPayment);
        updateSummary();
      });
    });
  }

  function showPaymentDetail(method) {
    document.getElementById('ck-bank-detail')?.classList.toggle('show', method === 'transfer');
    document.getElementById('ck-qris-box')?.classList.toggle('show', method === 'qris');
    document.getElementById('ck-ewallet-detail')?.classList.toggle('show', method === 'ewallet');
  }

  /* ── Render shipping options ─────────────────────────────── */
  function renderShippingOptions() {
    calcShipping();
  }

  /* Split cart into durable vs perishable groups */
  function getShippingGroups() {
    const durable = [], perishable = [];
    cart.forEach(item => {
      const product = PM_DB.getProductById(item.productId);
      (product?.perishable ? perishable : durable).push(item);
    });
    return { durable, perishable };
  }

  function calcShipping() {
    const cityEl    = document.getElementById('addr-city');
    const distEl    = document.getElementById('addr-district');
    const buyerCity = cityEl?.value || '';
    const buyerDist = (distEl?.value || '').trim();
    const inPurbalingga = buyerCity.toLowerCase().includes('purbalingga');

    const { durable, perishable } = getShippingGroups();
    const el = document.getElementById('ck-shipping-opts');
    if (!el) return;

    let html = '';
    shippingCost = 0;

    if (durable.length > 0 && perishable.length > 0) {
      html += `
      <div class="ck-ship-notice">
        🌿 Keranjang Anda berisi <strong>produk cepat basi</strong> dan <strong>produk tahan lama</strong>.
        Untuk menjaga kualitas, kedua jenis produk ini diatur pengirimannya secara terpisah di bawah ini.
      </div>`;
    }

    if (durable.length > 0) {
      html += `<div class="ck-ship-group">`;
      if (perishable.length > 0) html += `<div class="ck-ship-group-title">📦 Produk Tahan Lama (${durable.length} item)</div>`;
      html += renderShippingGroup('durable', durable, { buyerCity, buyerDist, inPurbalingga });
      html += `</div>`;
    }

    if (perishable.length > 0) {
      html += `<div class="ck-ship-group">`;
      if (durable.length > 0) html += `<div class="ck-ship-group-title">🌿 Produk Cepat Basi (${perishable.length} item)</div>`;
      html += `
        <div class="ck-ship-notice" style="margin-bottom:10px">
          Agar tetap segar, produk ini hanya bisa <strong>diambil sendiri</strong> atau
          <strong>diantar langsung oleh seller</strong> pada hari yang sama.
        </div>`;
      html += renderShippingGroup('perishable', perishable, { buyerCity, buyerDist, inPurbalingga });
      html += `</div>`;
    }

    el.innerHTML = html;
    bindShippingGroupEvents(el, { buyerCity, buyerDist, inPurbalingga });
    recalcShippingCost({ buyerCity, buyerDist, inPurbalingga });
    updateSummary();
  }

  /* Compute base/express/seller rates for a group of items */
  function getGroupRates(items, ctx) {
    const sellerLoc = items[0] ? (PM_DB.getProductById(items[0].productId)?.location || 'Purbalingga Kota') : 'Purbalingga Kota';
    const baseRate    = PM_TX.calcShipping(sellerLoc, ctx.buyerCity);
    const expressRate = baseRate + 10000;
    const sameKecamatan = ctx.inPurbalingga && ctx.buyerDist &&
      ctx.buyerDist.toLowerCase().trim() === sellerLoc.toLowerCase().trim();
    const sellerDeliveryRate = sameKecamatan ? 5000 : 8000;
    return { baseRate, expressRate, sellerDeliveryRate, sameKecamatan, sellerLoc };
  }

  /* Render one shipping option group (durable or perishable) */
  function renderShippingGroup(groupKey, items, ctx) {
    const { baseRate, expressRate, sellerDeliveryRate, sameKecamatan } = getGroupRates(items, ctx);
    const isPerishable = groupKey === 'perishable';
    let current = selectedShipping[groupKey];

    // Validate current selection against availability, fall back sensibly
    const sellerDeliveryAvailable = ctx.inPurbalingga;
    if (isPerishable) {
      if (current === 'regular' || current === 'express') current = sellerDeliveryAvailable ? 'seller' : 'pickup';
    }
    if (current === 'seller' && !sellerDeliveryAvailable) current = 'pickup';
    if (current === 'pickup' && !ctx.inPurbalingga) current = 'regular';
    selectedShipping[groupKey] = current;

    let html = '';

    if (!isPerishable) {
      html += shipOptHtml(groupKey, 'regular', current, '🚛 Reguler', 'Estimasi 2-3 hari kerja', fmt(baseRate));
      html += shipOptHtml(groupKey, 'express', current, '⚡ Ekspres', 'Estimasi hari ini - besok', fmt(expressRate));
    }

    if (sellerDeliveryAvailable) {
      const etaNote = sameKecamatan ? ' · masih satu kecamatan' : ' · masih dalam Purbalingga';
      html += shipOptHtml(groupKey, 'seller', current, '🛵 Diantar Seller', `Diantar langsung oleh penjual hari ini${etaNote}`, fmt(sellerDeliveryRate));
    }

    if (ctx.inPurbalingga) {
      html += shipOptHtml(groupKey, 'pickup', current, '🤝 Ambil Sendiri (COD)', 'Janjian langsung dengan seller, hari ini', `<span style="color:#e8a020">GRATIS</span>`);
    }

    return `<div class="ck-ship-radio-list" data-group="${groupKey}">${html}</div>`;
  }

  function shipOptHtml(groupKey, value, current, name, eta, priceHtml) {
    const selected = current === value;
    return `
      <div class="ck-ship-opt ${selected ? 'selected' : ''}" data-group="${groupKey}" data-ship="${value}">
        <input type="radio" name="shipping-${groupKey}" value="${value}" ${selected ? 'checked' : ''}>
        <div class="ck-ship-info">
          <div class="ck-ship-name">${name}</div>
          <div class="ck-ship-eta">${eta}</div>
        </div>
        <div class="ck-ship-price">${priceHtml}</div>
      </div>`;
  }

  function bindShippingGroupEvents(root, ctx) {
    root.querySelectorAll('.ck-ship-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const groupKey = opt.dataset.group;
        const list = root.querySelector(`.ck-ship-radio-list[data-group="${groupKey}"]`);
        list?.querySelectorAll('.ck-ship-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
        selectedShipping[groupKey] = opt.dataset.ship;
        recalcShippingCost(ctx);
        updateSummary();
      });
    });
  }

  /* Recompute total shippingCost from current selectedShipping per group */
  function recalcShippingCost(ctx) {
    const { durable, perishable } = getShippingGroups();
    let total = 0;

    if (durable.length > 0) {
      const { baseRate, expressRate, sellerDeliveryRate } = getGroupRates(durable, ctx);
      const choice = selectedShipping.durable;
      total += choice === 'express' ? expressRate
             : choice === 'seller'  ? sellerDeliveryRate
             : choice === 'pickup'  ? 0
             : baseRate;
    }

    if (perishable.length > 0) {
      const { sellerDeliveryRate } = getGroupRates(perishable, ctx);
      const choice = selectedShipping.perishable;
      total += choice === 'seller' ? sellerDeliveryRate : 0; // pickup = 0
    }

    shippingCost = total;
  }

  /* ── Voucher ─────────────────────────────────────────────── */
  function renderVoucherChips() {
    const el = document.getElementById('ck-voucher-chips');
    if (!el) return;
    const chips = ['HEMAT10','HEMAT20','GRATISONGKIR','UMKM2025','NEWUSER'];
    el.innerHTML = chips.map(c => `
      <button class="ck-voucher-chip" onclick="PM_CHECKOUT.applyVoucherCode('${c}')">${c}</button>
    `).join('');
  }

  function applyVoucherCode(code) {
    const inp = document.getElementById('ck-voucher-input');
    if (inp) inp.value = code;
    applyVoucher();
  }

  function applyVoucher() {
    const code     = document.getElementById('ck-voucher-input')?.value.trim();
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

    if (!code) { toast('Masukkan kode voucher terlebih dahulu', 'warn'); return; }

    const result = PM_TX.validateVoucher(code, subtotal);
    if (!result.ok) { toast(result.msg, 'err'); return; }

    appliedVoucher = { code: result.code, ...result.voucher };
    const effect   = PM_TX.applyVoucher(result.code, subtotal, shippingCost);

    // Show applied badge
    const badge = document.getElementById('ck-voucher-applied');
    const label = document.getElementById('ck-voucher-label');
    if (badge) badge.classList.add('show');
    if (label) label.textContent = `${result.voucher.label} (${result.code})`;

    toast(`✅ Voucher ${result.code} berhasil! ${result.voucher.label}`, 'ok');
    updateSummary();
  }

  function removeVoucher() {
    appliedVoucher = null;
    const badge = document.getElementById('ck-voucher-applied');
    const inp   = document.getElementById('ck-voucher-input');
    if (badge) badge.classList.remove('show');
    if (inp)   inp.value = '';
    toast('Voucher dihapus', 'warn');
    updateSummary();
  }

  /* ── Update summary ──────────────────────────────────────── */
  function updateSummary() {
    const subtotal  = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const itemCount = cart.reduce((s, i) => s + i.qty, 0);

    // Apply voucher effects
    let discount = 0, shippingDiscount = 0;
    if (appliedVoucher) {
      const effect = PM_TX.applyVoucher(appliedVoucher.code, subtotal, shippingCost);
      discount         = effect.discount || 0;
      shippingDiscount = effect.shippingDiscount || 0;
    }

    const serviceFee  = Math.round(subtotal * 0.01);
    const finalShip   = Math.max(0, shippingCost - shippingDiscount);
    const total       = Math.max(0, subtotal - discount + finalShip + serviceFee);

    setTxt('sum-subtotal',     fmt(subtotal));
    setTxt('sum-items',        itemCount + ' produk');
    setTxt('sum-shipping',     shippingCost === 0 ? 'GRATIS' : fmt(finalShip));
    setTxt('sum-service',      fmt(serviceFee));
    setTxt('sum-total',        fmt(total));
    setTxt('sum-btn-total',    fmt(total));

    const discRow = document.getElementById('sum-discount-row');
    if (discRow) {
      discRow.style.display = discount > 0 ? 'flex' : 'none';
      setTxt('sum-discount', '- ' + fmt(discount));
    }

    // Update product preview in summary
    renderSummaryProducts();

    // Enable/disable submit
    const btn = document.getElementById('ck-submit-btn');
    if (btn) btn.disabled = !selectedPayment;
  }

  function setTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function renderSummaryProducts() {
    const el = document.getElementById('ck-sum-products');
    if (!el) return;
    const show = cart.slice(0, 2);
    const more = cart.length - 2;
    el.innerHTML = show.map(item => `
      <div class="ck-sum-prod-count">
        <img class="ck-sum-prod-img" src="${item.image}"
             onerror="this.src='https://picsum.photos/seed/${item.productId}/80/80'"
             alt="${item.name}">
        <div class="ck-sum-prod-info">
          <div class="ck-sum-prod-name">${item.name}</div>
          <div class="ck-sum-prod-qty">${fmt(item.price)} × ${item.qty}</div>
        </div>
      </div>`).join('') +
      (more > 0 ? `<div class="ck-sum-more">+${more} produk lainnya</div>` : '');
  }

  /* ── Render voucher chips ────────────────────────────────── */
  function renderVoucherChips() {
    const el = document.getElementById('ck-voucher-chips');
    if (!el) return;
    const vouchers = (PM_TX.getVouchers ? PM_TX.getVouchers() : {});
    el.innerHTML = Object.entries(vouchers).map(([code, v]) => `
      <div class="ck-voucher-chip"
           onclick="document.getElementById('ck-voucher-input').value='${code}';PM_CHECKOUT.applyVoucherCode('${code}')"
           title="${v.label}${v.minOrder ? ' · Min. Rp' + v.minOrder.toLocaleString('id-ID') : ''}">
        🏷️ ${code}
      </div>`).join('');
  }

  /* ── Bind events ─────────────────────────────────────────── */
  function bindEvents() {
    // Remove item buttons (delegated)
    document.getElementById('ck-product-list')?.addEventListener('click', e => {
      const btn = e.target.closest('.ck-prod-remove');
      if (btn) removeItem(btn.dataset.pid);
    });

    // Address change → recalc shipping
    document.getElementById('addr-city')?.addEventListener('change', () => {
      calcShipping();
      updateSummary();
    });
    document.getElementById('addr-district')?.addEventListener('input', () => {
      clearTimeout(window._ckDistTimer);
      window._ckDistTimer = setTimeout(() => {
        calcShipping();
        updateSummary();
      }, 500);
    });

    // Save address on input
    ['addr-name','addr-phone','addr-province','addr-city','addr-district','addr-postal','addr-detail']
      .forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
          autoSaveAddress();
          updateSummary();
        });
      });

    // Voucher
    document.getElementById('ck-voucher-btn')?.addEventListener('click', applyVoucher);
    document.getElementById('ck-voucher-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') applyVoucher();
    });
    document.getElementById('ck-voucher-remove')?.addEventListener('click', removeVoucher);

    // Submit
    document.getElementById('ck-submit-btn')?.addEventListener('click', submitOrder);

    // Copy bank number
    document.querySelectorAll('.ck-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.val || btn.previousElementSibling?.textContent || '');
        toast('Disalin ke clipboard!', 'ok', 1800);
      });
    });

    // Saved address click → use it
    document.getElementById('ck-saved-address')?.addEventListener('click', () => {
      const saved = PM_TX.getSavedAddress();
      if (saved) fillAddressForm(saved);
      toast('Alamat tersimpan digunakan', 'ok');
    });
  }

  function autoSaveAddress() {
    const addr = getAddress();
    if (addr.name) PM_TX.saveAddress(addr);
  }

  function getAddress() {
    return {
      name:       document.getElementById('addr-name')?.value.trim()     || '',
      phone:      document.getElementById('addr-phone')?.value.trim()    || '',
      province:   document.getElementById('addr-province')?.value        || '',
      city:       document.getElementById('addr-city')?.value            || '',
      district:   document.getElementById('addr-district')?.value.trim() || '',
      postalCode: document.getElementById('addr-postal')?.value.trim()   || '',
      detail:     document.getElementById('addr-detail')?.value.trim()   || '',
    };
  }

  /* ── Validate ────────────────────────────────────────────── */
  function validate() {
    const addr = getAddress();
    const errs = [];
    if (!addr.name)     errs.push('Nama penerima wajib diisi');
    if (!addr.phone)    errs.push('Nomor HP wajib diisi');
    if (!addr.province) errs.push('Pilih provinsi');
    if (!addr.city)     errs.push('Pilih kota/kabupaten');
    if (!addr.detail)   errs.push('Alamat detail wajib diisi');
    if (!selectedPayment) errs.push('Pilih metode pembayaran');

    if (errs.length > 0) {
      toast(errs[0], 'err');
      // Highlight first error field
      const fieldMap = {
        'Nama penerima wajib diisi': 'addr-name',
        'Nomor HP wajib diisi':       'addr-phone',
        'Pilih provinsi':             'addr-province',
        'Pilih kota/kabupaten':       'addr-city',
        'Alamat detail wajib diisi':  'addr-detail',
      };
      const fid = fieldMap[errs[0]];
      if (fid) {
        const el = document.getElementById(fid);
        el?.classList.add('err');
        el?.focus();
        setTimeout(() => el?.classList.remove('err'), 2000);
      }
      return false;
    }
    return true;
  }

  /* ── Submit order ────────────────────────────────────────── */
  function submitOrder() {
    if (isSubmitting) return;
    if (!validate()) return;

    isSubmitting = true;
    const btn = document.getElementById('ck-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="ck-spinner"></div> Memproses Pesanan...'; }

    const addr = getAddress();
    PM_TX.saveAddress(addr);

    // Collect notes per store
    const notes = {};
    document.querySelectorAll('.ck-note-field').forEach(el => {
      if (el.value.trim()) notes[el.dataset.store] = el.value.trim();
    });

    setTimeout(() => {
      const result = PM_TX.create({
        cart,
        address:       addr,
        paymentMethod: selectedPayment,
        voucher:       appliedVoucher?.code || null,
        buyerLocation: addr.city,
        notes,
        shippingType:  selectedShipping,
        shippingCost,
      });

      isSubmitting = false;

      if (!result.ok) {
        toast(result.msg, 'err');
        if (btn) { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg> Buat Pesanan`; }
        return;
      }

      // Store transaction ID for invoice page
      sessionStorage.setItem('pm_last_tx', result.transaction.transactionId);

      // Show success screen with WA notification links
      showOrderSuccess(result.transaction);

    }, 900);
  }

  /* ── WhatsApp Notification ──────────────────────────────── */
  function buildWaLinks(transaction) {
    const fmt   = n => 'Rp ' + Number(n).toLocaleString('id-ID');
    const links = [];

    // --- Per-seller links ---
    // Group products by seller
    const bySellerMap = {};
    (transaction.products || []).forEach(p => {
      const key = p.sellerUsername;
      if (!bySellerMap[key]) bySellerMap[key] = { storeName: p.storeName, sellerUsername: p.sellerUsername, items: [] };
      bySellerMap[key].items.push(p);
    });

    // Look up seller WA numbers from localStorage
    let users = [];
    try { users = JSON.parse(localStorage.getItem('pm_auth_users') || '[]'); } catch {}

    Object.values(bySellerMap).forEach(({ storeName, sellerUsername, items }) => {
      const seller = users.find(u => u.username === sellerUsername);
      const waRaw  = seller?.whatsapp || '';
      const waNum  = waRaw.replace(/[^0-9]/g, '');
      const waFull = waNum.startsWith('0') ? '62' + waNum.slice(1) : waNum;

      const itemLines = items.map(i =>
        `• ${i.name} x${i.qty} — ${fmt(i.subtotal)}`
      ).join('%0A');

      const msg = [
        `🛒 *PESANAN BARU MASUK!*`,
        ``,
        `📋 ID: ${transaction.transactionId}`,
        `👤 Pembeli: ${transaction.buyerName}`,
        `📞 HP: ${transaction.address?.phone || '-'}`,
        ``,
        `*Produk:*`,
        itemLines,
        ``,
        `💳 Pembayaran: ${(transaction.paymentMethod || '').toUpperCase()}`,
        `💰 Total: ${fmt(transaction.total)}`,
        ``,
        `📍 Alamat: ${transaction.address?.detail || ''}, ${transaction.address?.district || ''}, ${transaction.address?.city || ''}`,
        ``,
        `Segera proses pesanan ini ya! 🙏`,
      ].join('%0A');

      links.push({
        type:      'seller',
        label:     `Notif ke ${storeName}`,
        storeName,
        waNum:     waFull,
        hasWa:     !!waFull,
        href:      waFull ? `https://wa.me/${waFull}?text=${msg}` : null,
        msgPreview: `Pesanan baru dari ${transaction.buyerName} (${items.length} item, ${fmt(items.reduce((s,i)=>s+i.subtotal,0))})`,
      });
    });

    // --- Buyer self-confirmation link ---
    // Buyer can save the order details via WA to themselves
    const allItems = (transaction.products || []).map(i =>
      `• ${i.name} x${i.qty} — ${fmt(i.subtotal)}`
    ).join('%0A');

    const buyerMsg = [
      `✅ *KONFIRMASI PESANAN*`,
      ``,
      `📋 ID: ${transaction.transactionId}`,
      `🏪 Purbalingga Mart`,
      ``,
      `*Produk:*`,
      allItems,
      ``,
      `💳 Pembayaran: ${(transaction.paymentMethod || '').toUpperCase()}`,
      `🚚 Pengiriman: ${transaction.shippingLabel || '-'}`,
      `💰 Total Bayar: ${fmt(transaction.total)}`,
      ``,
      `📍 Kirim ke: ${transaction.address?.detail || ''}, ${transaction.address?.city || ''}`,
      ``,
      `Cek status pesanan di: ${window.location.origin}/orders.html`,
    ].join('%0A');

    links.push({
      type:  'buyer',
      label: 'Simpan bukti ke WA saya',
      href:  `https://wa.me/?text=${buyerMsg}`,
      hasWa: true,
    });

    return links;
  }

  function showOrderSuccess(transaction) {
    const fmt   = n => 'Rp ' + Number(n).toLocaleString('id-ID');
    const links = buildWaLinks(transaction);

    const sellerLinks = links.filter(l => l.type === 'seller');
    const buyerLink   = links.find(l => l.type === 'buyer');

    // Build seller WA cards
    const sellerCardsHtml = sellerLinks.map(l => {
      if (l.hasWa) {
        return `
          <a href="${l.href}" target="_blank" class="ck-wa-btn ck-wa-seller">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 011 4.18 2 2 0 013 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 9a16 16 0 006.29 6.29l.61-1.17a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
            ${l.label}
            <span class="ck-wa-sub">${l.msgPreview}</span>
          </a>`;
      } else {
        return `
          <div class="ck-wa-btn ck-wa-no-number">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 011 4.18 2 2 0 013 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 9a16 16 0 006.29 6.29l.61-1.17a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
            ${l.label}
            <span class="ck-wa-sub">⚠️ Seller belum mengatur nomor WA — minta seller isi di Dashboard → Profil</span>
          </div>`;
      }
    }).join('');

    // Build success overlay
    const overlay = document.createElement('div');
    overlay.id = 'ck-success-overlay';
    overlay.innerHTML = `
      <div class="ck-success-card">
        <div class="ck-success-icon">🎉</div>
        <h2 class="ck-success-title">Pesanan Berhasil Dibuat!</h2>
        <div class="ck-success-txid">${transaction.transactionId}</div>
        <div class="ck-success-total">Total: <strong>${fmt(transaction.total)}</strong></div>

        <div class="ck-wa-section">
          <div class="ck-wa-section-title">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e8a020" stroke-width="2.5">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 011 4.18 2 2 0 013 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 9a16 16 0 006.29 6.29l.61-1.17a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
            Notifikasi WhatsApp
          </div>
          <p class="ck-wa-desc">Kirim notifikasi ke seller agar pesanan Anda segera diproses.</p>
          ${sellerCardsHtml}
          <a href="${buyerLink.href}" target="_blank" class="ck-wa-btn ck-wa-buyer">
            📋 ${buyerLink.label}
          </a>
        </div>

        <div class="ck-success-actions">
          <a href="invoice.html?id=${transaction.transactionId}" class="ck-success-btn ck-success-btn-primary">
            🧾 Lihat Invoice
          </a>
          <a href="orders.html" class="ck-success-btn ck-success-btn-outline">
            📦 Cek Pesanan Saya
          </a>
        </div>
      </div>`;

    document.body.appendChild(overlay);
  }

  /* ── Expose ──────────────────────────────────────────────── */
  window.PM_CHECKOUT = { applyVoucherCode, removeVoucher, renderVoucherChips };

  document.addEventListener('DOMContentLoaded', init);

})();
