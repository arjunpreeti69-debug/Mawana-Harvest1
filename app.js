const app = (function() {
    // State
    let cart = {}; // productId -> quantity
    let cachedProducts = [];

    // Cache DOM
    const views = {
        home: document.getElementById('home-view'),
        cart: document.getElementById('cart-view'),
        checkout: document.getElementById('checkout-view'),
        confirmation: document.getElementById('confirmation-view'),
        admin: document.getElementById('admin-view')
    };
    
    const navItems = {
        home: document.getElementById('nav-home'),
        cart: document.getElementById('nav-cart'),
        admin: document.getElementById('nav-admin')
    };

    const cartBadge = document.getElementById('cart-badge');

    // Initialize
    async function init() {
        lucide.createIcons();
        await loadSettings();
        await refreshProducts();
        updateCartBadge();
    }

    async function loadSettings() {
        try {
            const settings = await window.db.getSettings();
            if (settings) {
                if (settings.banner_url) {
                    const banner = document.querySelector('.home-banner');
                    banner.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('${settings.banner_url}')`;
                }
                if (settings.terms_text) {
                    const termsEl = document.getElementById('checkout-terms-text');
                    if (termsEl) termsEl.textContent = settings.terms_text;
                }
            }
        } catch(e) {
            console.error('Failed to load settings', e);
        }
    }

    async function refreshProducts() {
        const productList = document.getElementById('product-list');
        productList.innerHTML = '<div class="empty-state" style="grid-column:span 2;">Loading products...</div>';
        
        try {
            if (!window.db || !window.db.getProducts) {
                throw new Error("Database script (db.js) failed to load properly. Check if Supabase loaded.");
            }
            const products = await window.db.getProducts();
            cachedProducts = products || [];
            renderProducts();
        } catch (err) {
            productList.innerHTML = `<div class="empty-state" style="grid-column:span 2; color:red; text-align:left; font-family:monospace; padding:1rem; border:1px solid red; background:#fee;">Error loading products:<br><br>${err.message}</div>`;
        }
    }

    // Navigation
    function switchTab(tabId) {
        // Hide all views
        Object.values(views).forEach(v => v.classList.remove('active'));
        
        // Remove active state from nav
        Object.values(navItems).forEach(n => {
            if(n) n.classList.remove('active');
        });

        // Show selected view
        if (views[tabId]) {
            views[tabId].classList.add('active');
        }

        // Highlight nav item if it exists
        if (navItems[tabId]) {
            navItems[tabId].classList.add('active');
        }

        // View specific logic
        if (tabId === 'home') {
            refreshProducts(); // Fetch fresh data when going to home
        }
        if (tabId === 'cart') renderCart();
        if (tabId === 'admin') {
            checkAdminAuth();
        }
    }

    // --- HOME VIEW ---
    function renderProducts() {
        const productList = document.getElementById('product-list');
        const products = cachedProducts.filter(p => p.available && p.quantity > 0);
        
        if (products.length === 0) {
            productList.innerHTML = `<div class="empty-state" style="grid-column: span 2;">No products available today.</div>`;
            return;
        }

        productList.innerHTML = products.map(p => {
            const qty = cart[p.id] || 0;
            const unit = p.unit || 'kg';
            
            let imageHtml = `
                <div class="product-image-container">
                    <i data-lucide="image" width="32" height="32"></i>
                </div>
            `;
            if (p.image && p.image.trim() !== '') {
                imageHtml = `
                    <div class="product-image-container">
                        <img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <i data-lucide="image" width="32" height="32" style="display:none;"></i>
                    </div>
                `;
            }

            return `
                <div class="product-card">
                    ${imageHtml}
                    <div class="product-info">
                        <div class="product-name">${p.name}</div>
                        <div class="product-price">₹${p.price}<span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted)">/${unit}</span></div>
                        
                        ${qty > 0 ? `
                            <div class="quantity-controls">
                                <button class="qty-btn" onclick="app.updateCartQty(${p.id}, -1)">-</button>
                                <span class="qty-display">${qty}</span>
                                <button class="qty-btn" onclick="app.updateCartQty(${p.id}, 1, ${p.quantity})">+</button>
                            </div>
                        ` : `
                            <button class="add-to-cart-btn" onclick="app.updateCartQty(${p.id}, 1, ${p.quantity})">Add to Cart</button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }

    // --- CART LOGIC ---
    function updateCartQty(productId, delta, maxQty) {
        if (!cart[productId]) cart[productId] = 0;
        
        const newQty = cart[productId] + delta;
        if (newQty <= 0) {
            delete cart[productId];
        } else if (!maxQty || newQty <= maxQty) {
            cart[productId] = newQty;
        } else {
            alert('Cannot add more than available stock.');
        }
        
        updateCartBadge();
        
        // Re-render based on current view
        if (views.home.classList.contains('active')) renderProducts();
        if (views.cart.classList.contains('active')) renderCart();
    }

    function updateCartBadge() {
        const count = Object.values(cart).reduce((a, b) => a + b, 0);
        if (count > 0) {
            cartBadge.textContent = count;
            cartBadge.style.display = 'block';
        } else {
            cartBadge.style.display = 'none';
        }
    }

    function renderCart() {
        const cartItemsContainer = document.getElementById('cart-items');
        const emptyState = document.getElementById('cart-empty-state');
        const footer = document.getElementById('cart-footer');
        const totalPriceEl = document.getElementById('cart-total-price');

        const cartKeys = Object.keys(cart);

        if (cartKeys.length === 0) {
            cartItemsContainer.innerHTML = '';
            emptyState.style.display = 'block';
            footer.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        footer.style.display = 'block';

        let total = 0;
        cartItemsContainer.innerHTML = cartKeys.map(id => {
            const p = cachedProducts.find(p => p.id == id);
            if (!p) return '';
            const qty = cart[id];
            const unit = p.unit || 'kg';
            total += (p.price * qty);
            
            return `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <h3>${p.name}</h3>
                        <div class="cart-item-price">₹${p.price} x ${qty} ${unit}</div>
                    </div>
                    <div class="quantity-controls" style="margin-top:0">
                        <button class="qty-btn" onclick="app.updateCartQty(${p.id}, -1)">-</button>
                        <span class="qty-display">${qty}</span>
                        <button class="qty-btn" onclick="app.updateCartQty(${p.id}, 1, ${p.quantity})">+</button>
                    </div>
                </div>
            `;
        }).join('');

        totalPriceEl.textContent = `₹${total}`;
    }

    function goToCheckout() {
        switchTab('checkout');
    }

    // --- CHECKOUT LOGIC ---
    async function placeOrder(e) {
        e.preventDefault();
        
        const termsChecked = document.getElementById('terms').checked;
        if (!termsChecked) {
            alert('Please accept the terms and conditions.');
            return;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        const ogText = btn.textContent;
        btn.textContent = 'Processing...';
        btn.disabled = true;

        try {
            const name = document.getElementById('name').value;
            const phone = document.getElementById('phone').value;
            const address = document.getElementById('address').value;

            const orderItems = Object.keys(cart).map(id => {
                const p = cachedProducts.find(p => p.id == id);
                return {
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    unit: p.unit || 'kg',
                    cartQuantity: cart[id]
                };
            });

            const orderData = {
                customer_name: name,
                phone: phone,
                address: address,
                items: orderItems,
                total: orderItems.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0)
            };

            await window.db.addOrder(orderData);
            
            // Clear cart and form
            cart = {};
            updateCartBadge();
            e.target.reset();
            
            await refreshProducts(); // Update local stock cache
            switchTab('confirmation');
        } catch (err) {
            console.error(err);
            alert("Failed to place order. Please try again.");
        } finally {
            btn.textContent = ogText;
            btn.disabled = false;
        }
    }

    // --- ADMIN LOGIC ---
    function checkAdminAuth() {
        const loginView = document.getElementById('admin-login-view');
        const dashboardView = document.getElementById('admin-dashboard-view');
        
        if (sessionStorage.getItem('adminAuth') === 'true') {
            loginView.style.display = 'none';
            dashboardView.style.display = 'block';
            switchAdminTab('orders'); // Default
        } else {
            loginView.style.display = 'flex';
            dashboardView.style.display = 'none';
        }
    }

    function handleAdminLogin(e) {
        e.preventDefault();
        const pin = document.getElementById('admin-pin').value;
        if (pin === '1234') { // Configured default PIN
            sessionStorage.setItem('adminAuth', 'true');
            checkAdminAuth();
        } else {
            alert('Incorrect PIN');
        }
        e.target.reset();
    }

    function switchAdminTab(subTab) {
        const btnOrders = document.getElementById('admin-tab-orders');
        const btnProducts = document.getElementById('admin-tab-products');
        const btnSettings = document.getElementById('admin-tab-settings');
        const viewOrders = document.getElementById('admin-orders-view');
        const viewProducts = document.getElementById('admin-products-view');
        const viewSettings = document.getElementById('admin-settings-view');

        // Reset all tabs
        [btnOrders, btnProducts, btnSettings].forEach(btn => {
            if(btn) {
                btn.style.background = 'var(--border)';
                btn.style.color = 'var(--text-main)';
            }
        });
        [viewOrders, viewProducts, viewSettings].forEach(view => {
            if(view) view.style.display = 'none';
        });

        if (subTab === 'orders') {
            if(btnOrders) { btnOrders.style.background = 'var(--primary)'; btnOrders.style.color = 'white'; }
            if(viewOrders) viewOrders.style.display = 'block';
            renderAdminOrders();
        } else if (subTab === 'products') {
            if(btnProducts) { btnProducts.style.background = 'var(--primary)'; btnProducts.style.color = 'white'; }
            if(viewProducts) viewProducts.style.display = 'block';
            renderAdminProducts();
        } else if (subTab === 'settings') {
            if(btnSettings) { btnSettings.style.background = 'var(--primary)'; btnSettings.style.color = 'white'; }
            if(viewSettings) viewSettings.style.display = 'block';
            renderAdminSettings();
        }
    }

    async function renderAdminSettings() {
        const settings = await window.db.getSettings();
        if (settings) {
            document.getElementById('settings-terms').value = settings.terms_text || '';
        }
    }

    async function saveSettings(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const ogText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            const termsText = document.getElementById('settings-terms').value;
            const fileInput = document.getElementById('settings-banner');
            
            let updates = { terms_text: termsText };
            
            if (fileInput.files.length > 0) {
                btn.textContent = 'Uploading Image...';
                const url = await window.db.uploadImage(fileInput.files[0]);
                updates.banner_url = url;
            }

            await window.db.updateSettings(updates);
            alert('Settings saved!');
            e.target.reset(); // Reset file input
            await loadSettings(); // Apply immediately
            renderAdminSettings(); // Repopulate terms
        } catch (err) {
            console.error(err);
            alert('Failed to save settings: ' + err.message);
        } finally {
            btn.textContent = ogText;
            btn.disabled = false;
        }
    }

    async function renderAdminOrders() {
        const list = document.getElementById('admin-orders-list');
        list.innerHTML = `<div class="empty-state">Loading orders...</div>`;
        
        const orders = await window.db.getOrders();

        if (!orders || orders.length === 0) {
            list.innerHTML = `<div class="empty-state">No orders yet.</div>`;
            return;
        }

        list.innerHTML = orders.map(o => {
            const date = new Date(o.created_at).toLocaleString();
            const itemsHtml = o.items.map(i => `${i.name} (x${i.cartQuantity} ${i.unit || 'kg'})`).join(', ');
            
            const pStatus = o.payment_status || 'Pending';
            
            return `
                <div class="order-card">
                    <div class="order-header">
                        <strong>Order #${o.id}</strong>
                        <div>
                            <span class="status-badge ${o.status === 'Pending' ? 'status-pending' : 'status-delivered'}">${o.status}</span>
                        </div>
                    </div>
                    <div class="mb-1">
                        <div><strong>${o.customer_name}</strong> (${o.phone})</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${o.address}</div>
                    </div>
                    <div class="mb-1" style="font-size: 0.9rem;">
                        <em>Items:</em> ${itemsHtml}
                    </div>
                    <div class="flex-between mb-1">
                        <strong>Total: ₹${o.total}</strong>
                        <div>
                            Payment: <span class="status-badge ${pStatus === 'Received' ? 'status-received' : 'status-pending'}">${pStatus}</span>
                        </div>
                    </div>
                    <div class="flex-between" style="gap: 0.5rem; flex-wrap: wrap;">
                        ${o.status === 'Pending' ? `
                            <button class="btn-secondary btn-small" style="flex:1;" onclick="app.markOrderDelivered(${o.id})">Mark Delivered</button>
                        ` : ''}
                        
                        ${pStatus === 'Pending' ? `
                            <button class="btn-secondary btn-small" style="flex:1;" onclick="app.markPaymentReceived(${o.id})">Mark Paid</button>
                        ` : ''}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; text-align: right;">${date}</div>
                </div>
            `;
        }).join('');
    }

    async function markOrderDelivered(id) {
        if(confirm("Mark this order as delivered?")) {
            await window.db.updateOrderStatus(id, 'Delivered');
            renderAdminOrders();
        }
    }

    async function markPaymentReceived(id) {
        if(confirm("Mark payment as received for this order?")) {
            await window.db.updateOrderPaymentStatus(id, 'Received');
            renderAdminOrders();
        }
    }

    async function renderAdminProducts() {
        const list = document.getElementById('admin-products-list');
        list.innerHTML = `<div class="empty-state">Loading products...</div>`;
        
        // Ensure fresh data
        cachedProducts = await window.db.getProducts();

        list.innerHTML = cachedProducts.map(p => `
            <div class="cart-item">
                ${p.image ? `
                    <div style="width: 40px; height: 40px; border-radius: 4px; overflow: hidden; margin-right: 10px; flex-shrink: 0;">
                        <img src="${p.image}" alt="" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
                    </div>
                ` : ''}
                <div class="cart-item-info" style="flex-grow: 1;">
                    <h3>${p.name}</h3>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        ₹${p.price}/${p.unit || 'kg'} | Stock: ${p.quantity} | ${p.available ? '<span style="color:var(--primary)">Available</span>' : '<span style="color:var(--danger)">Unavailable</span>'}
                    </div>
                </div>
                <div>
                    <button class="btn-secondary btn-small" onclick='app.editProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Edit</button>
                </div>
            </div>
        `).join('');
    }

    function openAddProductModal() {
        document.getElementById('product-form').reset();
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-image-url').value = '';
        document.getElementById('modal-title').textContent = 'Add Product';
        document.getElementById('product-modal').classList.add('active');
    }

    function editProduct(p) {
        document.getElementById('product-form').reset();
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-image-url').value = p.image || '';
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-unit').value = p.unit || 'kg';
        document.getElementById('prod-quantity').value = p.quantity;
        document.getElementById('prod-available').checked = p.available;
        document.getElementById('modal-title').textContent = 'Edit Product';
        document.getElementById('product-modal').classList.add('active');
    }

    function closeProductModal() {
        document.getElementById('product-modal').classList.remove('active');
    }

    async function saveProduct(e) {
        e.preventDefault();
        
        const btn = e.target.querySelector('button[type="submit"]');
        const ogText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            const id = document.getElementById('prod-id').value;
            let image = document.getElementById('prod-image-url').value;
            const fileInput = document.getElementById('prod-image-file');
            
            if (fileInput.files.length > 0) {
                btn.textContent = 'Uploading Image...';
                image = await window.db.uploadImage(fileInput.files[0]);
            }

            const name = document.getElementById('prod-name').value;
            const price = parseFloat(document.getElementById('prod-price').value);
            const unit = document.getElementById('prod-unit').value || 'kg';
            const quantity = parseInt(document.getElementById('prod-quantity').value);
            const available = document.getElementById('prod-available').checked;

            const productData = { image, name, price, unit, quantity, available };

            if (id) {
                await window.db.updateProduct(parseInt(id), productData);
            } else {
                await window.db.addProduct(productData);
            }

            closeProductModal();
            renderAdminProducts(); // This refreshes cachedProducts
            
        } catch (err) {
            console.error(err);
            alert("Failed to save product.");
        } finally {
            btn.textContent = ogText;
            btn.disabled = false;
        }
    }

    // Expose API
    return {
        init,
        switchTab,
        updateCartQty,
        goToCheckout,
        placeOrder,
        handleAdminLogin,
        switchAdminTab,
        markOrderDelivered,
        markPaymentReceived,
        openAddProductModal,
        editProduct,
        closeProductModal,
        saveProduct,
        saveSettings
    };
})();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', app.init);
