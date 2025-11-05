
import React, { useState, useCallback, useEffect } from 'react';
import { AnalyzedFile } from './types';
import { extractBomFromFile } from './services/geminiService';
import FileUpload from './components/FileUpload';
import BomTable from './components/BomTable';
import { ExportButton } from './components/ExportButton';
import { BatchProcessorInstructions } from './components/BatchProcessorInstructions';
import { BatchFileContent } from './components/BatchFileContent';

// Add declaration for the pdf-lib library loaded from CDN
declare const PDFLib: any;

// SVG Icons as components
const BrainCircuitIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.25 8.575a.75.75 0 1 0-1.06-1.061 3.492 3.492 0 0 1-1.086 5.092.75.75 0 1 0 1.06 1.061A5 5 0 0 0 17.25 8.575ZM19.5 6.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 4.125a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM12 17.625a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM5.993 16.007a.75.75 0 1 0-1.06-1.06 3.5 3.5 0 0 1 0-4.95.75.75 0 0 0 1.06-1.06 5 5 0 0 0 0 7.07ZM8.575 6.75a.75.75 0 1 0-1.061-1.06 3.493 3.493 0 0 0-1.085 5.093.75.75 0 1 0 1.06 1.06A5.001 5.001 0 0 1 8.575 6.75ZM4.5 17.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0ZM19.5 17.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
    </svg>
);

const LoaderIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

const RestartIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201-4.42 1 1 0 011.837.802 3.5 3.5 0 005.73 2.812l-1.18.001a1 1 0 110-2h3a1 1 0 011 1v3a1 1 0 11-2 0v-1.191zM4.688 8.576a5.5 5.5 0 019.201 4.42 1 1 0 01-1.837-.802 3.5 3.5 0 00-5.73-2.812l1.18-.001a1 1 0 110 2h-3a1 1 0 01-1-1v-3a1 1 0 112 0v1.191z" clipRule="evenodd" />
    </svg>
);

