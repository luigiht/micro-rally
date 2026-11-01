'use client';

import { useMessages } from '@/i18n/useMessages';

interface ControlRow {
  keys: string;
  action: string;
}

function Rows({ rows, className }: { rows: readonly ControlRow[]; className: string }) {
  return (
    <table className={`mt-2 w-full text-sm ${className}`}>
      <tbody>
        {rows.map((c) => (
          <tr key={c.keys} className="border-t-2 border-dashed border-ink/20">
            <th
              scope="row"
              className="py-1 pr-3 text-left font-mono font-semibold whitespace-nowrap"
            >
              {c.keys}
            </th>
            <td className="py-1">{c.action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Controls reference (shown in Settings): keyboard on desktop, the on-screen pads on touch devices. */
export function ControlsTable() {
  const m = useMessages();
  return (
    <>
      <Rows rows={m.controls} className="coarse:hidden" />
      <Rows rows={m.controlsTouch} className="hidden coarse:table" />
    </>
  );
}
