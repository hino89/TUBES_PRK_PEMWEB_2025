/**
 * src/js/controllers/pos.js
 * Point of Sales Terminal Controller - WarkOps Theme
 */

(function (window, document) {
    'use strict';

    const MENU_API = 'api/items.php';
    const CATEGORIES_API = 'api/categories.php';
    const TRANSACTIONS_API = 'api/orders.php';

    const TAX_RATE = 0.10;
    const currency = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    });

    let state = {
        menu: [],
        categories: [],
        cart: [],
        selectedCategory: 'all',
        currentTrxNo: generateTrxNo()
    };

    let nodes = {};

    function init() {
        collectNodes();
        bindEvents();
        loadData();
    }

    function collectNodes() {
        nodes = {
            categoryTabs: document.getElementById('category-tabs-container'),
            menuGrid: document.getElementById('menu-grid-container'),
            cartItems: document.getElementById('cart-items-container'),
            trxNumber: document.getElementById('trx-number'),
            subtotalEl: document.getElementById('subtotal-display'),
            taxEl: document.getElementById('tax-display'),
            totalEl: document.getElementById('total-display'),
            btnClearCart: document.getElementById('clear-cart-btn'),
            btnProcessOrder: document.getElementById('process-order-btn'),
            modalPayment: document.getElementById('modal-payment'),
            btnClosePayment: document.getElementById('close-payment-modal'),
            formPayment: document.getElementById('form-payment'),
            paymentAmount: document.getElementById('payment-amount'),
            changeAmount: document.getElementById('change-amount-display'),
            finalTotal: document.getElementById('final-total-display')
        };
    }

    function bindEvents() {
        nodes.btnClearCart?.addEventListener('click', clearCart);
        nodes.btnProcessOrder?.addEventListener('click', openPaymentModal);
        nodes.btnClosePayment?.addEventListener('click', closePaymentModal);
        nodes.formPayment?.addEventListener('submit', handlePayment);
        nodes.paymentAmount?.addEventListener('input', calculateChange);
    }

    async function loadData() {
        try {
            const [menuRes, categoriesRes] = await Promise.all([
                fetch(MENU_API),
                fetch(CATEGORIES_API)
            ]);

            const menuData = await menuRes.json();
            const categoriesData = await categoriesRes.json();

            if (menuData.success) state.menu = menuData.data;
            if (categoriesData.success) state.categories = categoriesData.data;

            renderCategoryTabs();
            renderMenuGrid();
            updateCartDisplay();
        } catch (error) {
            console.error('Failed to load data:', error);
            showToast('error', 'Gagal memuat data menu');
        }
    }

    function renderCategoryTabs() {
        if (!nodes.categoryTabs) return;

        let html = `
            <button class="category-tab active flex-shrink-0 px-6 py-2 bg-warkops-primary text-black font-display font-bold text-sm uppercase skew-x-[-10deg] border border-warkops-primary transition-all" data-category="all">
                <span class="skew-x-[10deg] block">ALL ITEMS</span>
            </button>
        `;

        state.categories.forEach(cat => {
            html += `
                <button class="category-tab flex-shrink-0 px-6 py-2 bg-warkops-panel border border-white/10 text-warkops-muted hover:text-white font-mono text-xs uppercase skew-x-[-10deg] hover:border-warkops-secondary transition-all" data-category="${cat.category_id}">
                    <span class="skew-x-[10deg] block">${cat.name.toUpperCase()}</span>
                </button>
            `;
        });

        nodes.categoryTabs.innerHTML = html;

        // Bind category filter
        document.querySelectorAll('.category-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const categoryId = e.currentTarget.dataset.category;
                state.selectedCategory = categoryId;

                document.querySelectorAll('.category-tab').forEach(b => {
                    b.classList.remove('active', 'bg-warkops-primary', 'text-black');
                    b.classList.add('bg-warkops-panel', 'text-warkops-muted');
                });
                e.currentTarget.classList.add('active', 'bg-warkops-primary', 'text-black');
                e.currentTarget.classList.remove('bg-warkops-panel', 'text-warkops-muted');

                renderMenuGrid();
            });
        });
    }

    function renderMenuGrid() {
        if (!nodes.menuGrid) return;

        let filtered = state.menu;
        if (state.selectedCategory !== 'all') {
            filtered = state.menu.filter(item => item.category_id == state.selectedCategory);
        }

        if (filtered.length === 0) {
            nodes.menuGrid.innerHTML = `
                <div class="col-span-full py-20 text-center">
                    <div class="text-warkops-muted font-mono text-sm">Tidak ada menu tersedia</div>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(item => {
            const isAvailable = item.is_available == 1;
            const priceFormatted = formatCurrency(item.price);

            let overlayHTML = '';
            if (isAvailable) {
                overlayHTML = `
                    <button class="absolute inset-0 bg-warkops-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" onclick="PosController.addToCart(${item.menu_id})">
                        <span class="bg-warkops-primary text-black font-bold px-4 py-1 font-mono text-xs shadow-[0_0_15px_rgba(244,63,94,0.6)]">ADD +</span>
                    </button>
                `;
            } else {
                overlayHTML = `
                    <div class="absolute inset-0 flex items-center justify-center z-10">
                        <div class="border-2 border-white text-white font-black font-display text-xl uppercase -rotate-12 px-4 py-1">SOLD OUT</div>
                    </div>
                `;
            }

            html += `
                <div class="group relative bg-warkops-panel border border-white/5 ${isAvailable ? 'hover:border-warkops-primary/50 cursor-pointer' : 'opacity-60 grayscale cursor-not-allowed'} transition-all overflow-hidden flex flex-col h-full">
                    <div class="p-4 flex-1 flex flex-col justify-end min-h-[120px] bg-gradient-to-t from-black/80 to-transparent">
                        <div class="text-[10px] text-warkops-secondary font-mono mb-1">#${String(item.menu_id).padStart(3, '0')}</div>
                        <h3 class="font-display font-bold text-white leading-tight">${item.name}</h3>
                        <div class="mt-2 text-warkops-primary font-mono font-bold">Rp ${priceFormatted}</div>
                    </div>
                    ${overlayHTML}
                </div>
            `;
        });

        nodes.menuGrid.innerHTML = html;
    }

    function addToCart(menuId) {
        const item = state.menu.find(m => m.menu_id == menuId);
        if (!item || item.is_available != 1) return;

        const existingIndex = state.cart.findIndex(c => c.menu_id == menuId);
        if (existingIndex > -1) {
            state.cart[existingIndex].qty++;
        } else {
            state.cart.push({
                menu_id: item.menu_id,
                name: item.name,
                price: parseFloat(item.price),
                qty: 1
            });
        }

        updateCartDisplay();
        showToast('success', `${item.name} ditambahkan`);
    }

    function updateCartQty(menuId, change) {
        const index = state.cart.findIndex(c => c.menu_id == menuId);
        if (index === -1) return;

        state.cart[index].qty += change;
        if (state.cart[index].qty <= 0) {
            state.cart.splice(index, 1);
        }

        updateCartDisplay();
    }

    function removeFromCart(menuId) {
        state.cart = state.cart.filter(c => c.menu_id != menuId);
        updateCartDisplay();
    }

    function updateCartDisplay() {
        if (!nodes.cartItems) return;

        if (nodes.trxNumber) {
            nodes.trxNumber.textContent = state.currentTrxNo;
        }

        if (state.cart.length === 0) {
            nodes.cartItems.innerHTML = `
                <div class="text-center py-10">
                    <div class="text-warkops-muted font-mono text-xs mb-2">KERANJANG KOSONG</div>
                    <div class="text-[10px] text-white/30">Pilih menu untuk memulai transaksi</div>
                </div>
            `;
            nodes.subtotalEl.textContent = '0';
            nodes.taxEl.textContent = '0';
            nodes.totalEl.textContent = '0';
            nodes.btnProcessOrder.disabled = true;
            nodes.btnProcessOrder.classList.add('opacity-50', 'cursor-not-allowed');
            return;
        }

        let html = '';
        state.cart.forEach(item => {
            const lineTotal = item.price * item.qty;
            html += `
                <div class="bg-black/30 border border-white/5 p-3 flex items-center justify-between group hover:border-warkops-primary/30 transition-colors">
                    <div class="flex-1">
                        <div class="font-display font-bold text-white text-sm">${item.name}</div>
                        <div class="text-[10px] text-warkops-muted font-mono">Rp ${formatCurrency(item.price)} × ${item.qty}</div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="PosController.updateQty(${item.menu_id}, -1)" class="w-6 h-6 bg-warkops-panel border border-white/10 hover:border-warkops-accent hover:text-warkops-accent text-white text-xs flex items-center justify-center transition-colors">−</button>
                        <span class="w-8 text-center font-mono font-bold text-white">${item.qty}</span>
                        <button onclick="PosController.updateQty(${item.menu_id}, 1)" class="w-6 h-6 bg-warkops-panel border border-white/10 hover:border-warkops-success hover:text-warkops-success text-white text-xs flex items-center justify-center transition-colors">+</button>
                        <button onclick="PosController.removeItem(${item.menu_id})" class="ml-2 w-6 h-6 bg-red-900/20 border border-red-500/30 hover:border-red-500 hover:text-red-400 text-red-500/70 text-xs flex items-center justify-center transition-colors">×</button>
                    </div>
                    <div class="ml-4 font-mono font-bold text-warkops-primary">Rp ${formatCurrency(lineTotal)}</div>
                </div>
            `;
        });

        nodes.cartItems.innerHTML = html;

        // Calculate totals
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const tax = subtotal * TAX_RATE;
        const total = subtotal + tax;

        nodes.subtotalEl.textContent = formatCurrency(subtotal);
        nodes.taxEl.textContent = formatCurrency(tax);
        nodes.totalEl.textContent = formatCurrency(total);

        nodes.btnProcessOrder.disabled = false;
        nodes.btnProcessOrder.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    function clearCart() {
        if (!confirm('Yakin ingin mengosongkan keranjang?')) return;
        state.cart = [];
        state.currentTrxNo = generateTrxNo();
        updateCartDisplay();
    }

    function openPaymentModal() {
        if (state.cart.length === 0) return;

        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const tax = subtotal * TAX_RATE;
        const total = subtotal + tax;

        nodes.finalTotal.textContent = formatCurrency(total);
        nodes.paymentAmount.value = '';
        nodes.changeAmount.textContent = '0';
        nodes.modalPayment.classList.remove('hidden');
    }

    function closePaymentModal() {
        nodes.modalPayment.classList.add('hidden');
    }

    function calculateChange() {
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const tax = subtotal * TAX_RATE;
        const total = subtotal + tax;

        const payment = parseFloat(nodes.paymentAmount.value) || 0;
        const change = payment - total;

        nodes.changeAmount.textContent = change >= 0 ? formatCurrency(change) : '0';
    }

    async function handlePayment(e) {
        e.preventDefault();

        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const tax = subtotal * TAX_RATE;
        const total = subtotal + tax;

        const payment = parseFloat(nodes.paymentAmount.value) || 0;

        if (payment < total) {
            showToast('error', 'Pembayaran kurang dari total!');
            return;
        }

        const currentUser = window.Auth?.getUser();
        if (!currentUser) {
            showToast('error', 'User tidak terdeteksi');
            return;
        }

        const payload = {
            user_id: currentUser.user_id,
            table_no: document.getElementById('table-no')?.value || null,
            discount: 0,
            tax: tax,
            items: state.cart.map(item => ({
                menu_id: item.menu_id,
                qty: item.qty
            }))
        };

        try {
            const response = await fetch(TRANSACTIONS_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                const trxId = result.data.trx_id;

                // Update payment info
                await fetch(TRANSACTIONS_API, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        trx_id: trxId,
                        payment: payment,
                        note: document.getElementById('payment-note')?.value || null
                    })
                });

                showToast('success', 'Transaksi berhasil! TRX-' + trxId);
                closePaymentModal();
                state.cart = [];
                state.currentTrxNo = generateTrxNo();
                updateCartDisplay();
            } else {
                showToast('error', result.message || 'Gagal memproses transaksi');
            }
        } catch (error) {
            console.error('Transaction error:', error);
            showToast('error', 'Terjadi kesalahan saat memproses transaksi');
        }
    }

    function generateTrxNo() {
        const now = new Date();
        const timestamp = now.getTime().toString().slice(-6);
        return `TRX-${timestamp}`;
    }

    function formatCurrency(val) {
        return currency.format(val).replace(/Rp\s?/g, '').replace(',00', '');
    }

    function showToast(type, message) {
        if (window.ToastNotification?.show) {
            window.ToastNotification.show(type, message);
        } else {
            alert(message);
        }
    }

    // Public API
    window.PosController = {
        init,
        addToCart,
        updateQty: updateCartQty,
        removeItem: removeFromCart
    };

})(window, document);
