import { GoogleGenAI, Type } from "@google/genai";
import { BomItem } from '../types';

declare const PDFLib: any;

// A robust function to convert a Uint8Array to a Base64 string.
async function uint8ArrayToBase64(bytes: Uint8Array, mimeType: string): Promise<string> {
    return new Promise((resolve) => {
        const blob = new Blob([bytes], { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
            resolve((reader.result as string).split(',')[1]);
        };
        reader.readAsDataURL(blob);
    });
}

// Processes a file into one or more generative parts for the Gemini API.
// This version is optimized for speed by removing progress callbacks and UI-yield delays.
async function fileToGenerativeParts(file: File): Promise<any[]> {
    const mimeType = file.type;
    const fileBytes = await file.arrayBuffer();

    if (mimeType.startsWith('image/')) {
        const base64EncodedData = await uint8ArrayToBase64(new Uint8Array(fileBytes), mimeType);
        return [{ inlineData: { data: base64EncodedData, mimeType: mimeType } }];
    }

    if (mimeType === 'application/pdf') {
        const pdfDoc = await PDFLib.PDFDocument.load(fileBytes);
        const pageCount = pdfDoc.getPageCount();
        const parts = [];

        for (let i = 0; i < pageCount; i++) {
            // Create a new PDF document with just the current page
            const subDocument = await PDFLib.PDFDocument.create();
            const [copiedPage] = await subDocument.copyPages(pdfDoc, [i]);
            subDocument.addPage(copiedPage);
            const subDocumentBytes = await subDocument.save();
            const base64EncodedData = await uint8ArrayToBase64(subDocumentBytes, 'application/pdf');
            parts.push({
                inlineData: { data: base64EncodedData, mimeType: 'application/pdf' }
            });
        }
        return parts;
    }
    
    throw new Error(`Unsupported file type: ${mimeType}`);
}


/**
 * Extracts a Bill of Materials (BOM) from a given file using a single, consolidated API call to Gemini.
 * This approach is optimized for speed by sending all pages of a document at once.
 * @param file The image or PDF file to analyze.
 * @param onProgress A callback to report progress updates to the UI.
 * @returns A promise that resolves to an array of BomItem objects.
 */
export async function extractBomFromFile(file: File, onProgress: (message: string) => void): Promise<BomItem[]> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    onProgress('Splitting document into pages...');
    const allFileParts = await fileToGenerativeParts(file);

    const consolidatedAnalysisPrompt = `Analyze all the provided pages from a pipe isometric drawing document.
    The document may contain MULTIPLE DISTINCT DRAWINGS. Each drawing has its own unique drawing number ('図番') and its own Bill of Materials (BOM), which may span across pages.
    
    Your task is to find all BOM items from all drawings and consolidate them into a single, comprehensive list.
    
    Your output must be a single JSON array that strictly follows the provided schema.

    CRITICAL INSTRUCTIONS:
    1.  **MULTI-DRAWING DETECTION:** Be aware that one PDF can contain several different drawings.
    2.  **CORRECT DRAWING NUMBER ASSIGNMENT:** For each BOM item you extract, you MUST assign it the specific drawing number ('図番') that belongs to its drawing. The drawing number is located in the title block of the corresponding drawing's page. Do NOT apply one drawing number to all items if multiple drawings exist. The revision number, labeled '訂番', must NOT be part of the drawing number.
    3.  **CONSOLIDATE ALL ITEMS:** Combine all BOM items from every drawing into one final list.
    4.  **STRICT DATA EXTRACTION:** All rules from the single-page analysis apply. If a value for a field is not explicitly present for an item, you MUST return an empty string "". Do not infer or copy data from other rows, especially 'length'.

    RECAP OF EXTRACTION RULES:
    -   IGNORE REVISION SYMBOLS (e.g., <A>).
    -   'SCRE'/'SCRD' must be moved from '型式' (modelType) to '説明' (description).
    -   PRESERVE EXACT TEXT for terms like "MACH'N" and "HEX.".
    -   For GASKETS, move material codes like 'T#1050-CR' from '型式' to '材質' (material).
    -   For 'パイプ' (Pipe) with 'SGP' material, '型式' should be blank.
    -   ISOLATE SUMMARY ROWS: Extract rows like 'パイプ計' (Pipe Total), but DO NOT use their data to fill in values for other items. Each item is independent.

    Extract the following fields for each item and return them as one complete JSON array:
    - 図番 (drawingNumber)
    - No. (itemNo)
    - 名称 (name)
    - サイズ (size)
    - 長さ (length): Extract as a string. If blank, return "".
    - 単位 (unit)
    - 型式 (modelType)
    - 説明 (description)
    - 材質 (material)
    - 規格 (standard)
    - 台数 (quantity): Extract as a string. If blank, return "".
    - 注記 (remarks)
    `;
    
    const bomSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                drawingNumber: { type: Type.STRING, description: "図番 (Drawing Number)" },
                itemNo: { type: Type.STRING, description: "No. (Item Number)" },
                name: { type: Type.STRING, description: "名称 (Name)" },
                size: { type: Type.STRING, description: "サイズ (Size)" },
                length: { type: Type.STRING, description: "長さ (Length). Extract as a string. If not present, return an empty string." },
                unit: { type: Type.STRING, description: "単位 (Unit)" },
                modelType: { type: Type.STRING, description: "型式 (Model/Type)" },
                description: { type: Type.STRING, description: "説明 (Description)" },
                material: { type: Type.STRING, description: "材質 (Material)" },
                standard: { type: Type.STRING, description: "規格 (Standard)" },
                quantity: { type: Type.STRING, description: "台数 (Quantity). Extract as a string. If not present, return an empty string." },
                remarks: { type: Type.STRING, description: "注記 (Remarks)" },
            },
            required: ["drawingNumber", "itemNo", "name", "size", "length", "unit", "modelType", "description", "material", "standard", "quantity", "remarks"]
        }
    };

    onProgress('Sending document to AI for analysis...');
    let allBomItems: any[];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: consolidatedAnalysisPrompt },
                    ...allFileParts
                ],
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: bomSchema
            }
        });

        const jsonText = response.text;
        allBomItems = JSON.parse(jsonText);
        
        if (!Array.isArray(allBomItems)) {
            console.warn("AI response was not a JSON array, wrapping it.", allBomItems);
            allBomItems = [allBomItems]; // Attempt to recover if a single object is returned
        }
    } catch (e) {
        console.error(`Error during Gemini API call:`, e);
        throw new Error(`An error occurred during AI analysis. The model may have returned an invalid format. Please check the console.`);
    }

    onProgress('Processing AI response and cleaning data...');
    let processedData: any[];
    
    try {
        processedData = allBomItems.map((item: any) => {
            const newItem = { ...item };
            
            // 1. Clean 'length'
            let lengthStr = String(newItem.length ?? '').trim();
            if (lengthStr.endsWith('.')) {
                lengthStr = lengthStr.slice(0, -1);
            }
            newItem.length = (lengthStr !== '' && !isNaN(Number(lengthStr))) ? Number(lengthStr) : lengthStr;

            // 2. Clean 'quantity'
            let quantityStr = String(newItem.quantity ?? '').trim();
            if (quantityStr !== '' && !isNaN(Number(quantityStr))) {
                newItem.quantity = Number(quantityStr);
            } else {
                const num = parseInt(quantityStr, 10);
                newItem.quantity = isNaN(num) ? 1 : num;
            }
            
            // 3. Normalize 'HEX.'
            if (String(newItem.modelType ?? '').toUpperCase() === 'HEX') {
                newItem.modelType = 'HEX.';
            }

            // 4. Move 'SCRE' or 'SCRD' from modelType to description
            const modelTypeUpper = String(newItem.modelType ?? '').toUpperCase();
            if (modelTypeUpper === 'SCRE' || modelTypeUpper === 'SCRD') {
                if (!String(newItem.description ?? '').toUpperCase().includes(modelTypeUpper)) {
                    newItem.description = [newItem.modelType, newItem.description].filter(Boolean).join(' ');
                }
                newItem.modelType = '';
            }

            // 5. Split multi-word modelType (except MACH'N)
            const modelTypeStr = String(newItem.modelType ?? '').trim();
            if (modelTypeStr) {
                const parts = modelTypeStr.split(/\s+/);
                const normalizedModelType = modelTypeStr.replace(/['\s]/g, '').toUpperCase();
                
                if (parts.length > 1 && !normalizedModelType.startsWith("MACHN")) {
                    newItem.modelType = parts[0];
                    newItem.description = [newItem.description, parts.slice(1).join(' ')].filter(Boolean).join(' ');
                }
            }
            return newItem;
        });
    } catch (e) {
        console.error("Error during data cleaning:", e);
        throw new Error("Could not process the data returned from the AI model.");
    }
    
    // Final type safety check for quantity.
    processedData.forEach(item => {
        if (typeof item.quantity !== 'number') {
            const num = parseInt(String(item.quantity), 10);
            item.quantity = isNaN(num) ? 1 : num;
        }
    });

    onProgress('Analysis complete.');
    return processedData as BomItem[];
}