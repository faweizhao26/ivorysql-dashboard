import { validateMaterialInput, type ActivityMaterialType } from './material-validation';

export function materialDraft() {
  return { material_type: 'photo' as ActivityMaterialType, title: '', url: '', thumbnail_url: '', access_note: '', source_url: '', sort_order: 0 };
}

export function materialPayload(eventId: number, draft: ReturnType<typeof materialDraft>) {
  return validateMaterialInput({ ...draft, event_id: eventId });
}
