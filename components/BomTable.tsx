import React from 'react';
import { BomItem } from '../types';

interface BomTableProps {
    bomData: BomItem[];
    isLoading: boolean;
}

const BomTable: React.FC<BomTableProps> = ({ bomData, isLoading }) => {

    if (isLoading) {
        return (
            <div className="animate-pulse p-4 space-y-4">
                <div className="h-8 bg-slate-700 rounded w-full"></div>
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-10 bg-slate-700/50 rounded w-full"></div>
                ))}
            </div>
        );
    }
    
    if (bomData.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500">
                <p>BOM data will be displayed here.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-cyan-400 uppercase bg-slate-700/50">
                    <tr>
                        <th scope="col" className="px-4 py-3">Dwg No.</th>
                        <th scope="col" className="px-4 py-3">Item No.</th>
                        <th scope="col" className="px-4 py-3">Name</th>
                        <th scope="col" className="px-4 py-3">Size</th>
                        <th scope="col" className="px-4 py-3">Length</th>
                        <th scope="col" className="px-4 py-3">Unit</th>
                        <th scope="col" className="px-4 py-3">Model</th>
                        <th scope="col" className="px-4 py-3">Description</th>
                        <th scope="col" className="px-4 py-3">Material</th>
                        <th scope="col" className="px-4 py-3">Standard</th>
                        <th scope="col" className="px-4 py-3 text-center">Qty</th>
                        <th scope="col" className="px-4 py-3">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    {bomData.map((item, index) => (
                        <tr key={index} className="border-b border-slate-700 hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{item.drawingNumber}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.itemNo}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.size}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.length}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.unit}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.modelType}</td>
                            <td className="px-4 py-3">{item.description}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.material}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.standard}</td>
                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                            <td className="px-4 py-3">{item.remarks}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default BomTable;