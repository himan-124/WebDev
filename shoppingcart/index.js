/**
 * script.js
 *
 * Full-featured Shopping Kart frontend logic (single-file, all CSS applied via JS).
 * - Floating cart sidebar with overlay and smooth animations
 * - Coupons section, checkout simulation, clear cart
 * - Product grid with hover effects, responsive layout, pagination
 * - Search with debounce, category filter, sort options
 * - Wishlist (save for later)
 * - LocalStorage persistence for cart and wishlist
 * - Lazy image loading, skeleton loaders, error handling
 * - Accessibility improvements (ARIA attributes, keyboard support)
 * - Toast notifications, small analytics mock, and helpful comments
 *
 * Copy this file into the same folder as index.html (which should include the required DOM elements).
 */

/* ========================================================================
   Configuration and Constants
   ======================================================================== */

const CONFIG = {
  API_ENDPOINT: "https://dummyjson.com/products", // product source
  PAGE_SIZE: 12, // products per page
  SIDEBAR_WIDTH: 360, // px
  SIDEBAR_HIDDEN_RIGHT: `-${360 + 20}px`, // hidden position (with small margin)
  SIDEBAR_VISIBLE_RIGHT: "0px",
  OVERLAY_Z: 1500,
  SIDEBAR_Z: 2000,
  HEADER_Z: 1000,
  STORAGE_KEYS: {
    CART: "shopping_kart_cart_v1",
    WISHLIST: "shopping_kart_wishlist_v1",
    PREFS: "shopping_kart_prefs_v1"
  },
  TOAST_DURATION: 3000,
  SKELETON_COUNT: 8
};

/* ========================================================================
   Utility Helpers
   ======================================================================== */

/**
 * Safe query selector
 * @param {string} sel
 * @returns {Element}
 */
function $$(sel) {
  return document.querySelector(sel);
}

/**
 * Create element with optional attributes and children
 * @param {string} tag
 * @param {Object} attrs
 * @param {Array|String} children
 * @returns {Element}
 */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style" && typeof v === "object") {
      Object.assign(node.style, v);
    } else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2), v);
    } else if (k === "html") {
      node.innerHTML = v;
    } else {
      node.setAttribute(k, v);
    }
  }
  if (typeof children === "string") {
    node.textContent = children;
  } else {
    (children || []).forEach(c => node.appendChild(c));
  }
  return node;
}

/**
 * Format currency (INR)
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

/**
 * Debounce helper
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function}
 */
function debounce(fn, wait = 300) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ========================================================================
   Toast Notifications (small UI feedback)
   ======================================================================== */

const toastContainer = el("div", { id: "toast-container", style: { position: "fixed", right: "20px", bottom: "20px", zIndex: CONFIG.SIDEBAR_Z + 10 } });
document.body.appendChild(toastContainer);

/**
 * Show a toast message
 * @param {string} message
 * @param {string} type - 'info'|'success'|'error'
 */
function showToast(message, type = "info") {
  const bg = type === "success" ? "#28a745" : type === "error" ? "#dc3545" : "#333";
  const node = el("div", {
    style: {
      backgroundColor: bg,
      color: "white",
      padding: "10px 14px",
      marginTop: "8px",
      borderRadius: "6px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      minWidth: "180px",
      fontSize: "14px",
      opacity: "0",
      transition: "opacity 0.2s ease"
    }
  }, message);
  toastContainer.appendChild(node);
  requestAnimationFrame(() => node.style.opacity = "1");
  setTimeout(() => {
    node.style.opacity = "0";
    setTimeout(() => node.remove(), 300);
  }, CONFIG.TOAST_DURATION);
}

/* ========================================================================
   LocalStorage helpers
   ======================================================================== */

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("Storage read error", e);
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage write error", e);
  }
}

/* ========================================================================
   Initial DOM Setup and Styling (all CSS via JS)
   ======================================================================== */

