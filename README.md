Isometric Drawing BOM Extractor
An intelligent, AI-powered tool that automates the extraction of Bill of Materials (BOM) data from pipe isometric drawings. Built with React and powered by the Google Gemini API, this application streamlines a traditionally manual and time-consuming process for engineers and drafters, increasing accuracy and efficiency.
(You can add a screenshot or GIF of the application in action here)
✨ Features
AI-Powered Extraction: Leverages the advanced multimodal capabilities of Google's gemini-2.5-flash model to accurately parse and understand technical drawings.
Flexible File Upload: Supports both image (PNG, JPG) and PDF formats. Users can select files or use a convenient drag-and-drop interface.
Multi-Document Processing: Analyze multiple drawings simultaneously in a single batch.
Smart PDF Handling:
Processes multi-page PDFs, treating each page as part of a whole document to ensure context is maintained.
Includes pre-flight validation to check for and reject PDFs exceeding a 20-page limit to manage processing time and costs.
Structured Data Output: Uses Gemini's JSON mode with a strict schema to ensure the extracted BOM data is consistently structured, clean, and accurate.
Intuitive UI: A clean, modern, and responsive user interface built with React and Tailwind CSS, guiding the user through a simple three-step process: Upload, Analyze, and Export.
Versatile Export Options:
Combined Export: Merge BOMs from multiple drawings into a single, consolidated Excel (.xlsx) file.
Individual Export: Export the BOM for each drawing as a separate Excel file, conveniently packaged in a single .zip archive.
Advanced Local Automation:
Node.js Batch Script: A powerful script is provided for developers and power users to process entire folders of drawings locally, ideal for large-scale automation and integration into existing workflows.
One-Click Windows Batch File: A simple .bat file is included that automates the entire local process, from setting up folders to running the Node.js script and opening the final log file.
⚙️ How It Works
The application follows a sophisticated pipeline to transform visual drawings into structured, exportable data:
File Ingestion & Pre-processing: The React frontend accepts user-uploaded files. PDFs are split into individual pages using pdf-lib to be sent to the model. Images are converted directly to a Base64 format.
Prompt Engineering: A detailed prompt is sent to the Gemini API along with the image/PDF data. This prompt provides critical instructions for handling multi-drawing documents, assigning correct drawing numbers, and adhering to specific data extraction rules (e.g., handling abbreviations, cleaning data fields).
AI Analysis with Schema: The request specifies a JSON responseSchema. This forces the Gemini model to return a structured JSON array of BOM items, greatly reducing the chances of malformed or incomplete data.
Data Cleaning: The returned JSON from the AI is further processed on the client side to clean and normalize specific fields (like quantity and length), ensuring data integrity.
Display & Export: The validated BOM data is displayed in a clean, readable table. The user can then use the xlsx and jszip libraries to export the data into their desired Excel format.
🚀 Getting Started (Web App)
Upload: Drag and drop your isometric drawing files (PDF, PNG, or JPG) into the upload area, or click to select them.
Analyze: Click the "Extract Bill of Materials" button to send the files to the Gemini AI for processing.
Review & Export: Once the analysis is complete, the extracted BOM will appear in the table. Review the data and use the "Export Excel" button to download your file(s).
💻 Advanced Usage: Local Batch Processing
For processing large volumes of files, a local Node.js script is provided for maximum efficiency.
Prerequisites
Node.js (version 18 or newer) installed on your system.
A Google Gemini API Key.
Setup Instructions
Create a Project: Create a new folder on your computer for this project.
Initialize Project: Open a terminal in the new folder and run npm init -y.
Install Dependencies: Run the following command:
code
Bash
npm install @google/genai xlsx pdf-lib dotenv
Save the Scripts:
Save the Node.js script provided in the "Advanced Automation" section of the app as batch-processor.js.
(For Windows) Save the batch file script as run-batch.bat.
Set API Key: Create a file named .env.local in the project folder and add your API key:
code
Code
GEMINI_API_KEY=YOUR_API_KEY_HERE
Running the Batch Processor
Create a folder named input_pdfs inside your project directory.
Place all the PDF drawings you want to analyze into the input_pdfs folder.
Double-click the run-batch.bat file (on Windows) or run node batch-processor.js from your terminal.
The script will process all files, and the extracted Excel files will be saved in a new output_excels folder. A detailed log file will also be created and opened automatically upon completion.
