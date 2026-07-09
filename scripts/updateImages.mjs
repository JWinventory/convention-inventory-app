// One-time script: updates the photo on items that already exist in your live
// Firestore database, matching by exact item name.
//
// Run from the project's "app" folder with:
//   node --env-file=.env scripts/updateImages.mjs
//
// (Needs Node 20.6+ for --env-file. If your Node is older, install dotenv
// with `npm install dotenv` and add `import "dotenv/config";` as the very
// first line of this file instead.)

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const updates = JSON.parse(readFileSync(join(__dirname, "image_updates_data.json"), "utf8"));

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig).filter(([, v]) => !v);
if (missing.length) {
  console.error("Missing Firebase config values:", missing.map(([k]) => k).join(", "));
  console.error("Make sure you're running this from inside the 'app' folder, with a filled-in .env file.");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log(`Loaded ${Object.keys(updates).length} new photos to apply.`);
  const snap = await getDocs(collection(db, "items"));
  console.log(`Found ${snap.size} items in your live catalog.`);

  let updated = 0;
  let skipped = 0;
  const unmatchedNames = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const newImg = updates[data.name];
    if (newImg) {
      // eslint-disable-next-line no-await-in-loop
      await updateDoc(doc(db, "items", docSnap.id), { img: newImg });
      updated += 1;
      process.stdout.write(".");
    } else {
      skipped += 1;
      unmatchedNames.push(data.name);
    }
  }

  console.log("\n\nDone.");
  console.log(`Updated: ${updated}`);
  console.log(`Left as-is (no new photo provided for these): ${skipped}`);
  if (unmatchedNames.length) {
    console.log(unmatchedNames.map((n) => "  - " + n).join("\n"));
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
