/* ================================================================
   PURBALINGGA MART — storage.js
   Central localStorage database engine
   ================================================================ */
'use strict';

(function () {

  /* ── Keys ──────────────────────────────────────────────────── */
  const KEYS = {
    PRODUCTS:     'pm_products',
    CART:         'pm_cart',
    TRANSACTIONS: 'pm_transactions',
    REVIEWS:      'pm_reviews',
    INIT:         'pm_db_initialized',
    NOTIFY:       'pm_notify_ts',   // cross-tab sync timestamp
  };

  /* ── Seed product data ────────────────────────────────────── */
  const SEED_PRODUCTS = [
    {
      id: 'p1', sellerId: 's1', sellerUsername: 'seller1',
      storeName: 'Toko Berkah', storeId: 's1',
      name: 'Nopia Asli Pak Slamet',
      category: 'makanan', location: 'Purbalingga Kota',
      price: 15000, originalPrice: 20000,
      stock: 15, sold: 234, rating: 4.8, ratingCount: 58,
      badge: 'BEST SELLER', promo: true, perishable: false,
      description: 'Nopia asli khas Purbalingga buatan turun-temurun. Tekstur renyah, isian manis gurih autentik. Cocok untuk oleh-oleh keluarga dan teman.',
      image: 'https://picsum.photos/seed/nopia/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 30*24*60*60*1000).toISOString(),
    },
    {
      id: 'p2', sellerId: 's2', sellerUsername: 'seller2',
      storeName: 'Warung Bu Siti', storeId: 's2',
      name: 'Tempe Mendoan Gurih',
      category: 'makanan', location: 'Bojongsari',
      price: 5000, originalPrice: 5000,
      stock: 50, sold: 512, rating: 4.7, ratingCount: 120,
      badge: 'TRENDING', promo: false, perishable: true,
      description: 'Tempe mendoan lembut dengan balutan tepung bumbu gurih khas Purbalingga. Cocok camilan atau lauk.',
      image: 'https://picsum.photos/seed/mendoan/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 28*24*60*60*1000).toISOString(),
    },
    {
      id: 'p3', sellerId: 's2', sellerUsername: 'seller2',
      storeName: 'Warung Bu Siti', storeId: 's2',
      name: 'Soto Bancar Khas',
      category: 'makanan', location: 'Kertanegara',
      price: 20000, originalPrice: 25000,
      stock: 30, sold: 189, rating: 4.9, ratingCount: 45,
      badge: 'PROMO', promo: true, perishable: true,
      description: 'Soto Bancar kuah bening segar dengan mi soun, potongan daging, dan taoge pilihan.',
      image: 'https://picsum.photos/seed/sotobancar/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 25*24*60*60*1000).toISOString(),
    },
    {
      id: 'p4', sellerId: 's1', sellerUsername: 'seller1',
      storeName: 'Toko Berkah', storeId: 's1',
      name: 'Gula Kelapa Organik',
      category: 'pertanian', location: 'Bukateja',
      price: 25000, originalPrice: 32000,
      stock: 40, sold: 98, rating: 4.6, ratingCount: 30,
      badge: 'PROMO', promo: true, perishable: false,
      description: 'Gula kelapa murni organik tanpa pengawet, aroma karamel alami cocok untuk memasak & baking.',
      image: 'https://picsum.photos/seed/gulakelapa/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 20*24*60*60*1000).toISOString(),
    },
    {
      id: 'p5', sellerId: 's1', sellerUsername: 'seller1',
      storeName: 'Toko Berkah', storeId: 's1',
      name: 'Kripik Tempe Sagu',
      category: 'makanan', location: 'Mrebet',
      price: 12000, originalPrice: 12000,
      stock: 60, sold: 321, rating: 4.5, ratingCount: 78,
      badge: 'BEST SELLER', promo: false, perishable: false,
      description: 'Kripik tempe sagu renyah dengan bumbu krispy khas Purbalingga. Cocok sebagai oleh-oleh keluarga.',
      image: 'https://picsum.photos/seed/kripiktempe/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 18*24*60*60*1000).toISOString(),
    },
    {
      id: 'p6', sellerId: 's2', sellerUsername: 'seller2',
      storeName: 'Warung Bu Siti', storeId: 's2',
      name: 'Batik Tulis Purbalingga',
      category: 'kerajinan', location: 'Purbalingga Kota',
      price: 185000, originalPrice: 220000,
      stock: 20, sold: 45, rating: 4.8, ratingCount: 18,
      badge: 'PROMO', promo: true, perishable: false,
      description: 'Batik tulis asli motif khas Banyumas, buatan pengrajin lokal berpengalaman lebih dari 20 tahun.',
      image: 'https://picsum.photos/seed/batikPurbalingga/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 15*24*60*60*1000).toISOString(),
    },
    {
      id: 'p7', sellerId: 's1', sellerUsername: 'seller1',
      storeName: 'Toko Berkah', storeId: 's1',
      name: 'Bulu Mata Palsu Premium',
      category: 'fashion', location: 'Mrebet',
      price: 35000, originalPrice: 50000,
      stock: 200, sold: 876, rating: 4.9, ratingCount: 200,
      badge: 'BEST SELLER', promo: true, perishable: false,
      description: 'Bulu mata palsu premium buatan Purbalingga — sentra bulu mata terbesar Indonesia. Alami & tahan lama.',
      image: 'https://picsum.photos/seed/bulumata/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 12*24*60*60*1000).toISOString(),
    },
    {
      id: 'p8', sellerId: 's2', sellerUsername: 'seller2',
      storeName: 'Warung Bu Siti', storeId: 's2',
      name: 'Kopi Robusta Purbalingga',
      category: 'minuman', location: 'Kertanegara',
      price: 45000, originalPrice: 45000,
      stock: 35, sold: 167, rating: 4.7, ratingCount: 42,
      badge: 'BARU', promo: false, perishable: false,
      description: 'Kopi robusta pilihan lereng Slamet, petik manual, diproses natural. Aroma kuat, rasa bold.',
      image: 'https://picsum.photos/seed/kopirobusta/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 8*24*60*60*1000).toISOString(),
    },
    {
      id: 'p9', sellerId: 's1', sellerUsername: 'seller1',
      storeName: 'Toko Berkah', storeId: 's1',
      name: 'Sambal Bawang Khas',
      category: 'makanan', location: 'Bukateja',
      price: 18000, originalPrice: 22000,
      stock: 8, sold: 243, rating: 4.6, ratingCount: 62,
      badge: 'PROMO', promo: true, perishable: false,
      description: 'Sambal bawang buatan tangan dengan bawang merah pilihan, cabai segar, dan bumbu rahasia.',
      image: 'https://picsum.photos/seed/sambalbawang/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 5*24*60*60*1000).toISOString(),
    },
    {
      id: 'p10', sellerId: 's2', sellerUsername: 'seller2',
      storeName: 'Warung Bu Siti', storeId: 's2',
      name: 'Anyaman Bambu Premium',
      category: 'kerajinan', location: 'Bojongsari',
      price: 75000, originalPrice: 90000,
      stock: 18, sold: 67, rating: 4.5, ratingCount: 22,
      badge: 'BARU', promo: false, perishable: false,
      description: 'Anyaman bambu premium handmade khas Purbalingga. Tersedia tas, tempat buah, dan dekorasi rumah.',
      image: 'https://picsum.photos/seed/anyamanbambu/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 3*24*60*60*1000).toISOString(),
    },
    {
      id: 'p11', sellerId: 's1', sellerUsername: 'seller1',
      storeName: 'Toko Berkah', storeId: 's1',
      name: 'Getuk Goreng Sokaraja',
      category: 'makanan', location: 'Purbalingga Kota',
      price: 8000, originalPrice: 10000,
      stock: 45, sold: 410, rating: 4.6, ratingCount: 95,
      badge: 'TRENDING', promo: true, perishable: true,
      description: 'Getuk goreng khas Sokaraja, renyah di luar lembut di dalam dengan gula jawa yang legit.',
      image: 'https://picsum.photos/seed/getukgoreng/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 2*24*60*60*1000).toISOString(),
    },
    {
      id: 'p12', sellerId: 's2', sellerUsername: 'seller2',
      storeName: 'Warung Bu Siti', storeId: 's2',
      name: 'Tas Anyam Rotan',
      category: 'kerajinan', location: 'Karangreja',
      price: 120000, originalPrice: 150000,
      stock: 12, sold: 34, rating: 4.7, ratingCount: 11,
      badge: 'PROMO', promo: true, perishable: false,
      description: 'Tas anyaman rotan premium buatan perajin lokal Purbalingga. Cocok untuk daily use maupun hadiah.',
      image: 'https://picsum.photos/seed/tasrotan/400/300',
      status: 'active',
      createdAt: new Date(Date.now() - 1*24*60*60*1000).toISOString(),
    },
  ];


  /* ── Seed transaction data ─────────────────────────────── */
  const SEED_TRANSACTIONS = [
    {
      transactionId: 'TRX-1704000001-DEMO',
      buyerId: 'u3', buyerName: 'Ahmad Buyer', buyerEmail: 'buyer@example.com',
      products: [
        { productId:'p1', name:'Nopia Asli Pak Slamet', price:15000, qty:2, image:'https://picsum.photos/seed/nopia/400/300', storeName:'Toko Berkah', sellerUsername:'seller1', location:'Purbalingga Kota', subtotal:30000 },
        { productId:'p5', name:'Kripik Tempe Sagu', price:12000, qty:3, image:'https://picsum.photos/seed/kripiktempe/400/300', storeName:'Toko Berkah', sellerUsername:'seller1', location:'Mrebet', subtotal:36000 },
      ],
      subtotal: 66000, shipping: 5000, shippingOriginal: 5000, discount: 0, serviceFee: 660,
      total: 71660, paymentMethod: 'cod',
      address: { name:'Ahmad Buyer', phone:'081234567890', province:'Jawa Tengah', city:'Purbalingga Kota', district:'Purbalingga', postalCode:'53311', detail:'Jl. Mawar No. 5 RT 02/03' },
      voucher: null, voucherLabel: null,
      status: 'diproses',
      statusHistory: [
        { status:'pending',  time: new Date(Date.now()-2*86400000).toISOString(), note:'Pesanan dibuat' },
        { status:'diproses', time: new Date(Date.now()-1*86400000).toISOString(), note:'Seller mengkonfirmasi pesanan' },
      ],
      createdAt: new Date(Date.now()-2*86400000).toISOString(),
      updatedAt: new Date(Date.now()-1*86400000).toISOString(),
    },
    {
      transactionId: 'TRX-1704000002-DEMO',
      buyerId: 'u3', buyerName: 'Ahmad Buyer', buyerEmail: 'buyer@example.com',
      products: [
        { productId:'p7', name:'Bulu Mata Palsu Premium', price:35000, qty:2, image:'https://picsum.photos/seed/bulumata/400/300', storeName:'Toko Berkah', sellerUsername:'seller1', location:'Mrebet', subtotal:70000 },
      ],
      subtotal: 70000, shipping: 5000, shippingOriginal: 5000, discount: 7000, serviceFee: 700,
      total: 68700, paymentMethod: 'transfer',
      address: { name:'Ahmad Buyer', phone:'081234567890', province:'Jawa Tengah', city:'Purbalingga Kota', district:'Purbalingga', postalCode:'53311', detail:'Jl. Melati No. 12 RT 01/02' },
      voucher: 'HEMAT10', voucherLabel: 'Diskon 10%',
      status: 'selesai',
      statusHistory: [
        { status:'pending',  time: new Date(Date.now()-5*86400000).toISOString(), note:'Pesanan dibuat' },
        { status:'diproses', time: new Date(Date.now()-4*86400000).toISOString(), note:'Seller mengkonfirmasi' },
        { status:'dikirim',  time: new Date(Date.now()-3*86400000).toISOString(), note:'Pesanan dikirim via kurir' },
        { status:'selesai',  time: new Date(Date.now()-1*86400000).toISOString(), note:'Pesanan diterima pembeli' },
      ],
      createdAt: new Date(Date.now()-5*86400000).toISOString(),
      updatedAt: new Date(Date.now()-1*86400000).toISOString(),
    },
  ];

  /* ================================================================
     PM_DB — Database engine
     ================================================================ */
  const PM_DB = {

    /* ── Init ────────────────────────────────────────────────── */
    init() {
      if (!localStorage.getItem(KEYS.INIT)) {
        this.saveProducts(SEED_PRODUCTS);
        this.saveCart([]);
        this.saveTransactions(SEED_TRANSACTIONS);
        localStorage.setItem(KEYS.INIT, '1');
      }
    },

    /* ── Notify (cross-tab) ──────────────────────────────────── */
    _notify() {
      localStorage.setItem(KEYS.NOTIFY, Date.now().toString());
    },

    /* ================================================================
       PRODUCTS
       ================================================================ */
    getProducts() {
      try {
        return JSON.parse(localStorage.getItem(KEYS.PRODUCTS) || '[]');
      } catch { return []; }
    },

    saveProducts(products) {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
      this._notify();
    },

    getActiveProducts() {
      return this.getProducts().filter(p => p.status === 'active');
    },

    getProductById(id) {
      return this.getProducts().find(p => p.id === id) || null;
    },

    getProductsBySeller(sellerId) {
      return this.getProducts().filter(p => p.sellerId === sellerId || p.sellerUsername === sellerId);
    },

    addProduct(product) {
      const products = this.getProducts();
      const newP = {
        ...product,
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        sold: 0,
        rating: 0,
        ratingCount: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      products.push(newP);
      this.saveProducts(products);
      return newP;
    },

    updateProduct(id, updates) {
      const products = this.getProducts();
      const idx = products.findIndex(p => p.id === id);
      if (idx === -1) return null;
      products[idx] = { ...products[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveProducts(products);
      return products[idx];
    },

    deleteProduct(id) {
      const products = this.getProducts().filter(p => p.id !== id);
      this.saveProducts(products);
      this._notify();
    },

    suspendProduct(id) {
      return this.updateProduct(id, { status: 'suspended' });
    },

    activateProduct(id) {
      return this.updateProduct(id, { status: 'active' });
    },

    /* ── Membership tier helpers ─────────────────────────────── */
    // Nilai numerik tier untuk keperluan sorting (makin tinggi = tampil lebih atas)
    _TIER_RANK: { gold: 3, silver: 2, free: 1 },

    // Ambil tier aktif seorang seller dari data user.
    // Jika expiry sudah lewat, kembalikan 'free'.
    getSellerTier(sellerUsername) {
      if (!window.PM_AUTH) return 'free';
      const users  = PM_AUTH.getUsers();
      const seller = users.find(u => u.username === sellerUsername);
      if (!seller || seller.role !== 'seller') return 'free';

      const tier   = seller.membershipTier || 'free';
      const expiry = seller.membershipExpiry ? new Date(seller.membershipExpiry) : null;
      if (expiry && expiry < new Date()) return 'free'; // expired → turun ke free
      return tier;
    },

    // Komparator: urutkan produk berdasarkan tier seller (Gold > Silver > Free),
    // lalu tiebreak dengan comparator sekunder yang diberikan.
    _sortByTier(products, secondaryComparator) {
      // Enrich dengan tier rank agar tidak hit getUsers() per-perbandingan
      const enriched = products.map(p => ({
        ...p,
        _tierRank: this._TIER_RANK[this.getSellerTier(p.sellerUsername)] || 1,
      }));
      enriched.sort((a, b) => {
        if (b._tierRank !== a._tierRank) return b._tierRank - a._tierRank;
        return secondaryComparator(a, b);
      });
      // Hapus field internal sebelum dikembalikan
      return enriched.map(({ _tierRank, ...p }) => p);
    },

    /* ── Product sections ────────────────────────────────────── */
    getLatest(limit = 8) {
      return this._sortByTier(
        this.getActiveProducts(),
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ).slice(0, limit);
    },

    getBestSellers(limit = 8) {
      return this._sortByTier(
        this.getActiveProducts(),
        (a, b) => b.sold - a.sold
      ).slice(0, limit);
    },

    getPromo(limit = 8) {
      return this._sortByTier(
        this.getActiveProducts().filter(p => p.promo),
        (a, b) => b.sold - a.sold
      ).slice(0, limit);
    },

    getTrending(limit = 8) {
      return this._sortByTier(
        this.getActiveProducts(),
        (a, b) => b.rating - a.rating
      ).slice(0, limit);
    },

    /* ── Search & filter ─────────────────────────────────────── */
    search(query, filters = {}) {
      let products = this.getActiveProducts();
      const q = query.toLowerCase().trim();

      if (q) {
        products = products.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.storeName.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        );
      }

      if (filters.category && filters.category !== 'semua') {
        products = products.filter(p => p.category === filters.category);
      }
      if (filters.location && filters.location !== 'semua') {
        products = products.filter(p => p.location === filters.location);
      }
      if (filters.minPrice) {
        products = products.filter(p => p.price >= Number(filters.minPrice));
      }
      if (filters.maxPrice) {
        products = products.filter(p => p.price <= Number(filters.maxPrice));
      }
      if (filters.minRating) {
        products = products.filter(p => p.rating >= Number(filters.minRating));
      }
      if (filters.promo) {
        products = products.filter(p => p.promo);
      }
      if (filters.inStock) {
        products = products.filter(p => p.stock > 0);
      }

      // Sort — semua mode tetap menerapkan tier sebagai prioritas pertama,
      // kecuali user memilih sort manual (price, oldest) yang dianggap override eksplisit.
      const MANUAL_SORTS = ['price_lo', 'price_hi', 'oldest'];
      if (MANUAL_SORTS.includes(filters.sort)) {
        // Sort manual: tidak ada tier boost
        switch (filters.sort) {
          case 'price_lo': products.sort((a,b) => a.price - b.price); break;
          case 'price_hi': products.sort((a,b) => b.price - a.price); break;
          case 'oldest':   products.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
        }
      } else {
        // Sort dengan tier awareness: Gold > Silver > Free, tiebreak oleh kriteria dipilih
        const secondary = {
          newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
          rating: (a, b) => b.rating - a.rating,
          sold:   (a, b) => b.sold - a.sold,
        }[filters.sort] || ((a, b) => b.sold - a.sold);
        products = this._sortByTier(products, secondary);
      }

      return products;
    },

    /* ── Stats ───────────────────────────────────────────────── */
    getStats() {
      const all = this.getProducts();
      const active = all.filter(p => p.status === 'active');
      const sellers = [...new Set(all.map(p => p.sellerId))].length;
      const categories = [...new Set(active.map(p => p.category))].length;
      const locations = [...new Set(active.map(p => p.location))].length;
      return { total: all.length, active: active.length, sellers, categories, locations };
    },

    /* ================================================================
       CART
       ================================================================ */
    getCart() {
      // Jangan tampilkan keranjang jika belum login
      if (window.PM_AUTH && !PM_AUTH.isLoggedIn()) return [];
      try {
        return JSON.parse(localStorage.getItem(KEYS.CART) || '[]');
      } catch { return []; }
    },

    saveCart(cart) {
      localStorage.setItem(KEYS.CART, JSON.stringify(cart));
      this._notify();
    },

    addToCart(productId, qty = 1) {
      const product = this.getProductById(productId);
      if (!product) return { ok: false, msg: 'Produk tidak ditemukan.' };
      if (product.stock < qty) return { ok: false, msg: 'Stok tidak mencukupi.' };

      const cart = this.getCart();
      const existing = cart.find(item => item.productId === productId);
      if (existing) {
        if (existing.qty + qty > product.stock) return { ok: false, msg: 'Melebihi stok tersedia.' };
        existing.qty += qty;
      } else {
        cart.push({
          id: 'ci_' + Date.now(),
          productId,
          name: product.name,
          price: product.price,
          image: product.image,
          storeName: product.storeName,
          qty,
          addedAt: new Date().toISOString(),
        });
      }
      this.saveCart(cart);
      return { ok: true, cart };
    },

    removeFromCart(productId) {
      this.saveCart(this.getCart().filter(i => i.productId !== productId));
    },

    updateCartQty(productId, qty) {
      const cart = this.getCart();
      const item = cart.find(i => i.productId === productId);
      if (item) {
        if (qty <= 0) return this.removeFromCart(productId);
        item.qty = qty;
        this.saveCart(cart);
      }
    },

    clearCart() { this.saveCart([]); },

    getCartTotal() {
      return this.getCart().reduce((sum, i) => sum + i.price * i.qty, 0);
    },

    getCartCount() {
      // Jangan tampilkan badge keranjang jika belum login
      if (window.PM_AUTH && !PM_AUTH.isLoggedIn()) return 0;
      return this.getCart().reduce((sum, i) => sum + i.qty, 0);
    },

    /* ================================================================
       TRANSACTIONS
       ================================================================ */
    getTransactions() {
      try {
        return JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS) || '[]');
      } catch { return []; }
    },

    saveTransactions(txns) {
      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txns));
    },

    /* ================================================================
       REVIEWS
       ================================================================ */
    getReviews() {
      try { return JSON.parse(localStorage.getItem(KEYS.REVIEWS) || '[]'); }
      catch { return []; }
    },

    saveReviews(reviews) {
      localStorage.setItem(KEYS.REVIEWS, JSON.stringify(reviews));
    },

    getReviewsByProduct(productId) {
      return this.getReviews().filter(r => r.productId === productId);
    },

    hasReviewed(transactionId, productId) {
      return this.getReviews().some(
        r => r.transactionId === transactionId && r.productId === productId
      );
    },

    addReview({ transactionId, productId, buyerId, buyerName, buyerAvatar, rating, comment }) {
      if (!transactionId || !productId || !buyerId || !rating)
        return { ok: false, msg: 'Data ulasan tidak lengkap.' };
      if (rating < 1 || rating > 5)
        return { ok: false, msg: 'Rating harus antara 1-5.' };
      if (this.hasReviewed(transactionId, productId))
        return { ok: false, msg: 'Anda sudah memberi ulasan untuk produk ini.' };

      const review = {
        id:            'RVW-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        transactionId,
        productId,
        buyerId,
        buyerName:     buyerName || 'Pembeli',
        buyerAvatar:   buyerAvatar || '',
        rating,
        comment:       (comment || '').trim(),
        createdAt:     new Date().toISOString(),
      };

      const reviews = this.getReviews();
      reviews.unshift(review);
      this.saveReviews(reviews);
      this._recalcProductRating(productId);
      this._markItemReviewed(transactionId, productId);
      return { ok: true, review };
    },

    _recalcProductRating(productId) {
      const productReviews = this.getReviewsByProduct(productId);
      if (productReviews.length === 0) return;
      const avg = productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length;
      this.updateProduct(productId, {
        rating:      Math.round(avg * 10) / 10,
        ratingCount: productReviews.length,
      });
    },

    _markItemReviewed(transactionId, productId) {
      const txns = this.getTransactions();
      const idx  = txns.findIndex(t => t.transactionId === transactionId);
      if (idx === -1) return;
      txns[idx].products = txns[idx].products.map(p =>
        p.productId === productId ? { ...p, reviewed: true } : p
      );
      this.saveTransactions(txns);
    },
  };

  window.PM_DB = PM_DB;
  PM_DB.init();

})();
