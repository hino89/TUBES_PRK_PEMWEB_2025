// src/js/router.js

/**
 * src/js/router.js
 * Core Navigation Logic untuk WarkOps (Single Page Application)
 * Menangani loading view tanpa refresh halaman.
 */

// Konfigurasi Route Mapping
const routes = {
    'home': { 
        view: 'views/home.html', 
        title: 'DASHBOARD OVERVIEW',
        init: null // Nanti diisi function jika butuh load chart data
    },
    'pos': { 
        view: 'views/pos.html', 
        title: 'POINT OF SALES TERMINAL',
        init: null 
    },
    'inventory': { 
        view: 'views/inventory.html', 
        title: 'INVENTORY MANAGEMENT',
        init: null
    },
    'reports': { 
        view: 'views/reports.html', 
        title: 'ANALYTICS & REPORTS',
        init: null
    },
    'users': { 
        view: 'views/users.html', 
        title: 'OPERATOR ACCESS CONTROL', // Judul halaman yang lebih "Tech"
        init: null // Nanti diisi function loadUsers() dari users.js
    }
};

/**
 * Fungsi Utama: Load konten berdasarkan Hash URL
 */
async function loadContent() {
    // 1. Ambil hash (contoh: #pos), hilangkan tanda #
    let hash = window.location.hash.substring(1);

    // 2. Default ke 'home' jika kosong
    if (!hash) {
        hash = 'home';
        window.location.hash = '#home'; // Update URL biar konsisten
    }

    // 3. Cek apakah route valid
    const route = routes[hash];
    const contentDiv = document.getElementById('content');

    if (!route) {
        contentDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-warkops-secondary">
                <h1 class="text-4xl font-display font-bold">404</h1>
                <p class="font-mono text-sm">MODULE NOT FOUND</p>
            </div>
        `;
        return;
    }

    // 4. Update Judul Halaman (Top Bar)
    document.getElementById('page-title').innerText = route.title;

    // 5. Update Sidebar Active State
    updateSidebar(hash);

    // 6. Fetch Content HTML
    try {
        // Tampilkan Loading Indicator Retro
        contentDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full gap-4">
                <div class="w-12 h-12 border-4 border-warkops-primary/30 border-t-warkops-primary rounded-full animate-spin"></div>
                <div class="font-mono text-xs text-warkops-muted animate-pulse">LOADING MODULE::${hash.toUpperCase()}...</div>
            </div>
        `;

        // Simulasi delay sedikit biar kerasa "loading data" (Optional, bisa dihapus)
        // await new Promise(r => setTimeout(r, 300)); 

        const response = await fetch(route.view);
        
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const html = await response.text();
        
        // 7. Inject HTML ke Dashboard
        contentDiv.innerHTML = html;

        // 8. Jalankan Script Init Khusus (jika ada)
        // Contoh: Load data tabel inventory setelah HTML masuk
        if (typeof route.init === 'function') {
            route.init();
        }

    } catch (error) {
        console.error("Router Error:", error);
        contentDiv.innerHTML = `
            <div class="p-8 border border-red-500/50 bg-red-500/10 text-red-500 font-mono text-sm">
                <h3 class="font-bold">SYSTEM ERROR</h3>
                <p>Failed to load module: ${route.view}</p>
                <p class="text-xs mt-2 opacity-70">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Helper: Update tampilan Sidebar agar menu yang aktif menyala
 */
function updateSidebar(hash) {
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        // Ambil href (misal: #pos)
        const href = link.getAttribute('href');
        
        if (href === `#${hash}`) {
            // Tambah class aktif (sesuai style dashboard.html)
            link.classList.add('nav-active');
            
            // Opsional: Tambah efek glow pada icon
            const icon = link.querySelector('svg');
            if(icon) icon.classList.add('text-warkops-primary');
        } else {
            // Hapus class aktif
            link.classList.remove('nav-active');
            
            const icon = link.querySelector('svg');
            if(icon) icon.classList.remove('text-warkops-primary');
        }
    });
}

// === Event Listeners ===

// 1. Saat URL Hash berubah (User klik menu)
window.addEventListener('hashchange', loadContent);

// 2. Saat halaman pertama kali dibuka (Fresh Load)
window.addEventListener('DOMContentLoaded', loadContent);