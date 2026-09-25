export default function ConfirmDialog({
  title,
  text,
  confirmLabel,
  isEn,
  busy,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="modal-overlay">
      <div
        className="modal-box confirm-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h2 className="modal-title" id="confirm-dialog-title">
          {title}
        </h2>
        <p className="confirm-text">{text}</p>
        <div className="modal-actions modal-command-bar">
          <button
            className="btn btn-action btn-danger modal-primary"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button className="btn btn-outline modal-dismiss" disabled={busy} onClick={onCancel}>
            {isEn ? 'Cancel' : 'Скасувати'}
          </button>
        </div>
      </div>
    </div>
  )
}
