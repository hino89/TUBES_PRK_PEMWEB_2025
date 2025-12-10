/**
 * src/js/controllers/home.js
 * Controller Dashboard - Adapted for WarkOps SPA Architecture
 */

window.HomeController = {
    // Gunakan relative path agar aman dari masalah CORS/Port
    apiUrl: 'api/home.php',
    interval: null,

    // Fungsi wajib yang dipanggil oleh Router saat halaman dimuat
    init() {
        this.loadStats();
        // Auto refresh data setiap 60 detik agar real-time
        this.interval = setInterval(() => this.loadStats(), 60000);
    },

    // Fungsi cleanup (optional, dipanggil jika router support destroy)
    destroy() {
        if (this.interval) clearInterval(this.interval);
    },

    async loadStats() {
        try {
            const response = await fetch(this.apiUrl);
            const result = await response.json();

            if (result.success) {
                this.updateStatistics(result.data);
                this.generateChart(result.data.weekly_chart);
                this.generatePopularList(result.data.popular_items);
            } else {
                console.error("Dashboard API Error:", result.message);
            }

        } catch (error) {
            console.error("Fetch Error:", error);
        }
    },

    updateStatistics(data) {
        // Helper element selector
        const el = (id) => document.getElementById(id);

        if (el('d-total-sales')) {
            el('d-total-sales').textContent = this.formatCompact(data.sales_today);
            el('d-total-sales').classList.remove('animate-pulse');
        }

        if (el('d-total-orders')) {
            el('d-total-orders').textContent = data.orders_today;
            el('d-total-orders').classList.remove('animate-pulse');
        }

        if (el('d-sales-growth')) {
            const percent = parseFloat(data.growth_percent);
            const isPositive = percent >= 0;
            const symbol = isPositive ? '▲' : '▼';
            const colorClass = isPositive ? 'text-warkops-success' : 'text-red-500';
            
            el('d-sales-growth').className = `font-bold ${colorClass}`;
            el('d-sales-growth').textContent = `${symbol} ${Math.abs(percent)}%`;
        }
    },

    generateChart(chartData) {
        const container = document.getElementById('d-chart-container');
        if (!container) return;
        
        container.innerHTML = '';

        if (!chartData || chartData.length === 0) {
            container.innerHTML = '<div class="text-xs text-white self-center">No Data</div>';
            return;
        }

        const maxVal = Math.max(...chartData.map(d => parseFloat(d.daily_total))) || 1;

        chartData.forEach(day => {
            const val = parseFloat(day.daily_total);
            const heightPercent = (val / maxVal) * 100;
            
            const bar = document.createElement('div');
            
            // Styling bar chart dengan Tailwind
            bar.className = `
                w-full 
                bg-warkops-primary/40 
                hover:bg-warkops-primary 
                border-t border-white/20 
                relative group 
                cursor-pointer 
                transition-all duration-500 ease-out
                rounded-t-sm
            `;
            
            // Set tinggi minimal 5% agar bar tetap terlihat walau nilai kecil
            bar.style.height = `${Math.max(heightPercent, 5)}%`;

            const dateLabel = new Date(day.date).toLocaleDateString('id-ID', { weekday: 'short' });
            
            // Tooltip saat hover
            bar.innerHTML = `
                <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 
                            opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                    <div class="bg-black border border-white/20 text-white text-[10px] px-2 py-1 font-mono whitespace-nowrap shadow-lg">
                        <div class="font-bold text-warkops-primary">${dateLabel}</div>
                        <div>${this.formatFull(val)}</div>
                    </div>
                </div>
            `;

            container.appendChild(bar);
        });
    },

    generatePopularList(items) {
        const container = document.getElementById('d-popular-list');
        if (!container) return;
        
        container.innerHTML = '';

        if (!items || items.length === 0) {
            container.innerHTML = '<div class="text-xs text-warkops-muted italic text-center py-4">Belum ada transaksi hari ini.</div>';
            return;
        }

        items.forEach((item, index) => {
            const rankIcon = index === 0 ? '👑' : '⭐';
            const rankColor = index === 0 ? 'text-yellow-400' : 'text-warkops-muted';
            const borderClass = index === items.length - 1 ? '' : 'border-b border-white/5';

            const itemHTML = `
                <div class="flex items-center gap-3 pb-3 ${borderClass} group cursor-default">
                    <div class="w-8 h-8 bg-white/5 flex items-center justify-center text-sm border border-white/10 rounded-sm ${rankColor}">
                        ${rankIcon}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold text-white truncate group-hover:text-warkops-primary transition-colors">
                            ${item.name}
                        </div>
                        <div class="text-[10px] text-warkops-muted font-mono">
                            <span class="text-white font-bold">${item.sold_qty}</span> terjual hari ini
                        </div>
                    </div>
                </div>
            `;
            
            container.insertAdjacentHTML('beforeend', itemHTML);
        });
    },

    // --- Formatters ---
    
    formatCompact(number) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            notation: "compact",
            compactDisplay: "short",
            maximumFractionDigits: 1
        }).format(number);
    },

    formatFull(number) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(number);
    }
};