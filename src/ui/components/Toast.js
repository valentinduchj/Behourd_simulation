import { h } from '../../utils/dom.js';

/** Notification brève. type : info | success | warning | error */
export function showToast(message, type = 'info', duration = 2800) {
  const toast = h('div', { class: `toast toast-${type}`, role: 'status' }, message);
  document.getElementById('toast-root').append(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
