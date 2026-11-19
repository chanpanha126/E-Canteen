# AUPP E-Canteen (Group 8) — Complete Technical & Team Guide

**Project Title:** E-Canteen  
**Team Members:** CHAN Panha • CHENG Mengsrun • SAY Kimlong  
**Stack:**
- **Frontend:** Plain HTML5 + Tailwind CSS (CDN) + Vanilla JavaScript (`fetch()`, DOM manipulation, `localStorage`, `Web Notifications API`)
- **Backend:** Node.js + Express.js + Real Individual Bakong KHQR (`bakong-khqr`, `qrcode`)
- **Database:** JSON file storage ([server/data/menu.json](server/data/menu.json) & [server/data/orders.json](server/data/orders.json)) — no database installation needed

---

## Quick Start (How to Run on Any Laptop)

1. Make sure **Node.js** is installed (`node -v`).
2. Install dependencies once:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` if `.env` does not exist yet, and fill in your Personal ABA/Bakong ID:
   ```env
   PORT=3000
   BAKONG_ACCOUNT_ID=your_name@aba
   BAKONG_ACCOUNT_NAME=YOUR NAME
   BAKONG_MERCHANT_CITY=Phnom Penh
   BAKONG_DEV_TOKEN=
   DEMO_TEST_AMOUNT_KHR=100
   ```
4. Start the server:
   ```bash
   npm run dev
   ```
5. Open Chrome:
   - **Customer QR Menu (Table 7):** `http://localhost:3000/?table=7`
   - **Staff Kitchen & Demo Panel:** `http://localhost:3000/staff.html`

---

## Complete Folder & File Structure

```text
E-Canteen/
│
├── package.json                  # Lists project packages (express, cors, dotenv, bakong-khqr, qrcode) and scripts
├── .env                          # Local secret config (Port, Personal ABA Bakong ID, optional Bakong Dev Token)
├── .env.example                  # Template of .env safe to commit to GitHub
├── .gitignore                    # Ignores node_modules/, .env, .DS_Store
├── README.md                     # This team guide & technical documentation
│
├── public/                       # FRONTEND (Runs in Chrome / Phone Browser)
│   ├── index.html                # Customer Page: Menu, Cart Drawer, KHQR Modal, Order Status Banner, History
│   ├── staff.html                # Staff Page: Live Order Queue, "Mark Ready" button, Analytics, Table QR Generator
│   └── js/
│       ├── api.js                # Shared fetch() + async/await REST API client
│       ├── menu.js               # Fetches menu items, filters by category/search, renders menu cards
│       ├── cart.js               # Reads ?table=7 from URL, manages cart in localStorage (+ / - quantity, total)
│       ├── checkout.js           # Opens Bakong KHQR modal, checks payment status, creates order
│       ├── tracking.js           # Polls order status every 3s via Fetch API & triggers Web Notification alert
│       └── staff.js              # Logic for staff.html (mark ready, toggle sold-out, generate table QR codes)
│
└── server/                       # BACKEND (Runs in Node.js)
    ├── index.js                  # Express entry point: serves public/ static files and /api/* routes on port 3000
    ├── data/
    │   ├── menu.json             # Seeded menu items across food, drinks, and dessert
    │   └── orders.json           # JSON persistence for placed customer orders
    ├── routes/
    │   ├── menu.routes.js        # GET /api/menu, PATCH /api/menu/:id/availability
    │   ├── khqr.routes.js        # POST /api/payments/khqr/generate, POST /api/payments/khqr/verify
    │   └── orders.routes.js      # POST /api/orders, GET/PATCH /api/orders/:orderId/status, GET /api/orders
    └── services/
        ├── store.js              # Reads/writes menu.json & orders.json and assigns orderId & queueNumber
        └── bakongService.js      # Uses bakong-khqr & qrcode to create real KHQR + MD5 verification
```

---

## PART 1: The Big Picture — How Data Flows Step-by-Step

