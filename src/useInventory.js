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
      await addDoc(collection(db, ITEMS_COL), {
        name: item.name,
        category: item.category,
        total: Number(item.total) || 0,
        note: item.note || "",
        img: item.img || null,
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
      await updateDoc(doc(db, ITEMS_COL, id), patch);
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

  const applyCheckChange = useCallback(async (id, delta, who) => {
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
      };
      const nextLog = [entry, ...(data.log || [])].slice(0, 25);
      await updateDoc(ref, { out: nextOut, log: nextLog });
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
    }
  }, []);

  const addOrder = useCallback(async (order) => {
    setSyncStatus("yellow");
    try {
      await addDoc(collection(db, ORDERS_COL), {
        requesterName: order.requester.name || "",
        requesterPhone: order.requester.phone || "",
        requesterEmail: order.requesterEmail || "",
        eventDate: order.requester.eventDate || "",
        pickupDate: order.requester.pickupDate || "",
        returnDate: order.requester.returnDate || "",
        items: order.items, // [{ name, qty }]
        notes: order.notes || "",
        createdAtMs: Date.now(),
        createdAtLabel: new Date().toLocaleString(),
      });
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
    }
  }, []);

  const saveNotes = useCallback(async (text) => {
    setSyncStatus("yellow");
    try {
      await setDoc(doc(db, META_DOC), { notes: text, updatedAt: serverTimestamp() }, { merge: true });
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
    }
  }, []);

  return {
    items,
    orders,
    notes,
    loading,
    syncStatus,
    ready,
    seedIfEmpty,
    addItem,
    updateItem,
    deleteItem,
    applyCheckChange,
    addOrder,
    saveNotes,
  };
}
