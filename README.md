# AUPP E-Canteen

A QR ordering system for the AUPP canteen. You scan the QR code on your table, pick your food, pay with Bakong KHQR, and get a notification when your order is ready. No queue at the counter, no shouting order numbers.

**INFO 251 Web Development II, Group 8**
CHAN Panha · CHENG Mengsrun · SAY Kimlong

---

## Running it

You need Node.js (we used v22).

```bash
npm install
cp .env.example .env     # then fill in your own Bakong / ABA details
npm run dev
```

Then open:

- Customer menu for table 7: http://localhost:3000/?table=7
- Staff panel: http://localhost:3000/staff.html

To scan the table QR from a phone, the phone has to be on the same Wi-Fi as the laptop. In the staff panel, change the base URL from `localhost` to the laptop's IP address and generate the QR code again.

### `.env` settings

| Key | What it's for |
|---|---|
| `PORT` | Server port (default 3000) |
| `BAKONG_ACCOUNT_ID` | Your personal Bakong ID, e.g. `name@aba` |
| `BAKONG_ACCOUNT_NAME`, `BAKONG_MERCHANT_CITY` | Shown on the KHQR code |
| `ABA_ACCOUNT_NUMBER`, `BAKONG_ACQUIRING_BANK`, `ABA_P2P_TAG` | Optional extra details for ABA |
| `BAKONG_DEV_TOKEN` | Token from https://api-bakong.nbc.gov.kh. With it, payments are confirmed automatically. Without it, use the "Simulate Payment" button. |

Never commit `.env`. It's already in `.gitignore`.

---

## What it does

**Customer page (`index.html`)**
- **Table Detection**: Reads the table number from the URL `QR-Code`, so one page works for every table.
- **Menu and Search**: Fetch the MENU from the api call, with the categorical navigation and search function. 
- **Item card and Detail**: Displays Food cards with photos. Tap hover on a cart to open details and description of the dishes with a set of -/+ quantity set, and a round **+** to immediatly add another one. 
- **Cart**: Items saved in cart are store in `localStorage`, so a refresh doesnot lose the added items. Each card shows amount of item are already in the cart. On mobile devices there is a bottom bar with Menu, Orders and Cart.
- **Form Validation**: On the check out form, it ask for validated table number (1-99), order note (max 120 chars) and the cart cannot be empty.
- **Payment**: Generate KHQR code for exact cart total payment (real-time).
- **Live Tracking**: Display status such as Paid, Preparing, Ready, Picked Up. it polls status every 3seconds, with a chime and browser short notification.

**Staff panel (`staff.html`)**
- Live order queue that refreshes every 4 seconds, with filter tabs (All / Preparing / Ready for Pickup / Picked Up) and a colour for each status.
- Each order only shows its next step: **Food Done – Notify Customer** while it's cooking, then **Picked Up** (or **Back to Preparing** if clicked by mistake).
- **Edit** an order (status and note) in a validated form. This sends PUT.
- **Delete** an order after confirming in the page. This sends DELETE.
- Sales numbers, popular items, sold-out toggles, and a QR code generator for each table.

If the server can't be reached, both pages say so and show a Retry button instead of failing silently.

---

## How it fits together

```
Browser (public/)                     Express server (server/)              Outside
─────────────────                     ────────────────────────              ───────
index.html / staff.html
  js/menu.js, cart.js, ...
  js/api.js  ── fetch() ──────────▶   routes/*.js  ──▶ services/store.js ──▶ data/*.json
                                                   └─▶ services/bakongService.js ──▶ NBC Bakong API
             ◀────────── JSON ─────
```

Every request from the pages goes through `public/js/api.js`, a small wrapper around `fetch()` with `async/await`. It turns HTTP errors and network failures into readable messages. The server checks the input, reads or writes the JSON files, talks to Bakong when needed, and sends back JSON.

**Public API:** NBC Bakong. We use the `bakong-khqr` package to build a real KHQR for a personal account (no merchant registration needed) and Bakong's `check_transaction_by_md5` endpoint to confirm the payment.

**Our own REST API:** Bakong doesn't let us store orders, so we wrote a small Express API for the menu and orders. The guidelines allow a mock API for the POST/PUT/DELETE part.

### API routes

| Method | Route | Used for |
|---|---|---|
| GET | `/api/menu` | Menu items (optional `?category=food\|drinks\|dessert`) |
| PATCH | `/api/menu/:id/availability` | Mark an item sold out or available |
| POST | `/api/payments/khqr/generate` | Create a KHQR code and its MD5 |
| POST | `/api/payments/khqr/verify` | Check whether that MD5 has been paid |
| GET | `/api/orders` | All orders plus sales numbers (staff panel) |
| POST | `/api/orders` | Place an order after payment, returns queue number like `A-001` |
| GET | `/api/orders/:orderId/status` | Status check (customer tracker polls this) |
| PATCH | `/api/orders/:orderId/status` | Quick status change from the staff buttons |
| PUT | `/api/orders/:orderId` | Edit an order's status and note |
| DELETE | `/api/orders/:orderId` | Remove an order |

Bad input gets a `400` and a missing order gets a `404`, both with a JSON `{ "error": "..." }` message.

---

## Files

