import React from 'react';

export const DataTable = ({ columns, data }: { columns: { key: string, header: string }[], data: Record<string, React.ReactNode>[] }) => {
  return (
    <div className="overflow-x-auto w-full rounded border border-gray-300 bg-white shadow-sm">
      <table className="w-full text-sm text-left text-ink border-collapse">
        <thead className="bg-gray-100 border-b border-gray-300">
          <tr>
            {columns.map(col => (
              <th key={col.key} className="px-4 py-3 font-semibold uppercase tracking-wider text-xs">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-gray-200 hover:bg-gray-50 focus-within:bg-gray-50 transition-colors" tabIndex={0}>
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3">
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
