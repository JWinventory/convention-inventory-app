import React from "react";
import { S } from "../styles";
import { Icon } from "./Icon";

export function Modal({ title, children, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div style={S.modalTitle}>{title}</div>
          <button style={S.modalClose} onClick={onClose}>
            <Icon.close />
          </button>
        </div>
        <div style={S.modalBody}>{children}</div>
      </div>
    </div>
  );
}
