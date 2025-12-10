// src/js/router.js

/**
 * src/js/router.js
 * Core Navigation Logic untuk WarkOps (Single Page Application)
 * Menangani loading view, script controller, dan security role.
 */

// Konfigurasi Route Mapping
const routes = {
    'home': { 
        view: 'views/home.html', 
        title: 'DASHBOARD OVERVIEW'
    },
    'pos': { 
        view: 'views/pos.html', 
        title: 'POINT OF SALES TERMINAL'
    },
    'inventory': { 
        view: 'views/inventory.html', 
        title: 'INVENTORY MANAGEMENT',
        // Definisikan script & controller yang dipakai
        script: 'js/controllers/inventory.js',
        controller: 'InventoryController'
    },
    'reports': { 
        view: 'views/reports.html', 
        title: 'ANALYTICS & REPORTS'
    },
    'users': { 
        view: 'views/users.html', 
        title: 'OPERATOR ACCESS CONTROL',
        allowedRoles: ['admin'],
        // Definisikan script & controller yang dipakai
        script: 'js/controllers/users.js',
        controller: 'UsersController'
    }
};

const controllerScripts = {
    inventory: 'js/controllers/inventory.js',
    reports: 'js/controllers/reports.js',
    users: 'js/controllers/users.js'
};

const controllerInits = {
    inventory: () => window.InventoryController && typeof window.InventoryController.init === 'function' && window.InventoryController.init(),
    reports: () => window.ReportsController && typeof window.ReportsController.init === 'function' && window.ReportsController.init()
};

async function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Cek jika script sudah ada
        const old = document.querySelector(`script[src="${src}"]`);
        if (old) old.remove(); 

        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

/**
 * Fungsi Utama: Load konten berdasarkan Hash URL
 */
async function loadContent() {
    let hash = window.location.hash.substring(1);

    if (!hash) {
        hash = 'home';
        window.location.hash = '#home';
    }

    const route = routes[hash];
    const contentDiv = document.getElementById('content');

    // 1. Cek Route
    if (!route) {
        renderError(contentDiv, '404', 'MODULE NOT FOUND');
        return;
    }

    // 2. Security Check (Role Guard)
    const currentUser = Auth.getUser();
    if (route.allowedRoles && currentUser) {
        if (!route.allowedRoles.includes(currentUser.role)) {
            renderAccessDenied(contentDiv);
            return;
        }
    }

    // 3. Update UI
    document.getElementById('page-title').innerText = route.title;
    updateSidebar(hash);

    // 4. Fetch Content HTML
    try {
        // Loading State
        contentDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full gap-4">
                <div class="w-12 h-12 border-4 border-warkops-primary/30 border-t-warkops-primary rounded-full animate-spin"></div>
                <div class="font-mono text-xs text-warkops-muted animate-pulse">LOADING MODULE::${hash.toUpperCase()}...</div>
            </div>
        `;

        const response = await fetch(route.view);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const html = await response.text();
        contentDiv.innerHTML = html;

        // 5. Load & Init Controller (LOGIC BARU)
        if (route.script) {
            await loadScript(route.script);
            
            // Cek apakah controller terdaftar di window (Global Object) dan punya fungsi init()
            if (route.controller && window[route.controller] && typeof window[route.controller].init === 'function') {
                console.log(`Initializing ${route.controller}...`);
                window[route.controller].init();
            }
        }

        if (controllerInits[hash]) {
            controllerInits[hash]();
        }

    } catch (error) {
        console.error("Router Error:", error);
        renderError(contentDiv, 'SYSTEM ERROR', error.message);
    }
}

// --- Helper Functions ---

function renderAccessDenied(container) {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center p-6 relative overflow-hidden">
            <div class="absolute inset-0 bg-red-500/5 z-0 pointer-events-none"></div>
            <div class="relative z-10 border-2 border-red-500/50 p-10 bg-black/80 backdrop-blur-sm max-w-lg">
                <h1 class="text-5xl font-display font-black text-red-500 mb-2">ACCESS DENIED</h1>
                <p class="font-mono text-white text-sm mb-6">SECURITY CLEARANCE INSUFFICIENT</p>
                <button onclick="window.location.hash='#home'" class="bg-red-500 hover:bg-red-600 text-black font-bold py-3 px-8 font-mono text-xs uppercase transition-all">Return to Dashboard</button>
            </div>
        </div>
    `;
}

function renderError(container, title, message) {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-warkops-secondary">
            <h1 class="text-4xl font-display font-bold">${title}</h1>
            <p class="font-mono text-sm uppercase mt-2">${message}</p>
        </div>
    `;
}

function updateSidebar(hash) {
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === `#${hash}`) {
            link.classList.add('nav-active');
            const icon = link.querySelector('svg');
            if(icon) icon.classList.add('text-warkops-primary');
        } else {
            link.classList.remove('nav-active');
            const icon = link.querySelector('svg');
            if(icon) icon.classList.remove('text-warkops-primary');
        }
    });
}

window.addEventListener('hashchange', loadContent);
window.addEventListener('DOMContentLoaded', loadContent);