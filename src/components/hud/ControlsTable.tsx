'use client';

import { useMessages } from '@/i18n/useMessages';

/** Keyboard controls reference (shown in Settings). */
export function ControlsTable() {
  const m = useMessages();
  return (
    <table className="mt-2 w-full text-sm">
      <tbody>
        {m.controls.map((c) => (
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
