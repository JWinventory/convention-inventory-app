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
  const [volunteers, setVolunteersState] = useState([]);
  const [reviewerName, setReviewerNameState] = useState("");
  const [reviewerEmail, setReviewerEmailState] = useState("");
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

  // live shared settings: notes, the volunteer roster, and the one
  // fixed reviewer (name + email for the review-needed notification).
  useEffect(() => {
    if (!firebaseConfigured) return;
    const ref = doc(db, META_DOC);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setNotes(d.notes || "");
          setVolunteersState(Array.isArray(d.volunteers) ? d.volunteers : []);
          setReviewerNameState(d.reviewerName || "");
          setReviewerEmailState(d.reviewerEmail || "");
        }
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
        events: Array.isArray(item.events) ? item.events : [], // empty = visible for every event
        perUnitQr: Boolean(item.perUnitQr),
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
