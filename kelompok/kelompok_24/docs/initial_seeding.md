# **📦 WarkOps API Payload Guide V2.0**

Panduan ini mencakup **Basic Seeding** (isi data awal) dan **Advanced Operations** (Edit/Hapus Resep) sesuai update terbaru API.

**Base URL:** `http://localhost/TUBES_PRK_PEMWEB_2025/kelompok/kelompok_24/src/api/`

## **🔐 PHASE 0: USER MANAGEMENT (Setup Personil)**

Gunakan ini untuk mendaftarkan Admin dan Kasir. Password akan otomatis di-hash oleh sistem.

**Endpoint:** `POST .../users.php`

### **Request A (Buat Admin Utama)**

{  
    "username": "ADMIN\_01",  
    "password": "admin123",  
    "full\_name": "Doctor Hino",  
    "role": "admin"  
}

### **Request B (Buat Kasir)**

{  
    "username": "KASIR\_01",  
    "password": "kasir123",  
    "full\_name": "Amiya",  
    "role": "kasir"  
}

## **🟢 PHASE 1: DATA MASTER (Wajib Urut)**

### **1\. CATEGORIES (Buat Kategori)**

**Endpoint:** `POST .../categories.php`

{  
    "name": "Minuman",  
    "description": "Aneka kopi dan refresher"  
}

### **2\. INGREDIENTS (Isi Gudang)**

**Endpoint:** `POST .../ingredients.php`

**Bahan A (Kopi):**

{  
    "name": "Beans Arabica",  
    "unit": "gram",  
    "stock\_qty": 5000,  
    "low\_stock\_threshold": 500  
}

**Bahan B (Susu):**

{  
    "name": "Fresh Milk",  
    "unit": "ml",  
    "stock\_qty": 10000,  
    "low\_stock\_threshold": 1000  
}

### **3\. MENU ITEMS (Daftar Menu Jual)**

**Endpoint:** `POST .../items.php`

{  
    "name": "Kopi Susu Momo",  
    "description": "Signature drink with pink foam",  
    "price": 24000,  
    "category\_id": 1,  
    "is\_available": 1  
}

## **🔵 PHASE 2: RACIK RESEP (The Core Logic)**

Disini kita menghubungkan **Menu** dengan **Bahan**. *Asumsi ID: Menu Kopi Susu \= 1, Beans \= 1, Milk \= 2\.*

**Endpoint:** `POST .../recipes.php`

### **Komponen 1: Kopi (18 gram)**

{  
    "menu\_id": 1,  
    "ingredient\_id": 1,  
    "qty\_used": 18,  
    "unit": "gram"  
}

### **Komponen 2: Susu (150 ml)**

{  
    "menu\_id": 1,  
    "ingredient\_id": 2,  
    "qty\_used": 150,  
    "unit": "ml"  
}

## **🔴 PHASE 3: KOREKSI DATA (Fitur Baru\!)**

Ini fitur baru dari `recipes.php` versi *reports-js* yang canggih. Gunakan ini jika Operator salah input resep.

### **Skenario: "Salah Input Takaran Susu"**

Ternyata susunya bukan 150ml, tapi harusnya **200ml**.

#### **Langkah 1: Cari ID Resep dulu**

**Method:** `GET` **URL:** `.../recipes.php?q=Kopi` *Cari data di response JSON, misal ketemu `recipe_id`: 5 untuk komponen Susu.*

#### **Langkah 2: Lakukan Update (PUT)**

**Method:** `PUT` **URL:** `.../recipes.php?id=5` \<-- *PENTING: Pakai ID Resep, bukan ID Menu* **Body (JSON):**

{  
    "qty\_used": 200  
}

*Note: Kamu hanya perlu kirim field yang mau diubah saja. `menu_id` atau `ingredient_id` tidak perlu dikirim kalau tidak berubah.*

### **Skenario: "Hapus Bahan dari Resep"**

Misal menu ini tidak jadi pakai Gula.

**Method:** `DELETE` **URL:** `.../recipes.php?id=5` \<-- *ID Resep komponen Gula*

## **⚡ Quick Test: Inventory View**

Setelah melakukan operasi di atas:

1. Buka Dashboard \> Inventory.  
2. Cek tabel **Blueprint Resep**.  
3. Pastikan angka takaran sudah berubah sesuai yang kamu edit via PUT tadi.