- **Frontend (`public/` folder):** Runs inside the student's web browser (Chrome/Safari). It cannot directly access files on the server's hard drive. Instead, whenever it needs data, it uses **`fetch()`** to send an HTTP request (`GET`, `POST`, or `PATCH`) to the Backend.
- **Backend (`server/` folder):** Runs in Node.js on port `3000`. It listens for `fetch()` requests, reads or updates [server/data/menu.json](server/data/menu.json) and [server/data/orders.json](server/data/orders.json), talks to Bakong KHQR, and replies with **JSON** data.

```text
[Student Phone Browser]                     [Node.js Express Server]
       |                                               |
       |--- 1. Opens /?table=7 ----------------------->| Serves public/index.html
       |--- 2. fetch('GET /api/menu') ---------------->| Reads server/data/menu.json
       |<-- Returns JSON list of 10 food/drink items --|
       |                                               |
       | (Student adds items to Cart in localStorage)  |
       |                                               |
       |--- 3. fetch('POST /api/payments/khqr/generate') -> Creates real Bakong QR + MD5
       |<-- Returns QR image + MD5 hash ---------------|
       |                                               |
       |--- 4. fetch('POST /api/payments/khqr/verify') ---> Checks if MD5 is paid
       |<-- Returns { responseCode: 0 } ---------------|
       |                                               |
       |--- 5. fetch('POST /api/orders') ------------->| Saves order to orders.json
       |<-- Returns { orderId: 101, queueNumber: "A-001", status: "preparing" }
       |                                               |
       |--- 6. Every 3s: fetch('GET /api/orders/101/status') -> Checks current status
       |<-- Returns { status: "ready" } (after Staff clicks "Mark Ready")
       |                                               |
       |---> 7. Browser fires Web Notification: "Queue A-001 is ready for pickup!"
```

---

## PART 2: Role 1 — Digital Menu, QR Table Detection & Shopping Cart

**Assigned to:** Teammate 1 (*e.g., CHENG Mengsrun*)  
**Files Owned:**
- [public/index.html](public/index.html)
- [public/js/menu.js](public/js/menu.js)
- [public/js/cart.js](public/js/cart.js)
- [server/data/menu.json](server/data/menu.json)

### Task 1.1: Detect the Table Number from the QR Code URL
- **WHAT it does:** When a student scans a table QR code, it opens `http://localhost:3000/?table=7`. Your code reads `7` from the URL and displays `Table #7` in the top navigation bar and inside the cart.
- **WHY we do it this way:** Instead of building 20 separate HTML pages for 20 canteen tables, **one single webpage** handles every table by reading the `?table=` query parameter. Saving it in `localStorage` ensures a page refresh keeps the student's table number.
- **HOW it works (`initTableNumber()` in [public/js/cart.js](public/js/cart.js)):**
  1. `window.location.search` reads the query string (e.g., `"?table=7"`).
  2. `new URLSearchParams(window.location.search).get('table')` extracts `"7"`.
  3. Validates it is a positive integer (`Number.isInteger(urlTable) && urlTable > 0`).
  4. Saves it using `localStorage.setItem('ecanteen_table', String(urlTable))`.
  5. `renderTableBadge()` updates `<span id="table-badge-number">` to `#7`.

### Task 1.2: Fetch the Menu & Render HTML Cards (DOM Manipulation)
- **WHAT it does:** Loads all canteen dishes, drinks, and desserts from the backend server and dynamically creates the visual menu cards on the page.
- **WHY we do it this way:** If the canteen runs out of an item, staff can mark it "Sold Out" on the server and every student immediately sees the updated availability via `GET /api/menu`.
- **HOW it works (`loadMenu()` & `renderMenu()` in [public/js/menu.js](public/js/menu.js)):**
  1. `loadMenu()` calls `await fetchMenu('all')` (`fetch('/api/menu')`).
  2. Stores the returned `items` array in `allMenuItems`.
  3. `renderMenu()` filters `allMenuItems` by `activeCategory` and `searchQuery`.
  4. Maps each matching item to an `<article>` HTML string showing emoji, price, rating, and `Available` / `Sold Out` badge (adding `disabled` to the button when `available === false`).
  5. Injects the cards into `#menu-grid` using `grid.innerHTML = ...` with no page reload.

