/**
 * WarkOps v2.0 - Reports / Analytics Controller
 * FINAL VERSION – With Fully Working Time Range Filter
 */

window.ReportsController = {
    state: {
        range: '7d',
        operator: 'all',
        start_date: '',
        end_date: '',
    },

    init() {
        console.log("[Reports] Controller Initialized");
        this.cacheDom();
        this.bindEvents();
        this.applyPresetDates('7d');      // Default
        this.fetchData();

        this.interval = setInterval(() => this.fetchData(), 60000);
    },

    destroy() {
        if (this.interval) clearInterval(this.interval);
    },

    cacheDom() {
        this.dom = {
            range: document.getElementById('filter-range'),
            start: document.getElementById('filter-start-date'),
            end: document.getElementById('filter-end-date'),
            operator: document.getElementById('filter-operator'),
            apply: document.getElementById('filter-apply'),

            // Metrics
            valRevenue: document.getElementById('val-revenue'),
            valTrx: document.getElementById('val-transactions'),
            valBestItem: document.getElementById('val-best-seller'),
            valBestUnit: document.getElementById('val-best-unit'),

            chartBody: document.getElementById('chart-body'),
            history: document.getElementById('history-table-body'),
        };
    },

    bindEvents() {
        const d = this.dom;

        // WHEN TIME RANGE CHANGES
        d.range.addEventListener("change", () => {
            const val = d.range.value;
            this.state.range = val;

            if (val === "custom") {
                this.toggleDateInputs(true);
                this.prefillCustomRange();
            } else {
                this.toggleDateInputs(false);
                this.applyPresetDates(val);
            }
        });

        // APPLY BUTTON
        d.apply.addEventListener("click", () => {
            this.state.operator = d.operator.value;

            if (this.state.range === "custom") {
                if (!this.validateCustomDates()) return;
            }

            this.fetchData();
        });
    },

    toggleDateInputs(show) {
        this.dom.start.disabled = !show;
        this.dom.end.disabled = !show;
        this.dom.start.classList.toggle("opacity-40", !show);
        this.dom.end.classList.toggle("opacity-40", !show);
    },

    prefillCustomRange() {
        const today = new Date().toISOString().slice(0, 10);
        this.dom.start.value = today;
        this.dom.end.value = today;

        this.state.start_date = today;
        this.state.end_date = today;
    },

    applyPresetDates(type) {
        const today = new Date();
        const end = today.toISOString().slice(0, 10);
        let startDate = new Date(today);

        if (type === "today") {
            // start = end
        }
        else if (type === "7d") {
            startDate.setDate(today.getDate() - 6);
        }
        else if (type === "30d") {
            startDate.setDate(today.getDate() - 29);
        }

        const start = startDate.toISOString().slice(0, 10);

        this.state.start_date = start;
        this.state.end_date = end;
        this.dom.start.value = start;
        this.dom.end.value = end;
    },

    validateCustomDates() {
        const start = this.dom.start.value;
        const end = this.dom.end.value;

        if (!start || !end) {
            alert("Tanggal mulai dan selesai wajib diisi untuk Custom Range.");
            return false;
        }

        if (start > end) {
            alert("Tanggal mulai tidak boleh setelah tanggal selesai.");
            return false;
        }

        this.state.start_date = start;
        this.state.end_date = end;

        return true;
    },

    async fetchData() {
        try {
            const params = new URLSearchParams({
                range: this.state.range,
                operator_id: this.state.operator,
                start_date: this.state.start_date,
                end_date: this.state.end_date
            });

            const res = await fetch(`api/reports.php?${params.toString()}`);
            const json = await res.json();

            if (!json.success) {
                console.error("[Reports] API Error:", json.message);
                return;
            }

            // Load Operator list (only once)
            if (this.dom.operator.options.length === 1 && json.filters?.operators) {
                this.renderOperators(json.filters.operators);
            }

            this.renderMetrics(json.metrics);
            this.renderChart(json.daily_sales);
            this.renderHistory(json.transaction_history);

        } catch (err) {
            console.error("[Reports] Fetch Error:", err);
        }
    },

    renderOperators(operators) {
        operators.forEach(op => {
            const opt = document.createElement("option");
            opt.value = op.id;
            opt.textContent = op.label || op.username;
            this.dom.operator.appendChild(opt);
        });
    },

    renderMetrics(metrics) {
        if (!metrics) return;

        const fmt = new Intl.NumberFormat("id-ID");

        this.dom.valRevenue.textContent = "Rp " + fmt.format(metrics.total_revenue || 0);
        this.dom.valTrx.textContent = (metrics.total_transactions || 0).toLocaleString();

        this.dom.valBestItem.textContent = metrics.best_seller_name || "-";
        this.dom.valBestUnit.textContent = `${metrics.best_seller_units || 0} sold`;
    },

	renderChart(dailyData) {
		const container = this.dom.chartBody;
		if (!container) return;

		container.innerHTML = ''; // Clear chart

		// Convert object to array & sort by date
		const dataArr = Object.entries(dailyData || {})
			.map(([date, val]) => ({ date, val: Number(val) }))
			.sort((a, b) => new Date(a.date) - new Date(b.date));

		if (dataArr.length === 0) {
			container.innerHTML = `
				<div class="w-full text-center text-xs text-warkops-muted mt-5">
					NO DATA
				</div>
			`;
			return;
		}

		// Get max for height scaling
		const maxVal = Math.max(...dataArr.map(d => d.val), 1);

		dataArr.forEach(d => {
			const heightPct = (d.val / maxVal) * 100;
			const dayLabel = new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short' });
			const valFormatted = d.val.toLocaleString();

			const barHtml = `
				<div class="flex-1 flex flex-col items-center justify-end h-full group relative cursor-crosshair">

					<!-- Tooltip -->
					<div class="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
						<div class="bg-black border border-white/20 px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-lg">
							<span class="text-warkops-secondary font-bold">Rp ${valFormatted}</span>
							<br><span class="text-gray-500">${d.date}</span>
						</div>
					</div>

					<!-- The Bar -->
					<div class="w-full mx-1 bg-warkops-primary/30 border-t border-warkops-primary 
								group-hover:bg-warkops-primary/70 transition-all relative"
						style="height: ${Math.max(heightPct, 5)}%;">
					</div>

					<!-- Label -->
					<div class="mt-2 text-[9px] font-mono text-warkops-muted uppercase group-hover:text-white transition-colors">
						${dayLabel}
					</div>

				</div>
			`;

			container.insertAdjacentHTML('beforeend', barHtml);
		});
	},


    renderHistory(list = []) {
        const tbody = this.dom.history;

        tbody.innerHTML = "";

        if (list.length === 0) {
            tbody.innerHTML = `<tr>
                <td colspan="6" class="py-6 text-center text-warkops-muted text-xs">
                    No transactions found in this period.
                </td>
            </tr>`;
            return;
        }

        list.forEach(tx => {
            const statusClass =
                tx.status === "PAID" ? "text-warkops-success" : "text-warkops-accent";

            const row = `
            <tr class="hover:bg-white/5 transition border-b border-white/5">
                <td class="px-4 py-3 font-mono text-warkops-secondary">#${tx.trx_id}</td>
                <td class="px-4 py-3 text-white/70 text-xs">${tx.datetime}</td>
                <td class="px-4 py-3 text-xs text-white">${tx.operator_username}</td>
                <td class="px-4 py-3 text-xs text-warkops-muted truncate">${tx.item_summary}</td>
                <td class="px-4 py-3 text-right font-bold text-xs">Rp ${tx.total.toLocaleString()}</td>
                <td class="px-4 py-3 text-center ${statusClass} text-xs font-bold">${tx.status}</td>
            </tr>
            `;

            tbody.insertAdjacentHTML("beforeend", row);
        });
    }
};
