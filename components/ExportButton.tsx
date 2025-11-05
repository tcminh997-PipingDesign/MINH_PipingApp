import React from 'react';
import { AnalyzedFile } from '../types';

declare const XLSX: any;
declare const JSZip: any;

interface ExportButtonProps {
    analyzedData: AnalyzedFile[];
    combineExport: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ analyzedData, combineExport }) => {
    
    const createSheetFromData = (data: any[]) => {
        const dataToExport = data.map(item => ({
            '図番': item.drawingNumber,
            'No.': item.itemNo,
            '名称': item.name,
            'サイズ': item.size,
            '長さ': item.length,
            '単位': item.unit,
            '型式': item.modelType,
            '説明': item.description,
            '材質': item.material,
            '規格': item.standard,
            '台数': item.quantity,
            '注記': item.remarks,
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);

        // Auto-fit columns
        const cols = Object.keys(dataToExport[0] || {});
        const colWidths = cols.map(key => ({
            wch: Math.max(
                key.length,
                ...dataToExport.map(row => (row[key as keyof typeof row] ?? '').toString().length)
            ) + 1
        }));
        worksheet['!cols'] = colWidths;
        return worksheet;
    }

    const handleExport = async () => {
        // Filter for files that actually have BOM items extracted
        const filesWithBoms = analyzedData.filter(d => d.bomItems.length > 0);
        if (filesWithBoms.length === 0) return;

        if (combineExport) {
            // Combined export to a single Excel file
            const allBomItems = filesWithBoms.flatMap(d => d.bomItems);
            const worksheet = createSheetFromData(allBomItems);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'BOM');

            // If only one file has BOM items, use its name for the export. Otherwise, use a generic name.
            const fileName = filesWithBoms.length === 1
                ? `${filesWithBoms[0].fileName.replace(/\.[^/.]+$/, '')}.xlsx`
                : 'bom-export.xlsx';
                
            XLSX.writeFile(workbook, fileName);
        } else {
            // Separate export to a zip file
            const zip = new JSZip();
            
            filesWithBoms.forEach(fileData => {
                const worksheet = createSheetFromData(fileData.bomItems);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'BOM');
                
                // Generate Excel file as a binary buffer
                const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                
                // Add the file to the zip
                const excelFileName = fileData.fileName.replace(/\.[^/.]+$/, "") + ".xlsx";
                zip.file(excelFileName, excelBuffer);
            });

            // Generate the zip file and trigger download
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = 'bom-exports.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const allBomItems = analyzedData.flatMap(d => d.bomItems);

    return (
        <button
            onClick={handleExport}
            disabled={allBomItems.length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 shadow-sm disabled:shadow-none"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Export Excel
        </button>
    );
};