### Task 1.3: Category Tabs & Live Search Filtering (Event Handling)
- **WHAT it does:** Filters the menu instantly when clicking **All Menu**, **Food**, **Drinks & Cafe**, or **Dessert**, or typing in the search bar.
- **WHY we do it this way:** Updating the DOM in memory is instant and satisfies the requirement for flexible UI updates without a full-page refresh.
- **HOW it works (`initMenuEvents()` in [public/js/menu.js](public/js/menu.js)):**
  1. Reads `btn.dataset.category` when a tab inside `#category-tabs` is clicked.
  2. Updates `activeCategory`, highlights the active tab, and re-runs `renderMenu()`.
  3. Listens to the `input` event on `#menu-search`, updates `searchQuery`, and re-runs `renderMenu()`.

### Task 1.4: Shopping Cart State (`localStorage`), Quantity Controls & Total Calculation
- **WHAT it does:** Lets students add items to the slide-out cart drawer, change quantities (`+` / `-`), remove items (`✕`), see the live total price, and keep their cart across refreshes.
- **WHY we do it this way:** Saving the `cart` array in `localStorage` prevents students from losing their selected dishes if they accidentally refresh their mobile browser.
- **HOW it works (in [public/js/cart.js](public/js/cart.js)):**
  1. `addToCart(menuItem)` verifies `menuItem.available` is `true`, increments `qty` if the item is already in `cart`, or pushes `{ id, name, price, emoji, qty: 1 }`.
  2. `saveCart()` serializes the array with `JSON.stringify(cart)` into `localStorage`.
  3. `updateCartQty(itemId, delta)` adds `+1` or `-1` and filters out items whose `qty <= 0`.
  4. `getCartTotal()` uses `.reduce((sum, item) => sum + item.price * item.qty, 0)` to compute the exact subtotal.
  5. `renderCart()` updates `#cart-count-badge`, `#cart-items-list`, `#cart-subtotal`, and disables `#proceed-checkout-btn` when empty.

---

## PART 3: Role 2 — Bakong KHQR Modal, Fetch API Polling, Web Notifications & Staff Dashboard

**Assigned to:** Teammate 2 (*e.g., SAY Kimlong*)  
**Files Owned:**
- [public/js/api.js](public/js/api.js)
- [public/js/checkout.js](public/js/checkout.js)
- [public/js/tracking.js](public/js/tracking.js)
- [public/staff.html](public/staff.html) & [public/js/staff.js](public/js/staff.js)

### Task 2.1: Shared Fetch API Helper (`async / await`)
- **WHAT it does:** Centralizes all `fetch()` calls to the backend inside [public/js/api.js](public/js/api.js).
- **WHY we do it this way:** Avoids repeating JSON headers and HTTP error handling across every module.
- **HOW it works (`request(url, options)` in [public/js/api.js](public/js/api.js)):**
  1. Calls `await fetch(url, ...)` with `'Content-Type': 'application/json'`.
  2. Parses JSON and throws a readable `Error` whenever `!response.ok`.

### Task 2.2: Bakong KHQR Checkout Modal & Payment Verification
- **WHAT it does:** Opens the Bakong KHQR payment popup, displays the scannable QR image + MD5 hash, checks payment confirmation, and creates the order to obtain a queue number.
- **WHY we do it this way:** Orders only enter the kitchen queue once payment is verified (`responseCode === 0`). The **100 KHR** live demo checkbox and **Simulate Payment Confirmed (Demo)** button allow both real ABA Mobile testing and reliable class presentations.
- **HOW it works (in [public/js/checkout.js](public/js/checkout.js)):**
  1. `openKhqrCheckoutModal()` ensures the cart is non-empty and requests Web Notification permission on the user click.
  2. `loadKhqrCode()` calls `POST /api/payments/khqr/generate` to receive `qrImageDataUrl` and `md5`.
  3. Polls `POST /api/payments/khqr/verify` every 3 seconds (or verifies immediately when clicking **Simulate Payment Confirmed (Demo)**).
  4. Once `responseCode === 0`, `finalizePaidOrder(md5)` calls `POST /api/orders`, clears the cart, saves to local order history, and starts order tracking.

