export interface BomItem {
  drawingNumber: string;
  itemNo: string;
  name: string;
  size: string;
  length: number | string;
  unit: string;
  modelType: string;
  description: string;
  material: string;
  standard: string;
  quantity: number;
  remarks: string;
}

export interface AnalyzedFile {
    fileName: string;
    bomItems: BomItem[];
}
