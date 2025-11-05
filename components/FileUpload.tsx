import React, { useCallback, useState } from 'react';

interface FileUploadProps {
    onFileSelect: (files: FileList | null) => void | Promise<void>;
    selectedFiles: File[];
}

const PdfIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const ImageIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
);


const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, selectedFiles }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelect(e.dataTransfer.files);
        }
    }, [onFileSelect]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelect(e.target.files);
        }
    };

    const renderContent = () => {
        if (selectedFiles.length > 0) {
             return (
                <div className="relative group w-full h-full flex items-center justify-center">
                    <ul className="text-left max-h-48 overflow-y-auto p-2 space-y-1 w-full">
                        {selectedFiles.map(file => (
                            <li key={file.name + file.size} className="text-sm flex items-center gap-2 p-1.5 bg-slate-700/50 rounded-md">
                                {file.type === 'application/pdf' 
                                    ? <PdfIcon className="w-5 h-5 text-red-400 flex-shrink-0" /> 
                                    : <ImageIcon className="w-5 h-5 text-cyan-400 flex-shrink-0" />}
                                <span className="truncate text-slate-300" title={file.name}>{file.name}</span>
                            </li>
                        ))}
                    </ul>
                     <label htmlFor="file-upload" className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md cursor-pointer">
                        <span className="text-white font-bold">Change Files</span>
                    </label>
                </div>
            );
        }

        return (
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-slate-300 font-semibold">Click to upload or drag & drop</p>
                <p className="text-xs text-slate-500">PNG, JPG, or PDF files (max 20 pages per PDF)</p>
            </label>
        );
    }

    return (
        <div 
            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-300 min-h-[220px] flex items-center justify-center ${isDragging ? 'border-cyan-400 bg-slate-700/50' : 'border-slate-600 hover:border-cyan-500'}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <input
                type="file"
                id="file-upload"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept="image/png, image/jpeg, application/pdf"
                onChange={handleFileChange}
                multiple
            />
            {renderContent()}
        </div>
    );
};

export default FileUpload;