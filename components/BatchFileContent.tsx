
import React, { useState, useCallback } from 'react';

const batchFileContent = `
@echo off
REM ============================================================================
REM == Batch file to automate the Isometric Drawing BOM Extractor Node.js script
REM ============================================================================

REM --- Configuration ---
REM Set the root directory of your project.
REM %~dp0 automatically gets the directory where this batch file is located.
SET "PROJECT_DIR=%~dp0"

REM Set the paths for your input PDFs, output Excels, and logs.
SET "INPUT_DIR=%PROJECT_DIR%input_pdfs"
SET "OUTPUT_DIR=%PROJECT_DIR%output_excels"
SET "LOG_DIR=%PROJECT_DIR%logs"

REM --- Script Execution ---
echo.
echo --- Starting BOM Extraction Process ---
echo Project Directory: %PROJECT_DIR%
echo Input PDFs from: %INPUT_DIR%
echo Output Excels to: %OUTPUT_DIR%
echo.

REM Create directories if they don't exist
IF NOT EXIST "%INPUT_DIR%" mkdir "%INPUT_DIR%"
IF NOT EXIST "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
IF NOT EXIST "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Create a timestamped log file name (e.g., bom-extractor-log-2024-08-20_14-30-55.txt)
FOR /f "delims=" %%I in ('powershell -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"') do set "TIMESTAMP=%%I"
SET "LOG_FILE=%LOG_DIR%\\bom-extractor-log-%TIMESTAMP%.txt"

REM Navigate to the project directory and run the Node.js script.
REM The script will now log to both this console window and the specified log file.
cd /d "%PROJECT_DIR%"
node batch-processor.js "%INPUT_DIR%" "%OUTPUT_DIR%" "%LOG_FILE%"

echo.
echo --- Process Finished ---
echo A complete log has been saved to: %LOG_FILE%
start "" "%LOG_FILE%"

echo.
echo You can now close this window.
echo.
pause
`.trim();

const CopyIcon = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h5.879a1.5 1.5 0 0 1 1.06.44l3.122 3.121A1.5 1.5 0 0 1 19 6.621V16.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 16.5v-13Zm0 " />
        <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.121A1.5 1.5 0 0 1 15 9.621V14.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 7 14.5v-8Z" transform="translate(-2, 2)" />
    </svg>
);


export const BatchFileContent = () => {
    const [copyButtonText, setCopyButtonText] = useState('Copy Script');

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(batchFileContent);
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy Script'), 2000);
    }, []);

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 shadow-lg ring-1 ring-white/10 mt-8">
            <h3 className="text-xl font-bold text-slate-200 mb-4">2. Create a Batch File for One-Click Execution (Windows)</h3>
            <p className="text-slate-400 mb-4">This batch file automates the entire process. Just save it and double-click to run.</p>
            
            <ol className="list-decimal list-inside space-y-3 text-slate-300 pl-2 mb-6">
                 <li>
                    <strong>Create the Batch File:</strong> Open Notepad, paste the script below, and save it as <code className="bg-slate-900 px-1 rounded">run-batch.bat</code> in the same project folder where you saved <code className="bg-slate-900 px-1 rounded">batch-processor.js</code>.
                </li>
                <li>
                    <strong>Add PDFs:</strong> The script will automatically create the required <code className="bg-slate-900 px-1 rounded">input_pdfs</code>, <code className="bg-slate-900 px-1 rounded">output_excels</code>, and <code className="bg-slate-900 px-1 rounded">logs</code> folders. Simply place the PDF files you want to analyze into the <code className="bg-slate-900 px-1 rounded">input_pdfs</code> folder.
                </li>
                <li>
                    <strong>Run:</strong> Make sure your <code className="bg-slate-900 px-1 rounded">.env.local</code> file is in place. Then, simply double-click <code className="bg-slate-900 px-1 rounded">run-batch.bat</code> to start. A terminal window will open and display the live progress of the analysis. When it's finished, a complete log file with the results will open automatically.
                </li>
            </ol>

            <div>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-lg font-semibold text-slate-200">run-batch.bat</h4>
                    <button onClick={handleCopy} className="bg-slate-700 hover:bg-slate-600 text-sm font-medium py-1 px-3 rounded-md transition-colors flex items-center gap-2">
                        <CopyIcon className="w-4 h-4" />
                        {copyButtonText}
                    </button>
                </div>
                <pre className="bg-slate-900 rounded-lg p-4 max-h-96 overflow-auto">
                    <code className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                        {batchFileContent}
                    </code>
                </pre>
            </div>
        </div>
    );
};