### Task 2.3: Real-Time Order Status Polling via Fetch API
- **WHAT it does:** Displays the customer's **Queue Number (`A-001`)** and polls the backend every 3 seconds until status becomes `"ready"`.
- **WHY we do it this way:** Customers see live updates without hitting browser refresh (`F5`).
- **HOW it works (`startOrderTracking(order)` in [public/js/tracking.js](public/js/tracking.js)):**
  1. Saves the active order in `localStorage` (`ecanteen_active_order`) so tracking automatically resumes on refresh.
  2. Starts `pollingTimer = setInterval(pollOnce, 3000)` calling `GET /api/orders/:orderId/status`.
  3. When `latest.status === 'ready'`, calls `clearInterval(pollingTimer)`, updates the banner to green **READY FOR PICKUP**, and triggers the alert.

### Task 2.4: Browser Web Notifications API & Audio Chime
- **WHAT it does:** Sends a native notification (`"Queue A-001 is ready for pickup!"`), plays a 2-note chime via Web Audio API, and shows an in-app toast banner.
- **WHY we do it this way:** Alerts students even if they switch tabs while waiting, with an in-app banner + sound fallback if browser notifications are blocked.
- **HOW it works (in [public/js/tracking.js](public/js/tracking.js)):**
  1. `requestNotificationPermission()` runs `await Notification.requestPermission()`.
  2. `triggerPickupReadyAlert()` plays two sine-wave tones via `AudioContext` and fires `new Notification('AUPP E-Canteen — Order Ready!', { body: 'Queue A-001 is ready for pickup!' })` when permission is `'granted'`.

### Task 2.5: Canteen Staff Dashboard, Analytics & Table QR Generator
- **WHAT it does:** Lets staff view incoming orders, click **Mark Pickup Ready 🔔**, track daily revenue & popular items, toggle sold-out menu items, and generate scannable table QR codes.
- **WHY we do it this way:** Enables live demonstrations where clicking **Mark Pickup Ready 🔔** on one screen triggers the customer's polling and Web Notification on the other screen.
- **HOW it works (in [public/js/staff.js](public/js/staff.js)):**
  1. Polls `GET /api/orders` every 4 seconds and renders analytics cards + order queue.
  2. Clicking **Mark Pickup Ready 🔔** sends `PATCH /api/orders/:orderId/status` with `{ "status": "ready" }`.
  3. Clicking **Generate QR** creates a scannable QR code pointing to `${baseUrl}/?table=${tableNum}`.

---

## PART 4: Role 3 — Backend Express Server, In-House REST API & Real Bakong KHQR

**Assigned to:** Teammate 3 (*e.g., CHAN Panha*)  
**Files Owned:**
- [server/index.js](server/index.js)
- [server/services/store.js](server/services/store.js)
- [server/services/bakongService.js](server/services/bakongService.js)
- [server/routes/menu.routes.js](server/routes/menu.routes.js)
- [server/routes/khqr.routes.js](server/routes/khqr.routes.js)
- [server/routes/orders.routes.js](server/routes/orders.routes.js)

### Task 3.1: Express Server & Static Hosting Setup
- **WHAT it does:** Starts the Node.js server on Port `3000`, serves static frontend files from `public/`, and mounts `/api/*` endpoints.
- **WHY we do it this way:** Serving frontend and API from one server avoids CORS issues and allows phones on the same Wi-Fi to access the app directly.
- **HOW it works (in [server/index.js](server/index.js)):** Loads `.env` with `dotenv`, enables `cors()` and `express.json()`, serves `public/` via `express.static()`, and mounts menu, KHQR, and order routes.