```
E-Canteen/
├── public/                  frontend (runs in the browser)
│   ├── index.html           customer page
│   ├── staff.html           staff panel
│   ├── css/styles.css       our own styles (Tailwind CDN handles layout utilities)
│   ├── images/menu/         food photos, named after the menu item id (food-01.jpg, ...)
│   ├── images/brand/        AUPP logo
│   └── js/
│       ├── main.js          starts the customer page (imports the modules below)
│       ├── api.js           all fetch() calls
│       ├── ui.js            shared helpers: toasts, escaping HTML, form errors
│       ├── menu.js          menu cards, categories, search, food details sheet
│       ├── cart.js          cart, table number, order history
│       ├── checkout.js      checkout form validation, KHQR payment
│       ├── tracking.js      order status polling, notifications
│       └── staff.js         staff queue, filters, edit/delete
└── server/                  backend (runs in Node.js)
    ├── index.js             Express setup, serves public/ and /api
    ├── routes/              menu, orders, khqr routes
    ├── services/            store.js (JSON files), bakongService.js (Bakong)
    └── data/                menu.json, orders.json
```

---

## JavaScript features we used

- **DOM manipulation:** menu cards, cart items and order cards are built with template literals and inserted with `innerHTML`. Toasts use `createElement`.
- **Events:** clicks are handled on parent elements and use `data-*` attributes to tell buttons apart; `submit` and `input` events drive the forms; `keydown` lets Esc close popups. `cart.js` sends a custom `cart:updated` event and `menu.js` listens for it.
- **Async:** `async/await` with `try/catch` around every `fetch()`; `setInterval` for polling.
- **ES6+:** modules (`import`/`export`), arrow functions, `const`/`let`, template literals, destructuring, spread, optional chaining (`?.`), `Array` methods like `map`, `filter`, `reduce`, `find`.
- **Browser APIs:** `localStorage`, `URLSearchParams`, the Notifications API, Web Audio for the chime.

---

## Who did what

| Member | Part |
|---|---|
| **CHAN Panha** | Backend: Express server, REST API, JSON storage, Bakong KHQR generation and payment verification |
| **CHENG Mengsrun** | Customer page: menu, search, cart, checkout form and validation, order tracker, styles |
| **SAY Kimlong** | Staff panel: order queue, filters, status buttons, edit (PUT) and delete (DELETE), table QR generator |

---

## Photo credits

The food photos (`food-01.jpg` to `food-10.jpg`) were collected by our team. The drink and dessert photos come from Wikimedia Commons and were resized for the menu:

| File | Photo | Author | License |
|---|---|---|---|
| `food-04.jpg` | [Fish Amok](https://silkroadrecipes.com/wp-content/uploads/2024/08/Cambodian-Khmer-Fish-Amok-Recipe-square.jpg) |
| `drink-01.jpg` | [Ice Latte](https://www.vecteezy.com/free-png/ice-latte)|
| `drink-02.jpg` | [Passionfruit drink](http://www.sesamenoodlebar.com/drink/item/passion-soda/) |
| `drink-03.jpg` | [Matcha Latte im Glas](https://commons.wikimedia.org/wiki/File:Matcha_Latte_im_Glas.jpg) | Csuding | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `drink-04.jpg` | [Iced Americano](https://mocktail.net/wp-content/uploads/2022/03/homemade-Iced-Americano-recipe_1.jpg) |
| `drink-05.jpg` | [Hot Macchiato Latte](https://podmkr.com/wp-content/uploads/2023/11/latte-macchiato-600x400.png) | PODMKR |
| `dessert-02.jpg` | [Pain au chocolat](https://commons.wikimedia.org/wiki/File:Pain_au_chocolat_Luc_Viatour.jpg) | Luc Viatour | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `dessert-03.jpg` | [Coconut Flan](https://commons.wikimedia.org/wiki/File:Coconut_Flan.jpg) | norwichnuts | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| `dessert-04.jpg` | [Creme Caramel Pudding](https://bakewithshivesh.com/wp-content/uploads/2023/04/IMG_0052-scaled.jpg) | BAKE WITH SHIVESH | 

The AUPP logo belongs to the American University of Phnom Penh and is used here only for this class project.

---

## AI assistance

In line with the course GenAI guidelines, we're open about where AI was used. We used Claude (Anthropic) as a coding assistant to:

- connect the existing PUT and DELETE routes to the staff panel (edit form and delete confirmation)
- add client-side form validation and the shared `ui.js` helpers
- move custom styles and redesign the UI in a food-delivery-app style (photo cards, details sheet, bottom navigation, loading cards, order progress steps, staff filters)
- find and fix a bug where checkout waited forever on the notification permission prompt
- tidy up this README

We read through the changes, tested them in the browser, and each of us can explain the code in our own part.

---

## Demo walkthrough

1. Open the staff panel and generate the QR code for a table.
2. Scan it (or open `/?table=7`): the welcome banner shows the table number.
3. Search and filter the menu, tap a dish to open its details, pick a quantity and add it. Show the cart badge and the "In cart" labels.
4. Try to check out with a bad table number to show the validation errors, then fix it.
5. Pay with the real KHQR code. Bakong confirms it and a queue number appears.
6. In the staff panel, click **Food Done – Notify Customer**. The customer tab updates by itself, plays the chime and sends the notification. Then click **Picked Up**.
7. In the staff panel, edit the order's note (PUT), then delete a test order (DELETE).
