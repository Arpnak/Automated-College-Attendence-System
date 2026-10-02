import EmptyState from '../atoms/EmptyState';
import { Table2 } from 'lucide-react';

// columns: [{ key, header, render?(row) }]
export default function DataTable({ columns, rows, emptyTitle = 'Nothing here yet', emptyDescription, rowKey = 'id' }) {
  if (!rows?.length) {
    return <EmptyState icon={Table2} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-700/10 dark:border-ink-700/60 text-left text-xs uppercase tracking-wide text-fog">
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-4 py-3 font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]} className="border-b border-ink-700/5 dark:border-ink-700/30 last:border-0 hover:bg-ink-700/5 dark:hover:bg-ink-800/40">
              {columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-3 text-ink-950 dark:text-mist">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
