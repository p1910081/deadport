/** Result of parsing one row from Windows `tasklist /FI "PID eq <pid>" /V /FO CSV`. */
export interface TasklistEntry {
  pid: number;
  name: string;
  user: string;
}

/**
 * Parse CSV output of `tasklist /FO CSV /V`.
 * Header row is skipped. Columns (0-indexed): Image Name, PID, Session Name,
 * Session#, Mem Usage, Status, User Name, CPU Time, Window Title.
 *
 * Example:
 *   "Image Name","PID","Session Name","Session#","Mem Usage","Status","User Name","CPU Time","Window Title"
 *   "node.exe","48291","Console","1","50,652 K","Running","DESKTOP\alex","0:00:01","N/A"
 *
 * TODO(v0.1): handle quoted fields that contain commas (rare in practice for these columns).
 */
export function parseTasklist(csv: string): TasklistEntry[] {
  const results: TasklistEntry[] = [];
  const lines = csv.split('\n');
  let headerSkipped = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Skip the header row
    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    // Naive CSV split: remove surrounding quotes and split on ","
    const cols = line.split('","');
    if (cols.length < 7) continue;

    const name = (cols[0] ?? '').replace(/^"/, '');
    const pidStr = cols[1] ?? '';
    const user = (cols[6] ?? '').replace(/"$/, '');

    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) continue;

    results.push({ pid, name, user });
  }

  return results;
}
