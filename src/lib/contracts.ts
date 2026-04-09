export interface ShellPanel {
  id: string;
  title: string;
  phase: string;
  status: string;
  summary: string;
}

export interface ShellSnapshot {
  productName: string;
  version: string;
  milestone: string;
  slogan: string;
  surfaces: ShellPanel[];
  reservedExtensions: ShellPanel[];
}
