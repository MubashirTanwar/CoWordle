import { v4 as uuidv4 } from 'uuid';

const ID_KEY = 'cowordle_id';
const NAME_KEY = 'cowordle_name';

export function getPlayerId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) { id = uuidv4(); localStorage.setItem(ID_KEY, id); }
  return id;
}

export function getSavedName(): string {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export function saveName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}
