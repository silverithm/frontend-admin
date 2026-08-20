/**
 * 파일 선택·드롭 공용 헬퍼.
 *
 * 드래그앤드롭으로 폴더를 떨어뜨리면 브라우저는 파일이 아니라 디렉터리 엔트리를 주므로,
 * webkitGetAsEntry로 재귀 순회해 안의 파일을 전부 꺼낸다. 폴더 선택 input(webkitdirectory)은
 * FileList에 상대 경로(webkitRelativePath)가 실려 오므로 그대로 옮겨 담는다.
 */

export interface PickedFile {
  file: File;
  /** 폴더에서 왔으면 "폴더/하위/파일.pdf", 낱개 파일이면 파일명 그대로 */
  path: string;
}

/** 드롭 이벤트에서 파일·폴더를 모두 꺼낸다 (폴더는 재귀 순회) */
export async function collectFromDataTransfer(dataTransfer: DataTransfer): Promise<PickedFile[]> {
  const picked: PickedFile[] = [];

  // items는 이벤트 핸들러가 끝나면 비워지므로 엔트리를 먼저 전부 붙잡아 둔다
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(dataTransfer.items)) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length === 0) {
    // webkitGetAsEntry를 지원하지 않는 환경 — 파일만이라도 받는다
    for (const file of Array.from(dataTransfer.files)) {
      picked.push({ file, path: file.name });
    }
    return picked;
  }

  for (const entry of entries) {
    await walkEntry(entry, '', picked);
  }
  return picked;
}

async function walkEntry(entry: FileSystemEntry, parentPath: string, out: PickedFile[]): Promise<void> {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;

  if (entry.isFile) {
    // macOS 폴더를 통째로 끌면 딸려오는 메타 파일은 걸러낸다
    if (entry.name === '.DS_Store' || entry.name.startsWith('._')) return;
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    out.push({ file, path });
    return;
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries는 한 번에 최대 100개만 주므로 빈 배열이 올 때까지 반복해야 폴더 전체를 읽는다
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (batch.length === 0) break;
      for (const child of batch) {
        await walkEntry(child, path, out);
      }
    }
  }
}

/** input[type=file] (multiple 또는 webkitdirectory)의 FileList를 옮겨 담는다 */
export function collectFromFileList(list: FileList): PickedFile[] {
  return Array.from(list)
    .filter((file) => file.name !== '.DS_Store' && !file.name.startsWith('._'))
    .map((file) => ({
      file,
      path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));
}
