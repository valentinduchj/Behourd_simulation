import { SCREENS } from '../../core/screenIds.js';
import { promptModal } from '../components/Modal.js';

/**
 * Accès au module Admin (Options › Administration) : code demandé, puis ouverture. Mêmes
 * règles qu'avant le déplacement depuis l'écran principal (services.adminAuth).
 */
export async function openAdminAccess({ services, navigate }) {
  const { adminAuth } = services;
  const code = await promptModal({
    title: 'Module Admin',
    message: 'Saisissez le code d’accès.',
    type: 'password',
    confirmLabel: 'Entrer',
    validate: (value) => (adminAuth.verify(value) ? null : 'Code incorrect. Accès refusé.'),
  });
  if (code !== null && adminAuth.isUnlocked()) {
    navigate(SCREENS.ADMIN);
    return true;
  }
  return false;
}
