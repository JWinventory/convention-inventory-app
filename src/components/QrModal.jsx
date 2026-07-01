import React from "react";
import { Modal } from "./Modal";
import { QRBox } from "./QRBox";
import { S } from "../styles";

export function QrModal({ item, onClose }) {
  const payload = JSON.stringify({ id: item.id, name: item.name, category: item.category });
  return (
    <Modal onClose={onClose} title={item.name}>
      <QRBox payload={payload} />
      <div style={S.qrCaption}>Scan this code to check this item in or out.</div>
    </Modal>
  );
}
