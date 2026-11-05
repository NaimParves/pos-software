# POS Software

A point-of-sale system for a tiles / sanitary / door shop.

- **Frontend:** React, Vite, Tailwind CSS (`src/`)
- **Backend:** Node.js + Express API with a SQLite database (`server/`), using Node's built-in `node:sqlite`.
  Logins use hashed passwords (scrypt) and signed tokens (JWT).

Requires **Node.js 22.13 or newer** (built and tested on Node 24).

## Run it (development)

```bash
npm install
npm run dev
```

This starts the API on http://localhost:3001 and the web app on http://localhost:5173. Open the web app.

On first start the server creates `data/pos.db` with sample data and one admin user:

- Phone: `admin`
- Password: `admin123`, or whatever you set in `ADMIN_PASSWORD` before the first start

**Change this password right away** (Admin menu, top right → Change password).

## Run it on the shop computer (production)

**Easiest:** install Node.js, then double-click **`Start POS.bat`**. The first time, it installs packages
(this needs internet) and builds the app. Then it starts the server and opens the browser.
Keep its window open while using POS. After updating the code, delete the `dist` folder so the next start rebuilds.

Or from a terminal:

```bash
npm install
npm start
```

This builds the frontend and serves the app and API together on http://localhost:3001.
Other computers on the same network can open `http://<this-computer's-IP>:3001`.

### Settings (environment variables)

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_PORT` | `3001` | Port the server listens on |
| `ADMIN_PASSWORD` | `admin123` | Password of the first admin, used only when the database is first created |
| `JWT_SECRET` | generated and saved in `data/.jwt-secret` | Key that signs login tokens |
| `DATA_DIR` | `./data` | Folder for the database and secret |

### Backups

All data is in `data/pos.db`. Stop the server and copy that file (plus `pos.db-wal` if present) to back up.
Deleting the `data` folder starts over with fresh sample data.

## How the backend works

- `GET /api/state` loads everything once after login. Pages read from that cache, and every change goes
  to the API first (`src/store/db.js`). The app reloads data when the window regains focus,
  so changes made on other computers show up.
- Invoices (`sales`, `purchases`, returns, purchase orders, damages) are saved through
  `POST /api/documents/:collection`. The server assigns the invoice number and updates stock in one
  database transaction, and deleting an invoice reverses its stock change. Invoice numbers are never reused.
- Other records use `GET/POST/PATCH/DELETE /api/:collection`.
- Roles: only **Super Admin** and **Admin** can manage users, branches and permissions, or reset to sample data.
  Inactive users cannot sign in.

## Customize

| What | Where |
| --- | --- |
| Shop name, address, phone, payment methods | `src/config/shop.js` |
| Sidebar menu | `src/config/menu.js` |
| Simple form + list screens (sizes, brands, expenses, payroll…) | `src/config/crudPages.js` |
| Invoice types and labour cost per carton | `src/config/invoiceModes.js` |
| Sample data loaded into a new database | `src/store/seed.js` |
| API routes, number prefixes and stock rules | `server/index.js`, `server/db.js` |

## Known limits

- Invoice totals are calculated in the browser and saved as sent. The server checks the products and
  quantities but does not recalculate prices.
- The per-menu checkboxes on Set Permission are saved, but only the admin-only rules above are enforced.
- SMS messages are recorded but not sent; connect an SMS gateway in the server to deliver them.
- Use HTTPS (for example behind a reverse proxy) if the app will be reachable from the internet.
