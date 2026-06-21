/* ================================================================
   PURBALINGGA MART — transaction.js
   Transaction engine: create, save, retrieve, status management
   ================================================================ */
'use strict';

(function () {

  const KEY_TX   = 'pm_transactions';
  const KEY_ADDR = 'pm_shipping_address';

  /* ── Vouchers ────────────────────────────────────────────── */
  const VOUCHERS = {
    'HEMAT10':      { type: 'percent',   value: 10,    label: 'Diskon 10%',        minOrder: 0 },
    'HEMAT20':      { type: 'percent',   value: 20,    label: 'Diskon 20%',        minOrder: 50000 },
    'DISKON50':     { type: 'flat',      value: 50000, label: 'Diskon Rp50.000',   minOrder: 100000 },
    'DISKON25':     { type: 'flat',      value: 25000, label: 'Diskon Rp25.000',   minOrder: 75000 },
    'GRATISONGKIR': { type: 'shipping',  value: 100,   label: 'Gratis Ongkir',     minOrder: 0 },
    'UMKM2025':     { type: 'percent',   value: 15,    label: 'Diskon UMKM 15%',   minOrder: 30000 },
    'NEWUSER':      { type: 'flat',      value: 20000, label: 'Diskon New User 20K', minOrder: 0 },
  };

  /* ── Shipping rates ─────────────────────────────────────── */
  const SHIPPING_RATES = {
    'Purbalingga Kota': {
      'Purbalingga Kota': 5000,  default: 12000,
    },
    default: {
      'Purbalingga Kota': 12000, default: 20000,
    },
  };

  /* ================================================================
     PM_TX — Transaction engine
     ================================================================ */
  const PM_TX = {

    /* ── Get / Save ──────────────────────────────────────── */
    getAll() {
      try { return JSON.parse(localStorage.getItem(KEY_TX) || '[]'); }
      catch { return []; }
    },

    saveAll(txns) {
      localStorage.setItem(KEY_TX, JSON.stringify(txns));
    },

    getById(id) {
      return this.getAll().find(t => t.transactionId === id) || null;
    },

    getByBuyer(buyerId) {
      return this.getAll().filter(t => t.buyerId === buyerId);
    },

    getBySeller(sellerUsername) {
      return this.getAll().filter(t =>
        t.products.some(p => p.sellerUsername === sellerUsername)
      );
    },

    /* ── Create transaction ──────────────────────────────── */
    create({ cart, address, paymentMethod, voucher, buyerLocation, shippingType, shippingCost, notes }) {
      const user = PM_AUTH.getCurrentUser();
      if (!user) return { ok: false, msg: 'Silakan login terlebih dahulu.' };
      if (!cart || cart.length === 0) return { ok: false, msg: 'Keranjang kosong.' };
      if (!address || !address.name || !address.phone || !address.detail)
        return { ok: false, msg: 'Lengkapi alamat pengiriman.' };
      if (!paymentMethod) return { ok: false, msg: 'Pilih metode pembayaran.' };

      const SHIPPING_LABELS = {
        regular: 'Reguler (2-3 hari kerja)',
        express: 'Ekspres (hari ini - besok)',
        seller:  'Diantar Seller (hari ini)',
        pickup:  'Ambil Sendiri (COD)',
      };

      // shippingType can be a per-group object: { durable: 'regular', perishable: 'pickup' }
      // or (for backward compatibility) a plain string applying to all items.
      const isGroupShipping = shippingType && typeof shippingType === 'object';

      // Enrich cart items with product data + per-item shipping assignment
      const enriched = cart.map(item => {
        const product = PM_DB.getProductById(item.productId);
        const perishable = product?.perishable || false;
        const itemShipType = isGroupShipping
          ? (perishable ? shippingType.perishable : shippingType.durable)
          : (shippingType || 'regular');
        return {
          productId:       item.productId,
          name:            item.name,
          price:           item.price,
          qty:             item.qty,
          image:           item.image,
          storeName:       item.storeName,
          sellerUsername:  product?.sellerUsername || '',
          location:        product?.location || 'Purbalingga Kota',
          perishable,
          shippingType:    itemShipType,
          shippingLabel:   SHIPPING_LABELS[itemShipType] || SHIPPING_LABELS.regular,
          subtotal:        item.price * item.qty,
        };
      });

      const subtotal = enriched.reduce((s, i) => s + i.subtotal, 0);

      // Shipping calc — use the shipping chosen at checkout (covers pickup/express/seller-delivery),
      // falling back to the basic regional rate if not provided.
      const sellerLoc = enriched[0]?.location || 'Purbalingga Kota';
      const buyerLoc  = buyerLocation || address.city || 'Purbalingga Kota';
      const shipping  = (typeof shippingCost === 'number')
        ? shippingCost
        : this.calcShipping(sellerLoc, buyerLoc);

      // Build a combined human-readable shipping label
      let shippingLabel;
      let shippingTypeStored;
      if (isGroupShipping) {
        const hasDurable    = enriched.some(p => !p.perishable);
        const hasPerishable = enriched.some(p => p.perishable);
        const parts = [];
        if (hasDurable)    parts.push(`Tahan Lama: ${SHIPPING_LABELS[shippingType.durable] || SHIPPING_LABELS.regular}`);
        if (hasPerishable) parts.push(`Cepat Basi: ${SHIPPING_LABELS[shippingType.perishable] || SHIPPING_LABELS.pickup}`);
        shippingLabel = parts.join(' · ');
        shippingTypeStored = shippingType; // keep the object for reference
      } else {
        shippingLabel = SHIPPING_LABELS[shippingType] || SHIPPING_LABELS.regular;
        shippingTypeStored = shippingType || 'regular';
      }

      // "Pickup" portions of the order never get shipping-voucher discounts since they're already free
      const allPickup = enriched.every(p => p.shippingType === 'pickup');

      // Voucher
      const voucherResult = voucher ? this.applyVoucher(voucher, subtotal, shipping) : null;
      const discount       = voucherResult?.discount || 0;
      const shippingDiscount = allPickup ? 0 : (voucherResult?.shippingDiscount || 0);

      // Service fee dinamis berdasarkan tier membership seller.
      // Jika cart berisi produk dari beberapa seller, fee dihitung per-seller
      // berdasarkan subtotal porsi masing-masing, lalu dijumlahkan.
      const FEE_RATE = { gold: 0.015, silver: 0.02, free: 0.02 };

      const _getSellerTier = (username) => {
        try {
          const users  = JSON.parse(localStorage.getItem('pm_auth_users') || '[]');
          const seller = users.find(u => u.username === username);
          if (!seller) return 'free';
          const tier   = seller.membershipTier || 'free';
          const expiry = seller.membershipExpiry ? new Date(seller.membershipExpiry) : null;
          return (expiry && expiry < new Date()) ? 'free' : tier;
        } catch { return 'free'; }
      };

      // Hitung fee per-seller lalu jumlahkan
      const feesBySeller = {};
      enriched.forEach(item => {
        const uname = item.sellerUsername || '__unknown__';
        if (!feesBySeller[uname]) {
          feesBySeller[uname] = { subtotal: 0, tier: _getSellerTier(uname) };
        }
        feesBySeller[uname].subtotal += item.subtotal;
      });

      const serviceFee = Math.round(
        Object.values(feesBySeller).reduce((sum, s) => sum + s.subtotal * (FEE_RATE[s.tier] || 0.02), 0)
      );

      // Simpan rate efektif untuk keperluan invoice/laporan
      const effectiveFeeRate = subtotal > 0 ? serviceFee / subtotal : 0.02;

      const total = subtotal + (shipping - shippingDiscount) - discount + serviceFee;

      const tx = {
        transactionId: 'TRX-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        buyerId:        user.id,
        buyerName:      user.name,
        buyerEmail:     user.email,
        products:       enriched,
        subtotal,
        shipping:       Math.max(0, shipping - shippingDiscount),
        shippingOriginal: shipping,
        shippingType:   shippingTypeStored,
        shippingLabel,
        notes:          notes || '',
        discount,
        serviceFee,
        effectiveFeeRate: Math.round(effectiveFeeRate * 10000) / 10000, // simpan 4 desimal
        sellerFeeBreakdown: Object.fromEntries(          // { username: { tier, subtotal, fee } }
          Object.entries(feesBySeller).map(([u, s]) => [u, {
            tier:     s.tier,
            subtotal: s.subtotal,
            fee:      Math.round(s.subtotal * (FEE_RATE[s.tier] || 0.02)),
          }])
        ),
        total:          Math.max(0, total),
        paymentMethod,
        address,
        voucher:        voucher || null,
        voucherLabel:   voucherResult?.label || null,
        status:         'pending',
        statusHistory:  [{ status: 'pending', time: new Date().toISOString(), note: 'Pesanan dibuat' }],
        createdAt:      new Date().toISOString(),
        updatedAt:      new Date().toISOString(),
      };

      // Save transaction
      const all = this.getAll();
      all.unshift(tx);
      this.saveAll(all);

      // Deduct stock
      enriched.forEach(item => {
        const product = PM_DB.getProductById(item.productId);
        if (product) {
          PM_DB.updateProduct(item.productId, {
            stock: Math.max(0, product.stock - item.qty),
            sold:  (product.sold || 0) + item.qty,
          });
        }
      });

      // Clear cart
      PM_DB.clearCart();

      return { ok: true, transaction: tx };
    },

    /* ── Update status ───────────────────────────────────── */
    updateStatus(transactionId, status, note = '') {
      const all = this.getAll();
      const idx = all.findIndex(t => t.transactionId === transactionId);
      if (idx === -1) return false;
      all[idx].status = status;
      all[idx].updatedAt = new Date().toISOString();
      all[idx].statusHistory = [
        ...(all[idx].statusHistory || []),
        { status, time: new Date().toISOString(), note },
      ];
      this.saveAll(all);
      return true;
    },

    /* ── Update resi / tracking number ─────────────────── */
    updateResi(transactionId, resi, ekspedisi = '') {
      const all = this.getAll();
      const idx = all.findIndex(t => t.transactionId === transactionId);
      if (idx === -1) return false;
      all[idx].resi      = resi.trim();
      all[idx].ekspedisi = ekspedisi.trim();
      all[idx].updatedAt = new Date().toISOString();
      // Auto-update status to dikirim when resi is added
      if (resi && all[idx].status === 'diproses') {
        all[idx].status = 'dikirim';
        all[idx].statusHistory = [
          ...(all[idx].statusHistory || []),
          { status: 'dikirim', time: new Date().toISOString(), note: `No. Resi: ${ekspedisi ? ekspedisi + ' - ' : ''}${resi}` },
        ];
      }
      this.saveAll(all);
      return true;
    },

    /* ── Voucher validation ──────────────────────────────── */
    validateVoucher(code, subtotal) {
      const v = VOUCHERS[code?.toUpperCase().trim()];
      if (!v) return { ok: false, msg: 'Kode voucher tidak valid.' };
      if (subtotal < v.minOrder) return {
        ok: false,
        msg: `Minimum order Rp ${v.minOrder.toLocaleString('id-ID')} untuk voucher ini.`,
      };
      return { ok: true, voucher: v, code: code.toUpperCase().trim() };
    },

    applyVoucher(code, subtotal, shipping) {
      const v = VOUCHERS[code?.toUpperCase().trim()];
      if (!v) return null;
      let discount = 0, shippingDiscount = 0;
      if (v.type === 'percent')  discount = Math.round(subtotal * v.value / 100);
      if (v.type === 'flat')     discount = Math.min(v.value, subtotal);
      if (v.type === 'shipping') shippingDiscount = shipping;
      return { discount, shippingDiscount, label: v.label };
    },

    /* ── Shipping calculator ─────────────────────────────── */
    calcShipping(sellerLocation, buyerLocation) {
      const sellerRates = SHIPPING_RATES[sellerLocation] || SHIPPING_RATES.default;
      return sellerRates[buyerLocation] || sellerRates.default || 15000;
    },

    /* ── Address persistence ─────────────────────────────── */
    getSavedAddress() {
      try { return JSON.parse(localStorage.getItem(KEY_ADDR) || 'null'); }
      catch { return null; }
    },

    saveAddress(addr) {
      localStorage.setItem(KEY_ADDR, JSON.stringify(addr));
    },

    /* ── Stats ───────────────────────────────────────────── */
    getStats() {
      const all = this.getAll();
      const revenue    = all.reduce((s, t) => s + t.total, 0);
      const byStatus   = {};
      all.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
      return { total: all.length, revenue, byStatus };
    },

    getVouchers: () => VOUCHERS,

    /* ── Commission report ───────────────────────────────── */
    // Returns breakdown of platform service fee income, grouped by month and per seller.
    // Used by the Admin Commission Report section.
    getCommissionReport() {
      const all = this.getAll();

      const byMonth  = {};
      const bySeller = {};

      all.forEach(t => {
        const fee = t.serviceFee || 0;
        if (!fee) return;

        const d        = new Date(t.createdAt);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

        if (!byMonth[monthKey]) {
          byMonth[monthKey] = { key: monthKey, label: monthLabel, totalFee: 0, totalTx: 0, totalGmv: 0 };
        }
        byMonth[monthKey].totalFee += fee;
        byMonth[monthKey].totalTx  += 1;
        byMonth[monthKey].totalGmv += t.subtotal || 0;

        const sellers = [...new Set((t.products || []).map(p => p.sellerUsername).filter(Boolean))];
        sellers.forEach(username => {
          const sellerSubtotal = (t.products || [])
            .filter(p => p.sellerUsername === username)
            .reduce((s, p) => s + (p.subtotal || 0), 0);
          const sellerFee = t.subtotal > 0 ? Math.round(fee * sellerSubtotal / t.subtotal) : 0;

          if (!bySeller[username]) {
            bySeller[username] = { username, storeName: '', totalFee: 0, totalTx: 0, totalGmv: 0 };
          }
          bySeller[username].totalFee += sellerFee;
          bySeller[username].totalGmv += sellerSubtotal;
          bySeller[username].totalTx  += 1;
          if (!bySeller[username].storeName) {
            const prod = (t.products || []).find(p => p.sellerUsername === username);
            bySeller[username].storeName = prod?.storeName || username;
          }
        });
      });

      const months  = Object.values(byMonth).sort((a, b) => b.key.localeCompare(a.key));
      const sellers = Object.values(bySeller).sort((a, b) => b.totalFee - a.totalFee);
      const totalFee = all.reduce((s, t) => s + (t.serviceFee || 0), 0);
      const totalGmv = all.reduce((s, t) => s + (t.subtotal || 0), 0);
      const totalTx  = all.filter(t => t.serviceFee > 0).length;

      return { months, sellers, totalFee, totalGmv, totalTx };
    },
  };

  window.PM_TX = PM_TX;

})();
