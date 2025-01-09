# API Documentation for IzinSakit

## Deskripsi
IzinSakit adalah platform inovatif yang memungkinkan pengguna untuk membuat surat sakit dengan bantuan dokter AI. API ini dirancang untuk memudahkan integrasi layanan pembuatan surat sakit secara otomatis, memberikan kemudahan bagi pengguna dalam mendapatkan dokumen medis yang diperlukan.

## Table of Contents
- [Endpoint](#endpoint)
- [Authentication](#authentication)
- [Headers](#headers)
- [Request Body](#request-body)
- [Example Response](#example-response)
- [Example cURL Request](#example-curl-request)

## Endpoints

### 1. Welcome Endpoint
- **Method**: GET
- **Path**: /
- **Description**: Menampilkan pesan selamat datang.

### 2. User Registration
- **Method**: POST
- **Path**: /register
- **Description**: Mendaftarkan pengguna baru.
- **Request Body**:
  - `username`: String (required, 3-30 characters)
  - `email`: String (required, valid email format)
  - `password`: String (required, minimum 8 characters)

### 3. User Login
- **Method**: POST
- **Path**: /login
- **Description**: Mengautentikasi pengguna dan mengembalikan token JWT.
- **Request Body**:
  - `email`: String (required, valid email format)
  - `password`: String (required)

### 4. Create Sick Leave
- **Method**: POST
- **Path**: /sick-leave
- **Description**: Membuat permohonan izin sakit baru.
- **Request Body**:
  - `username`: String (required)
  - `reason`: String (required, minimum 5 characters)

### 5. Get Sick Leave by ID
- **Method**: GET
- **Path**: /sick-leave/{id}
- **Description**: Mengambil detail permohonan izin sakit berdasarkan ID.

### 6. Google OAuth Redirect
- **Method**: GET
- **Path**: /auth/google
- **Description**: Mengarahkan pengguna ke halaman login Google.

### 7. Google OAuth Callback
- **Method**: GET
- **Path**: /auth/google/callback
- **Description**: Menangani callback dari Google setelah autentikasi.

### 8. Create Sick Leave Form
- **Method**: POST
- **Path**: /api/sick-leave-form
- **Description**: Menerima pengajuan formulir izin sakit.
  
### 9. Save Answers to Sick Leave Form
- **Method**: POST
- **Path**: /api/save-answers
- **Description**: Menyimpan jawaban untuk formulir izin sakit.
  
### 10. Generate PDF for Sick Leave
- **Method**: GET
- **Path**: /api/generate-pdf/{id}
- **Description**: Menghasilkan PDF untuk izin sakit berdasarkan ID.
  
### 11. Convert PDF to Image
- **Method**: GET
- **Path**: /api/convert-pdf-to-image/{id}
- **Description**: Mengonversi PDF izin sakit menjadi gambar.

### 12. Get All Sick Leaves
- **Method**: GET
- **Path**: /api/sick-leaves
- **Description**: Mengambil semua permohonan izin sakit.

### 13. Get Dashboard Sick Leaves
- **Method**: GET
- **Path**: /api/dashboard/sick-leaves
- **Description**: Mengambil data izin sakit untuk dashboard.

### 14. Get User's Sick Leaves
- **Method**: GET
- **Path**: /api/user/sick-leaves
- **Description**: Mengambil semua permohonan izin sakit pengguna.

### 15. Send PDF via Email
- **Method**: POST
- **Path**: /api/send-pdf/{id}
- **Description**: Mengirim PDF yang dihasilkan melalui email.
  
### 16. Check Email Status
- **Method**: GET
- **Path**: /api/email-status/{jobId}
- **Description**: Memeriksa status pengiriman email berdasarkan job ID.

## Authentication
API ini menggunakan token Bearer untuk autentikasi. Pastikan Anda memiliki token akses yang valid sebelum melakukan request.

## Error Handling 
API ini akan mengembalikan kode kesalahan berikut jika terjadi masalah:
* `400 Bad Request`: Permintaan tidak valid.
* `401 Unauthorized`: Token akses tidak valid atau tidak ada.
* `404 Not Found`: Endpoint tidak ditemukan.
* `500 Internal Server Error`: Terjadi kesalahan di server.
