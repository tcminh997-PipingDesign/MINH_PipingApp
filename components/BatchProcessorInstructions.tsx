
import React, { useState, useCallback } from 'react';

const scriptContent = `
// A Node.js script to batch-process pipe isometric drawing PDFs from a local folder.
// It extracts the Bill of Materials (BOM) from each PDF and saves it as a separate Excel file.

import { GoogleGenAI, Type } from "@google/genai";
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib'; // Requires: npm install pdf-lib
import dotenv from 'dotenv'; // Requires: npm install dotenv

// --- CONFIGURATION ---
// Load environment variables from .env.local file.
dotenv.config({ path: '.env.local' });

const BATCH_SIZE = 5; // Files to process concurrently.

// --- LOGGER SETUP ---
let logStream;

// A simple logger that writes to both the console and a file stream.
function log(message) {
    console.log(message);
    if (logStream) {
        logStream.write(\`\${message}\\n\`);
    }
}


// --- CORE GEMINI API LOGIC ---

// Converts a Uint8Array from a file into a Base64 string for the API.
function uint8ArrayToBase64(bytes) {
    return Buffer.from(bytes).toString('base64');
}

// Splits a PDF into individual pages and prepares them for the Gemini API.
async function pdfToGenerativeParts(filePath) {
    const fileBytes = await fsp.readFile(filePath);
    const pdfDoc = await PDFDocument.load(fileBytes);
    const pageCount = pdfDoc.getPageCount();
    const parts = [];

    for (let i = 0; i < pageCount; i++) {
        const subDocument = await PDFDocument.create();
        const [copiedPage] = await subDocument.copyPages(pdfDoc, [i]);
        subDocument.addPage(copiedPage);
        const subDocumentBytes = await subDocument.save();
        const base64EncodedData = uint8ArrayToBase64(subDocumentBytes);
        parts.push({
            inlineData: { data: base64EncodedData, mimeType: 'application/pdf' }
        });
    }
    return parts;
}

async function extractBomFromPdf(filePath, ai) {
    const allFileParts = await pdfToGenerativeParts(filePath);

    // The prompt and schema are the same as used in the web application.
    const consolidatedAnalysisPrompt = \`Analyze all the provided pages from a pipe isometric drawing document. The document may contain MULTIPLE DISTINCT DRAWINGS. Each drawing has its own unique drawing number ('図番') and its own Bill of Materials (BOM), which may span across pages. Your task is to find all BOM items from all drawings and consolidate them into a single, comprehensive list. Your output must be a single JSON array that strictly follows the provided schema. CRITICAL INSTRUCTIONS: 1. MULTI-DRAWING DETECTION: Be aware that one PDF can contain several different drawings. 2. CORRECT DRAWING NUMBER ASSIGNMENT: For each BOM item you extract, you MUST assign it the specific drawing number ('図番') that belongs to its drawing. The drawing number is located in the title block of the corresponding drawing's page. Do NOT apply one drawing number to all items if multiple drawings exist. The revision number, labeled '訂番', must NOT be part of the drawing number. 3. CONSOLIDATE ALL ITEMS: Combine all BOM items from every drawing into one final list. 4. STRICT DATA EXTRACTION: All rules from the single-page analysis apply. If a value for a field is not explicitly present for an item, you MUST return an empty string "". Do not infer or copy data from other rows, especially 'length'. RECAP OF EXTRACTION RULES: - IGNORE REVISION SYMBOLS (e.g., <A>). - 'SCRE'/'SCRD' must be moved from '型式' (modelType) to '説明' (description). - PRESERVE EXACT TEXT for terms like "MACH'N" and "HEX.". - For GASKETS, move material codes like 'T#1050-CR' from '型式' to '材質' (material). - For 'パイプ' (Pipe) with 'SGP' material, '型式' should be blank. - ISOLATE SUMMARY ROWS: Extract rows like 'パイプ計' (Pipe Total), but DO NOT use their data to fill in values for other items. Each item is independent. Extract the following fields for each item and return them as one complete JSON array: - 図番 (drawingNumber), No. (itemNo), 名称 (name), サイズ (size), 長さ (length): Extract as a string. If blank, return "". - 単位 (unit), 型式 (modelType), 説明 (description), 材質 (material), 規格 (standard) - 台数 (quantity): Extract as a string. If blank, return "". - 注記 (remarks)\`;
    
    const bomSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                drawingNumber: { type: Type.STRING }, itemNo: { type: Type.STRING },
                name: { type: Type.STRING }, size: { type: Type.STRING },
                length: { type: Type.STRING }, unit: { type: Type.STRING },
                modelType: { type: Type.STRING }, description: { type: Type.STRING },
                material: { type: Type.STRING }, standard: { type: Type.STRING },
                quantity: { type: Type.STRING }, remarks: { type: Type.STRING },
            },
            required: ["drawingNumber", "itemNo", "name", "size", "length", "unit", "modelType", "description", "material", "standard", "quantity", "remarks"]
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: consolidatedAnalysisPrompt }, ...allFileParts] },
        config: { responseMimeType: "application/json", responseSchema: bomSchema }
    });

    const jsonText = response.text;
    const allBomItems = JSON.parse(jsonText);
    
    // Data cleaning logic (same as in the web app)
    return allBomItems.map(item => {
        const newItem = { ...item };
        let lengthStr = String(newItem.length ?? '').trim();
        if (lengthStr.endsWith('.')) lengthStr = lengthStr.slice(0, -1);
        newItem.length = (lengthStr !== '' && !isNaN(Number(lengthStr))) ? Number(lengthStr) : lengthStr;

        let quantityStr = String(newItem.quantity ?? '').trim();
        newItem.quantity = (quantityStr !== '' && !isNaN(Number(quantityStr))) ? Number(quantityStr) : (parseInt(quantityStr, 10) || 1);
        if (isNaN(newItem.quantity)) newItem.quantity = 1;
        
        return newItem;
    });
}

// --- EXCEL FILE GENERATION ---

function saveToExcel(bomItems, outputFilePath) {
    const dataToExport = bomItems.map(item => ({
        '図番': item.drawingNumber, 'No.': item.itemNo, '名称': item.name,
        'サイズ': item.size, '長さ': item.length, '単位': item.unit,
        '型式': item.modelType, '説明': item.description, '材質': item.material,
        '規格': item.standard, '台数': item.quantity, '注記': item.remarks,
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const colWidths = Object.keys(dataToExport[0] || {}).map(key => ({
        wch: Math.max(key.length, ...dataToExport.map(row => (row[key] ?? '').toString().length)) + 1
    }));
    worksheet['!cols'] = colWidths;
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'BOM');
    XLSX.writeFile(workbook, outputFilePath);
}

// --- MAIN EXECUTION LOGIC ---

async function main() {
    log("--- Starting Batch BOM Extraction ---");
    const args = process.argv.slice(2);
    if (args.length !== 3) {
        // Log stream isn't created yet, so just log to console.
        console.error("❌ USAGE: node batch-processor.js <input_folder_path> <output_folder_path> <log_file_path>");
        process.exit(1);
    }
    
    const [inputDir, outputDir, logFilePath] = args;

    // Create log stream. All subsequent 'log' calls will also write to the file.
    logStream = fs.createWriteStream(logFilePath, { flags: 'w' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        log("❌ ERROR: GEMINI_API_KEY not found in .env.local file.");
        process.exit(1);
    }

    try {
        await fsp.access(inputDir);
        await fsp.mkdir(outputDir, { recursive: true });
    } catch (error) {
        log(\`❌ ERROR: Could not access input/output directories. Details: \${error.message}\`);
        process.exit(1);
    }

    log(\`📁 Input folder: \${inputDir}\`);
    log(\`📁 Output folder: \${outputDir}\`);
    log(\`📝 Logging to: \${logFilePath}\\n\`);

    const ai = new GoogleGenAI({ apiKey });
    const allFiles = await fsp.readdir(inputDir);
    const pdfFiles = allFiles.filter(file => path.extname(file).toLowerCase() === '.pdf');

    if (pdfFiles.length === 0) {
        log("🟡 No PDF files found. Exiting.");
        return;
    }

    log(\`✅ Found \${pdfFiles.length} PDF file(s) to process.\\n\`);
    let successCount = 0;
    let errorCount = 0;
    let filesProcessed = 0;

    for (let i = 0; i < pdfFiles.length; i += BATCH_SIZE) {
        const batch = pdfFiles.slice(i, i + BATCH_SIZE);
        log(\`--- Processing Batch \${Math.floor(i / BATCH_SIZE) + 1} of \${Math.ceil(pdfFiles.length / BATCH_SIZE)} (\${batch.length} files) ---\`);
        
        const promises = batch.map(async (fileName) => {
            const filePath = path.join(inputDir, fileName);
            filesProcessed++;
            const progressPrefix = \`  [\${filesProcessed}/\${pdfFiles.length}]\`;
            
            try {
                log(\`\${progressPrefix} ⏳ Analyzing: \${fileName}...\`);
                const bomItems = await extractBomFromPdf(filePath, ai);
                
                if (bomItems && bomItems.length > 0) {
                    log(\`\${progressPrefix} ✔️ AI analysis complete for \${fileName}.\`);
                    const outputFileName = fileName.replace(/\\.pdf$/i, '.xlsx');
                    const outputFilePath = path.join(outputDir, outputFileName);
                    
                    log(\`\${progressPrefix} 💾 Saving Excel file to \${outputFileName}...\`);
                    saveToExcel(bomItems, outputFilePath);
                    
                    log(\`\${progressPrefix} ✨ Successfully exported \${outputFileName}\`);
                    successCount++;
                } else {
                    log(\`\${progressPrefix} 🟡 Warning: No BOM items found in \${fileName}. Skipping Excel creation.\`);
                }
            } catch (e) {
                log(\`\${progressPrefix} ❌ Error processing \${fileName}: \${e.message}\`);
                errorCount++;
            }
        });

        await Promise.all(promises);
    }

    log("\\n--- Batch Processing Complete ---");
    log(\`🟢 Successful exports: \${successCount}\`);
    log(\`🔴 Failed files: \${errorCount}\`);
    log("---------------------------------");
    
    if (logStream) {
        logStream.end();
    }
}

main().catch(e => {
    log(\`An unexpected error occurred: \${e}\`);
    if (logStream) {
        logStream.end();
    }
});
`.trim();

