-- Buat database
CREATE DATABASE warkops_db;
USE warkops;

-- ----------------------------------------
-- 1. USERS (admin & kasir)
-- ----------------------------------------
CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role ENUM('admin','kasir') NOT NULL DEFAULT 'kasir',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------
-- 2. CATEGORIES (kategori menu)
-- ----------------------------------------
CREATE TABLE categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------
-- 3. MENU (produk yang dijual)
-- ----------------------------------------
CREATE TABLE menu (
  menu_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_menu_name ON menu(name);

-- ----------------------------------------
-- 4. INGREDIENTS (bahan baku)
-- ----------------------------------------
CREATE TABLE ingredients (
  ingredient_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  unit VARCHAR(50) NOT NULL,        -- misal: gram, ml, pack
  stock_qty DECIMAL(12,3) NOT NULL DEFAULT 0,  -- jumlah yang tersisa
  low_stock_threshold DECIMAL(12,3) DEFAULT NULL, -- untuk notifikasi
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_ingredient_name ON ingredients(name);

-- ----------------------------------------
-- 5. MENU_RECIPES (bill of materials)
-- ----------------------------------------
CREATE TABLE menu_recipes (
  recipe_id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  qty_used DECIMAL(12,3) NOT NULL, -- jumlah bahan yang dipakai per 1 porsi/menu
  unit VARCHAR(50) NULL,
  FOREIGN KEY (menu_id) REFERENCES menu(menu_id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
  UNIQUE KEY ux_menu_ingredient (menu_id, ingredient_id)
) ENGINE=InnoDB;

-- ----------------------------------------
-- 6. TRANSACTIONS (header)
-- ----------------------------------------
CREATE TABLE transactions (
  trx_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,                  -- kasir yang membuat struk
  table_no VARCHAR(50) NULL,             -- optional: meja atau 'takeaway'
  datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  subtotal DECIMAL(14,2) NOT NULL,       -- total sebelum diskon/pajak
  discount_amount DECIMAL(14,2) DEFAULT 0,
  tax_amount DECIMAL(14,2) DEFAULT 0,
  total DECIMAL(14,2) NOT NULL,          -- jumlah yang harus dibayar
  payment DECIMAL(14,2) DEFAULT 0,       -- yg dibayarkan customer
  change_amount DECIMAL(14,2) DEFAULT 0, -- kembalian
  note TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_transactions_datetime ON transactions(datetime);
CREATE INDEX idx_transactions_user ON transactions(user_id);

-- ----------------------------------------
-- 7. TRANSACTION_ITEMS (detail baris barang)
-- ----------------------------------------
CREATE TABLE transaction_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  trx_id INT NOT NULL,
  menu_id INT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  price_at_time DECIMAL(12,2) NOT NULL,  -- harga per unit pada saat transaksi
  line_total DECIMAL(14,2) NOT NULL,     -- qty * price_at_time (stored for speed)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trx_id) REFERENCES transactions(trx_id) ON DELETE CASCADE,
  FOREIGN KEY (menu_id) REFERENCES menu(menu_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_transaction_items_trx ON transaction_items(trx_id);
CREATE INDEX idx_transaction_items_menu ON transaction_items(menu_id);

-- ----------------------------------------
-- 8. INVENTORY_LOGS (catatan perubahan stok bahan)
-- ----------------------------------------
CREATE TABLE inventory_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  ingredient_id INT NOT NULL,
  change_qty DECIMAL(12,3) NOT NULL,    -- positif = masuk / restock, negatif = pemakaian
  reason ENUM('used','restock','correction','purchase','adjustment') NOT NULL,
  related_trx_id INT NULL,               -- jika perubahan terkait transaksi
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
  FOREIGN KEY (related_trx_id) REFERENCES transactions(trx_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_inventory_logs_ingredient ON inventory_logs(ingredient_id);
CREATE INDEX idx_inventory_logs_date ON inventory_logs(created_at);