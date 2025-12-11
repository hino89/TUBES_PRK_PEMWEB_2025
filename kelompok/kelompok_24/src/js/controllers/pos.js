/**
 * src/js/controllers/pos.js
 * Controller POS: Handle Menu, Cart, & Checkout
 * FIX: Perbaikan pengambilan ID User saat checkout
 */

(function (window, document) {
    'use strict';
    const BASE_URL_API = 'http://localhost:8080/TUBES_PRK_PEMWEB_2025/kelompok/kelompok_24/src/api/';
    
    const MENU_API = BASE_URL_API + 'items.php';
    const CATEGORIES_API = BASE_URL_API + 'categories.php';
    const MODIFIERS_API = BASE_URL_API + 'modifiers.php';
    const TRANSACTIONS_API = BASE_URL_API + 'orders.php';

    const TAX_RATE = 0.10;
    const currency = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    });

    let state = {
        menu: [],
        categories: [],
        modifiers: [],
        cart: [],
        selectedCategory: 'all',
        currentItem: null,
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
            finalTotal: document.getElementById('final-total-display'),
            
            modalModifier: document.getElementById('modifier-modal'),
            modalItemName: document.getElementById('modal-item-name'),
            modalBasePrice: document.getElementById('modal-base-price'),
            modalModifiersList: document.getElementById('modal-modifiers-list'),
            modalTotalPrice: document.getElementById('modal-total-price'),
            btnCancelMod: document.getElementById('btn-cancel-mod'),
            btnConfirmMod: document.getElementById('btn-confirm-mod'),
        };
    }

    function bindEvents() {
        nodes.btnClearCart?.addEventListener('click', clearCart);
        nodes.btnProcessOrder?.addEventListener('click', openPaymentModal);
        nodes.btnClosePayment?.addEventListener('click', closePaymentModal);
        nodes.formPayment?.addEventListener('submit', handlePayment);
        nodes.paymentAmount?.addEventListener('input', calculateChange);
        
        nodes.btnCancelMod?.addEventListener('click', closeModifierModal);
        nodes.modalModifier?.addEventListener('change', handleModifierChange);
        nodes.btnConfirmMod?.addEventListener('click', confirmModifiers);
    }

    async function loadData() {
        try {
            const [menuRes, categoriesRes, modifiersRes] = await Promise.all([
                fetch(MENU_API),
                fetch(CATEGORIES_API),
                fetch(MODIFIERS_API)
            ]);

            const menuData = await menuRes.json();
            const categoriesData = await categoriesRes.json();
            const modifiersData = await modifiersRes.json();

            if (menuData.success) state.menu = menuData.data;
            if (categoriesData.success) state.categories = categoriesData.data;
            if (modifiersData.success) state.modifiers = modifiersData.data;

            renderCategoryTabs();
            renderMenuGrid();
            updateCartDisplay();
        } catch (error) {
            console.error('Failed to load data:', error);
            showToast('error', 'Gagal memuat data menu dan topping');
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
            nodes.menuGrid.innerHTML = `<div class="col-span-full py-20 text-center"><div class="text-warkops-muted font-mono text-sm">Tidak ada menu tersedia</div></div>`;
            return;
        }

        let html = '';
        filtered.forEach(item => {
            const isAvailable = item.is_available == 1;
            const priceFormatted = formatCurrency(item.price);

            let overlayHTML = '';
            if (isAvailable) {
                overlayHTML = `
                    <button class="absolute inset-0 bg-warkops-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" onclick="PosController.openModifierModal(${item.menu_id})">
                        <span class="bg-warkops-primary text-black font-bold px-4 py-1 font-mono text-xs shadow-[0_0_15px_rgba(244,63,94,0.6)]">ADD +</span>
                    </button>
                `;
            } else {
                overlayHTML = `<div class="absolute inset-0 flex items-center justify-center z-10"><div class="border-2 border-white text-white font-black font-display text-xl uppercase -rotate-12 px-4 py-1">SOLD OUT</div></div>`;
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

    function openModifierModal(menuId) {
        const item = state.menu.find(m => m.menu_id == menuId);
        if (!item || item.is_available != 1) return;

        state.currentItem = {
            ...item,
            selectedModifiers: [],
            totalPrice: parseFloat(item.price)
        };

        nodes.modalItemName.textContent = item.name;
        nodes.modalBasePrice.textContent = formatCurrency(item.price);
        
        renderModifiersCheckboxes(state.modifiers);
        updateModalTotal(item.price);
        
        nodes.modalModifier.classList.remove('hidden');
    }

    function closeModifierModal() {
        state.currentItem = null;
        nodes.modalModifier.classList.add('hidden');
        nodes.modalModifiersList.innerHTML = '';
    }
    
    function renderModifiersCheckboxes(modifiers) {
        if (!nodes.modalModifiersList) return;
        nodes.modalModifiersList.innerHTML = '';
        
        let html = '';
        modifiers.forEach(mod => {
            const priceLabel = mod.price > 0 ? `+Rp ${formatCurrency(mod.price)}` : 'FREE';
            
            html += `
                <label class="flex items-center justify-between p-3 border border-white/5 hover:border-warkops-primary/50 cursor-pointer group transition-all bg-white/5">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" data-mod-id="${mod.modifier_id}" data-mod-price="${mod.price}" data-mod-name="${mod.name}" class="modifier-checkbox accent-warkops-primary w-4 h-4">
                        <span class="text-sm font-bold text-white group-hover:text-warkops-primary">${mod.name}</span>
                    </div>
                    <span class="text-xs font-mono text-warkops-muted">${priceLabel}</span>
                </label> 
            `;
        });
        nodes.modalModifiersList.innerHTML = html;
    }

    function handleModifierChange(e) {
        if (!e.target.classList.contains('modifier-checkbox')) return;

        const checkbox = e.target;
        const modId = parseInt(checkbox.dataset.modId);
        const modPrice = parseFloat(checkbox.dataset.modPrice);
        const modName = checkbox.dataset.modName;
        const isChecked = checkbox.checked;
        
        if (!state.currentItem) return;

        if (isChecked) {
            state.currentItem.selectedModifiers.push({
                modifier_id: modId,
                name: modName,
                price: modPrice
            });
        } else {
            state.currentItem.selectedModifiers = state.currentItem.selectedModifiers.filter(m => m.modifier_id !== modId);
        }

        const newTotalPrice = state.currentItem.price + state.currentItem.selectedModifiers.reduce((sum, mod) => sum + mod.price, 0);
        state.currentItem.totalPrice = newTotalPrice;
        
        updateModalTotal(newTotalPrice);
    }

    function updateModalTotal(total) {
        nodes.modalTotalPrice.textContent = formatCurrency(total);
    }
    
    function confirmModifiers() {
        if (!state.currentItem) return;
        
        const finalItem = {
            menu_id: state.currentItem.menu_id,
            name: state.currentItem.name,
            base_price: state.currentItem.price, 
            price: state.currentItem.totalPrice,
            qty: 1,
            modifiers: state.currentItem.selectedModifiers 
        };

        addToCart(finalItem);
        
        closeModifierModal();
        showToast('success', `${finalItem.name} + ${finalItem.modifiers.length} topping ditambahkan`);
    }

    function addToCart(itemOrMenuId) {
        let itemToAdd;

        if (typeof itemOrMenuId === 'number') {
            const menu = state.menu.find(m => m.menu_id === itemOrMenuId);
            if (!menu || menu.is_available != 1) return;
            itemToAdd = {
                menu_id: menu.menu_id,
                name: menu.name,
                base_price: parseFloat(menu.price),
                price: parseFloat(menu.price),
                qty: 1,
                modifiers: []
            };
        } else {
            itemToAdd = itemOrMenuId;
        }
        
        state.cart.push(itemToAdd); 

        updateCartDisplay();
        showToast('success', `${itemToAdd.name} ditambahkan`);
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
            nodes.cartItems.innerHTML = `<div class="text-center py-10"><div class="text-warkops-muted font-mono text-xs mb-2">KERANJANG KOSONG</div><div class="text-[10px] text-white/30">Pilih menu untuk memulai transaksi</div></div>`;
            nodes.subtotalEl.textContent = '0';
            nodes.taxEl.textContent = '0';
            nodes.totalEl.textContent = '0';
            nodes.btnProcessOrder.disabled = true;
            nodes.btnProcessOrder.classList.add('opacity-50', 'cursor-not-allowed');
            return;
        }

        let html = '';
        state.cart.forEach((item, index) => {
            const lineTotal = item.price * item.qty;
            const modifierList = item.modifiers.map(m => m.name).join(', ');
            const modifierHTML = modifierList ? `<div class="text-[9px] text-warkops-accent font-mono italic">${modifierList}</div>` : '';
            
            html += `
                <div class="bg-black/30 border border-white/5 p-3 flex items-start justify-between group hover:border-warkops-primary/30 transition-colors">
                    <div class="flex-1">
                        <div class="font-display font-bold text-white text-sm">${item.name}</div>
                        ${modifierHTML}
                        <div class="text-[10px] text-warkops-muted font-mono">@ ${formatCurrency(item.base_price)} + ${formatCurrency(item.price - item.base_price)} toping</div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="PosController.updateQty(${item.menu_id}, -1, ${index})" class="w-6 h-6 bg-warkops-panel border border-white/10 hover:border-warkops-accent hover:text-warkops-accent text-white text-xs flex items-center justify-center transition-colors">−</button>
                        <span class="w-8 text-center font-mono font-bold text-white">${item.qty}</span>
                        <button onclick="PosController.updateQty(${item.menu_id}, 1, ${index})" class="w-6 h-6 bg-warkops-panel border border-white/10 hover:border-warkops-success hover:text-warkops-success text-white text-xs flex items-center justify-center transition-colors">+</button>
                        <button onclick="PosController.removeItem(${item.menu_id}, ${index})" class="ml-2 w-6 h-6 bg-red-900/20 border border-red-500/30 hover:border-red-500 hover:text-red-400 text-red-500/70 text-xs flex items-center justify-center transition-colors">×</button>
                    </div>
                    <div class="ml-4 font-mono font-bold text-warkops-primary">Rp ${formatCurrency(lineTotal)}</div>
                </div>
            `;
        });

        nodes.cartItems.innerHTML = html;

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
            showToast('error', 'User tidak terdeteksi. Silakan login ulang.');
            return;
        }

        const payload = {
            user_id: currentUser.id, 
            table_no: document.getElementById('table-no')?.value || null,
            discount: 0,
            tax: tax,
            items: state.cart.map(item => ({
                menu_id: item.menu_id,
                qty: item.qty,
                price: item.price,
                base_price: item.base_price,
                modifiers: item.modifiers.map(mod => ({
                    modifier_id: mod.modifier_id,
                    price: mod.price 
                }))
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

    window.PosController = {
        init,
        openModifierModal,
        updateQty: updateCartQty,
        removeItem: removeFromCart
    };

})(window, document);