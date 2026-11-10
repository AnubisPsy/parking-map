import { useState, useCallback } from 'react';
import Modal from './ui/Modal';

export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback(({ title, message, confirmLabel = 'Eliminar', danger = true }) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, danger, resolve });
    });
  }, []);

  function accept() {
    state?.resolve(true);
    setState(null);
  }

  function cancel() {
    state?.resolve(false);
    setState(null);
  }

  const dialog = state ? (
    <ConfirmModal
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
      onConfirm={accept}
      onCancel={cancel}
    />
  ) : null;

  return { confirm, dialog };
}

export default function ConfirmModal({ title, message, confirmLabel = 'Eliminar', danger = true, onConfirm, onCancel }) {
  return (
    <Modal
      title={title}
      size="sm"
      closeOnBackdrop
      onClose={onCancel}
      footer={(
        <>
          <button onClick={onCancel} className="btn btn-secondary">Cancelar</button>
          <button onClick={onConfirm} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} data-autofocus>
            {confirmLabel}
          </button>
        </>
      )}
    >
      {message && <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{message}</p>}
    </Modal>
  );
}