const TerminalIcon = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M2.25 3.75A1.5 1.5 0 013.75 2.25h16.5a1.5 1.5 0 011.5 1.5v16.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V3.75zM6 10.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5H6zM7.06 6.44a.75.75 0 00-1.06 1.06l1.72 1.72-1.72 1.72a.75.75 0 101.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 101.06-1.06L9.88 9.22l1.72-1.72a.75.75 0 10-1.06-1.06L8.82 8.16 7.06 6.44z" clipRule="evenodd" />
    </svg>
);


export const BatchProcessorInstructions = () => {
    const [copyButtonText, setCopyButtonText] = useState('Copy Script');

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(scriptContent);
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy Script'), 2000);
    }, []);

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 shadow-lg ring-1 ring-white/10">
            <div className="flex items-center gap-4 mb-4">
                <TerminalIcon className="w-8 h-8 text-cyan-400" />
                <div>
                    <h2 className="text-2xl font-bold text-cyan-400">Advanced Automation</h2>
                    <p className="text-slate-400">For analyzing many files at once, use this local Node.js script for maximum efficiency and automation.</p>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-200 mb-2">1. Setup Local Project</h3>
                    <p className="text-slate-400 mb-4">Follow these steps once to set up your local processing environment.</p>
                    <ol className="list-decimal list-inside space-y-3 text-slate-300 pl-2">
                        <li>
                            <strong>Prerequisites:</strong> Make sure you have <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Node.js</a> (version 18 or newer) installed.
                        </li>
                        <li>
                            <strong>Create a Project Folder:</strong>
                            <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-slate-400">
                                <li>Create a new folder on your computer (e.g., <code className="bg-slate-900 px-1 rounded">C:\Users\YourUser\Documents\bom-extractor</code>).</li>
                                <li>Open a terminal (like CMD or PowerShell), navigate into that folder, and run <code className="bg-slate-900 px-1 rounded">npm init -y</code> to create a <code className="bg-slate-900 px-1 rounded">package.json</code> file.</li>
                                <li>Install the required libraries by running this command in your terminal: <br />
                                    <code className="bg-slate-900 p-2 rounded block mt-2 text-cyan-300">npm install @google/genai xlsx pdf-lib dotenv</code>
                                </li>
                            </ul>
                        </li>
                         <li>
                            <strong>Save the Node.js Script:</strong> Copy the script below and save it as <code className="bg-slate-900 px-1 rounded">batch-processor.js</code> in your project folder.
                        </li>
                        <li>
                            <strong>Set API Key:</strong> Create a new file in your project folder named <code className="bg-slate-900 px-1 rounded">.env.local</code> (note the dot at the beginning). Open it and add your API key like this: <br/>
                            <code className="bg-slate-900 p-2 rounded block mt-2 text-slate-300">
                                GEMINI_API_KEY=AIzaSyABC...
                            </code>
                        </li>
                    </ol>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-semibold text-slate-200">batch-processor.js</h4>
                        <button onClick={handleCopy} className="bg-slate-700 hover:bg-slate-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">{copyButtonText}</button>
                    </div>
                    <pre className="bg-slate-900 rounded-lg p-4 max-h-96 overflow-auto">
                        <code className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                            {scriptContent}
                        </code>
                    </pre>
                </div>
            </div>
        </div>
    );
};
