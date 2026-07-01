# Convention Inventory App

A standalone, mobile-friendly inventory tracker for convention/assembly
equipment. Scan a QR code (or type a name) to check items in and out,
everyone using the app sees live updates, and an Admin tab lets you add,
edit, or delete catalog items — including uploading your own photos.

This app is **not** a Claude artifact — it's a normal web app you host
yourself (free, on Vercel) with a free Firebase backend for the shared
data.

---

## 1. Create your Firebase project (5 minutes, free)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**. Name it anything (e.g. "convention-inventory") and finish the wizard — you can decline Google Analytics.
2. In the left sidebar, click **Build → Firestore Database → Create database**. Choose **Start in test mode** (open reads/writes — fine for a small trusted group of volunteers; see the security note at the bottom to lock it down later). Pick any region close to you.
3. Click the gear icon → **Project settings**. Under "Your apps," click the **</> (Web)** icon to register a new web app. Give it any nickname. You don't need Firebase Hosting.
4. Firebase will show you a `firebaseConfig` object with keys like `apiKey`, `authDomain`, etc. Keep this tab open — you'll need it in step 3 below.

## 2. Get the code running locally

You'll need [Node.js](https://nodejs.org) installed (v18+).

```bash
cd convention-inventory-app
npm install
cp .env.example .env
```

Open `.env` in a text editor and paste in the values from your Firebase
config (step 4 above):

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=convention-inventory-xxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=convention-inventory-xxxx
VITE_FIREBASE_STORAGE_BUCKET=convention-inventory-xxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

Then run:

```bash
npm run dev
```

Open the printed `localhost` URL. Go to the **Admin** tab and click
**Load Starter Inventory** to seed all 73 items from the original
Spanish Regional Convention inventory sheet (with their photos). From
then on, use **Add Item** / **Edit** / **Delete** on that same tab to
manage the catalog — no code editing required.

## 3. Deploy it so anyone can use it (Vercel, free)

1. Push this folder to a GitHub repo (or use `npx vercel` directly from
   the folder without GitHub — either works).
2. Go to [vercel.com](https://vercel.com), sign in, and **Add New →
   Project**, importing this repo (or run `npx vercel` from inside the
   folder and follow the prompts).
3. Vercel auto-detects the Vite framework. Before deploying, add the
   same six `VITE_FIREBASE_*` environment variables from your `.env`
   file under **Settings → Environment Variables**.
4. Deploy. You'll get a URL like `convention-inventory.vercel.app` —
   share that with your volunteers.
5. On an iPhone: open the link in Safari → Share → **Add to Home
   Screen**. On Android: open in Chrome → menu → **Add to Home screen**.

Every volunteer who opens that link sees the same live inventory —
no Claude account needed.

## What's different from the Claude-artifact version

| | Claude artifact version | This standalone version |
|---|---|---|
| Shared data | `window.storage` (only works inside a shared Claude link) | Firebase Firestore (real-time, works anywhere) |
| Catalog editing | Fixed at build time | Add/Edit/Delete items from the **Admin** tab, with photo upload |
| QR scanning | Paste-box demo only | Real camera scanning (`html5-qrcode`), with a manual-entry fallback for devices without a camera |
| Request details | Not persisted between sessions | Saved on-device (`localStorage`) so it's remembered next visit |
| Hosting | Only inside claude.ai | Any static host (Vercel, Netlify, your own server) |

## What's still a mock (intentionally, to keep this simple)

- **Submit & Notify** shows a summary and a success screen but doesn't
  send a real email yet. To wire it up, add a call to SendGrid, Resend,
  or a Zapier/Make webhook inside `src/components/SubmitModal.jsx`'s
  `onSubmit` handler.

## Project structure

```
src/
  App.jsx                  – top-level layout, tabs, state wiring
  firebase.js               – Firebase init (reads .env)
  useInventory.js            – Firestore real-time sync + CRUD hook
  seedData.js                – the 73 starter items (name/category/qty/photo)
  imageUtils.js               – resizes uploaded photos before saving
  styles.js                    – shared style tokens (colors, layout)
  components/
    ItemCard.jsx, RequesterForm.jsx, ScanModal.jsx, QrModal.jsx,
    QRBox.jsx, SubmitModal.jsx, NotesSection.jsx, AdminPage.jsx,
    Modal.jsx, Icon.jsx
```

## Locking down Firestore security later

Test mode leaves the database open to anyone with your project ID, which
is fine for a small volunteer group but worth tightening if you want more
control. Two easy options:

- **Simplest:** in Firestore rules, restrict writes to a shared "admin
  passcode" check, or set an expiry date on the test-mode rules (Firebase
  prompts you before they expire).
- **More robust:** add Firebase Authentication (e.g. anonymous or email
  sign-in) and update the Firestore rules to require `request.auth != null`.
  This is a larger change — ask if you'd like help adding it.
