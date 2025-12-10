/**
 * src/js/controllers/items.js
 * Controller untuk CRUD Menu (items.php API)*/

(function (window, document) {
    'use strict';

    const STATUS_META = {
        1: { label: 'Ready', className: 'text-warkops-success' },
        0: { label: 'Sold Out', className: 'text-warkops-accent' }
    };

    const currency = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    });

    let state = {
        menu: [],
        categories: [],
        filter: 'all'
    };

    let nodes = {};

    function init() {
        collectNodes();
        bindEvents();
        loadData();
    }

    function collectNodes() {
        nodes = {
            tableBody: document.querySelector('#menu-table-body'),
            filterButtons: document.querySelectorAll('.filter-btn'),
            btnAdd: document.getElementById('btn-add-menu'),
            modal: document.getElementById('modal-menu'),
            form: document.getElementById('form-menu'),
            btnClose: document.getElementById('close-modal-menu'),
            btnCancel: document.getElementById('cancel-modal-menu'),
            title: document.getElementById('modal-menu-title'),
            statReady: document.getElementById('stat-ready-menu')
        };
    }

    function bindEvents() {
        nodes.btnAdd?.addEventListener('click', () => openModal());
        nodes.btnClose?.addEventListener('click', closeModal);
        nodes.btnCancel?.addEventListener('click', closeModal);
        nodes.form?.addEventListener('submit', handleSubmit);

        nodes.filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.innerText.toLowerCase();
                state.filter = filter === 'all' ? 'all' : filter;
                
                nodes.filterButtons.forEach(b => {
                    b.classList.remove('border-warkops-primary', 'text-warkops-primary', 'bg-white/10');
                    b.classList.add('border-white/10', 'text-white/70');
                });
                e.target.classList.remove('border-white/10', 'text-white/70');
                e.target.classList.add('border-warkops-primary', 'text-warkops-primary', 'bg-white/10');

                render();
            });
        });
    }

    async function loadData() {
        await Promise.all([fetchMenu(), fetchCategories()]);
        render();
        updateStats();
    }

    async function fetchMenu() {
        try {
            const response = await fetch('api/items.php');
            const result = await response.json();
            if (result.success) state.menu = result.data;
        } catch (error) {
            console.error("Failed to load menu:", error);
            nodes.tableBody.innerHTML = errorRow("Gagal memuat data menu.");
        }
    }

    async function fetchCategories() {
        try {
            const response = await fetch('api/categories.php');
            const result = await response.json();
            if (result.success) {
                state.categories = result.data;
                populateCategoryDropdown();
            }
        } catch (error) {
            console.error("Failed to load categories:", error);
        }
    }

    function populateCategoryDropdown() {
        const select = document.getElementById('menu-category');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Pilih Kategori --</option>';
        state.categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.category_id}">${cat.name}</option>`;
        });
    }

    function render() {
        const tbody = nodes.tableBody;
        if (!tbody) return;
        
        tbody.innerHTML = '';

        const filtered = state.menu.filter(item => {
            if (state.filter === 'all') return true;
            return item.category_name && item.category_name.toLowerCase() === state.filter;
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
                    <td class="py-3 text-right">
                        <button onclick="MenuController.edit(${item.menu_id})" class="text-warkops-secondary hover:text-warkops-secondary/70 text-xs mr-2" title="Edit">
                            ✎
                        </button>
                        <button onclick="MenuController.delete(${item.menu_id})" class="text-red-500 hover:text-red-400 text-xs" title="Hapus">
                            ✕
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    }

    function updateStats() {
        if (nodes.statReady) {
            const readyCount = state.menu.filter(i => i.is_available == 1).length;
            nodes.statReady.innerText = readyCount;
        }
    }

    function openModal(data = null) {
        if (!nodes.modal) return;
        
        nodes.modal.classList.remove('hidden');
        nodes.title.textContent = data ? 'Edit Menu' : 'Tambah Menu';
        
        if (data) {
            document.getElementById('menu-id').value = data.menu_id;
            document.getElementById('menu-name').value = data.name;
            document.getElementById('menu-desc').value = data.description || '';
            document.getElementById('menu-price').value = data.price;
            document.getElementById('menu-category').value = data.category_id || '';
            document.getElementById('menu-available').value = data.is_available;
        } else {
            nodes.form.reset();
        }
    }

    function closeModal() {
        nodes.modal?.classList.add('hidden');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        const menuId = document.getElementById('menu-id').value;
        const isEdit = !!menuId;
        
        if (isEdit) data.menu_id = parseInt(menuId);
        
        try {
            const url = isEdit ? `api/items.php?id=${menuId}` : 'api/items.php';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('success', result.message || (isEdit ? 'Menu berhasil diupdate' : 'Menu berhasil ditambahkan'));
                closeModal();
                await fetchMenu();
                render();
                updateStats();
            } else {
                showToast('error', result.message || 'Gagal menyimpan menu');
            }
        } catch (error) {
            console.error('Menu submit error:', error);
            showToast('error', 'Terjadi kesalahan saat menyimpan menu');
        }
    }

    async function deleteItem(id) {
        if (!confirm('Yakin ingin menghapus menu ini?')) return;
        
        try {
            const response = await fetch(`api/items.php?id=${id}`, { method: 'DELETE' });
            const result = await response.json();
            
            if (result.success) {
                showToast('success', 'Menu berhasil dihapus');
                await fetchMenu();
                render();
                updateStats();
            } else {
                showToast('error', result.message || 'Gagal menghapus menu');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showToast('error', 'Terjadi kesalahan saat menghapus menu');
        }
    }

    function edit(id) {
        const item = state.menu.find(m => m.menu_id == id);
        if (item) openModal(item);
    }

    // Utils
    function emptyRow(msg) {
        return `<tr><td colspan="5" class="py-8 text-center text-warkops-muted font-mono text-xs border-t border-white/5">${msg}</td></tr>`;
    }

    function errorRow(msg) {
        return `<tr><td colspan="5" class="py-8 text-center text-red-500 font-mono text-xs border-t border-red-500/20 bg-red-500/5">${msg}</td></tr>`;
    }

    function formatCurrency(val) {
        return currency.format(val).replace(',00', '');
    }

    function showToast(type, message) {
        if (window.ToastNotification?.show) {
            window.ToastNotification.show(type, message);
        } else {
            alert(message);
        }
    }

    // Public API
    window.MenuController = {
        init,
        edit,
        delete: deleteItem
    };

})(window, document);
