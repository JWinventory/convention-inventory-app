import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db, firebaseConfigured } from "./firebase";
import { SEED_ITEMS } from "./seedData";

const ITEMS_COL = "items";
const ORDERS_COL = "orders";
const META_DOC = "meta/shared";

export function useInventory() {
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("yellow"); // green | yellow | red
  const [ready, setReady] = useState(false);

  // live items
  useEffect(() => {
    if (!firebaseConfigured) {
      setSyncStatus("red");
      setLoading(false);
      return;
    }
    const q = query(collection(db, ITEMS_COL), orderBy("category"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(next);
        setLoading(false);
        setSyncStatus("green");
        setReady(true);
      },
      () => setSyncStatus("red")
    );
    return () => unsub();
  }, []);

  // live orders (submitted equipment requests)
  useEffect(() => {
    if (!firebaseConfigured) return;
    const q = query(collection(db, ORDERS_COL), orderBy("createdAtMs", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // live shared notes
  useEffect(() => {
    if (!firebaseConfigured) return;
    const ref = doc(db, META_DOC);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) setNotes(snap.data().notes || "");
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const seedIfEmpty = useCallback(async () => {
    if (!firebaseConfigured) return { ok: false, reason: "not-configured" };
    const snap = await getDocs(collection(db, ITEMS_COL));
    if (!snap.empty) return { ok: false, reason: "not-empty", count: snap.size };
    for (const item of SEED_ITEMS) {
      // eslint-disable-next-line no-await-in-loop
      await addDoc(collection(db, ITEMS_COL), item);
    }
    return { ok: true, count: SEED_ITEMS.length };
  }, []);

  const addItem = useCallback(async (item) => {
    setSyncStatus("yellow");
    try {
      const images = Array.isArray(item.images) ? item.images : item.img ? [item.img] : [];
      await addDoc(collection(db, ITEMS_COL), {
        name: item.name,
        category: item.category,
        total: Number(item.total) || 0,
        note: item.note || "",
        images,
        img: images[0] || null, // kept for backward compatibility with older code paths
        out: 0,
        log: [],
      });
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
      throw e;
    }
  }, []);

  const updateItem = useCallback(async (id, patch) => {
    setSyncStatus("yellow");
    try {
      const finalPatch = { ...patch };
      if (Array.isArray(patch.images)) {
        finalPatch.img = patch.images[0] || null; // keep in sync for backward compatibility
      }
      await updateDoc(doc(db, ITEMS_COL, id), finalPatch);
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
      throw e;
    }
  }, []);

  const deleteItem = useCallback(async (id) => {
    setSyncStatus("yellow");
    try {
      await deleteDoc(doc(db, ITEMS_COL, id));
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
      throw e;
    }
  }, []);

  // note is optional — set when an item is checked in manually because
  // its QR code was missing or damaged, so there's a record of why.
  const applyCheckChange = useCallback(async (id, delta, who, note) => {
    setSyncStatus("yellow");
    try {
      const ref = doc(db, ITEMS_COL, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      let nextOut = (data.out || 0) + delta;
      if (nextOut < 0) nextOut = 0;
      if (nextOut > data.total) nextOut = data.total;
      const entry = {
        who: who || "Unnamed volunteer",
        action: delta > 0 ? "Checked OUT" : "Checked IN",
        qty: Math.abs(delta),
        at: new Date().toLocaleString(),
        ...(note ? { note } : {}),
      };
      const nextLog = [entry, ...(data.log || [])].slice(0, 25);
      await updateDoc(ref, { out: nextOut, log: nextLog });
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
    }
  }, []);

  // Creates the order and returns its new id, so the requester's own
  // browser can track "this is my order" through the fulfillment/
  // check-in phases. Starts life with status "submitted".
  const addOrder = useCallback(async (order) => {
    setSyncStatus("yellow");
    try {
      const ref = await addDoc(collection(db, ORDERS_COL), {
        requesterName: order.requester.name || "",
        requesterPhone: order.requester.phone || "",
        requesterEmail: order.requesterEmail || "",
        eventDate: order.requester.eventDate || "",
        pickupDate: order.requester.pickupDate || "",
        returnDate: order.requester.returnDate || "",
        items: order.items, // [{ name, qty }]
        notes: order.notes || "",
        status: "submitted", // submitted -> fulfilled (then "completed" is derived once items are checked back in)
        createdAtMs: Date.now(),
        createdAtLabel: new Date().toLocaleString(),
      });
      setSyncStatus("green");
      return ref.id;
    } catch (e) {
      setSyncStatus("red");
      return null;
    }
  }, []);

  // Flips an order's status (e.g. "submitted" -> "fulfilled" when
  // staff have gathered the items and are ready to notify the requester).
  const updateOrderStatus = useCallback(async (orderId, status) => {
    setSyncStatus("yellow");
    try {
      await