/* Ensure minimal HTML structure exists; if not, create it. This makes the script robust. */
(function ensureDOM() {
  // Header
  let headerEl = $$("header");
  if (!headerEl) {
    headerEl = el("header");
    document.body.prepend(headerEl);
  }
  headerEl.innerHTML = ""; // reset

  // Left: title
  const title = el("div", { style: { display: "flex", alignItems: "center", gap: "12px" } });
  title.appendChild(el("h1", { style: { margin: "0", fontSize: "20px" } }, "Dummy Shopping Kart"));

  // Search input
  const search = el("input", { id: "search", placeholder: "Search products...", style: { padding: "8px 10px", borderRadius: "6px", border: "none", minWidth: "220px" } });
  title.appendChild(search);

  headerEl.appendChild(title);

  // Right controls
  const rightControls = el("div", { style: { display: "flex", alignItems: "center", gap: "10px" } });
  const categorySelect = el("select", { id: "category-filter", style: { padding: "8px", borderRadius: "6px", border: "none" } });
  rightControls.appendChild(categorySelect);

  // BUG FIXED HERE: Changed border: "none'" to border: "none"
  const sortSelect = el("select", { id: "sort-select", style: { padding: "8px", borderRadius: "6px", border: "none" } });
  sortSelect.innerHTML = `<option value="">Sort</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="alpha">Alphabetical</option>`;
  rightControls.appendChild(sortSelect);

  const cartBtn = el("button", { id: "toggle-cart", "aria-label": "Open cart", style: { padding: "8px 12px", borderRadius: "6px", border: "none", cursor: "pointer" } }, "🛒 Cart (0)");
  rightControls.appendChild(cartBtn);

  headerEl.appendChild(rightControls);

  // Main content wrapper
  let main = $$("main#main");
  if (!main) {
    main = el("main", { id: "main" });
    document.body.appendChild(main);
  }
  main.innerHTML = ""; // reset

  const productsDiv = el("div", { id: "products" });
  main.appendChild(productsDiv);

  // Overlay
  let overlay = $$("#overlay");
  if (!overlay) {
    overlay = el("div", { id: "overlay" });
    document.body.appendChild(overlay);
  }

  // Cart sidebar
  let cartSidebar = $$("#cart-sidebar");
  if (!cartSidebar) {
    cartSidebar = el("aside", { id: "cart-sidebar", role: "dialog", "aria-label": "Shopping cart" });
    cartSidebar.innerHTML = `
      <div id="cart-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2 style="margin:0; font-size:18px;">Your Cart</h2>
        <button id="close-cart" aria-label="Close cart" style="background:none; border:none; font-size:20px; cursor:pointer;">✖</button>
      </div>
      <div id="coupon-section" style="margin-bottom:12px;"></div>
      <div id="cart-items" style="min-height:120px;"></div>
      <div id="cart-summary" style="margin-top:12px;">
        <p style="margin:6px 0;"><strong>Subtotal:</strong> <span id="cart-total">₹0</span></p>
        <p id="cart-savings" style="color:green; margin:6px 0;"></p>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button id="checkout">✅ Checkout</button>
          <button id="clear-cart">🧹 Clear Cart</button>
        </div>
      </div>
    `;
    document.body.appendChild(cartSidebar);
  }

  // Basic styling for header and main
  headerEl.style.position = "sticky";
  headerEl.style.top = "0";
  headerEl.style.backgroundColor = "#81cb86";
  headerEl.style.color = "white";
  headerEl.style.display = "flex";
  headerEl.style.justifyContent = "space-between";
  headerEl.style.alignItems = "center";
  headerEl.style.padding = "10px 16px";
  headerEl.style.zIndex = CONFIG.HEADER_Z;

  // Style overlay and cart sidebar initial state
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
  overlay.style.zIndex = CONFIG.OVERLAY_Z;
  overlay.style.display = "none";

  cartSidebar.style.position = "fixed";
  cartSidebar.style.top = "0";
  cartSidebar.style.right = CONFIG.SIDEBAR_HIDDEN_RIGHT;
  cartSidebar.style.width = `${CONFIG.SIDEBAR_WIDTH}px`;
  cartSidebar.style.height = "100%";
  cartSidebar.style.backgroundColor = "#fff";
  cartSidebar.style.boxShadow = "-4px 0 12px rgba(0,0,0,0.15)";
  cartSidebar.style.padding = "18px";
  cartSidebar.style.overflowY = "auto";
  cartSidebar.style.transition = "right 0.32s cubic-bezier(.2,.8,.2,1)";
  cartSidebar.style.zIndex = CONFIG.SIDEBAR_Z;
  cartSidebar.style.borderLeft = "1px solid rgba(0,0,0,0.06)";

  // Make sure main content has some top padding so header doesn't overlap
  main.style.paddingTop = "12px";
})();

