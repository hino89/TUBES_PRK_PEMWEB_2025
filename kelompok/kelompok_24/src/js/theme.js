/**
 * src/js/theme.js
 * Konfigurasi Tema WarkOps (Arknights/Retro 90s Style)
 * * Load file ini SETELAH script CDN Tailwind di head HTML.
 */

tailwind.config = {
    theme: {
      extend: {
        colors: {
          // WarkOps Color Palette
          // Menggabungkan nuansa 'Dark Industrial' dengan 'Neon Accents'
          warkops: {
            bg: '#0f0f11',        // Almost Black (Background Utama)
            panel: '#18181b',     // Dark Grey (Card Background)
            surface: '#27272a',   // Lighter Grey (Input fields)
            
            // Accents
            primary: '#f43f5e',   // Neon Pink/Red (Momo Theme - Main Action)
            secondary: '#06b6d4', // Cyan (Tech/Data Info)
            accent: '#eab308',    // Industrial Yellow (Warning/Caution)
            success: '#10b981',   // Acid Green (Success state)
            
            // Text
            text: '#e4e4e7',      // White Smoke (Main Text)
            muted: '#71717a',     // Grey (Subtitles/Labels)
            dark: '#000000',      // Pure Black (Text on neon buttons)
          }
        },
        fontFamily: {
          sans: ['Manrope', 'sans-serif'],        // UI Font (Clean, Geometric)
          mono: ['JetBrains Mono', 'monospace'],  // Code/System Font
          display: ['Montserrat', 'sans-serif'],  // Headers (Bold)
        },
        backgroundImage: {
          // Pola Seigaiha (Ombak Jepang) via SVG Data URI (Optimized)
          'seigaiha': `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0c0 11.05 8.95 20 20 20s20-8.95 20-20H0zm20 10c5.52 0 10-4.48 10-10H10c0 5.52 4.48 10 10 10zM0 10c5.52 0 10-4.48 10-10H0c0 5.52 4.48 10 10 10z' fill='%233f3f46' fill-opacity='0.08' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          
          // Pola Dot Matrix (Retro Tech)
          'dots': `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2371717a' fill-opacity='0.15' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
          
          // Garis-garis diagonal (Hazard/Warning zones)
          'stripes': `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(234, 179, 8, 0.1) 10px, rgba(234, 179, 8, 0.1) 20px)`,
        },
        animation: {
            'spin-slow': 'spin 12s linear infinite',
            'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }
      }
    }
  }