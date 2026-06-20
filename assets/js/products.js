/* ================================================================
   PURBALINGGA MART — products.js
   Homepage product rendering, filtering & search engine
   ================================================================ */
'use strict';

(function () {

  /* ── Helpers ─────────────────────────────────────────────── */
  const fmt = n => 'Rp ' + Number(n).toLocaleString('id-ID');
  const disc = (orig, price) => orig > price ? Math.round((1 - price / orig) * 100) : 0;
  const stars = r => {
    if (!r) return '';
    const full = Math.floor(r);
    const half = r - full >= 0.5 ? 1 : 0;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
  };

  /* ── Membership tier badge helper ───────────────────────── */
  const TIER_BADGE = {
    gold:   { label: '🥇 GOLD',   cls: 'pc-tier-gold'   },
    silver: { label: '🥈 SILVER', cls: 'pc-tier-silver' },
  };

  function getTierBadgeHTML(sellerUsername) {
    if (!window.PM_AUTH) return '';
    const info = PM_AUTH.getMembershipInfo
      ? PM_AUTH.getMembershipInfo({ username: sellerUsername })
      : null;
    // Coba ambil langsung dari data user jika getMembershipInfo belum ada
    if (!info) {
      try {
        const users  = JSON.parse(localStorage.getItem('pm_auth_users') || '[]');
        const seller = users.find(u => u.username === sellerUsername);
        if (!seller) return '';
        const tier   = seller.membershipTier || 'free';
        const expiry = seller.membershipExpiry ? new Date(seller.membershipExpiry) : null;
        const active = (expiry && expiry < new Date()) ? 'free' : tier;
        const badge  = TIER_BADGE[active];
        return badge ? `<span class="pc-tier-badge ${badge.cls}">${badge.label}</span>` : '';
      } catch { return ''; }
    }
    const badge = TIER_BADGE[info.tier];
    return badge ? `<span class="pc-tier-badge ${badge.cls}">${badge.label}</span>` : '';
  }

  /* ── Badge map ───────────────────────────────────────────── */
  const BADGE_CLASS = {
    'BEST SELLER': 'badge-bs',
    'TRENDING':    'badge-tren',
    'PROMO':       'badge-promo',
    'BARU':        'badge-baru',
    'HOT':         'badge-hot',
  };

  /* ── Skeleton ────────────────────────────────────────────── */
  function skeletonCard() {
    return `<div class="prod-card skeleton-card">
      <div class="sk sk-img"></div>
      <div class="sk-body">
        <div class="sk sk-line" style="width:60%;height:14px;margin-bottom:8px"></div>
        <div class="sk sk-line" style="width:85%;height:12px;margin-bottom:6px"></div>
        <div class="sk sk-line" style="width:40%;height:18px;margin-bottom:10px"></div>
        <div class="sk sk-line" style="width:70%;height:10px"></div>
      </div>
    </div>`;
  }

  /* ── Product card ────────────────────────────────────────── */
  function createProductCard(p) {
    const discPct = disc(p.originalPrice, p.price);
    const badgeCls = BADGE_CLASS[p.badge] || 'badge-baru';
    const lowStock = p.stock > 0 && p.stock <= 10;
    const outStock = p.stock === 0;

    return `<div class="prod-card" data-id="${p.id}" data-cat="${p.category}" data-loc="${p.location}">
      <div class="pc-img-wrap">
        <img class="pc-img lazy" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
             data-src="${p.image}" alt="${p.name}"
             onerror="this.src='https://picsum.photos/seed/${p.id}/400/300'">
        ${p.badge ? `<span class="pc-badge ${badgeCls}">${p.badge}</span>` : ''}
        ${discPct > 0 ? `<span class="pc-disc">-${discPct}%</span>` : ''}
        ${outStock ? `<div class="pc-out-overlay">Habis</div>` : ''}
      </div>
      <div class="pc-body">
        <div class="pc-store">
          <span class="pc-store-name">🏪 ${p.storeName}</span>
          ${getTierBadgeHTML(p.sellerUsername)}
          <span class="pc-loc">📍 ${p.location}</span>
        </div>
        <h3 class="pc-name">${p.name}</h3>
        <div class="pc-price-row">
          <span class="pc-price">${fmt(p.price)}</span>
          ${discPct > 0 ? `<span class="pc-orig">${fmt(p.originalPrice)}</span>` : ''}
        </div>
        <div class="pc-meta">
          <span class="pc-rating" title="${p.rating} bintang">
            <span class="pc-stars">${p.rating ? p.rating.toFixed(1) : '-'}</span>
            <span class="star-icon">★</span>
          </span>
          <span class="pc-sep">·</span>
          <span class="pc-sold">${p.sold > 0 ? p.sold + ' terjual' : 'Baru'}</span>
          ${lowStock ? `<span class="pc-low-stock">⚠️ Sisa ${p.stock}</span>` : ''}
          ${p.perishable ? `<span class="pc-perishable" title="Kirim/ambil di hari yang sama agar tetap segar">🌿 Cepat Basi</span>` : ''}
        </div>
        <div class="pc-actions">
          <button class="pc-btn pc-btn-detail" onclick="PM_PRODUCTS.openDetail('${p.id}')">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Detail
          </button>
          <button class="pc-btn pc-btn-cart ${outStock ? 'disabled' : ''}"
                  onclick="PM_PRODUCTS.addToCart('${p.id}',this)"
                  ${outStock ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            Keranjang
          </button>
        </div>
      </div>
    </div>`;
  }

  /* ── Render grid ─────────────────────────────────────────── */
  function renderGrid(container, products, emptyMsg = 'Produk tidak ditemukan.') {
    if (!container) return;
    if (!products || products.length === 0) {
      container.innerHTML = `<div class="pm-empty-state">
        <div class="pm-empty-icon">🔍</div>
        <div class="pm-empty-title">Produk Belum Ada</div>
        <div class="pm-empty-desc">${emptyMsg}</div>
      </div>`;
      return;
    }
    container.innerHTML = products.map(createProductCard).join('');
    lazyLoadImages(container);
  }

  /* ── Lazy image loading ──────────────────────────────────── */
  function lazyLoadImages(root = document) {
    const imgs = root.querySelectorAll('img.lazy');
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries, o) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const img = e.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            o.unobserve(img);
          }
        });
      }, { rootMargin: '200px' });
      imgs.forEach(img => obs.observe(img));
    } else {
      imgs.forEach(img => { img.src = img.dataset.src; img.classList.remove('lazy'); });
    }
  }

  /* ── Show skeletons ──────────────────────────────────────── */
  function showSkeletons(container, count = 8) {
    if (!container) return;
    container.innerHTML = Array(count).fill(skeletonCard()).join('');
  }

  /* ── Product Detail Modal ────────────────────────────────── */
  function openDetail(productId) {
    const p = PM_DB.getProductById(productId);
    if (!p) return;

    // Remove existing modal
    document.getElementById('pm-detail-modal')?.remove();

    const discPct = disc(p.originalPrice, p.price);
    const badgeCls = BADGE_CLASS[p.badge] || 'badge-baru';

    const related = PM_DB.search('', { category: p.category })
      .filter(r => r.id !== p.id)
      .slice(0, 4);

    const el = document.createElement('div');
    el.id = 'pm-detail-modal';
    el.className = 'pm-modal-overlay pm-detail-overlay';
    el.innerHTML = `
      <div class="pm-detail-box">
        <button class="pm-detail-close" onclick="document.getElementById('pm-detail-modal').remove()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div class="pm-detail-grid">
          <!-- Image side -->
          <div class="pm-detail-img-side">
            <div class="pm-detail-img-wrap">
              <img src="${p.image}" alt="${p.name}"
                   onerror="this.src='https://picsum.photos/seed/${p.id}/600/450'"
                   style="width:100%;height:100%;object-fit:cover;border-radius:12px">
              ${p.badge ? `<span class="pc-badge ${badgeCls}" style="font-size:12px;padding:4px 10px">${p.badge}</span>` : ''}
              ${discPct > 0 ? `<span class="pc-disc">-${discPct}%</span>` : ''}
            </div>
          </div>

          <!-- Info side -->
          <div class="pm-detail-info">
            <div class="pd-store">🏪 ${p.storeName} ${getTierBadgeHTML(p.sellerUsername)} · 📍 ${p.location}</div>
            <h2 class="pd-name">${p.name}</h2>

            <div class="pd-rating-row">
              <span class="pd-stars">★ ${p.rating ? p.rating.toFixed(1) : '0'}</span>
              <span class="pd-rating-cnt">(${p.ratingCount || 0} ulasan)</span>
              <span class="pd-sep">·</span>
              <span class="pd-sold">${p.sold} terjual</span>
            </div>

            <div class="pd-price-block">
              <div class="pd-price">${fmt(p.price)}</div>
              ${discPct > 0 ? `
                <div class="pd-price-orig-row">
                  <span class="pd-orig">${fmt(p.originalPrice)}</span>
                  <span class="pd-disc-badge">Hemat ${discPct}%</span>
                </div>` : ''}
            </div>

            <div class="pd-desc">${p.description || '-'}</div>

            <div class="pd-meta-grid">
              <div class="pd-meta-item">
                <span class="pd-meta-label">Kategori</span>
                <span class="pd-meta-val">${p.category}</span>
              </div>
              <div class="pd-meta-item">
                <span class="pd-meta-label">Stok</span>
                <span class="pd-meta-val ${p.stock <= 5 ? 'text-warn' : p.stock === 0 ? 'text-danger' : ''}">
                  ${p.stock === 0 ? 'Habis' : p.stock <= 10 ? `Sisa ${p.stock}` : p.stock + ' tersedia'}
                </span>
              </div>
            </div>

            <div class="pd-qty-row">
              <button class="pd-qty-btn" onclick="PM_PRODUCTS._changeQty(-1)">−</button>
              <input type="number" id="pd-qty-input" value="1" min="1" max="${p.stock}" class="pd-qty-input">
              <button class="pd-qty-btn" onclick="PM_PRODUCTS._changeQty(1)">+</button>
              <span class="pd-stock-note">Stok: ${p.stock}</span>
            </div>

            <div class="pd-action-btns">
              <button class="pd-btn-cart" onclick="PM_PRODUCTS._detailAddCart('${p.id}')">
                🛒 Tambah ke Keranjang
              </button>
              ${(function() {
                // Look up seller WA from users
                const users = JSON.parse(localStorage.getItem('pm_auth_users') || '[]');
                const seller = users.find(u => u.username === p.sellerUsername);
                const waNum  = (seller && seller.whatsapp) ? seller.whatsapp.replace(/[^0-9]/g,'') : '';
                const waNum2 = waNum.startsWith('0') ? '62' + waNum.slice(1) : waNum;
                const msg    = encodeURIComponent('Halo, saya tertarik dengan produk *' + p.name + '* di Purbalingga Mart. Apakah masih tersedia?');
                const href   = waNum2 ? 'https://wa.me/' + waNum2 + '?text=' + msg : '#';
                const cls    = waNum2 ? 'pd-btn-wa' : 'pd-btn-wa pd-btn-wa-disabled';
                const title  = waNum2 ? '' : 'Seller belum mengatur nomor WhatsApp';
                return '<a href="' + href + '" target="' + (waNum2 ? '_blank' : '_self') + '" class="' + cls + '" title="' + title + '">' +
                  '💬 Hubungi Seller' +
                  (waNum2 ? '' : ' <span style=\'font-size:10px;opacity:.6\'>(No. belum diatur)</span>') +
                  '</a>';
              })()}
            </div>
          </div>
        </div>

        ${related.length > 0 ? `
        <div class="pd-related">
          <h3 class="pd-related-title">Produk Serupa</h3>
          <div class="pd-related-grid">
            ${related.map(r => `
              <div class="pd-rel-card" onclick="PM_PRODUCTS.openDetail('${r.id}')">
                <img src="${r.image}" alt="${r.name}" onerror="this.src='https://picsum.photos/seed/${r.id}/200/150'">
                <div class="pd-rel-name">${r.name}</div>
                <div class="pd-rel-price">${fmt(r.price)}</div>
              </div>`).join('')}
          </div>
        </div>` : ''}
      </div>`;

    // Inject reviews section into modal
    const reviewsBlock = document.createElement('div');
    reviewsBlock.className = 'pd-reviews-section';
    reviewsBlock.innerHTML = _buildReviewsHTML(p);
    el.querySelector('.pm-detail-box').appendChild(reviewsBlock);

    el.addEventListener('click', e => {
      if (e.target === el) el.remove();
    });
    document.body.appendChild(el);

    // Trap scroll
    document.body.style.overflow = 'hidden';
    el.addEventListener('remove', () => { document.body.style.overflow = ''; });
    // Simple cleanup
    setTimeout(() => {
      const btn = el.querySelector('.pm-detail-close');
      if (btn) {
        const orig = btn.onclick;
        btn.onclick = () => {
          document.body.style.overflow = '';
          el.remove();
        };
      }
    }, 0);
  }

  /* ── Build reviews HTML ─────────────────────────────────── */
  /* ── Build reviews HTML ─────────────────────────────────────── */
  function _buildReviewsHTML(p) {
    const reviews = PM_DB.getReviewsByProduct(p.id);
    const avg = reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    const starsHTML = r => {
      let h = '';
      for (let i = 1; i <= 5; i++) {
        h += `<span style="color:${i <= r ? '#f59e0b' : '#d1d5db'}">★</span>`;
      }
      return h;
    };

    const fmtDate = d => new Date(d).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    const user = PM_AUTH.getCurrentUser();
    let canReview  = false;
    let pendingTxId = null;

    if (user && user.role === 'buyer' && typeof PM_TX !== 'undefined') {
      const txns = PM_TX.getByBuyer(user.id);
      const tx = txns.find(t =>
        t.status === 'selesai' &&
        t.products.some(item => item.productId === p.id && !item.reviewed)
      );
      if (tx) { canReview = true; pendingTxId = tx.transactionId; }
    }

    let html = `<div class="pd-reviews-wrap">
      <div class="pd-reviews-head">
        <h3 class="pd-reviews-title">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          Ulasan Pembeli
        </h3>`;

    if (avg) {
      html += `<div class="pd-reviews-avg">
        <span class="pd-avg-num">${avg}</span>
        <span class="pd-avg-stars">${starsHTML(Math.round(parseFloat(avg)))}</span>
        <span class="pd-avg-cnt">(${reviews.length} ulasan)</span>
      </div>`;
    }
    html += `</div>`;

    if (canReview) {
      html += `<div class="pd-review-form">
        <div class="pd-review-form-title">✍️ Tulis Ulasan Anda</div>
        <div class="pd-star-picker" id="pd-star-pick-${p.id}" data-rating="0">
          ${[1,2,3,4,5].map(n =>
            `<button class="pd-star-btn" data-val="${n}"
                     onclick="PM_PRODUCTS._pickStar('${p.id}', ${n})">★</button>`
          ).join('')}
        </div>
        <div class="pd-review-form-err" id="pd-review-err-${p.id}"
             style="display:none;color:#ef4444;font-size:12px;margin:4px 0"></div>
        <textarea class="pd-review-textarea" id="pd-review-txt-${p.id}"
          placeholder="Bagaimana pengalaman Anda dengan produk ini? (opsional)"
          rows="3" maxlength="400"></textarea>
        <button class="pd-review-submit"
                onclick="PM_PRODUCTS._submitReview('${p.id}', '${pendingTxId}')">
          Kirim Ulasan
        </button>
      </div>`;
    }

    if (reviews.length === 0) {
      html += `<div class="pd-reviews-empty">
        <span style="font-size:32px">💬</span>
        <div>Belum ada ulasan. Jadilah yang pertama!</div>
      </div>`;
    } else {
      reviews.slice(0, 6).forEach(r => {
        html += `<div class="pd-review-item">
          <div class="pd-review-top">
            <img class="pd-review-avatar"
                 src="${r.buyerAvatar || `https://picsum.photos/seed/${r.buyerId}/40/40`}"
                 onerror="this.src='https://picsum.photos/seed/def/40/40'" alt="avatar">
            <div class="pd-review-meta">
              <div class="pd-review-name">${r.buyerName}</div>
              <div class="pd-review-stars">${starsHTML(r.rating)}</div>
            </div>
            <div class="pd-review-date">${fmtDate(r.createdAt)}</div>
          </div>
          ${r.comment ? `<div class="pd-review-comment">${r.comment}</div>` : ''}
        </div>`;
      });
    }

    html += `</div>`;
    return html;
  }

  /* ── Star picker ─────────────────────────────────────────────── */
  function _pickStar(productId, val) {
    const wrap = document.getElementById('pd-star-pick-' + productId);
    if (!wrap) return;
    wrap.dataset.rating = val;
    wrap.querySelectorAll('.pd-star-btn').forEach((btn, i) => {
      btn.style.color = i < val ? '#f59e0b' : '#d1d5db';
    });
  }

  /* ── Submit review ───────────────────────────────────────────── */
  function _submitReview(productId, transactionId) {
    const user = PM_AUTH.getCurrentUser();
    if (!user) { PM_AUTH.showLoginModal(); return; }

    const wrap    = document.getElementById('pd-star-pick-' + productId);
    const rating  = parseInt(wrap?.dataset.rating || '0');
    const errEl   = document.getElementById('pd-review-err-' + productId);
    const comment = document.getElementById('pd-review-txt-' + productId)?.value.trim();

    if (errEl) errEl.style.display = 'none';
    if (!rating || rating < 1) {
      if (errEl) { errEl.textContent = 'Pilih rating bintang terlebih dahulu.'; errEl.style.display = 'block'; }
      return;
    }

    const result = PM_DB.addReview({
      transactionId,
      productId,
      buyerId:     user.id,
      buyerName:   user.name,
      buyerAvatar: user.avatar || '',
      rating,
      comment,
    });

    if (!result.ok) { PM_AUTH.toast(result.msg, 'err'); return; }

    PM_AUTH.toast('✅ Ulasan berhasil dikirim! Terima kasih.', 'ok');

    // Refresh the reviews section in the open modal
    const section = document.querySelector('.pd-reviews-section');
    const product = PM_DB.getProductById(productId);
    if (section && product) {
      section.innerHTML = _buildReviewsHTML(product);
    }
  }

  /* ── Qty helper ──────────────────────────────────────────── */
  function _changeQty(delta) {
    const inp = document.getElementById('pd-qty-input');
    if (!inp) return;
    const max = parseInt(inp.max) || 99;
    inp.value = Math.max(1, Math.min(max, parseInt(inp.value || 1) + delta));
  }

  /* ── Add to cart (card button) ───────────────────────────── */
  function addToCart(productId, btn) {
    if (!PM_AUTH.isLoggedIn()) { PM_AUTH.showLoginModal(); return; }
    const result = PM_DB.addToCart(productId);
    if (!result.ok) { PM_AUTH.toast(result.msg, 'err'); return; }
    PM_AUTH.toast('✅ Produk ditambahkan ke keranjang!', 'ok');
    updateCartBadge();
    if (btn) {
      btn.textContent = '✓ Ditambahkan';
      btn.style.background = '#c98310';
      setTimeout(() => {
        btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg> Keranjang`;
        btn.style.background = '';
      }, 1500);
    }
  }

  /* ── Add to cart (detail modal) ──────────────────────────── */
  function _detailAddCart(productId) {
    if (!PM_AUTH.isLoggedIn()) { PM_AUTH.showLoginModal(); return; }
    const qty = parseInt(document.getElementById('pd-qty-input')?.value || 1);
    const result = PM_DB.addToCart(productId, qty);
    if (!result.ok) { PM_AUTH.toast(result.msg, 'err'); return; }
    PM_AUTH.toast(`✅ ${qty} produk ditambahkan ke keranjang!`, 'ok');
    updateCartBadge();
  }

  /* ── Update cart badge ───────────────────────────────────── */
  function updateCartBadge() {
    const count = PM_DB.getCartCount();
    document.querySelectorAll('.cart-dot, #cart-dot').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  /* ================================================================
     HOMEPAGE SECTIONS MANAGER
     ================================================================ */
  const PM_SECTIONS = {
    activeCategory: 'semua',
    activeFilters: {},
    searchQuery: '',
    searchTimer: null,

    /* ── Initialize all sections ─────────────────────────── */
    init() {
      this.renderAllSections();
      this.bindSearch();
      this.bindCategoryPills();
      this.bindFilterPanel();
      this.updateStats();
      updateCartBadge();

      // Listen for cross-tab storage changes
      window.addEventListener('storage', (e) => {
        if (e.key === 'pm_notify_ts' || e.key === 'pm_products') {
          this.renderAllSections();
          this.updateStats();
        }
        if (e.key === 'pm_cart') {
          updateCartBadge();
        }
      });
    },

    /* ── Render all product sections ─────────────────────── */
    renderAllSections() {
      this.renderSection('products-latest',    PM_DB.getLatest(8),      'Belum ada produk terbaru.');
      this.renderSection('products-bestseller', PM_DB.getBestSellers(8), 'Belum ada produk terlaris.');
      this.renderSection('products-promo',     PM_DB.getPromo(8),       'Belum ada promo saat ini.');
      this.renderSection('products-trending',  PM_DB.getTrending(8),    'Belum ada produk trending.');
      this.renderMainGrid();
    },

    /* ── Render a specific section ───────────────────────── */
    renderSection(containerId, products, emptyMsg) {
      const el = document.getElementById(containerId);
      if (!el) return;
      renderGrid(el, products, emptyMsg);
    },

    /* ── Main product grid (with filter) ─────────────────── */
    renderMainGrid() {
      const el = document.getElementById('products-main');
      if (!el) return;
      showSkeletons(el, 8);
      setTimeout(() => {
        const products = PM_DB.search(this.searchQuery, {
          ...this.activeFilters,
          category: this.activeCategory !== 'semua' ? this.activeCategory : undefined,
        });
        renderGrid(el, products, 'Tidak ada produk yang cocok dengan filter Anda.');
        const countEl = document.getElementById('products-count');
        if (countEl) countEl.textContent = products.length + ' produk ditemukan';
      }, 300);
    },

    /* ── Search ──────────────────────────────────────────── */
    bindSearch() {
      const input = document.getElementById('search-input');
      const btn   = document.getElementById('search-btn');
      if (!input) return;

      input.addEventListener('input', () => {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
          this.searchQuery = input.value.trim();
          this.renderMainGrid();
          // Scroll to main grid
          if (this.searchQuery) {
            this.scrollToProductsIfNeeded();
          }
        }, 300);
      });

      if (btn) {
        btn.addEventListener('click', () => {
          this.searchQuery = input.value.trim();
          this.renderMainGrid();
          this.scrollToProductsIfNeeded();
        });
      }

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') btn?.click();
      });
    },

    /* ── Category pills ──────────────────────────────────── */
    bindCategoryPills() {
      document.querySelectorAll('.cat-pill, .cat-tile').forEach(el => {
        el.addEventListener('click', () => {
          const cat = el.dataset.cat || 'semua';
          this.setCategory(cat);
        });
      });
    },

    setCategory(cat) {
      this.activeCategory = cat;
      document.querySelectorAll('.cat-pill').forEach(el => {
        el.classList.toggle('active', el.dataset.cat === cat);
      });
      document.querySelectorAll('.cat-tile').forEach(el => {
        el.classList.toggle('active', el.dataset.cat === cat);
      });
      this.renderMainGrid();
      this.scrollToProductsIfNeeded();
    },

    /* ── Only scroll to product grid if it's not already visible ── */
    scrollToProductsIfNeeded() {
      const el = document.getElementById('section-all-products');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const navH = document.querySelector('.navbar')?.offsetHeight || 0;
      // Already in view (top edge visible within viewport, below sticky navbar) → don't scroll
      if (rect.top >= navH && rect.top < window.innerHeight * 0.8) return;
      const top = window.scrollY + rect.top - navH - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    },

    /* ── Filter panel ────────────────────────────────────── */
    bindFilterPanel() {
      const applyBtn = document.getElementById('filter-apply');
      const resetBtn = document.getElementById('filter-reset');

      if (applyBtn) {
        applyBtn.addEventListener('click', () => {
          this.activeFilters = {
            location:  document.getElementById('filter-location')?.value || '',
            minPrice:  document.getElementById('filter-min-price')?.value || '',
            maxPrice:  document.getElementById('filter-max-price')?.value || '',
            minRating: document.getElementById('filter-rating')?.value || '',
            promo:     document.getElementById('filter-promo')?.checked || false,
            inStock:   document.getElementById('filter-stock')?.checked || false,
            sort:      document.getElementById('filter-sort')?.value || '',
          };
          this.renderMainGrid();
          PM_AUTH.toast('Filter diterapkan!', 'ok');
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.activeFilters = {};
          document.getElementById('filter-location') && (document.getElementById('filter-location').value = '');
          document.getElementById('filter-min-price') && (document.getElementById('filter-min-price').value = '');
          document.getElementById('filter-max-price') && (document.getElementById('filter-max-price').value = '');
          document.getElementById('filter-rating') && (document.getElementById('filter-rating').value = '');
          document.getElementById('filter-promo') && (document.getElementById('filter-promo').checked = false);
          document.getElementById('filter-stock') && (document.getElementById('filter-stock').checked = false);
          document.getElementById('filter-sort') && (document.getElementById('filter-sort').value = '');
          this.renderMainGrid();
          PM_AUTH.toast('Filter direset', 'info');
        });
      }

      // Live sort
      document.getElementById('filter-sort')?.addEventListener('change', () => applyBtn?.click());

      // Live location filter
      document.getElementById('filter-location')?.addEventListener('change', () => applyBtn?.click());
    },

    /* ── Update stats ────────────────────────────────────── */
    updateStats() {
      const stats = PM_DB.getStats();
      const animNum = (id, target) => {
        const el = document.getElementById(id);
        if (!el) return;
        let cur = 0;
        const step = Math.ceil(target / 40);
        const t = setInterval(() => {
          cur = Math.min(cur + step, target);
          el.textContent = cur + '+';
          if (cur >= target) clearInterval(t);
        }, 30);
      };
      animNum('stat-products',  stats.active);
      animNum('stat-stores',    stats.sellers);

      const locEl = document.getElementById('stat-locations');
      if (locEl) locEl.textContent = stats.locations;

      // Update promo strip dynamically
      const promoCnt = document.getElementById('promo-count');
      if (promoCnt) promoCnt.textContent = PM_DB.getPromo().length;
    },
  };

  /* ── Expose ──────────────────────────────────────────────── */
  const PM_PRODUCTS = {
    openDetail,
    addToCart,
    _detailAddCart,
    _changeQty,
    _pickStar,
    _submitReview,
    updateCartBadge,
    renderGrid,
    createProductCard,
    lazyLoadImages,
  };

  window.PM_PRODUCTS = PM_PRODUCTS;
  window.PM_SECTIONS = PM_SECTIONS;

  // Auto-init on homepage
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('products-main') || document.getElementById('products-latest')) {
      PM_SECTIONS.init();
    }
  });

})();
