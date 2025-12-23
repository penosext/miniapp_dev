import { openSoftKeyboard as openKeyboard } from '../../utils/softKeyboardUtils';

export function formatTime(ts: number): string {
  const date = new Date(ts * 1000);
  return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')} ` +
         `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes/(1024*1024)).toFixed(1)} MB`;
  return `${(bytes/(1024*1024*1024)).toFixed(1)} GB`;
}

export function openSoftKeyboard(initialValue: () => string, callback: (v: string) => void, validator?: (v: string) => string | void) {
  openKeyboard(initialValue, callback, validator);
}
