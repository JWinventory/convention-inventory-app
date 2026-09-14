import React, { useRef, useState } from "react";

// Wraps the whole app so pulling down from the very top of the page
// (only when already scrolled all the way up) triggers a full reload —
// a simple safety net for "something feels stuck" without needing any
// external library. Shows a small indicator that follows the pull so
// it feels like the native gesture on other apps.
const PULL_THRESHOLD = 70;
const MAX_PULL = 120;

export function PullToRefresh({ children }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(null);
  const pullingRef = useRef(false);

  function handleTouchStart(e) {
    if (refreshing) return;
    if (window.scrollY <= 0) {
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    }
  }

  function handleTouchMove(e) {
    if (!pullingRef.current || startYRef.current == null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0 && window.scrollY <= 0) {
      setPull(Math.min(delta * 0.5, MAX_PULL));
    } else {
      pullingRef.current = false;
      setPull(0);
    }
  }

  function handleTouchEnd() {
    if (pullingRef.current && pull > PULL_THRESHOLD) {
      setRefreshing(true);
      setPull(PULL_THRESHOLD);
      window.location.reload();
      return;
    }
    setPull(0);
    pullingRef.current = false;
    startYRef.current = null;
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div
        style={{
          height: pull,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: pull === 0 ? "height 0.2s ease" : "none",
        }}
      >
        {pull > 10 && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#888" }}>
            {refreshing ? "Refreshing…" : pull > PULL_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
