/**
 * src/js/controllers/auth.js
 * Controller untuk menangani Autentikasi (Login/Logout/Session)
 * Berkomunikasi dengan api/auth.php
 */

const Auth = {
    // Base URL untuk API (Relative path dari root src/)
    endpoint: 'api/auth.php',

    /**
     * Proses Login ke Server
     * @param {string} username 
     * @param {string} password 
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

            // Jika sukses, simpan data user ke LocalStorage (Seperti ID Card digital)
            this.setSession(result.user_data);
            
            return { success: true };

        } catch (error) {
            console.error("Auth Error:", error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Proses Logout
     * Hapus sesi dan tendang ke halaman login
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
        return JSON.parse(session).user;
    },

    /**
     * Cek apakah user sudah login (Auth Guard)
     * Dipasang di Dashboard agar tidak bisa ditembus tanpa login
     */
    requireAuth() {
        const user = this.getUser();
        if (!user) {
            // Jika tidak ada sesi, tendang ke login
            window.location.href = 'index.html';
            return false;
        }
        return user;
    },

    /**
     * Cek apakah user sudah login (Guest Guard)
     * Dipasang di Halaman Login agar tidak perlu login ulang jika belum logout
     */
    requireGuest() {
        const user = this.getUser();
        if (user) {
            // Jika sudah login, langsung lempar ke dashboard
            window.location.href = 'dashboard.html';
        }
    }
};