# 🚀 Deployment Guide — Hand-Drawn Mess Inventory & Price Tracker

This guide walks you through the complete setup from a blank Google account to a fully working app. No programming experience needed — just follow the steps in order.

**Estimated time:** 15–20 minutes.

---

## Part 1: Set Up Google Sheets

1. Go to [sheets.google.com](https://sheets.google.com) and sign in with your Google account.
2. Click the **"+"** button (Blank spreadsheet) to create a new spreadsheet.
3. Click the title at the top (it says "Untitled spreadsheet") and rename it to:
   ```
   Mess Inventory Register
   ```
4. Look at the browser address bar. The URL will look like:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```
   Copy the long string of letters and numbers between `/d/` and `/edit` — that is your **Spreadsheet ID**. Save it somewhere handy (Notepad is fine).

> [!NOTE]
> You do **not** need to create any sheets manually. The script will create all four sheets (Inventory, PriceHistory, StockTransactions, ActivityLog) with the correct headers when you run `initSheets()` in Part 2.

---

## Part 2: Set Up Google Apps Script

### 2.1 — Open the Script Editor

1. In your spreadsheet, click the menu **Extensions → Apps Script**.  
   A new browser tab opens with the Apps Script editor.

### 2.2 — Replace the Default Code

2. In the editor you will see a file called `Code.gs` with a few lines of placeholder code.
3. Select **all** of that code and **delete** it.
4. Open the `Code.gs` file from this project in a text editor, select all, copy.
5. Paste it into the Apps Script editor (it should now be the only code there).
6. Press **Ctrl + S** (or click the 💾 save icon) to save.
7. When prompted for a project name, type:
   ```
   Mess Inventory Backend
   ```
   and click **Rename**.

### 2.3 — Add Your Spreadsheet ID as a Script Property

8. In the left sidebar, click the **⚙️ gear icon** (Project Settings).
9. Scroll down to the **Script Properties** section.
10. Click **"Add script property"**.
11. Fill in:
    - **Property name:** `SPREADSHEET_ID`
    - **Value:** *(paste the Spreadsheet ID you copied in Part 1)*
12. Click **Save script properties**.

### 2.4 — Run `initSheets()` to Create the Sheets

13. Click the **`</>`** (Editor) icon in the left sidebar to go back to the code.
14. In the toolbar above the code, find the **function dropdown** (it may say `myFunction` or be blank). Click it and select **`initSheets`**.
15. Click the **▶️ Run** button.
16. A dialog will appear asking you to **authorize the script**:
    - Click **"Review permissions"**
    - Choose your Google account
    - You may see a warning saying "Google hasn't verified this app" — click **"Advanced"**, then **"Go to Mess Inventory Backend (unsafe)"**
    - Review the permissions (the script only accesses your spreadsheet) and click **"Allow"**
17. The script will run. Check the **Execution log** at the bottom — you should see a success message.
18. Switch back to your spreadsheet tab and refresh the page. You should now see four new sheets at the bottom: **Inventory**, **PriceHistory**, **StockTransactions**, **ActivityLog**.

> [!IMPORTANT]
> You **must** run `initSheets()` at least once before using the app, or the app will not be able to read or write data correctly.

### 2.5 — Deploy the Script as a Web App

19. In the Apps Script editor, click the **"Deploy"** button (top right) → **"New deployment"**.
20. Click the **⚙️ gear icon** next to the "Select type" label → choose **"Web app"**.
21. Fill in the deployment settings:
    | Setting | Value |
    |---|---|
    | Description | `Mess Inventory API v1` |
    | Execute as | `Me` |
    | Who has access | `Anyone` |

    > [!IMPORTANT]
    > **Who has access must be set to "Anyone"** — otherwise the frontend cannot talk to the backend without users logging in.

22. Click **"Deploy"**.
23. Copy the **Web App URL** that appears. It looks like:
    ```
    https://script.google.com/macros/s/AKfycb.../exec
    ```
    Save this URL — you will need it in Part 3.

---

## Part 3: Configure the Frontend

You can configure the backend URL in either of two ways:

### Option 1 — In the Web App UI (Easiest, no code editing needed!)
1. Open the website in your browser (`http://localhost:8000` or open `index.html`).
2. Click the **"Sheets Setup"** button in the top navigation bar.
3. Paste your Google Apps Script Web App URL into the text box.
4. Click **"Save & Connect"**. The status turns green and connects live!

### Option 2 — In `api.js` directly
1. Open the file `api.js` from this project in any text editor (Notepad, VS Code, etc.).
2. Near the top of the file, find this line:
   ```javascript
   const SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
   ```
3. Replace `YOUR_APPS_SCRIPT_URL_HERE` with your Web App URL from Part 2:
   ```javascript
   const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
4. Save `api.js`.

---

## Part 4: Deploy the Frontend

Choose whichever option suits you best.

### Option A — Open Locally (Simplest)

- Double-click `index.html` to open it in your web browser.  
- **That's it.** No server needed.

> [!NOTE]
> Some browsers (notably Chrome) block `fetch()` requests when opening files directly from disk. If you see network errors or the app doesn't load data, use Option B instead.

---

### Option B — Run a Local Development Server

**If you have Python installed:**
```bash
# Navigate to the Web folder in your terminal, then:
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

**If you have Node.js installed:**
```bash
# Navigate to the Web folder in your terminal, then:
npx serve .
```
Open the URL it prints (usually [http://localhost:3000](http://localhost:3000)).

---

### Option C — Host on GitHub Pages (Free, Permanent URL)

1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Click **"New repository"**, give it a name (e.g. `mess-inventory`), set it to **Public**, and click **"Create repository"**.
3. Upload these files to the repository (drag-and-drop in the browser UI works):
   - `index.html`
   - `styles.css`
   - `app.js`
   - `api.js`
   
   > [!CAUTION]
   > Do **not** upload `Code.gs` — it contains your script logic and would expose the structure of your backend. It is not needed on GitHub Pages.

4. Go to your repository **Settings → Pages**.
5. Under "Build and deployment", set:
   - **Source:** Deploy from a branch
   - **Branch:** `main` → `/ (root)`
6. Click **Save**. After a minute or two your app will be live at:
   ```
   https://yourusername.github.io/your-repo-name/
   ```

---

### Option D — Host on Netlify (Recommended for Sharing)

Netlify gives you a live URL in under 60 seconds with zero configuration.

1. Go to [netlify.com](https://netlify.com) and sign up for a free account.
2. From your Netlify dashboard, find the drag-and-drop deploy zone.
3. Drag your entire **Web** folder (containing `index.html`, `styles.css`, `app.js`, `api.js`) into the zone.
4. Netlify instantly publishes your site and gives you a URL like `https://random-name.netlify.app`.
5. You can rename the site in Site Settings if you want something more memorable.

---

## Part 5: Updating the Apps Script

When you make changes to `Code.gs`, you must create a **new deployment version** so the live Web App picks up your changes. The URL will stay the same.

1. Go back to the Apps Script editor.
2. Click **"Deploy" → "Manage deployments"**.
3. Find your deployment and click the **✏️ pencil** (edit) icon.
4. In the **Version** dropdown, select **"New version"**.
5. Click **"Deploy"**.

You do **not** need to update `api.js` or redeploy the frontend — the URL is unchanged.

---

## Part 6: Testing the App End-to-End

Run through these tests in order after your first deployment to confirm everything is working:

| # | What to test | Expected result |
|---|---|---|
| 1 | **Add Item** — Go to Add Item page, fill the form, click "Add to Register" | Item appears on the Inventory page |
| 2 | **Edit Item** — Click Edit on any item, change a value, save | Inventory shows the updated value |
| 3 | **Update Quantity** — Click the quantity update button, enter a new quantity | Stock status badge updates (In Stock / Low / Out) |
| 4 | **Price Entry** — Go to Price Tracker, select an item, click "+ Add Price Entry", add a price | Price appears and a trend graph renders |
| 5 | **Delete Item** — Click Delete on any item and confirm | Item disappears from the inventory list |
| 6 | **History** — Go to the History page | All transactions from steps 1–5 are listed |

---

## Troubleshooting

### "Failed to fetch" error
- Double-check that `SCRIPT_URL` in `api.js` is correctly set and has no extra spaces or missing characters.
- Make sure the Apps Script is deployed with **"Who has access: Anyone"** (not "Only myself").

### "Exception: Spreadsheet not found"
- Check that `SPREADSHEET_ID` in Script Properties is the correct ID from your spreadsheet URL.
- Make sure there are no leading/trailing spaces in the value.

### Empty tables after adding items
- Re-run `initSheets()` from the Apps Script editor (see Part 2.4) to ensure all sheet headers are created, then try adding items again.

### CORS errors in the browser console
- This happens when the script has not been deployed as a Web App, or the deployment is stale. Go to Deploy → Manage deployments and confirm a Web App deployment exists with status "Active".

### Sheets not created after running `initSheets()`
- Check the Execution log in Apps Script for error messages.
- Verify that you granted all permissions when prompted during the authorization step.
- Try running `initSheets()` again from the **Run** menu at the top of the editor.

---

## Common Questions

**Q: Is my data secure?**  
A: Yes. Your data lives in a Google Sheets spreadsheet inside your own Google account. Only you control who can access the spreadsheet itself. The Web App URL exposes the API but not the raw spreadsheet.

**Q: Can multiple people use the app at the same time?**  
A: Yes — the Web App URL can be shared with anyone. All users read from and write to the same spreadsheet, so changes are visible to everyone immediately (after a page refresh).

**Q: Can I move the data to a different spreadsheet later?**  
A: Yes. Create a new spreadsheet, run `initSheets()` after updating the Script Property, and update `SPREADSHEET_ID` in Script Properties. Then redeploy (see Part 5).

**Q: Do I need to pay for anything?**  
A: No. Google Sheets, Apps Script, and GitHub Pages are all free. Netlify's free tier is also more than sufficient for personal use.