/* ========================================================================
   Application State
   ======================================================================== */

let APP = {
  products: [], // fetched products
  filteredProducts: [], // after search/filter/sort
  currentPage: 1,
  pageSize: CONFIG.PAGE_SIZE,
  cart: loadFromStorage(CONFIG.STORAGE_KEYS.CART, []),
  wishlist: loadFromStorage(CONFIG.STORAGE_KEYS.WISHLIST, []),
  prefs: loadFromStorage(CONFIG.STORAGE_KEYS.PREFS, { lastSearch: "", lastCategory: "", lastSort: "" }),
  isSidebarOpen: false
};

/* ========================================================================
   Fetching and Data Handling
   ======================================================================== */

/**
 * Fetch products from API with error handling and skeleton loader
 */
async function fetchProducts() {
  const productsDiv = $$("#products");
  showSkeletons(productsDiv, CONFIG.SKELETON_COUNT);

  try {
    const res = await fetch(CONFIG.API_ENDPOINT);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    APP.products = Array.isArray(data.products) ? data.products : (data.products || []);
    APP.filteredProducts = [...APP.products];
    APP.currentPage = 1;
    renderProductsPage();
    populateCategoryFilter();
  } catch (err) {
    console.error("Failed to fetch products", err);
    productsDiv.innerHTML = `<div style="padding:20px; text-align:center; color:#666;">Failed to load products. Please try again later.</div>`;
    showToast("Failed to load products", "error");
  }
}

/* ========================================================================
   UI: Skeleton Loader
   ======================================================================== */

/**
 * Show skeleton placeholders while loading
 * @param {Element} container
 * @param {number} count
 */
function showSkeletons(container, count = 6) {
  container.innerHTML = "";
  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(auto-fill, minmax(220px, 1fr))";
  container.style.gap = "15px";
  container.style.padding = "20px";

  for (let i = 0; i < count; i++) {
    const s = el("div", { style: { backgroundColor: "#fff", borderRadius: "6px", padding: "12px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" } });
    s.innerHTML = `
      <div style="width:100%; height:140px; background:linear-gradient(90deg,#eee,#f6f6f6,#eee); border-radius:6px;"></div>
      <div style="height:12px; width:70%; background:#eee; margin:12px 0; border-radius:6px;"></div>
      <div style="height:12px; width:40%; background:#eee; margin-bottom:8px; border-radius:6px;"></div>
      <div style="height:36px; width:100%; background:#eee; border-radius:6px;"></div>
    `;
    container.appendChild(s);
  }
}

/* ========================================================================
   UI: Product Rendering (grid, pagination, lazy images)
   ======================================================================== */

/**
 * Render a page of products based on APP.filteredProducts and APP.currentPage
 */
function renderProductsPage() {
  const start = (APP.currentPage - 1) * APP.pageSize;
  const end = start + APP.pageSize;
  const pageItems = APP.filteredProducts.slice(start, end);
  renderProducts(pageItems);
  renderPagination();
}

