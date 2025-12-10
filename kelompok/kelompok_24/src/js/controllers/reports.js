(function (window, document) {
	'use strict';

	const API_ENDPOINT = 'api/reports.php';
	const PRESET_CONFIG = [
		{ key: 'today', label: 'Hari Ini' },
		{ key: '7d', label: '7 Hari' },
		{ key: '30d', label: '30 Hari' },
		{ key: 'custom', label: 'Custom' }
	];

	const currency = new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		maximumFractionDigits: 0
	});

	const humanDate = new Intl.DateTimeFormat('id-ID', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	const dayLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'short' });
	const timeFormatter = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

	const state = {
		range: '7d',
		customStart: '',
		customEnd: '',
		operator: 'all',
		limit: 15,
		operators: [],
		lastPayload: null,
		isFetching: false
	};

	const dom = {};
	let toastTimer = null;

	function init() {
		const root = document.querySelector('#content .space-y-8');
		if (!root) return;

		dom.root = root;
		cacheStaticDom();
		injectFilterPanel();
		bindFilterEvents();
		applyPreset(state.range, false);
		fetchAndRender();
	}

	function cacheStaticDom() {
		dom.metricsSection = dom.root.querySelector('section.grid');
		const panelSections = [...dom.root.querySelectorAll('section.bg-warkops-panel')];
		dom.chartSection = panelSections.find((section) => {
			const heading = section.querySelector('h3');
			return heading && heading.textContent.toLowerCase().includes('weekly traffic');
		}) || null;
		dom.chartTrack = dom.chartSection ? dom.chartSection.querySelector('.relative.h-40') : null;
		dom.historySection = panelSections.find((section) => {
			const heading = section.querySelector('h3');
			return heading && heading.textContent.toLowerCase().includes('transaction history');
		}) || null;
		dom.historyTableBody = dom.historySection ? dom.historySection.querySelector('tbody') : null;
		dom.exportBtn = dom.historySection ? dom.historySection.querySelector('button') : null;
	}

	function injectFilterPanel() {
		const panel = document.createElement('section');
		panel.className = 'bg-warkops-panel border border-white/5 p-4 flex flex-col gap-4';
		panel.innerHTML = `
			<div class="flex flex-wrap items-center gap-3">
				<span class="text-[10px] font-mono text-warkops-muted uppercase tracking-[0.3em]">Periode</span>
				<div class="flex flex-wrap gap-2" data-range-buttons></div>
				<div class="flex items-center gap-2" data-custom-range hidden>
					<input type="date" name="start-date" class="bg-warkops-bg text-white text-xs px-2 py-1 border border-white/10 focus:border-warkops-primary outline-none">
					<span class="text-xs text-warkops-muted">s/d</span>
					<input type="date" name="end-date" class="bg-warkops-bg text-white text-xs px-2 py-1 border border-white/10 focus:border-warkops-primary outline-none">
				</div>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<label class="text-[10px] font-mono text-warkops-muted uppercase tracking-[0.3em]">Operator</label>
				<select name="operator" class="bg-warkops-bg text-white text-xs px-3 py-2 border border-white/10 focus:border-warkops-secondary outline-none">
					<option value="all">Semua Operator</option>
				</select>
				<button data-action="refresh" class="px-3 py-2 text-xs font-mono border border-warkops-primary/40 text-warkops-primary hover:bg-warkops-primary/10 transition">Terapkan</button>
				<button data-action="reset" class="px-3 py-2 text-xs font-mono border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition">Reset</button>
			</div>
			<div class="text-[11px] font-mono text-warkops-muted" data-filter-summary>Menunggu data laporan...</div>
		`;

		dom.root.insertBefore(panel, dom.metricsSection || dom.root.firstChild);
		dom.filterPanel = panel;
		dom.rangeButtonsWrapper = panel.querySelector('[data-range-buttons]');
		dom.customRangeGroup = panel.querySelector('[data-custom-range]');
		dom.startInput = panel.querySelector('input[name="start-date"]');
		dom.endInput = panel.querySelector('input[name="end-date"]');
		dom.operatorSelect = panel.querySelector('select[name="operator"]');
		dom.refreshBtn = panel.querySelector('[data-action="refresh"]');
		dom.resetBtn = panel.querySelector('[data-action="reset"]');
		dom.filterSummary = panel.querySelector('[data-filter-summary]');

		renderRangeButtons();
	}

	function renderRangeButtons() {
		dom.rangeButtonsWrapper.innerHTML = '';
		PRESET_CONFIG.forEach((preset) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.dataset.range = preset.key;
			button.className = 'px-3 py-2 text-xs font-mono border border-white/10 text-white/70 hover:text-white hover:border-warkops-secondary transition';
			button.textContent = preset.label;
			dom.rangeButtonsWrapper.appendChild(button);
		});
		dom.rangeButtons = dom.rangeButtonsWrapper.querySelectorAll('button');
		updateRangeButtons();
	}

	function bindFilterEvents() {
		dom.rangeButtonsWrapper.addEventListener('click', (event) => {
			const target = event.target.closest('button[data-range]');
			if (!target) return;
			const rangeKey = target.dataset.range;
			applyPreset(rangeKey);
		});

		dom.startInput.addEventListener('change', () => {
			state.customStart = dom.startInput.value;
		});
		dom.endInput.addEventListener('change', () => {
			state.customEnd = dom.endInput.value;
		});

		dom.operatorSelect.addEventListener('change', () => {
			state.operator = dom.operatorSelect.value;
		});

		dom.refreshBtn.addEventListener('click', () => fetchAndRender());
		dom.resetBtn.addEventListener('click', resetFilters);

		if (dom.exportBtn) {
			dom.exportBtn.addEventListener('click', exportHistory);
		}
	}

	function applyPreset(rangeKey, autoFetch = true) {
		state.range = rangeKey;
		if (rangeKey !== 'custom') {
			const { start, end } = computePresetDates(rangeKey);
			state.customStart = start;
			state.customEnd = end;
			dom.startInput.value = start;
			dom.endInput.value = end;
		}

		toggleCustomRange(rangeKey === 'custom');
		updateRangeButtons();
		if (autoFetch && rangeKey !== 'custom') {
			fetchAndRender();
		}
	}

	function resetFilters() {
		state.range = '7d';
		state.customStart = '';
		state.customEnd = '';
		state.operator = 'all';
		if (dom.operatorSelect) dom.operatorSelect.value = 'all';
		applyPreset('7d', false);
		fetchAndRender();
	}

	function toggleCustomRange(visible) {
		if (!dom.customRangeGroup) return;
		dom.customRangeGroup.hidden = !visible;
		dom.customRangeGroup.classList.toggle('opacity-0', !visible);
	}

	function updateRangeButtons() {
		if (!dom.rangeButtons) return;
		dom.rangeButtons.forEach((button) => {
			const isActive = button.dataset.range === state.range;
			button.classList.toggle('border-warkops-primary/60', isActive);
			button.classList.toggle('text-warkops-primary', isActive);
			button.classList.toggle('bg-white/10', isActive);
		});
	}

	async function fetchAndRender() {
		if (state.isFetching) return;
		try {
			setLoading(true);
			const params = buildQueryParams();
			const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const payload = await response.json();
			if (!payload.success) throw new Error(payload.message || 'Gagal memuat laporan');

			state.lastPayload = payload;

			if (Array.isArray(payload.filters?.operators)) {
				updateOperatorOptions(payload.filters.operators);
			}

			renderMetrics(payload.metrics || {});
			renderChart(payload.daily_sales || payload.weekly_sales || {});
			renderHistory(payload.transaction_history || []);
			updateFilterSummary(payload.filters?.range || null);
		} catch (error) {
			showToast(error.message || 'Terjadi kesalahan saat memuat laporan');
			renderMetrics(null);
			renderChart({});
			renderHistory([]);
		} finally {
			setLoading(false);
		}
	}

	function buildQueryParams() {
		const params = new URLSearchParams();
		const range = getActiveRange();
		params.set('start_date', range.start);
		params.set('end_date', range.end);
		params.set('limit', state.limit);
		params.set('range', state.range);
		if (state.operator !== 'all') {
			params.set('operator_id', state.operator);
		}
		return params;
	}

	function getActiveRange() {
		if (state.range === 'custom') {
			const start = state.customStart || state.customEnd || formatDateInput(new Date());
			const end = state.customEnd || state.customStart || start;
			return normalizeRange(start, end);
		}
		return computePresetDates(state.range);
	}

	function computePresetDates(rangeKey) {
		const today = new Date();
		const end = formatDateInput(today);
		const start = new Date(today);
		switch (rangeKey) {
			case 'today':
				break;
			case '30d':
				start.setDate(today.getDate() - 29);
				break;
			case '7d':
			default:
				start.setDate(today.getDate() - 6);
				break;
		}
		return normalizeRange(formatDateInput(start), end);
	}

	function normalizeRange(start, end) {
		if (start > end) {
			return { start: end, end: start };
		}
		return { start, end };
	}

	function formatDateInput(date) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function updateOperatorOptions(list) {
		state.operators = list;
		dom.operatorSelect.innerHTML = '<option value="all">Semua Operator</option>';
		list.forEach((operator) => {
			const option = document.createElement('option');
			option.value = operator.id;
			option.textContent = `${operator.label || operator.username} (${operator.username})`;
			dom.operatorSelect.appendChild(option);
		});
		if (state.operator !== 'all') {
			const exists = list.some((op) => String(op.id) === String(state.operator));
			if (!exists) state.operator = 'all';
		}
		dom.operatorSelect.value = state.operator;
	}

	function renderMetrics(metrics) {
		if (!dom.metricsSection) return;
		const cards = dom.metricsSection.querySelectorAll('.bg-warkops-panel');
		if (!cards.length) return;

		const totalRevenue = metrics ? formatCurrency(metrics.total_revenue || 0) : 'Rp 0';
		const totalTrx = metrics ? (metrics.total_transactions || 0) : 0;
		const bestSeller = metrics ? (metrics.best_seller_name || 'N/A') : 'N/A';
		const bestUnits = metrics ? (metrics.best_seller_units || 0) : 0;
		const profit = metrics ? Math.round((metrics.profit_margin || 0) * 100) : 0;

		const revenueNode = cards[0]?.querySelector('.text-2xl');
		if (revenueNode) revenueNode.textContent = totalRevenue;

		const trxNode = cards[1]?.querySelector('.text-2xl');
		if (trxNode) trxNode.textContent = totalTrx.toLocaleString('id-ID');

		const bestNameNode = cards[2]?.querySelector('.text-lg');
		if (bestNameNode) bestNameNode.textContent = bestSeller;
		const bestDetailNode = cards[2]?.querySelector('.text-xs');
		if (bestDetailNode) bestDetailNode.textContent = `${bestUnits} units sold`;

		const profitNode = cards[3]?.querySelector('.text-2xl');
		if (profitNode) profitNode.textContent = `${profit}%`;
	}

	function renderChart(dailyData) {
		if (!dom.chartTrack) return;
		dom.chartTrack.innerHTML = '';
		const entries = Object.entries(dailyData)
			.map(([date, value]) => ({ date, value }))
			.sort((a, b) => new Date(a.date) - new Date(b.date));

		if (!entries.length) {
			dom.chartTrack.innerHTML = '<div class="w-full text-center text-warkops-muted text-xs font-mono">Tidak ada data penjualan pada rentang ini.</div>';
			return;
		}

		const maxValue = entries.reduce((max, item) => Math.max(max, item.value), 0) || 1;
		const axis = document.createElement('div');
		axis.className = 'absolute left-0 right-0 bottom-8 h-0.5 bg-white/10';
		dom.chartTrack.appendChild(axis);

		const columns = document.createElement('div');
		columns.className = 'relative z-10 flex items-end justify-between gap-4 h-full w-full';
		dom.chartTrack.appendChild(columns);

		entries.forEach((entry) => {
			const wrapper = document.createElement('div');
			wrapper.className = 'group flex flex-col items-center flex-1 gap-2 cursor-pointer';

			const label = document.createElement('div');
			label.className = 'text-[10px] font-mono text-warkops-muted uppercase group-hover:text-white transition-colors';
			label.textContent = (dayLabel.format(new Date(entry.date)) || '').toUpperCase();
			wrapper.appendChild(label);

			const bar = document.createElement('div');
			bar.className = 'relative w-5 rounded-t bg-gradient-to-t from-warkops-primary to-warkops-secondary shadow-[0_0_10px_rgba(6,182,212,0.4)] group-hover:shadow-[0_0_14px_rgba(244,63,94,0.7)] transition-all';
			const height = Math.max(12, (entry.value / maxValue) * 120);
			bar.style.height = `${height}px`;

			const tooltip = document.createElement('div');
			tooltip.className = 'absolute -top-8 left-1/2 -translate-x-1/2 bg-black border border-white/20 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap';
			tooltip.textContent = formatCurrency(entry.value);
			bar.appendChild(tooltip);

			wrapper.appendChild(bar);
			columns.appendChild(wrapper);
		});
	}

	function renderHistory(rows) {
		if (!dom.historyTableBody) return;
		if (!rows.length) {
			dom.historyTableBody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-warkops-muted text-xs font-mono">Tidak ada transaksi pada rentang ini.</td></tr>';
			return;
		}

		const statusClass = {
			PAID: 'text-warkops-success',
			UNPAID: 'text-warkops-accent',
			VOID: 'text-warkops-muted'
		};

		const html = rows.map((row) => {
			const time = formatTime(row.datetime);
			const status = (row.status || 'PAID').toUpperCase();
			const items = row.item_summary || '-';
			const operator = row.operator_username || '-';
			const amount = formatCurrency(row.total || 0);
			const cls = statusClass[status] || 'text-warkops-muted';
			return `
				<tr class="hover:bg-white/5 transition-colors group">
					<td class="py-3 px-2 text-warkops-secondary group-hover:underline">#${row.trx_id}</td>
					<td class="py-3 px-2">${time}</td>
					<td class="py-3 px-2">${operator}</td>
					<td class="py-3 px-2 truncate max-w-[180px]" title="${items}">${items}</td>
					<td class="py-3 px-2 text-right font-bold">${amount}</td>
					<td class="py-3 px-2 text-right ${cls}">${status}</td>
				</tr>
			`;
		}).join('');

		dom.historyTableBody.innerHTML = html;
	}

	function updateFilterSummary(remoteRange) {
		if (!dom.filterSummary) return;
		const fallback = getActiveRange();
		const activeRange = remoteRange && remoteRange.start_date && remoteRange.end_date
			? { start: remoteRange.start_date, end: remoteRange.end_date }
			: fallback;
		const operatorLabel = state.operator === 'all'
			? 'Semua Operator'
			: getOperatorLabel(state.operator);
		const startHuman = humanDate.format(new Date(activeRange.start));
		const endHuman = humanDate.format(new Date(activeRange.end));
		dom.filterSummary.textContent = `${startHuman} – ${endHuman} • ${operatorLabel}`;
	}

	function getOperatorLabel(id) {
		const target = state.operators.find((op) => String(op.id) === String(id));
		if (!target) return 'Operator Tidak Dikenal';
		return target.label || target.username;
	}

	function formatCurrency(value) {
		return currency.format(value).replace('Rp', 'Rp ');
	}

	function formatTime(value) {
		if (!value) return '-';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return timeFormatter.format(date);
	}

	function setLoading(isLoading) {
		state.isFetching = isLoading;
		if (isLoading) {
			if (!dom.loadingOverlay) {
				const overlay = document.createElement('div');
				overlay.className = 'absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-20';
				overlay.innerHTML = '<div class="flex flex-col items-center gap-2 text-warkops-muted font-mono text-xs"><div class="w-10 h-10 border-4 border-warkops-primary/30 border-t-warkops-primary rounded-full animate-spin"></div><span>Memuat laporan...</span></div>';
				dom.loadingOverlay = overlay;
			}
			dom.root.style.position = 'relative';
			dom.root.appendChild(dom.loadingOverlay);
		} else if (dom.loadingOverlay?.parentElement) {
			dom.loadingOverlay.parentElement.removeChild(dom.loadingOverlay);
		}
	}

	function showToast(message) {
		if (!dom.filterPanel) return;
		let toast = dom.filterPanel.querySelector('[data-toast]');
		if (!toast) {
			toast = document.createElement('div');
			toast.dataset.toast = 'true';
			toast.className = 'text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2';
			dom.filterPanel.appendChild(toast);
		}
		toast.textContent = message;
		toast.hidden = false;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			toast.hidden = true;
		}, 4000);
	}

	function exportHistory() {
		if (!state.lastPayload?.transaction_history?.length) {
			showToast('Tidak ada data untuk diexport.');
			return;
		}
		const rows = state.lastPayload.transaction_history;
		const header = ['TRX ID', 'Datetime', 'Operator', 'Items', 'Total', 'Status'];
		const csvRows = rows.map((row) => [
			row.trx_id,
			row.datetime,
			row.operator_username,
			(row.item_summary || '').replace(/"/g, '""'),
			row.total,
			row.status
		]);
		const csvContent = [header, ...csvRows]
			.map((cols) => cols.map((col) => `"${col !== undefined ? col : ''}"`).join(','))
			.join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `warkops-report-${Date.now()}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	window.ReportsController = { init };
})(window, document);