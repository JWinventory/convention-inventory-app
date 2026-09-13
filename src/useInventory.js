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
const VOLUNTEERS_COL = "volunteers";
const META_DOC = "meta/shared";

export function useInventory() {
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notes, setNotes] = useState("");
  const [volunteers, setVolunteers] = useState([]);
  const [volunteersReady, setVolunteersReady] = useState(false);
  const [reviewerId, setReviewerId] = useState("");
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

  // live volunteer roster — each volunteer's own record (name, phone,
  // email, permissions, and their password hash+salt once they've set
  // one). volunteersReady flips true after the first snapshot arrives,
  // so the UI can tell "still loading" apart from "genuinely empty."
  useEffect(() => {
    if (!firebaseConfigured) return;
    const q = query(collection(db, VOLUNTEERS_COL), orderBy("name"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setVolunteers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setVolunteersReady(true);
      },
      () => setVolunteersReady(true)
    );
    return () => unsub();
  }, []);

  // live shared settings: notes, and which volunteer is the reviewer.
  useEffect(() => {
    if (!firebaseConfigured) return;
    const ref = doc(db, META_DOC);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setNotes(d.notes || "");
          setReviewerId(d.reviewerId || "");
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
        eventType: order.requester.eventType || "",
        eventDate: order.requester.eventDate || "",
        pickupDate: order.requester.pickupDate || "",
        returnDate: order.requester.returnDate || "",
        items: order.items, // [{ name, qty }]
        notes: order.notes || "",
        status: "submitted", // submitted -> reviewed -> assigned -> fulfilled (then "completed" is derived once items are checked back in)
        reviewedBy: [],
        assignedFillers: [],
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

  // Flips an order's status (e.g. "assigned" -> "fulfilled" when
  // staff have gathered the items and are ready to notify the requester).
  const updateOrderStatus = useCallback(async (orderId, status) => {
    setSyncStatus("yellow");
    try {
      await updateDoc(doc(db, ORDERS_COL, orderId), { status });
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
    }
  }, []);

  // General-purpose order update — used for the review step and the
  // fill-assignment step, which each touch a few fields at once.
  const updateOrder = useCallback(async (orderId, patch) => {
    setSyncStatus("yellow");
    try {
      await updateDoc(doc(db, ORDERS_COL, orderId), patch);
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

  // Creates a new volunteer record (no password yet — they set their
  // own the first time they log in). Returns the new id.
  const addVolunteer = useCallback(async ({ name, phone, email, permissions }) => {
    setSyncStatus("yellow");
    try {
      const ref = await addDoc(collection(db, VOLUNTEERS_COL), {
        name: name || "",
        phone: phone || "",
        email: email || "",
        permissions: {
          catalog: Boolean(permissions?.catalog),
          orders: Boolean(permissions?.orders),
          volunteers: Boolean(permissions?.volunteers),
        },
        passwordHash: null,
        passwordSalt: null,
        createdAtMs: Date.now(),
      });
      setSyncStatus("green");
      return ref.id;
    } catch (e) {
      setSyncStatus("red");
      return null;
    }
  }, []);

  const updateVolunteer = useCallback(async (id, patch) => {
    setSyncStatus("yellow");
    try {
      await updateDoc(doc(db, VOLUNTEERS_COL, id), patch);
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
    }
  }, []);

  const deleteVolunteer = useCallback(async (id) => {
    setSyncStatus("yellow");
    try {
      await deleteDoc(doc(db, VOLUNTEERS_COL, id));
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
    }
  }, []);

  // Clears a volunteer's password so their next login prompts them to
  // create a brand new one — this is what "admin resets a password" means.
  const resetVolunteerPassword = useCallback(async (id) => {
    setSyncStatus("yellow");
    try {
      await updateDoc(doc(db, VOLUNTEERS_COL, id), { passwordHash: null, passwordSalt: null });
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
    }
  }, []);

  const setVolunteerPassword = useCallback(async (id, hash, salt) => {
    setSyncStatus("yellow");
    try {
      await updateDoc(doc(db, VOLUNTEERS_COL, id), { passwordHash: hash, passwordSalt: salt });
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
    }
  }, []);

  const saveReviewerId = useCallback(async (id) => {
    setSyncStatus("yellow");
    try {
      await setDoc(doc(db, META_DOC), { reviewerId: id, updatedAt: serverTimestamp() }, { merge: true });
      setSyncStatus("green");
    } catch (e) {
      setSyncStatus("red");
    }
  }, []);

  return {
    items,
    orders,
    notes,
    volunteers,
    volunteersReady,
    reviewerId,
    loading,
    syncStatus,
    ready,
    seedIfEmpty,
    addItem,
    updateItem,
    deleteItem,
    applyCheckChange,
    addOrder,
    updateOrderStatus,
    updateOrder,
    saveNotes,
    addVolunteer,
    updateVolunteer,
    deleteVolunteer,
    resetVolunteerPassword,
    setVolunteerPassword,
    saveReviewerId,
  };
}