### Task 3.2: JSON File Persistence & Queue Number Generator
- **WHAT it does:** Persists menu and orders in JSON files and generates sequential `orderId` (`101`, `102`...) and `queueNumber` (`"A-001"`, `"A-002"`...).
- **WHY we do it this way:** Keeps orders saved across server restarts without requiring database software setup across all laptops.
- **HOW it works (in [server/services/store.js](server/services/store.js)):** Uses `fs.readFileSync` / `fs.writeFileSync` and `getNextOrderIdentifiers()` with `.padStart(3, '0')` to format `"A-001"`.

### Task 3.3: In-House Order & Menu REST API Endpoints
- **WHAT it does:** Handles reading/toggling the menu, validating & storing orders, returning order polling status, and calculating analytics.
- **WHY we do it this way:** Validates every payload server-side and returns clean, consistent JSON matching our project API contract.
- **HOW it works:**
  - `GET /api/menu` -> `{ items: [...] }`
  - `PATCH /api/menu/:id/availability` -> `{ item }`
  - `POST /api/orders` -> Validates `table` and `items`, assigns `orderId` + `queueNumber` + `status: "preparing"`, returns `201 Created`
  - `GET /api/orders/:orderId/status` -> `{ orderId, queueNumber, status }`
  - `PATCH /api/orders/:orderId/status` -> Updates status (`"preparing"` | `"ready"` | `"completed"`)
  - `GET /api/orders` -> `{ orders, analytics }`

### Task 3.4: Real Individual Bakong KHQR Generation & MD5 Verification
- **WHAT it does:** Generates real EMVCo KHQR strings for a personal ABA/Bakong account via `bakong-khqr`, renders QR images with `qrcode`, and verifies payments by `md5`.
- **WHY we do it this way:** NBC's `IndividualInfo` standard works with a **personal ABA/Bakong account** (no merchant registration required), and `md5` uniquely identifies each payment QR for NBC verification.
- **HOW it works (in [server/services/bakongService.js](server/services/bakongService.js)):**
  1. `generateKhqr()` builds `new IndividualInfo(accountId, accountName, merchantCity, { currency, amount, expirationTimestamp })` and calls `new BakongKHQR().generateIndividual(info)` to get `{ qr, md5 }`, then converts `qr` to a PNG Data URL via `QRCode.toDataURL(qr)`.
  2. `verifyTransactionByMd5()` supports Demo simulation (`forceSimulate = true`) and live verification against `https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5` when `BAKONG_DEV_TOKEN` is configured, returning `{ responseCode: 0, data: { md5, amount, currency } }` when confirmed.

---

## PART 5: 4-Minute Live Presentation Script

1. **Minute 1 (Menu & QR Table Detection):** Open `http://localhost:3000/staff.html` to show the Table QR Generator for Table #7, then open `http://localhost:3000/?table=7`. Highlight automatic `Table #7` detection (`URLSearchParams`), category filtering, sold-out item disabling, cart quantity controls, and `localStorage` persistence.
2. **Minute 2 (Real Bakong KHQR & Order Creation):** Click **Proceed to Bakong KHQR Payment**. Point out the real KHQR code + `MD5` hash generated for your personal ABA account. Click **Simulate Payment Confirmed (Demo)** (or scan with **100 KHR** mode) and show the newly assigned `Queue A-001` (`status: "preparing"`).
3. **Minute 3 (Fetch API Polling & Web Notification):** Open Chrome DevTools (`Network` tab) to show `GET /api/orders/101/status` polling every 3 seconds. Switch to `staff.html`, show the updated **Total Orders** & **Today's Revenue** cards, and click **Mark Pickup Ready 🔔**. Watch the customer tab automatically turn green, chime, and pop up *"Queue A-001 is ready for pickup!"*.
