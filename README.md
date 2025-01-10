# API Documentation for IzinSakit

## Deskripsi
IzinSakit adalah platform inovatif yang memungkinkan pengguna untuk membuat surat sakit dengan bantuan dokter AI. API ini dirancang untuk memudahkan integrasi layanan pembuatan surat sakit secara otomatis, memberikan kemudahan bagi pengguna dalam mendapatkan dokumen medis yang diperlukan.

## Table of Contents
- [Endpoint](#endpoints)
- [Authentication](#authentication)
- [Headers](#headers)
- [Request Body](#request-body)
- [Example Response](#example-response)
- [Example cURL Request](#Example-cURL-Requests)

## Links

- 🔗 [Website Izinsakit.site](https://izinsakit.site)
- 🔗 [Dokumen Laporan](https://docs.google.com/document/d/1XuFovfNNBqS9Ja4nXLOWUkVcSbJnZ2Vn7DyrC8GEoE4/edit?usp=sharing)
- 🔗 [Repo Frontend](https://github.com/aththariq/izin-sakit-fe.git)
- 🔗 [Backend Link api.izinsakit.site](https:/api.izinsakit.site)

## Checklist

| Status | Task |
|--------|------|
| :white_check_mark: | Dokumentasi Github |
| :white_check_mark: | Connect ke Service Teman |
| :white_check_mark: | HTTPS |
| :white_check_mark:| Personal Domain |
| :white_check_mark: | Utilize Docker |
| :white_check_mark: | Oauth + JWT |
| :white_check_mark: | JavaScript + React + Hapi |
| :white_check_mark: | PDF to IMG Converter Using ImageMagick and GhostScript |
| :white_check_mark: | Personal VPS Deployment |
| :white_check_mark: | Utilize AI: Google Gemini Flash Experiment|
| Soon | Utilize Machine Learning for prescription understanding|


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

## Headers

| Header Name     | Required | Description                      |
|------------------|----------|----------------------------------|
| Content-Type     | Yes      | application/json                 |
| Authorization    | Yes      | Bearer {token}                  |

## Authentication
API ini menggunakan token Bearer untuk autentikasi. Pastikan Anda memiliki token akses yang valid sebelum melakukan request.

## Error Handling 
API ini akan mengembalikan kode kesalahan berikut jika terjadi masalah:
* `400 Bad Request`: Permintaan tidak valid.
* `401 Unauthorized`: Token akses tidak valid atau tidak ada.
* `404 Not Found`: Endpoint tidak ditemukan.
* `500 Internal Server Error`: Terjadi kesalahan di server.

## Example Responses

### User Registration Response

#### Success Response (201 Created)
```
{
    "message": "User registered successfully"
}
```

#### Error Response (400 Bad Request)
```
{
    "message": "Username already exists"
}
```
### User Login Response

#### Success Response (200 OK)
```
{
    "message": "Login berhasil",
    "token": "YOUR_JWT_TOKEN"
}
```
#### Error Response (400 Bad Request)
```
{
    "message": "Email tidak terdaftar"
}
```
### Create Sick Leave Response

#### Success Response (201 Created)
```
{
    "message": "Sick leave created",
    "data": {
        "_id": "SICK_LEAVE_ID",
        "username": "John Doe",
        "reason": "Flu"
    }
}
```
#### Error Response (400 Bad Request)
```
{
    "message": "Invalid input data"
}
```
### Get Sick Leave by ID Response

#### Success Response (200 OK)
```
{
    "_id": "SICK_LEAVE_ID",
    "username": "John Doe",
    "reason": "Flu",
    "date": "2025-01-10T00:00:00Z"
}
```
#### Error Response (404 Not Found)
```
{
    "message": "No sick leave found"
}
```
### Send PDF via Email Response

#### Success Response (202 Accepted)
```
{
    "status": "queued",
    "jobId": "JOB_ID",
    "message": "Email sedang dalam proses pengiriman"
}
```
#### Error Response (400 Bad Request)
```
{
    "status": "error",
    "message": "PDF belum digenerate, silakan generate terlebih dahulu"
}
```
## Example cURL Requests

### User Registration
```
curl -X POST 'https://api.izinsakit.com/register' \
-H 'Content-Type: application/json' \
-d '{
    "username": "PrabowoGibs",
    "email": "Ganjar@Pran.com",
    "password": "password123"
}'
```
### User Login
```
curl -X POST 'https://api.izinsakit.com/login' \
-H 'Content-Type: application/json' \
-d '{
    "email": "john@example.com",
    "password": "password123"
}'
```
### Create Sick Leave
```
curl -X POST 'https://api.izinsakit.com/sick-leave' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
-d '{
    "username": "JohnDoe",
    "reason": "Flu"
}'
```
### Get Sick Leave by ID
```
curl -X GET 'https://api.izinsakit.com/sick-leave/SICK_LEAVE_ID' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```
### Send PDF via Email
```
curl -X POST 'https://api.izinsakit.com/api/send-pdf/SICK_LEAVE_ID' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
-d '{
    "email": "recipient@example.com"
}'
```

## Dokumentasi Endpoint Terintegrasi dengan Teman

### POST /api/coworking/reservations
Endpoint ini digunakan untuk membuat reservasi coworking dan mengintegrasikannya dengan data cuti sakit. API ini saya hubungkan dengan service teman saya, Firsa Athaya.

Request Body
```
{
  "seat_number": "string",
  "reservation_date": "string (ISO Date)",
  "sickLeaveId": "string"
}
````


# Tutorial: Memperoleh Kunci API dari Server

### Langkah 1: Peroleh Token JWT
Untuk menghasilkan kunci API, Anda harus terlebih dahulu memperoleh token JWT dengan masuk.

#### Permintaan Masuk
1. Buka Postman dan buat permintaan baru.

2. Atur metode HTTP menjadi `POST` dan masukkan URL: `https://api.izinsakit.site/login.`

3. Pilih tab `Body`, pilih `raw`, dan setel jenis konten menjadi `JSON`.

4. Masukkan data berikut:
```
{
  "email": "tesapi@izinsakit.com",
  "password": "12345678"
}
```

5. Klik `Kirim`.


### Respons Masuk
Anda akan menerima respons JSON yang berisi `token`:
```
{
  "message": "Masuk berhasil",
  "token": "YOUR_JWT_TOKEN"
}
```
Simpan token ini untuk digunakan dalam permintaan selanjutnya.

### Langkah 2: Hasilkan Kunci API

Dengan token JWT, hasilkan kunci API dengan mengirimkan permintaan POST ke `endpoint /api/keys/generate.`

1. Buat permintaan baru di Postman.

2. Atur metode HTTP menjadi `POST` dan masukkan URL: `https://api.izinsakit.site/api/keys/generate.`

3. Tambahkan header Authorization dengan nilai: `Bearer YOUR_JWT_TOKEN`.

4. Pilih tab `Body`, pilih `raw`, dan setel jenis konten menjadi `JSON`.

5. Masukkan data berikut: 
```
{
  "description": "Kunci API Uji Coba"
}
```

6.Klik `Kirim.`

### Respons Hasilkan Kunci API
Anda akan menerima respons JSON dengan kunci API yang dihasilkan:
```
{
  "key": "GENERATED_API_KEY"
}
```
Simpan kunci API ini untuk digunakan dalam permintaan berikutnya.
