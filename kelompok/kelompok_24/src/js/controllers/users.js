/**
 * src/js/controllers/users.js
 * Controller untuk Manajemen User (CRUD) - REAL API CONNECTED
 * FIX: Menggunakan window.UsersController agar aman saat reload script di SPA
 */

// GANTI 'const UsersController' MENJADI 'window.UsersController'
window.UsersController = {
    endpoint: 'api/users.php',

    /**
     * Inisialisasi halaman
     */
    init() {
        this.fetchUsers();
    },

    /**
     * Ambil data user dari Database via API
     */
    async fetchUsers() {
        const container = document.getElementById('users-list');
        
        // Safety check: pastikan elemen ada sebelum render
        if (!container) return;

        try {
            const response = await fetch(this.endpoint);
            const result = await response.json();

            if (!result.success) throw new Error(result.message);

            if (result.data.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center text-warkops-muted font-mono py-10 border border-dashed border-white/10">
                        NO DATA FOUND
                    </div>`;
                return;
            }

            // Render Card
            container.innerHTML = result.data.map(user => `
                <div class="bg-warkops-panel border border-white/5 p-5 relative group overflow-hidden hover:border-warkops-secondary/50 transition-all flex flex-col justify-between h-full">
                    
                    <div class="absolute -right-2 -bottom-6 text-8xl font-black text-white/[0.02] pointer-events-none group-hover:text-warkops-secondary/[0.05] transition-colors select-none">
                        ${String(user.user_id).padStart(2, '0')}
                    </div>

                    <div>
                        <div class="flex items-start justify-between mb-4 relative z-10">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white font-mono text-lg rounded-sm group-hover:border-warkops-secondary transition-colors">
                                    ${user.full_name.substring(0,2).toUpperCase()}
                                </div>
                                <div>
                                    <h4 class="font-bold text-white text-base leading-tight tracking-tight">${user.full_name}</h4>
                                    <div class="text-[10px] font-mono ${user.role === 'admin' ? 'text-warkops-accent' : 'text-warkops-muted'} uppercase tracking-wider border border-white/5 inline-block px-1 mt-1">
                                        // ${user.role}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex flex-col items-end gap-1">
                                <div class="w-2 h-2 rounded-full ${user.is_active == 1 ? 'bg-warkops-success shadow-[0_0_8px_#10b981]' : 'bg-red-500'}"></div>
                                <span class="text-[9px] font-mono text-white/30">ACT</span>
                            </div>
                        </div>

                        <div class="space-y-2 font-mono text-[10px] text-warkops-muted border-t border-white/5 pt-3 relative z-10">
                            <div class="flex justify-between items-center group/line hover:text-white transition-colors">
                                <span>OPERATOR_ID</span>
                                <span class="bg-white/5 px-2 py-0.5 rounded text-white group-hover/line:bg-warkops-primary group-hover/line:text-black transition-colors">
                                    ${user.username}
                                </span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span>RECRUITED</span>
                                <span>${user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6 flex gap-2 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                         <button onclick="window.UsersController.deleteUser(${user.user_id})" class="flex-1 py-2 border border-red-500/30 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 text-[10px] font-mono uppercase transition">
                            Deactivate
                        </button>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error(error);
            if(container) container.innerHTML = `<div class="col-span-full text-red-500 font-mono text-center p-4 border border-red-500/20 bg-red-500/5">CONNECTION ERROR: ${error.message}</div>`;
        }
    },

    /**
     * Tambah User Baru
     */
    async addUser(e) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            btn.disabled = true;
            btn.innerText = "PROCESSING...";
            btn.classList.add('opacity-50', 'cursor-not-allowed');

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!result.success) throw new Error(result.message);

            alert("SUCCESS: Operator baru berhasil direkrut.");
            this.toggleModal(false);
            form.reset();
            this.fetchUsers();

        } catch (error) {
            alert("FAILED: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    },

    /**
     * Hapus User
     */
    async deleteUser(id) {
        if(!confirm("WARNING: Apakah Anda yakin ingin menonaktifkan akses operator ini?")) return;

        try {
            const response = await fetch(`${this.endpoint}?id=${id}`, { method: 'DELETE' });
            const result = await response.json();
            
            if (!result.success) throw new Error(result.message);
            
            this.fetchUsers();

        } catch (error) {
            alert("ERROR: " + error.message);
        }
    },

    toggleModal(show) {
        const modal = document.getElementById('user-modal');
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    }
};

// Jalankan init setiap kali script diload
window.UsersController.init();