export default function App() {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [analyzedData, setAnalyzedData] = useState<AnalyzedFile[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState<string | null>(null);
    const [combineExport, setCombineExport] = useState<boolean>(true);

    const handleRestart = useCallback(() => {
        setSelectedFiles([]);
        setAnalyzedData([]);
        setError(null);
        setFileError(null);
        setIsLoading(false);
        setProgressMessage(null);
        // Reset the value of the file input so that the onChange event will
        // fire again if the same file(s) are selected.
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    }, []);

    const handleFilesSelect = async (files: FileList | null) => {
        // Reset state for new selection
        setAnalyzedData([]);
        setError(null);
        setFileError(null);
        setSelectedFiles([]);

        if (!files || files.length === 0) {
            return;
        }

        const validFiles: File[] = [];
        const errors: string[] = [];

        // Asynchronously validate all files
        const validationPromises = Array.from(files).map(async file => {
            if (file.type === 'application/pdf') {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
                    const pageCount = pdfDoc.getPageCount();

                    if (pageCount > 20) {
                        return { error: `${file.name}: PDF has ${pageCount} pages. The maximum allowed is 20 pages.` };
                    }
                    return { file };
                } catch (e) {
                    console.error(`Error reading PDF ${file.name}:`, e);
                    return { error: `${file.name}: Could not be read or is corrupted.` };
                }
            } else if (file.type.startsWith('image/')) {
                return { file };
            } else {
                return { error: `${file.name}: Unsupported file type.` };
            }
        });

        const results = await Promise.all(validationPromises);

        results.forEach(result => {
            if (result.file) {
                validFiles.push(result.file);
            } else if (result.error) {
                errors.push(result.error);
            }
        });
        
        setSelectedFiles(validFiles);
        if (errors.length > 0) {
            setFileError(errors.join('\n'));
        }
    };

    const handleAnalyzeClick = useCallback(async () => {
        if (selectedFiles.length === 0) return;

        setIsLoading(true);
        setError(null);
        setFileError(null);
        setAnalyzedData([]);
        setProgressMessage(`Analyzing ${selectedFiles.length} document(s)...`);

        try {
            const analysisPromises = selectedFiles.map(file => 
                extractBomFromFile(file, (msg) => {
                    // Progress callback for individual files, can be used for more granular updates in the future.
                    // For now, the main progress message is sufficient.
                })
            );

            const results = await Promise.all(analysisPromises);
            const newData: AnalyzedFile[] = selectedFiles.map((file, index) => ({
                fileName: file.name,
                bomItems: results[index] || []
            }));

            if (newData.flatMap(d => d.bomItems).length === 0) {
              setError("No Bill of Materials could be extracted from the document(s). Please try different drawings.");
            }
            setAnalyzedData(newData);
        } catch (e) {
            console.error(e);
            setError('An error occurred during analysis. One or more files may have failed. Please check the console for details.');
        } finally {
            setIsLoading(false);
            setProgressMessage(null);
        }
    }, [selectedFiles]);

    // Determine if the "Combine files" toggle should be disabled.
    // It's disabled if 0 or 1 file is selected (before analysis) or if 0 or 1 file yielded results (after analysis).
    const filesWithBomsCount = analyzedData.filter(d => d.bomItems.length > 0).length;
    const isCombineDisabled = analyzedData.length > 0
        ? filesWithBomsCount <= 1
        : selectedFiles.length <= 1;

    // When the toggle becomes disabled, force it to the "on" (true) state.
    useEffect(() => {
        if (isCombineDisabled) {
            setCombineExport(true);
        }
    }, [isCombineDisabled]);

    const allBomItems = analyzedData.flatMap(d => d.bomItems);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                        Isometric BOM Extractor
                    </h1>
                    <p className="mt-2 text-lg text-slate-400">
                        Upload pipe isometric drawings and let AI extract the Bill of Materials for you.
                    </p>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-slate-800/50 rounded-xl p-6 shadow-lg ring-1 ring-white/10 flex flex-col space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-cyan-400 mb-1">Step 1: Upload Drawings</h2>
                                <p className="text-slate-400">Select image or PDF files (max 20 pages per PDF).</p>
                            </div>
                             <button
                                onClick={handleRestart}
                                title="Clear all files and start over"
                                className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors duration-200 p-2 -m-2 rounded-md"
                            >
                                <RestartIcon className="w-5 h-5" />
                                Restart
                            </button>
                        </div>
                        <FileUpload onFileSelect={handleFilesSelect} selectedFiles={selectedFiles} />
                        {fileError && (
                            <div className="text-center text-red-400 bg-red-900/50 p-3 rounded-lg whitespace-pre-line">
                                {fileError}
                            </div>
                        )}
                        <div>
                           <h2 className="text-2xl font-bold text-cyan-400 mb-1">Step 2: Analyze</h2>
                           <p className="text-slate-400 mb-4">Click the button below to start the AI analysis on all uploaded files.</p>
                            <button
                                onClick={handleAnalyzeClick}
                                disabled={selectedFiles.length === 0 || isLoading || !!fileError}
                                className="w-full flex items-center justify-center gap-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md disabled:shadow-none"
                            >
                                {isLoading ? (
                                    <>
                                        <LoaderIcon className="w-6 h-6 animate-spin" />
                                        {progressMessage || 'Analyzing...'}
                                    </>
                                ) : (
                                    <>
                                        <BrainCircuitIcon className="w-6 h-6" />
                                        Extract Bill of Materials
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    <div className="bg-slate-800/50 rounded-xl p-6 shadow-lg ring-1 ring-white/10 flex flex-col">
                        <div className="flex-col sm:flex-row flex justify-between items-start sm:items-center mb-4 gap-4">
                             <div>
                                <h2 className="text-2xl font-bold text-cyan-400 mb-1">Step 3: Review & Export</h2>
                                <p className="text-slate-400">The extracted BOM will appear below.</p>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                                <div className="flex items-center">
                                    <label htmlFor="combine-toggle" className={`text-sm mr-2 whitespace-nowrap transition-colors ${isCombineDisabled ? 'text-slate-500' : 'text-slate-300'}`}>Combine files</label>
                                    <button
                                        id="combine-toggle"
                                        onClick={() => setCombineExport(!combineExport)}
                                        disabled={isCombineDisabled}
                                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${combineExport ? 'bg-cyan-600' : 'bg-slate-600'} ${isCombineDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        aria-pressed={combineExport}
                                    >
                                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${combineExport ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <ExportButton analyzedData={analyzedData} combineExport={combineExport} />
                            </div>
                        </div>
                        <div className="flex-grow min-h-[300px] bg-slate-900 rounded-lg p-1 overflow-auto">
                            {error && <div className="h-full flex items-center justify-center text-center text-red-400 p-4">{error}</div>}
                            {!error && <BomTable bomData={allBomItems} isLoading={isLoading} />}
                        </div>
                    </div>
                </main>

                <section className="mt-12">
                   <BatchProcessorInstructions />
                   <BatchFileContent />
                </section>

                <footer className="text-center mt-8 text-slate-500">
                    <p>Powered by Google Gemini</p>
                </footer>
            </div>
        </div>
    );
}
