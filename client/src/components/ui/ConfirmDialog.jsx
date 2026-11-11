
import { AlertTriangle } from 'lucide-react'

function ConfirmDialog({
  isOpen,
  title = 'Confirm action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  onConfirm,
  onCancel,
  variant = 'danger',
}) {
  if (!isOpen) return null

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onCancel()
        }
      }}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
      >
        <div className={`dialog-icon ${variant}`}>
          <AlertTriangle size={24} />
        </div>

        <h2 id="dialog-title">{title}</h2>

        <p id="dialog-message">{message}</p>

        <div className="dialog-actions">
          <button
            type="button"
            className="dialog-cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className={`dialog-confirm ${variant}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Please wait...' : confirmText}
          </button>
        </div>
      </section>
    </div>
  )
}

export default ConfirmDialog