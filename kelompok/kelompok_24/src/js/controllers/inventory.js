/**
 * src/js/controllers/inventory.js
 * Controller untuk Inventory (Menu & Bahan Baku) - Connected to API
 * Mengelola data Menu (items.php) dan Bahan (ingredients.php)
 */

(function (window, document) {
    'use strict';

    // Konfigurasi Status Visual (Badge Colors)
    const STATUS_META = {
        // Menu Status
        1: { label: 'Ready', className: 'text-warkops-success' },
        0: { label: 'Sold Out', className: 'text-warkops-accent' },
        
        // Stock Status
        'safe': { label: 'Aman', className: 'text-warkops-success' },
        'low': { label: 'Low Stock', className: 'text-warkops-accent' },
        'critical': { label: 'Critical', className: 'text-red-500 animate-pulse' }
    };

    // State Management
    const state = {
        menu: [],
        stock: [],
        menuFilter: 'all',
        stockFilter: 'all'
    };

    // Format Rupiah
    const currency = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    });

    let nodes = null;

    /**
     * Inisialisasi Controller
     */
    async function init() {
        nodes = collectNodes();

        // Safety check jika view belum siap
        if (!nodes.menuTableBody || !nodes.stockTableBody) {
            console.warn('InventoryController: View elements not found.');
            return;
        }

        // Setup Filter Listeners
        bindMenuFilters();
        bindStockFilters();

        // Load Data dari API
        await Promise.all([
            fetchMenu(),
            fetchStock()
        ]);

        // Render Awal
        renderMenu();
        renderStock();
        updateStats();
    }

    /**
     * Fetch Data Menu dari API
     */
    async function fetchMenu() {
        try {
            const response = await fetch('api/items.php');
            const result = await response.json();
            
            if (result.success) {
                state.menu = result.data;
            }
        } catch (error) {
            console.error("Failed to load menu:", error);
            nodes.menuTableBody.innerHTML = errorRow("Gagal memuat data menu.");
        }
    }

    /**
     * Fetch Data Stock dari API
     */
    async function fetchStock() {
        try {
            const response = await fetch('api/ingredients.php');
            const result = await response.json();
            
            if (result.success) {
                state.stock = result.data;
            }
        } catch (error) {
            console.error("Failed to load stock:", error);
            nodes.stockTableBody.innerHTML = errorRow("Gagal memuat data stok.");
        }
    }

    // --- DOM HELPER FUNCTIONS ---

    function collectNodes() {
        const filterSection = document.querySelector('section.bg-warkops-panel');
        // Mencari elemen filter dengan selektor yang lebih spesifik
        const menuFilterBtns = filterSection ? Array.from(filterSection.querySelectorAll('button')) : [];
        const stockFilterBadges = filterSection ? Array.from(filterSection.querySelectorAll('.cursor-pointer')) : []; // Nanti kita tambah class ini di HTML

        return {
            menuFilterButtons: menuFilterBtns,
            stockFilterBadges: document.querySelectorAll('[data-stock-filter]'), // Kita akan update HTML biar gampang selectornya
            menuTableBody: document.querySelector('#menu-table-body'),
            stockTableBody: document.querySelector('#stock-table-body'),
            stats: {
                activeStock: document.getElementById('stat-active-stock'),
                readyMenu: document.getElementById('stat-ready-menu')
            }
        };
    }

    function bindMenuFilters() {
        nodes.menuFilterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.innerText.toLowerCase();
                // Map text button ke filter key
                state.menuFilter = filter === 'all' ? 'all' : filter; // 'makanan' / 'minuman'
                
                // Update UI Button Active State
                nodes.menuFilterButtons.forEach(b => {
                    b.classList.remove('border-warkops-primary', 'text-warkops-primary');
                    b.classList.add('border-white/10', 'text-white/70');
                });
                e.target.classList.remove('border-white/10', 'text-white/70');
                e.target.classList.add('border-warkops-primary', 'text-warkops-primary');

                renderMenu();
            });
        });
    }

    function bindStockFilters() {
        // Karena filter stok di HTML awalnya cuma span biasa, logicnya kita sesuaikan nanti
        // Untuk sekarang kita skip binding kompleks, fokus render data dulu
    }

    // --- RENDER FUNCTIONS ---

    function renderMenu() {
        const tbody = nodes.menuTableBody;
        tbody.innerHTML = '';

        // Filter Logic
        const filtered = state.menu.filter(item => {
            if (state.menuFilter === 'all') return true;
            // Case insensitive check untuk kategori (Misal: 'Makanan' vs 'makanan')
            return item.category_name && item.category_name.toLowerCase() === state.menuFilter;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = emptyRow("Tidak ada menu ditemukan.");
            return;
        }

        filtered.forEach(item => {
            const isReady = item.is_available == 1;
            const status = STATUS_META[isReady ? 1 : 0];

            const row = `
                <tr class="hover:bg-white/5 transition-colors group">
                    <td class="py-3">
                        <div class="font-bold text-white group-hover:text-warkops-primary transition-colors">${item.name}</div>
                        <div class="text-[10px] text-warkops-muted">${item.description || '-'}</div>
                    </td>
                    <td class="py-3 text-white/80">${item.category_name || 'Uncategorized'}</td>
                    <td class="py-3 text-right font-mono text-white">${formatCurrency(item.price)}</td>
                    <td class="py-3 text-right ${status.className} font-bold text-xs uppercase">${status.label}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    }

    function renderStock() {
        const tbody = nodes.stockTableBody;
        tbody.innerHTML = '';

        if (state.stock.length === 0) {
            tbody.innerHTML = emptyRow("Stok kosong.");
            return;
        }

        state.stock.forEach(item => {
            // Logic Status Stok
            const qty = parseFloat(item.stock_qty);
            const threshold = parseFloat(item.low_stock_threshold || 5); // Default threshold 5 jika null
            
            let statusKey = 'safe';
            if (qty <= 0) statusKey = 'critical';
            else if (qty <= threshold) statusKey = 'low';

            const status = STATUS_META[statusKey];

            const row = `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="py-3">
                        <div class="font-bold text-white">${item.name}</div>
                        <div class="text-[10px] text-warkops-muted font-mono">ID: ING-${String(item.ingredient_id).padStart(3, '0')}</div>
                    </td>
                    <td class="py-3 text-white/50 text-xs italic">Local Supplier</td> <!-- Placeholder -->
                    <td class="py-3 text-right font-mono text-white">
                        <span class="text-lg font-bold">${qty}</span> <span class="text-xs text-warkops-muted">${item.unit}</span>
                    </td>
                    <td class="py-3 text-right ${status.className} font-bold text-xs uppercase">${status.label}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    }

    function updateStats() {
        if (nodes.stats.activeStock) {
            const activeCount = state.stock.filter(i => parseFloat(i.stock_qty) > 0).length;
            nodes.stats.activeStock.innerText = activeCount;
        }
        if (nodes.stats.readyMenu) {
            const readyCount = state.menu.filter(i => i.is_available == 1).length;
            nodes.stats.readyMenu.innerText = readyCount;
        }
    }

    // --- UTILS ---

    function emptyRow(msg) {
        return `<tr><td colspan="4" class="py-8 text-center text-warkops-muted font-mono text-xs border-t border-white/5">${msg}</td></tr>`;
    }

    function errorRow(msg) {
        return `<tr><td colspan="4" class="py-8 text-center text-red-500 font-mono text-xs border-t border-red-500/20 bg-red-500/5">${msg}</td></tr>`;
    }

    function formatCurrency(val) {
        return currency.format(val).replace(',00', '');
    }

    // Expose Global untuk Router
    window.InventoryController = {
        init
    };

})(window, document);