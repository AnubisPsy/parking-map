// Almacén mínimo de avisos para notificar errores fuera del árbol de un formulario
let toasts = [];
let nextId = 1;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function showToast(message) {
  const id = nextId++;
  toasts = [...toasts, { id, message }];
  emit();
  setTimeout(() => dismissToast(id), 6000);
}

export function subscribeToasts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getToasts = () => toasts;
