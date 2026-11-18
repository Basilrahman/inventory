# 📒 Hand-Drawn Mess Inventory & Price Tracker

A charming, notebook-styled single-page web app for tracking inventory and prices in a "mess" (canteen/cafeteria) setting. Everything looks like it was sketched by hand on lined paper — because why should inventory management be boring?

Data lives entirely in **your own Google Sheets**, powered by a Google Apps Script backend. No server to maintain, no database to pay for, no account required for users beyond your Google account.

---

## ✨ Features

- **Inventory Management** — Add, edit, and delete items with name, category, unit, and quantity
- **Stock Status Tracking** — Automatically flags items as In Stock, Low Stock, or Out of Stock
- **Price History** — Log prices over time per item and visualise trends with an auto-generated chart
- **Stock Transactions** — Record quantity updates with timestamps for a full audit trail
- **Activity Log** — Every action (add, edit, delete, price entry) is logged automatically
- **Hand-Drawn UI** — Notebook paper background, sketchy borders, and marker-style fonts
- **Zero Backend Cost** — Runs entirely on Google Apps Script (free tier is more than enough)
- **Shareable** — Host the frontend anywhere; multiple users can read and write the same sheet

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Styling | Custom hand-drawn CSS (no framework) |
| Backend | Google Apps Script (`.gs`) |
| Database | Google Sheets |
| Charts | Native `<canvas>` API |
| Hosting | Anywhere static files can be served (or just open locally) |

---

## 🚀 Quick Start

1. **Set up the backend** — Follow **[DEPLOYMENT.md](DEPLOYMENT.md)** Parts 1–2 to create your Google Sheet and deploy the Apps Script as a Web App.
2. **Configure the frontend** — Paste your Web App URL into `api.js` (see [Configuration](#configuration) below).
3. **Open the app** — Open `index.html` in a browser, or serve it with any static file server.

For full step-by-step instructions, including hosting options and troubleshooting, see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## 📁 File Structure

```
Web/
├── index.html       — Main SPA page
├── styles.css       — Hand-drawn notebook styles
├── app.js           — Application logic
├── api.js           — Google Sheets API layer
├── Code.gs          — Google Apps Script backend
├── README.md
└── DEPLOYMENT.md    — Full setup instructions
```

---

## ⚙️ Configuration

The only thing you need to configure is the **Web App URL** in `api.js`.

Open `api.js` and find this line near the top of the file:

```javascript
const SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```

Replace `YOUR_APPS_SCRIPT_URL_HERE` with the URL you get after deploying `Code.gs` as a Google Apps Script Web App. It will look something like:

```
https://script.google.com/macros/s/AKfycb.../exec
```

Save the file and you're done. See [DEPLOYMENT.md](DEPLOYMENT.md) for how to get this URL.

---

## 📄 License

MIT — do whatever you like with it.
"# inventory" 
