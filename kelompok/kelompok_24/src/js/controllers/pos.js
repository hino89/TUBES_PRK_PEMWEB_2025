// src/js/controllers/pos.js

const API_BASE = 'http://localhost/tubes_prk_pemweb_2025/src/api/';
const MENU_API = API_BASE + 'items.php';
const CATEGORIES_API = API_BASE + 'categories.php';
const TRANSACTIONS_API = API_BASE + 'orders.php'; 

// === DOM ELEMENTS ===
const categoryTabsContainer = document.getElementById('category-tabs-container'); 
const menuGridContainer = document.getElementById('menu-grid-container'); 
const cartItemsContainer = document.getElementById('cart-items-container'); 
const subtotalEl = document.getElementById('subtotal-display'); 
const taxEl = document.getElementById('tax-display'); 
const totalEl = document.getElementById('total-display'); 
const clearCartBtn = document.getElementById('clear-cart-btn'); 
const processOrderBtn = document.getElementById('process-order-btn');

// === APPLICATION STATE ===
let menuData = []; 
let categoriesData = []; 
let cart = []; 

const TAX_RATE = 0.10; 
const CURRENCY_FORMAT = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
});

function formatRupiah(number) {
    if (number === null || isNaN(number)) return '0';
    return CURRENCY_FORMAT.format(number).replace('Rp', '');
}

async function loadInitialData() {
    try {
        const [menuRes, categoriesRes] = await Promise.all([
            fetch(MENU_API).then(res => res.json()),
            fetch(CATEGORIES_API).then(res => res.json())
        ]);

        if (menuRes.success) {
            menuData = menuRes.data;
        } else {
            console.error("Gagal memuat Menu dari items.php:", menuRes.message);
        }

        if (categoriesRes.success) {
            categoriesData = categoriesRes.data;
        } else {
            console.error("Gagal memuat Kategori:", categoriesRes.message);
        }

        renderCategoryTabs(categoriesData);
        renderMenuGrid(menuData);
        updateCartDisplay(); 
        
    } catch (error) {
        console.error("Koneksi gagal:", error);
    }
}

function renderCategoryTabs(categories) {
}

function renderMenuGrid(items) {
    if (!menuGridContainer) return;

    menuGridContainer.innerHTML = '';
    
    items.forEach(item => {
        const isAvailable = item.is_available && item.is_available !== '0'; 
        const priceFormatted = formatRupiah(item.price);
        
        const card = document.createElement('div');
        card.className = `group relative bg-warkops-panel border border-white/5 transition-all overflow-hidden flex flex-col h-full 
                          ${isAvailable ? 'hover:border-warkops-primary/50 cursor-pointer' : 'opacity-60 grayscale cursor-not-allowed'}`;
        card.dataset.menuId = item.menu_id;
        card.onclick = isAvailable ? () => addItemToCart(item) : null;

        let overlayHTML = '';
        if (isAvailable) {
             overlayHTML = `
                <button class="absolute inset-0 bg-warkops-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span class="bg-warkops-primary text-black font-bold px-4 py-1 font-mono text-xs shadow-[0_0_15px_rgba(244,63,94,0.6)]">ADD +</span>
                </button>`;
        } else {
            overlayHTML = `
                <div class="absolute inset-0 flex items-center justify-center z-10">
                    <div class="border-2 border-white text-white font-black font-display text-xl uppercase -rotate-12 px-4 py-1">SOLD OUT</div>
                </div>`;
        }

        card.innerHTML = `
            <div class="p-4 flex-1 flex flex-col justify-end min-h-[120px] bg-gradient-to-t from-black/80 to-transparent">
                <div class="text-[10px] text-warkops-secondary font-mono mb-1">${item.menu_id}</div>
                <h3 class="font-display font-bold text-white leading-tight">${item.name}</h3>
                <div class="mt-2 text-warkops-primary font-mono font-bold">Rp ${priceFormatted}</div>
            </div>
            ${overlayHTML}
        `;
        menuGridContainer.appendChild(card);
    });
}

