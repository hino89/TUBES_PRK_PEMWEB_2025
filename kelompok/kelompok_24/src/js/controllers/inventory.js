// src/js/controllers/inventory.js
(function (window, document) {
	'use strict';

	const MENU_STATUS_META = {
		ready: { label: 'Ready', className: 'text-warkops-success' },
		restock: { label: 'Restock', className: 'text-warkops-accent' },
		prep: { label: 'Prep', className: 'text-warkops-secondary' }
	};

	const STOCK_STATUS_META = {
		safe: { label: 'Aman', className: 'text-warkops-success' },
		low: { label: 'Low', className: 'text-warkops-accent' },
		qc: { label: 'QC', className: 'text-warkops-secondary' }
	};

	const MENU_ITEMS = [
		{ id: 'menu-1', name: 'Kopi Susu Momo', note: 'Signature Pink Foam', category: 'Minuman', type: 'drink', price: 24000, status: 'ready' },
		{ id: 'menu-2', name: 'Roti Bakar Higashi', note: 'Keju • Corned', category: 'Snack', type: 'food', price: 18000, status: 'restock' },
		{ id: 'menu-3', name: 'Nasi Gyudon Retro', note: 'Extra Onsen Egg', category: 'Makanan', type: 'food', price: 32000, status: 'ready' },
		{ id: 'menu-4', name: 'Sakura Soda', note: 'Lychee • Yuzu', category: 'Minuman', type: 'drink', price: 22000, status: 'prep' },
		{ id: 'menu-5', name: 'Matcha Kuromitsu', note: 'Charcoal Jelly', category: 'Minuman', type: 'drink', price: 26000, status: 'ready' }
	];

	const STOCK_ITEMS = [
		{ id: 'stock-1', name: 'Beans Arabica 90s Roast', batch: 'Lot #AK-221', supplier: 'Higashi Roastery', qty: '6 kg', status: 'safe' },
		{ id: 'stock-2', name: 'Sirup Momo', batch: 'Batch 12/2025', supplier: 'Momoka Lab', qty: '5 botol', status: 'low' },
		{ id: 'stock-3', name: 'Nori Sheet', batch: 'Stasiun Kios 04', supplier: 'Tokyo Mart', qty: '120 lembar', status: 'safe' },
		{ id: 'stock-4', name: 'Bawang Goreng', batch: 'Vacuum Pack', supplier: 'Pasar Permai', qty: '15 pack', status: 'qc' },
		{ id: 'stock-5', name: 'Saus Tare Gyudon', batch: 'Blend 07', supplier: 'Higashi Lab', qty: '8 botol', status: 'low' }
	];

	const MENU_FILTERS = {
		all: () => true,
		food: (item) => item.type === 'food',
		drink: (item) => item.type === 'drink'
	};

	const STOCK_FILTERS = {
		all: () => true,
		safe: (item) => item.status === 'safe',
		low: (item) => item.status === 'low',
		qc: (item) => item.status === 'qc'
	};

	const currency = new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		maximumFractionDigits: 0
	});

	const state = {
		menuFilter: 'all',
		stockFilter: 'all'
	};

	let nodes = null;

	function init() {
		nodes = collectNodes();

		if (!nodes.menuTableBody || !nodes.stockTableBody) {
			console.warn('InventoryController: inventory view not ready.');
			return;
		}

		bindMenuFilters();
		bindStockFilters();
		renderMenu();
		renderStock();
		updateStats();
	}

	function collectNodes() {
		const filterSection = document.querySelector('section.bg-warkops-panel');
		const filterGroups = filterSection ? [...filterSection.querySelectorAll('.flex.items-center.gap-3')] : [];
		const menuFilterButtons = filterGroups[0] ? [...filterGroups[0].querySelectorAll('button')] : [];
		const stockFilterBadges = filterGroups[1] ? [...filterGroups[1].querySelectorAll('span.text-xs.font-mono')] : [];

		return {
			menuFilterButtons,
			stockFilterBadges,
			menuTableBody: findTableBody('Daftar Menu'),
			stockTableBody: findTableBody('Bahan Mentah'),
			stats: detectHeroStats()
		};
	}

	function findTableBody(title) {
		const cards = [...document.querySelectorAll('article')];
		const target = cards.find((card) => {
			const heading = card.querySelector('h3');
			return heading && heading.textContent.toLowerCase().includes(title.toLowerCase());
		});

		return target ? target.querySelector('tbody') : null;
	}

	function detectHeroStats() {
		const hero = document.querySelector('section.relative.bg-gradient-to-r');
		if (!hero) return { bahan: null, menu: null };

		const counters = hero.querySelectorAll('.grid .text-2xl');
		return {
			bahan: counters[0] || null,
			menu: counters[1] || null
		};
	}

	function bindMenuFilters() {
		if (!nodes.menuFilterButtons.length) return;

		nodes.menuFilterButtons.forEach((button) => {
			const label = button.textContent.trim().toLowerCase();
			let filterKey = null;

			if (label === 'all') filterKey = 'all';
			if (label === 'makanan') filterKey = 'food';
			if (label === 'minuman') filterKey = 'drink';

			if (!filterKey) return;

			button.dataset.menuFilter = filterKey;
			button.addEventListener('click', () => {
				if (state.menuFilter === filterKey) return;
				state.menuFilter = filterKey;
				highlightMenuFilter(filterKey);
				renderMenu();
			});
		});

		highlightMenuFilter(state.menuFilter);
	}

	function bindStockFilters() {
		if (!nodes.stockFilterBadges.length) return;

		nodes.stockFilterBadges.forEach((badge) => {
			const label = badge.textContent.trim().toLowerCase();
			let filterKey = null;

			if (label.includes('stok aman')) filterKey = 'safe';
			if (label.includes('restock')) filterKey = 'low';
			if (label.includes('qc')) filterKey = 'qc';

			if (!filterKey) return;

			badge.dataset.stockFilter = filterKey;
			badge.classList.add('cursor-pointer', 'select-none');
			badge.setAttribute('role', 'button');
			badge.setAttribute('tabindex', '0');

			const handleToggle = () => toggleStockFilter(filterKey);
			badge.addEventListener('click', handleToggle);
			badge.addEventListener('keydown', (event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					handleToggle();
				}
			});
		});

		highlightStockFilter(state.stockFilter);
	}

	function toggleStockFilter(filterKey) {
		state.stockFilter = state.stockFilter === filterKey ? 'all' : filterKey;
		highlightStockFilter(state.stockFilter);
		renderStock();
		updateStats();
	}

	function highlightMenuFilter(activeKey) {
		nodes.menuFilterButtons.forEach((button) => {
			const isActive = button.dataset.menuFilter === activeKey;
			button.classList.toggle('border-warkops-primary/60', isActive);
			button.classList.toggle('text-warkops-primary', isActive);
			button.classList.toggle('bg-white/10', isActive);
			button.classList.toggle('text-white', !isActive);
		});
	}

	function highlightStockFilter(activeKey) {
		nodes.stockFilterBadges.forEach((badge) => {
			const isActive = activeKey !== 'all' && badge.dataset.stockFilter === activeKey;
			badge.classList.toggle('bg-white/10', isActive);
			badge.classList.toggle('border-white/30', isActive);
		});
	}

	function renderMenu() {
		const filterFn = MENU_FILTERS[state.menuFilter] || MENU_FILTERS.all;
		const rows = MENU_ITEMS.filter(filterFn)
			.map((item) => {
				const statusMeta = MENU_STATUS_META[item.status] || MENU_STATUS_META.ready;
				return `
					<tr class="hover:bg-white/5">
						<td class="py-3">
							<div class="font-bold">${item.name}</div>
							<div class="text-[10px] text-warkops-muted">${item.note}</div>
						</td>
						<td class="py-3">${item.category}</td>
						<td class="py-3 text-right">${formatCurrency(item.price)}</td>
						<td class="py-3 text-right ${statusMeta.className}">${statusMeta.label}</td>
					</tr>
				`;
			})
			.join('');

		nodes.menuTableBody.innerHTML = rows || emptyRow('Menu belum tersedia');
		updateStats();
	}

	function renderStock() {
		const filterFn = STOCK_FILTERS[state.stockFilter] || STOCK_FILTERS.all;
		const rows = STOCK_ITEMS.filter(filterFn)
			.map((item) => {
				const statusMeta = STOCK_STATUS_META[item.status] || STOCK_STATUS_META.safe;
				return `
					<tr class="hover:bg-white/5">
						<td class="py-3">
							<div class="font-bold">${item.name}</div>
							<div class="text-[10px] text-warkops-muted">${item.batch}</div>
						</td>
						<td class="py-3">${item.supplier}</td>
						<td class="py-3 text-right">${item.qty}</td>
						<td class="py-3 text-right ${statusMeta.className}">${statusMeta.label}</td>
					</tr>
				`;
			})
			.join('');

		nodes.stockTableBody.innerHTML = rows || emptyRow('Data bahan baku kosong');
	}

	function emptyRow(message) {
		return `
			<tr>
				<td colspan="4" class="py-6 text-center text-warkops-muted text-xs font-mono">${message}</td>
			</tr>
		`;
	}

	function updateStats() {
		if (!nodes.stats) return;

		const bahanAktif = STOCK_ITEMS.filter((item) => item.status !== 'low').length;
		const menuReady = MENU_ITEMS.filter((item) => item.status === 'ready').length;

		if (nodes.stats.bahan) nodes.stats.bahan.textContent = bahanAktif;
		if (nodes.stats.menu) nodes.stats.menu.textContent = menuReady;
	}

	function formatCurrency(value) {
		return currency.format(value).replace('Rp', 'Rp ');
	}

	window.InventoryController = {
		init,
		state,
		data: {
			menu: MENU_ITEMS,
			stock: STOCK_ITEMS
		}
	};
})(window, document);