/**
 * Render product cards into #products
 * @param {Array} products
 */
function renderProducts(products) {
  const container = $$("#products");
  container.innerHTML = "";
  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(auto-fill, minmax(220px, 1fr))";
  container.style.gap = "15px";
  container.style.padding = "20px";

  products.forEach(product => {
    const card = el("div", { style: { backgroundColor: "#fff", borderRadius: "8px", padding: "12px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: "8px" } });

    // Image wrapper with lazy loading
    const imgWrap = el("div", { style: { width: "100%", height: "160px", overflow: "hidden", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" } });
    const img = el("img", { src: product.thumbnail, alt: product.title, loading: "lazy", style: { width: "100%", height: "100%", objectFit: "cover" } });
    imgWrap.appendChild(img);

    const title = el("h3", { style: { margin: "0", fontSize: "16px", lineHeight: "1.2" } }, product.title);
    const brand = el("p", { style: { margin: "0", color: "#666", fontSize: "13px" } }, product.brand);
    const price = el("p", { style: { margin: "0", fontWeight: "700" } }, fmt(product.price));

    // Controls: add to cart, wishlist, quantity controls
    const controls = el("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" } });
    const addBtn = el("button", { onclick: () => addToCart(product.id), "aria-label": `Add ${product.title} to cart` }, "Add to Cart");
    const wishBtn = el("button", { onclick: () => toggleWishlist(product.id), "aria-label": `Toggle wishlist for ${product.title}` }, "♡");
    const qtyWrap = el("div", { style: { display: "flex", gap: "6px", alignItems: "center", marginLeft: "auto" } });
    const minus = el("button", { onclick: () => decreaseQuantity(product.id) }, "➖");
    const plus = el("button", { onclick: () => increaseQuantity(product.id) }, "➕");
    qtyWrap.appendChild(minus);
    qtyWrap.appendChild(plus);

    controls.appendChild(addBtn);
    controls.appendChild(wishBtn);
    controls.appendChild(qtyWrap);

    // Apply styles to buttons
    [addBtn, wishBtn, minus, plus].forEach(b => stylePrimaryButton(b));

    // Assemble card
    card.appendChild(imgWrap);
    card.appendChild(title);
    card.appendChild(brand);
    card.appendChild(price);
    card.appendChild(controls);

    container.appendChild(card);
  });
}

/* ========================================================================
   Pagination UI
   ======================================================================== */

/**
 * Render pagination controls below products
 */
function renderPagination() {
  // Remove existing pagination if any
  const existing = $$("#pagination");
  if (existing) existing.remove();

  const total = APP.filteredProducts.length;
  const pages = Math.max(1, Math.ceil(total / APP.pageSize));
  const pagination = el("div", { id: "pagination", style: { display: "flex", justifyContent: "center", gap: "8px", padding: "12px 20px" } });

  const prev = el("button", { onclick: () => changePage(APP.currentPage - 1) }, "Prev");
  const next = el("button", { onclick: () => changePage(APP.currentPage + 1) }, "Next");
  stylePrimaryButton(prev);
  stylePrimaryButton(next);

  pagination.appendChild(prev);

  // show up to 7 page buttons with ellipsis
  const maxButtons = 7;
  let start = Math.max(1, APP.currentPage - 3);
  let end = Math.min(pages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);

  if (start > 1) {
    pagination.appendChild(pageButton(1));
    if (start > 2) pagination.appendChild(el("span", {}, "..."));
  }

  for (let i = start; i <= end; i++) {
    pagination.appendChild(pageButton(i));
  }

  if (end < pages) {
    if (end < pages - 1) pagination.appendChild(el("span", {}, "..."));
    pagination.appendChild(pageButton(pages));
  }

  pagination.appendChild(next);
  $$("#products").after(pagination);

  function pageButton(n) {
    const btn = el("button", { onclick: () => changePage(n) }, n.toString());
    if (n === APP.currentPage) {
      btn.style.backgroundColor = "#75a1d1";
      btn.style.color = "white";
    } else {
      stylePrimaryButton(btn);
    }
    return btn;
  }
}

/**
 * Change current page and re-render
 * @param {number} n
 */
function changePage(n) {
  const total = APP.filteredProducts.length;
  const pages = Math.max(1, Math.ceil(total / APP.pageSize));
  if (n < 1) n = 1;
  if (n > pages) n = pages;
  APP.currentPage = n;
  renderProductsPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ========================================================================
   Cart Logic (add, remove, quantity, persistence)
   ======================================================================== */

/**
 * Add product to cart by id
 * If product exists, increment quantity
 * @param {number} id
 */
function addToCart(id) {
  const product = APP.products.find(p => p.id === id);
  if (!product) {
    showToast("Product not found", "error");
    return;
  }
  const existing = APP.cart.find(i => i.id === id);
  if (existing) {
    existing.quantity++;
  } else {
    APP.cart.push({ id: product.id, name: product.title, price: product.price, thumbnail: product.thumbnail, quantity: 1 });
  }
  saveCartState();
  renderCart();
  showToast(`${product.title} added to cart`, "success");
}

/**
 * Remove item from cart
 * @param {number} id
 */
function removeFromCart(id) {
  APP.cart = APP.cart.filter(i => i.id !== id);
  saveCartState();
  renderCart();
  showToast("Item removed from cart", "info");
}

/**
 * Increase quantity for item in cart
 * @param {number} id
 */
function increaseQuantity(id) {
  const item = APP.cart.find(i => i.id === id);
  if (item) {
    item.quantity++;
    saveCartState();
    renderCart();
  } else {
    // If not in cart, add it
    addToCart(id);
  }
}

/**
 * Decrease quantity for item in cart
 * @param {number} id
 */
function decreaseQuantity(id) {
  const item = APP.cart.find(i => i.id === id);
  if (!item) return;
  if (item.quantity > 1) {
    item.quantity--;
  } else {
    APP.cart = APP.cart.filter(i => i.id !== id);
  }
  saveCartState();
  renderCart();
}

/**
 * Save cart to localStorage and update cart button count
 */
function saveCartState() {
  saveToStorage(CONFIG.STORAGE_KEYS.CART, APP.cart);
  updateCartButton();
}

/**
 * Update cart button label with item count
 */
function updateCartButton() {
  const btn = $$("#toggle-cart");
  const count = APP.cart.reduce((s, i) => s + i.quantity, 0);
  btn.textContent = `🛒 Cart (${count})`;
}

/* ========================================================================
   Wishlist (save for later)
   ======================================================================== */

/**
 * Toggle wishlist state for a product
 * @param {number} id
 */
function toggleWishlist(id) {
  const product = APP.products.find(p => p.id === id);
  if (!product) return;
  const exists = APP.wishlist.find(i => i.id === id);
  if (exists) {
    APP.wishlist = APP.wishlist.filter(i => i.id !== id);
    showToast(`${product.title} removed from wishlist`, "info");
  } else {
    APP.wishlist.push({ id: product.id, name: product.title, price: product.price, thumbnail: product.thumbnail });
    showToast(`${product.title} added to wishlist`, "success");
  }
  saveToStorage(CONFIG.STORAGE_KEYS.WISHLIST, APP.wishlist);
}

/* ========================================================================
   Cart Sidebar Rendering (coupons, items, empty state, checkout)
   ======================================================================== */

/**
 * Render coupons into coupon-section
 */
function renderCoupons() {
  const couponSection = $$("#coupon-section");
  couponSection.innerHTML = "";
  couponSection.style.border = "1px dashed #eee";
  couponSection.style.padding = "8px";
  couponSection.style.borderRadius = "6px";
  couponSection.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <strong>🔥 Coupons</strong>
      <small style="color:#666">Apply at checkout</small>
    </div>
    <div style="margin-top:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div><strong>SAVE10</strong><div style="font-size:12px;color:#666">10% off on orders ₹1000+</div></div>
        <button onclick="applyCoupon('SAVE10')">Apply</button>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div><strong>FREESHIP</strong><div style="font-size:12px;color:#666">Free shipping</div></div>
        <button onclick="applyCoupon('FREESHIP')">Apply</button>
      </div>
    </div>
  `;
  couponSection.querySelectorAll("button").forEach(b => stylePrimaryButton(b));
}

/**
 * Apply coupon (fake logic)
 * @param {string} code
 */
function applyCoupon(code) {
  if (APP.cart.length === 0) {
    showToast("Add items to cart before applying coupons", "error");
    return;
  }
  if (code === "SAVE10") {
    showToast("SAVE10 applied: 10% discount will be shown at checkout", "success");
  } else if (code === "FREESHIP") {
    showToast("FREESHIP applied: free shipping at checkout", "success");
  } else {
    showToast("Invalid coupon", "error");
  }
}

/**
 * Render cart sidebar items and summary
 */
function renderCart() {
  renderCoupons();
  const cartItems = $$("#cart-items");
  cartItems.innerHTML = "";
  cartItems.style.minHeight = "120px";

  if (APP.cart.length === 0) {
    // Empty cart view with emoji and friendly message
    const empty = el("div", { style: { textAlign: "center", padding: "40px 10px", color: "#666" } });
    empty.innerHTML = `<div style="font-size:64px; margin-bottom:12px;">🛒</div><div style="font-weight:600; margin-bottom:6px;">Your cart is empty</div><div style="font-size:13px;">Add items to your cart to see them here</div>`;
    cartItems.appendChild(empty);
    $$("#cart-total").textContent = "₹0";
    $$("#cart-savings").textContent = "";
    updateCartButton();
    return;
  }

  // Render each cart item
  let subtotal = 0;
  APP.cart.forEach(item => {
    const row = el("div", { style: { display: "flex", gap: "8px", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f0f0" } });

    const thumb = el("img", { src: item.thumbnail, alt: item.name, style: { width: "56px", height: "56px", objectFit: "cover", borderRadius: "6px" } });
    const info = el("div", { style: { flex: "1" } });
    const name = el("div", { style: { fontWeight: "600", fontSize: "14px" } }, item.name);
    const price = el("div", { style: { color: "#333", marginTop: "6px" } }, `${fmt(item.price)} × ${item.quantity} = ${fmt(item.price * item.quantity)}`);
    info.appendChild(name);
    info.appendChild(price);

    const controls = el("div", { style: { display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" } });
    const qtyControls = el("div", { style: { display: "flex", gap: "6px" } });
    const minus = el("button", { onclick: () => decreaseQuantity(item.id) }, "➖");
    const plus = el("button", { onclick: () => increaseQuantity(item.id) }, "➕");
    stylePrimaryButton(minus);
    stylePrimaryButton(plus);
    qtyControls.appendChild(minus);
    qtyControls.appendChild(plus);

    const removeBtn = el("button", { onclick: () => removeFromCart(item.id) }, "🗑️ Remove");
    styleDangerButton(removeBtn);

    controls.appendChild(qtyControls);
    controls.appendChild(removeBtn);

    row.appendChild(thumb);
    row.appendChild(info);
    row.appendChild(controls);

    cartItems.appendChild(row);

    subtotal += item.price * item.quantity;
  });

  // Summary
  $$("#cart-total").textContent = fmt(subtotal);
  // Fake savings calculation for demo
  const savings = Math.round(subtotal * 0.05);
  $$("#cart-savings").textContent = `You saved ${fmt(savings)} on this order!`;
  updateCartButton();
}

/* ========================================================================
   Checkout Simulation
   ======================================================================== */

$$("#checkout").addEventListener("click", () => {
  if (APP.cart.length === 0) {
    showToast("Your cart is empty", "error");
    return;
  }
  // Build a simple summary
  const subtotal = APP.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const savings = Math.round(subtotal * 0.05);
  const total = subtotal - savings;
  // Show a modal-like alert (simple)
  const summary = `Order Summary\n\nItems: ${APP.cart.length}\nSubtotal: ${fmt(subtotal)}\nSavings: ${fmt(savings)}\nTotal: ${fmt(total)}\n\nThank you for your purchase!`;
  // Clear cart after checkout
  APP.cart = [];
  saveCartState();
  renderCart();
  showToast("Checkout successful", "success");
  setTimeout(() => alert(summary), 200);
});

/* ========================================================================
   Search, Filter, Sort
   ======================================================================== */

const debouncedSearch = debounce((q) => {
  APP.prefs.lastSearch = q;
  saveToStorage(CONFIG.STORAGE_KEYS.PREFS, APP.prefs);
  applyFilters();
}, 300);

$$("#search").addEventListener("input", (e) => {
  debouncedSearch(e.target.value.trim());
});

$$("#category-filter").addEventListener("change", (e) => {
  APP.prefs.lastCategory = e.target.value;
  saveToStorage(CONFIG.STORAGE_KEYS.PREFS, APP.prefs);
  applyFilters();
});

$$("#sort-select").addEventListener("change", (e) => {
  APP.prefs.lastSort = e.target.value;
  saveToStorage(CONFIG.STORAGE_KEYS.PREFS, APP.prefs);
  applyFilters();
});

/**
 * Apply search, category, and sort to APP.products and update filteredProducts
 */
function applyFilters() {
  const q = APP.prefs.lastSearch || $$("#search").value.trim();
  const cat = APP.prefs.lastCategory || $$("#category-filter").value;
  const sort = APP.prefs.lastSort || $$("#sort-select").value;

  let list = [...APP.products];

  if (q) {
    const ql = q.toLowerCase();
    list = list.filter(p => p.title.toLowerCase().includes(ql) || p.brand.toLowerCase().includes(ql) || (p.description && p.description.toLowerCase().includes(ql)));
  }

  if (cat) {
    list = list.filter(p => p.category === cat);
  }

  if (sort) {
    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    else if (sort === "alpha") list.sort((a, b) => a.title.localeCompare(b.title));
  }

  APP.filteredProducts = list;
  APP.currentPage = 1;
  renderProductsPage();
}

/* ========================================================================
   Category Filter Population
   ======================================================================== */

function populateCategoryFilter() {
  const select = $$("#category-filter");
  select.innerHTML = `<option value="">All Categories</option>`;
  const cats = [...new Set(APP.products.map(p => p.category))].sort();
  cats.forEach(c => {
    const opt = el("option", { value: c }, c.charAt(0).toUpperCase() + c.slice(1));
    select.appendChild(opt);
  });
  // Restore last selected
  if (APP.prefs.lastCategory) select.value = APP.prefs.lastCategory;
}

/* ========================================================================
   Accessibility and Keyboard Support
   ======================================================================== */

// Close cart with Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeCart();
  }
});

// Close cart helper
function closeCart() {
  const cartSidebar = $$("#cart-sidebar");
  const overlay = $$("#overlay");
  cartSidebar.style.right = CONFIG.SIDEBAR_HIDDEN_RIGHT;
  overlay.style.display = "none";
  APP.isSidebarOpen = false;
}

/* ========================================================================
   Overlay and Sidebar Toggle Helpers
   ======================================================================== */

$$("#close-cart").addEventListener("click", closeCart);

$$("#toggle-cart").addEventListener("click", () => {
  const cartSidebar = $$("#cart-sidebar");
  const overlay = $$("#overlay");
  if (cartSidebar.style.right === CONFIG.SIDEBAR_VISIBLE_RIGHT) {
    cartSidebar.style.right = CONFIG.SIDEBAR_HIDDEN_RIGHT;
    overlay.style.display = "none";
    APP.isSidebarOpen = false;
  } else {
    cartSidebar.style.right = CONFIG.SIDEBAR_VISIBLE_RIGHT;
    overlay.style.display = "block";
    APP.isSidebarOpen = true;
    // Focus first interactive element in sidebar for accessibility
    setTimeout(() => {
      const firstBtn = cartSidebar.querySelector("button");
      if (firstBtn) firstBtn.focus();
    }, 320);
  }
});

$$("#overlay").addEventListener("click", closeCart);

/* ========================================================================
   Clear Cart Button
   ======================================================================== */

$$("#clear-cart").addEventListener("click", () => {
  if (APP.cart.length === 0) {
    showToast("Cart is already empty", "info");
    return;
  }
  if (confirm("Clear all items from cart?")) {
    APP.cart = [];
    saveCartState();
    renderCart();
    showToast("Cart cleared", "info");
  }
});

/* ========================================================================
   Small Analytics Mock (non-invasive)
   ======================================================================== */

const ANALYTICS = {
  events: [],
  track(event, data = {}) {
    this.events.push({ event, data, ts: Date.now() });
    // For demo, we won't send anywhere. In a real app, batch and send to server.
    // console.log("Analytics:", event, data);
  }
};

/* ========================================================================
   Button Styling Helpers (all CSS via JS)
   ======================================================================== */

function stylePrimaryButton(btn) {
  btn.style.backgroundColor = "#ace497";
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.padding = "6px 10px";
  btn.style.borderRadius = "6px";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "13px";
  btn.style.transition = "transform 0.08s ease, background-color 0.12s ease";
  btn.onmouseover = () => btn.style.transform = "translateY(-1px)";
  btn.onmouseout = () => btn.style.transform = "translateY(0)";
  btn.onmousedown = () => btn.style.transform = "translateY(0)";
}

function styleDangerButton(btn) {
  btn.style.backgroundColor = "#dc3545";
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.padding = "6px 10px";
  btn.style.borderRadius = "6px";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "13px";
  btn.onmouseover = () => btn.style.opacity = "0.9";
  btn.onmouseout = () => btn.style.opacity = "1";
}

function stylePrimaryButtonSimple(btn) {
  btn.style.backgroundColor = "#28a745";
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.padding = "6px 10px";
  btn.style.borderRadius = "6px";
  btn.style.cursor = "pointer";
}

/* ========================================================================
   Small helpers for initial button styling used earlier
   ======================================================================== */

function styleButton(button) {
  button.style.backgroundColor = "#b4eab5";
  button.style.color = "white";
  button.style.border = "none";
  button.style.padding = "8px 12px";
  button.style.borderRadius = "6px";
  button.style.cursor = "pointer";
  button.style.fontSize = "14px";
  button.onmouseover = () => button.style.opacity = "0.9";
  button.onmouseout = () => button.style.opacity = "1";
}

/* ========================================================================
   Initialization and Boot
   ======================================================================== */

function boot() {
  // Restore preferences
  const prefs = loadFromStorage(CONFIG.STORAGE_KEYS.PREFS, {});
  APP.prefs = Object.assign(APP.prefs, prefs || {});
  if (APP.prefs.lastSearch) $$("#search").value = APP.prefs.lastSearch;
  if (APP.prefs.lastSort) $$("#sort-select").value = APP.prefs.lastSort;

  // Wire up initial UI
  updateCartButton();
  renderCart(); // initial render from stored cart
  fetchProducts();

  // Accessibility: focus search on load
  setTimeout(() => {
    const s = $$("#search");
    if (s) s.focus();
  }, 400);

  // Track page view
  ANALYTICS.track("page_view", { path: location.pathname });
}

boot();

/* ========================================================================
   End of file
   ======================================================================== */