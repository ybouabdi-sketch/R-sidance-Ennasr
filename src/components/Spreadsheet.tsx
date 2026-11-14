import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Upload, Save } from 'lucide-react';
import { Button } from './ui/Button';
import * as XLSX from 'xlsx';

interface SpreadsheetProps {
  data: any[];
  columns: { key: string; label: string; type?: string; options?: string[] }[];
  onSave: (data: any[]) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}

export const Spreadsheet: React.FC<SpreadsheetProps> = ({ data, columns, onSave, onDelete, onAdd }) => {
  const { t } = useTranslation();
  const [localData, setLocalData] = useState(data);

  const handleCellChange = (index: number, key: string, value: any) => {
    const newData = [...localData];
    newData[index] = { ...newData[index], [key]: value };
    setLocalData(newData);
  };

  const handleSave = () => {
    onSave(localData);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="p-4 md:p-6 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 dark:bg-slate-700/30">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
          {t('Spreadsheet View')}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onAdd} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('Add Row')}
          </Button>
          <Button variant="secondary" onClick={() => {
            const worksheet = XLSX.utils.json_to_sheet(localData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
            XLSX.writeFile(workbook, "Spreadsheet.xlsx");
          }} className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {t('Export')}
          </Button>
          <Button variant="primary" onClick={handleSave} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            {t('Save All')}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 dark:bg-slate-700">
              {columns.map((col) => (
                <th key={col.key} className="p-3 text-xs font-bold uppercase tracking-wider border border-gray-200 dark:border-slate-600">
                  {col.label}
                </th>
              ))}
              <th className="p-3 text-xs font-bold uppercase tracking-wider border border-gray-200 dark:border-slate-600 w-16">
                {t('Actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {localData.map((row, rowIndex) => (
              <tr key={row.id || rowIndex} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="p-0 border border-gray-200 dark:border-slate-600">
                    {col.type === 'select' ? (
                      <select
                        className="w-full p-3 bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 text-sm"
                        value={row[col.key]}
                        onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                      >
                        {col.options?.map((opt) => (
                          <option key={opt} value={opt}>{t(opt.charAt(0).toUpperCase() + opt.slice(1).replace('_', ' '))}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={col.type || 'text'}
                        className="w-full p-3 bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 text-sm"
                        value={row[col.key] || ''}
                        onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                      />
                    )}
                  </td>
                ))}
                <td className="p-2 border border-gray-200 dark:border-slate-600 text-center">
                  <button
                    onClick={() => onDelete(row.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
