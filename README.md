# API Documentation for IzinSakit

## Deskripsi
IzinSakit adalah platform inovatif yang memungkinkan pengguna untuk membuat surat sakit dengan bantuan dokter AI. API ini dirancang untuk memudahkan integrasi layanan pembuatan surat sakit secara otomatis, memberikan kemudahan bagi pengguna dalam mendapatkan dokumen medis yang diperlukan.

## ⚠️ Catatan Penting ⚠️

Repositori ini akan terus saya kembangkan dan diperbarui secara aktif karena saya berencana mengikutkannya dalam sebuah kompetisi. Oleh karena itu, akan ada banyak _commit_ baru seiring dengan penambahan fitur-fitur dan perbaikan yang saya lakukan. Harap maklum jika terkadang terdapat perubahan yang signifikan. Terima kasih atas perhatian dan dukungannya! 🚀

## Table of Contents
- [Endpoint](#endpoints)
- [Authentication](#authentication)
- [Headers](#headers)
- [Example Responses](#example-responses)
- [Example cURL Request](#example-curl-requests)
- [Tutorial: Memperoleh Kunci API dari Server](#tutorial-memperoleh-kunci-api-dari-server)
- [Download Postman Collection](#download-postman-collection)

## Links

- 🔗 [Website Izinsakit.site](https://izinsakit.site)
- 🔗 [Dokumen Laporan](https://docs.google.com/document/d/1XuFovfNNBqS9Ja4nXLOWUkVcSbJnZ2Vn7DyrC8GEoE4/edit?usp=sharing)a
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

## Download Postman Collection

Anda dapat mengunduh file Postman collection untuk menguji API ini [di sini](https://drive.google.com/drive/folders/1HSUNRoevs4mqytVKf4-qjvJMxe_v3tB_?usp=sharing).

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
- **Request Body**:
  - `fullName`: String (required)
  - `position`: String (required)
  - `institution`: String (required)
  - `startDate`: String (required, ISO Date format)
  - `sickReason`: String (required)
  - `otherReason`: String (optional)
  - `gender`: String (required, "male" or "female")
  - `age`: Number (required)
  - `contactEmail`: String (required, valid email format)
  - `phoneNumber`: String (required)

### 9. Save Answers to Sick Leave Form
- **Method**: POST
- **Path**: /api/save-answers
- **Description**: Menyimpan jawaban untuk formulir izin sakit.
- **Request Body**:
  - `formId`: String (required)
  - `answers`: Array of objects (required)
    - `questionId`: String (required)
    - `answer`: String (required)

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
- **Request Body**:
  - `email`: String (required, valid email format)

### 16. Check Email Status
- **Method**: GET
- **Path**: /api/email-status/{jobId}
- **Description**: Memeriksa status pengiriman email berdasarkan job ID.

### 17. Generate PDF and Image
- **Method**: GET
- **Path**: /generate-pdf-and-image/{formId}
- **Description**: Menghasilkan PDF dan gambar untuk izin sakit berdasarkan ID formulir.

### 18. Download Image
- **Method**: GET
- **Path**: /download/image/{formId}
- **Description**: Mengunduh gambar izin sakit berdasarkan ID formulir.

### 19. Download PDF
- **Method**: GET
- **Path**: /download/pdf/{formId}
- **Description**: Mengunduh PDF izin sakit berdasarkan ID formulir.

### 20. Generate API Key
- **Method**: POST
- **Path**: /api/keys/generate
- **Description**: Menghasilkan kunci API baru.
- **Request Body**:
  - `description`: String (required)

### 21. Create Coworking Reservation
- **Method**: POST
- **Path**: /api/coworking/reservations
- **Description**: Membuat reservasi coworking dan mengintegrasikannya dengan data cuti sakit.
- **Request Body**:
  - `seat_number`: String (required)
  - `reservation_date`: String (required, ISO Date format)
  - `sickLeaveId`: String (required)

## Headers

| Header Name     | Required | Description                      |
|------------------|----------|----------------------------------|
| Content-Type     | Yes      | application/json                 |
| Authorization    | Optional | Bearer {token} (untuk frontend)  |
| x-api-key        | Optional | API Key (untuk integrasi service)|

### Catatan:
- **Authorization (Bearer Token)**: Token JWT yang digunakan untuk autentikasi pengguna. Token ini akan kadaluarsa dalam 1 hari dan hanya ditujukan untuk frontend website IzinSakit.
- **x-api-key**: API Key yang digunakan untuk integrasi dengan service lain. API Key ini tidak memiliki batas waktu kadaluarsa.
- Maksud opsional di sini adalah pilih salah satu, bukan boleh pakai atau tidak. 

## Authentication
API ini mendukung dua jenis autentikasi:
1. **Bearer Token (JWT)**: Digunakan untuk frontend website IzinSakit. Token ini akan kadaluarsa dalam 1 hari.
2. **API Key**: Digunakan untuk integrasi dengan service lain. API Key dapat dihasilkan melalui endpoint `/api/keys/generate`.

## Error Handling 
API ini akan mengembalikan kode kesalahan berikut jika terjadi masalah:
* `400 Bad Request`: Permintaan tidak valid.
* `401 Unauthorized`: Token akses tidak valid atau tidak ada.
* `404 Not Found`: Resource tidak ditemukan.
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
    "error": "Bad Request",
    "message": "Username sudah terdaftar"
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
    "message": "Sick leave form submitted successfully",
    "questions": [
        {
            "id": "q1",
            "text": "Kapan pertama kali Anda mengalami gejala?",
            "type": "open-ended"
        }
    ],
    "formId": "FORM_ID",
    "sickLeave": {
        "_id": "SICK_LEAVE_ID",
        "userId": "USER_ID",
        "username": "John Doe",
        "fullName": "John Doe",
        "position": "Software Engineer",
        "institution": "Example Corp",
        "date": "2023-10-01T00:00:00.000Z",
        "reason": "Flu",
        "otherReason": "",
        "gender": "male",
        "age": 30,
        "contactEmail": "john.doe@example.com",
        "phoneNumber": "1234567890",
        "status": "Diajukan"
    }
}
```

#### Error Response (400 Bad Request)
```
{
    "statusCode": 400,
    "error": "Bad Request",
    "message": "Missing required fields: fullName, position, institution"
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

#### Request Body
```
{
  "seat_number": "string",
  "reservation_date": "string (ISO Date)",
  "sickLeaveId": "string"
}
```

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

6. Klik `Kirim.`

### Respons Hasilkan Kunci API
Anda akan menerima respons JSON dengan kunci API yang dihasilkan:
```
{
  "key": "GENERATED_API_KEY"
}
```
Simpan kunci API ini untuk digunakan dalam permintaan berikutnya.
