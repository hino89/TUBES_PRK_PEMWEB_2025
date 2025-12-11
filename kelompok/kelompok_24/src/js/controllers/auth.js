/**
 * src/js/controllers/auth.js
 * Controller untuk menangani Autentikasi (Login/Logout/Session)
 * FIX: Menggunakan window.Auth agar bisa diakses global oleh modul lain (POS/Inventory)
 */

window.Auth = {
    // Base URL untuk API
    endpoint: 'api/auth.php',

    /**
     * Proses Login ke Server
     */
    async login(username, password) {
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Login gagal.');
            }

            // Simpan sesi
            this.setSession(result.user_data);
            
            return { success: true };

        } catch (error) {
            console.error("Auth Error:", error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Proses Logout
     */
    logout() {
        localStorage.removeItem('warkops_session');
        window.location.href = 'index.html';
    },

    /**
     * Simpan data sesi
     */
    setSession(userData) {
        const sessionData = {
            user: userData,
            loginTime: new Date().getTime()
        };
        localStorage.setItem('warkops_session', JSON.stringify(sessionData));
    },

    /**
     * Ambil data user yang sedang login
     */
    getUser() {
        const session = localStorage.getItem('warkops_session');
        if (!session) return null;
        try {
            return JSON.parse(session).user;
        } catch (e) {
            return null;
        }
    },

    /**
     * Auth Guard (Untuk Dashboard)
     */
    requireAuth() {
        const user = this.getUser();
        if (!user) {
            window.location.href = 'index.html';
            return false;
        }
        return user;
    },

    /**
     * Guest Guard (Untuk Login Page)
     */
    requireGuest() {
        const user = this.getUser();
        if (user) {
            window.location.href = 'dashboard.html';
        }
    }
};