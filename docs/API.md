# RAAS IN TAAL — API SPECIFICATION & DATA CONTRACTS

This document defines the authoritative request and response schemas, authentication requirements, and error states for all API endpoints in **Raas in Taal**.

---

## 1. Authentication & Session Management

### `GET /api/auth/me`
- **Description:** Returns the current customer session details and their active bookings.
- **Auth:** Optional (reads `customer_session` cookie).
- **Responses:**
  - `200 OK`:
    ```json
    {
      "authenticated": true,
      "customer": {
        "id": "cust_123",
        "name": "Aarav Sharma",
        "email": "aarav@example.com",
        "phone": "9876543210"
      },
      "bookings": [
        {
          "id": "ord_abc123",
          "orderReference": "RIT-2026-X8Y9Z1",
          "categoryCode": "couple",
          "quantity": 1,
          "totalAttendees": 2,
          "amountPaise": 44900,
          "paymentStatus": "PAID",
          "passQrToken": "RIT_abc...xyz",
          "createdAt": "2026-10-10T00:00:00.000Z"
        }
      ]
    }
    ```
  - `401 Unauthorized`: `{ "authenticated": false }`

---

### `POST /api/auth/register`
- **Description:** Creates a new customer account and sets a signed `customer_session` cookie.
- **Rate Limit:** 10 requests / minute / IP.
- **Request Body:**
  ```json
  {
    "name": "string (min 2 chars)",
    "email": "string (valid email)",
    "phone": "string (valid 10-digit phone)",
    "password": "string (min 6 chars, optional)"
  }
  ```
- **Responses:**
  - `200 OK`: `{ "success": true, "customer": { "id": "...", "name": "...", "email": "..." } }`
  - `400 Bad Request`: `{ "error": "Invalid registration details" }`
  - `409 Conflict`: `{ "error": "An account with this email already exists" }`
  - `429 Too Many Requests`: `{ "error": "Rate limit exceeded" }`

---

### `POST /api/auth/login`
- **Description:** Authenticates an existing customer.
- **Rate Limit:** 10 requests / minute / IP.
- **Request Body:**
  ```json
  {
    "email": "string",
    "password": "string (optional for passwordless/simple flow)"
  }
  ```
- **Responses:**
  - `200 OK`: `{ "success": true, "customer": { ... } }`
  - `401 Unauthorized`: `{ "error": "Invalid email or password" }`
  - `429 Too Many Requests`: `{ "error": "Rate limit exceeded" }`

---

### `POST /api/auth/logout`
- **Description:** Clears the `customer_session` cookie.
- **Responses:**
  - `200 OK`: `{ "success": true }`

---

## 2. Orders & Booking Creation

### `POST /api/orders`
- **Description:** Authoritatively creates a ticket order. Validates ticket categories, attendee capacity (max 500), and pricing server-side.
- **Auth:** Required (customer session).
- **Request Body:**
  ```json
  {
    "categoryCode": "stag_girls | couple | group | family",
    "quantity": 1,
    "customerName": "string",
    "customerEmail": "string",
    "customerPhone": "string",
    "groupFemaleVerified": true,
    "attendeeDetails": [
      { "name": "Attendee One" },
      { "name": "Attendee Two" }
    ]
  }
  ```
- **Validation Rules:**
  - `quantity`: Must be between 1 and 5.
  - `categoryCode`: Must be a valid active category.
  - `group`: Must have `groupFemaleVerified === true`.
  - Server verifies that remaining capacity (`500 - currentAttendees`) is sufficient.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "orderReference": "RIT-2026-X8Y9Z1",
      "redirectUrl": "https://mercury-t2.phonepe.com/transact/...",
      "order": {
        "id": "ord_...",
        "orderReference": "RIT-2026-X8Y9Z1",
        "categoryCode": "couple",
        "amountPaise": 44900,
        "paymentStatus": "PENDING",
        "reservationExpiresAt": "2026-10-10T00:10:00.000Z"
      }
    }
    ```
  - `400 Bad Request`: `{ "error": "Validation error message" }`
  - `401 Unauthorized`: `{ "error": "Authentication required to book tickets" }`
  - `409 Conflict`: `{ "error": "Capacity limit reached. Only X passes remaining." }`

---

## 3. Payment Verification & Webhooks

### `POST /api/payments/verify`
- **Description:** Verifies payment transaction status with PhonePe and issues the gate pass.
- **Request Body:**
  ```json
  {
    "orderReference": "RIT-2026-X8Y9Z1",
    "simulateSuccess": false
  }
  ```
  *(Note: `simulateSuccess` is strictly ignored when `NODE_ENV === 'production'`)*
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "paymentStatus": "PAID",
      "passQrToken": "RIT_abc...xyz",
      "orderReference": "RIT-2026-X8Y9Z1"
    }
    ```
  - `400 Bad Request`: `{ "error": "Order not found or invalid status" }`

---

### `POST /api/webhooks/phonepe`
- **Description:** Server-to-server webhook receiver from PhonePe.
- **Headers:** `X-VERIFY: {SHA256_HASH}###{SALT_INDEX}`
- **Request Body:** Base64-encoded PhonePe payment notification.
- **Responses:**
  - `200 OK`: `{ "status": "RECEIVED" }`
  - `400 Bad Request`: `{ "error": "Invalid webhook signature" }`

---

## 4. Gate Scanner & Check-in

### `POST /api/scanner/check-in`
- **Description:** Gate staff attendee admittance.
- **Rate Limit:** 120 requests / minute / IP.
- **Request Body:**
  ```json
  {
    "token": "RIT_abc...xyz",
    "countToAdmit": 1,
    "staffPin": "202618",
    "gateIdentifier": "MAIN_GATE"
  }
  ```
- **Responses:**
  - `200 OK (Admitted)`:
    ```json
    {
      "success": true,
      "resultCode": "ADMITTED",
      "pass": {
        "orderReference": "RIT-2026-X8Y9Z1",
        "categoryName": "Couple",
        "totalAllowed": 2,
        "admittedCount": 2,
        "remaining": 0,
        "customerName": "Aarav Sharma"
      }
    }
    ```
  - `400 / 409 (Rejection)`:
    ```json
    {
      "success": false,
      "resultCode": "EXHAUSTED | UNPAID | REFUNDED | INVALID",
      "message": "All 2 attendees have already entered the venue."
    }
    ```
  - `401 Unauthorized`: `{ "error": "Invalid staff PIN" }`

---

## 5. Administrative Endpoints

### `POST /api/admin/stats`
- **Description:** Returns financial metrics, live capacity status, and recent bookings.
- **Headers / Body:** `{ "adminSecret": "..." }`
- **Responses:**
  - `200 OK`: `{ "stats": { "totalRevenue": 249000, "admittedAttendees": 142, "capacity": 500, "ordersCount": 98 } }`
  - `401 Unauthorized`: `{ "error": "Unauthorized" }`

---

### `POST /api/admin/action`
- **Description:** Executes administrative actions: `REVOKE_PASS`, `MARK_PAID`, `RESEND_EMAIL`.
- **Request Body:**
  ```json
  {
    "adminSecret": "...",
    "action": "REVOKE_PASS",
    "payload": { "orderId": "ord_...", "reason": "REFUNDED" }
  }
  ```
- **Responses:**
  - `200 OK`: `{ "success": true, "result": ... }`
  - `401 Unauthorized`: `{ "error": "Unauthorized" }`