function addItemToCart(item) {
    const existingItem = cart.find(cartItem => cartItem.menu_id === item.menu_id);

    if (existingItem) {
        existingItem.qty += 1;
    } else {
        cart.push({
            menu_id: item.menu_id,
            name: item.name,
            price: parseFloat(item.price),
            qty: 1
        });
    }

    updateCartDisplay();
}

function updateCartItemQty(menuId, change) {
    const itemIndex = cart.findIndex(cartItem => cartItem.menu_id === menuId);
    
    if (itemIndex > -1) {
        cart[itemIndex].qty += change;
        
        if (cart[itemIndex].qty <= 0) {
            cart.splice(itemIndex, 1); 
        }
    }

    updateCartDisplay();
}

function calculateTotals() {
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let taxAmount = subtotal * TAX_RATE;
    let total = subtotal + taxAmount;
    
    return { subtotal, taxAmount, total };
}

function updateCartDisplay() {
    if (!cartItemsContainer) return;
    
    cartItemsContainer.innerHTML = '';
    cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        const totalFormatted = formatRupiah(itemTotal);
        
        const itemHTML = `
            <div class="flex items-start justify-between group">
                <div class="flex-1">
                    <div class="text-xs font-bold text-white">${item.name}</div>
                    <div class="text-[10px] text-warkops-muted font-mono">@ ${formatRupiah(item.price)}</div>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="updateCartItemQty(${item.menu_id}, -1)" class="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white text-xs rounded border border-white/10">-</button>
                    <span class="text-sm font-mono font-bold text-warkops-secondary">${item.qty}</span>
                    <button onclick="updateCartItemQty(${item.menu_id}, 1)" class="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white text-xs rounded border border-white/10">+</button>
                </div>
                <div class="w-16 text-right text-xs font-mono font-bold text-white">${totalFormatted}</div>
            </div>`;
        cartItemsContainer.insertAdjacentHTML('beforeend', itemHTML);
    });
   
    const totals = calculateTotals();

    if (subtotalEl) subtotalEl.textContent = formatRupiah(totals.subtotal);
    if (taxEl) taxEl.textContent = formatRupiah(totals.taxAmount);
    if (totalEl) totalEl.textContent = `Rp ${formatRupiah(totals.total)}`;
}

function clearCart() {
    if (confirm('Yakin ingin mengosongkan keranjang?')) {
        cart = [];
        updateCartDisplay();
    }
}

async function processOrder() {
    if (cart.length === 0) {
        alert('Keranjang kosong. Tambahkan item terlebih dahulu.');
        return;
    }

    const totals = calculateTotals();
    const paidAmount = prompt(`Total yang harus dibayar: Rp ${formatRupiah(totals.total)}. Masukkan jumlah bayar:`);
    
    if (paidAmount === null) return; 

    const payment = parseFloat(paidAmount);

    if (isNaN(payment) || payment < totals.total) {
        alert('Jumlah pembayaran tidak valid atau kurang.');
        return;
    }
    
    if(processOrderBtn) processOrderBtn.disabled = true;

    const transactionData = {
        user_id: localStorage.getItem('userId') || 1,
        cart_items: cart,
        ...totals,
        payment,
        change_amount: payment - totals.total 
    };

    try {
        const response = await fetch(TRANSACTIONS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transactionData)
        });
        const result = await response.json();

        if (result.success) {
            alert(`Transaksi berhasil! Kembalian: Rp ${formatRupiah(result.transaction_details.change_amount)}`);
            cart = []; 
            updateCartDisplay();
        } else {
            alert('Transaksi gagal: ' + result.message);
        }
    } catch (error) {
        console.error('Error transaksi:', error);
        alert('Koneksi ke server gagal saat memproses transaksi.');
    } finally {
        if(processOrderBtn) processOrderBtn.disabled = false;
    }
}

if (clearCartBtn) clearCartBtn.onclick = clearCart;
if (processOrderBtn) processOrderBtn.onclick = processOrder;

loadInitialData();