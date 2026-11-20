// Handing a file to the player: the share sheet where the browser can share files (on Android
// it goes straight to a chat app), else a download.

export type Delivered = 'shared' | 'saved' | 'cancelled';

export function downloadFile(file: File): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Shares the file, or downloads it when sharing files is not possible. Closing the share sheet downloads nothing. */
export async function shareOrDownload(file: File): Promise<Delivered> {
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    /* sharing failed: fall through to a download */
  }
  downloadFile(file);
  return 'saved';
}
