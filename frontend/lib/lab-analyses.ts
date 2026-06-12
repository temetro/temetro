// A curated catalog of common laboratory analyses, grouped by panel, used to
// power the "Test" combobox in the lab add-result dialog. Users can still type
// any analysis not listed here (the field accepts free text) — this is just a
// fast-path for the routine ones, with typical reporting units as hints.
//
// Compiled from common clinical lab panels (CBC, BMP/CMP, lipid, thyroid,
// coagulation, inflammatory markers, iron studies, urinalysis). Sources:
// HealthLabs, LevelUpRN, Fullscript, Frederick Health.
export type LabAnalysis = { name: string; unit?: string; group: string };

export const LAB_ANALYSES: LabAnalysis[] = [
  // Complete Blood Count (CBC)
  { name: "Hemoglobin", unit: "g/dL", group: "Complete Blood Count" },
  { name: "Hematocrit", unit: "%", group: "Complete Blood Count" },
  { name: "White Blood Cell Count", unit: "10³/µL", group: "Complete Blood Count" },
  { name: "Red Blood Cell Count", unit: "10⁶/µL", group: "Complete Blood Count" },
  { name: "Platelet Count", unit: "10³/µL", group: "Complete Blood Count" },
  { name: "Mean Corpuscular Volume (MCV)", unit: "fL", group: "Complete Blood Count" },
  // Basic / Comprehensive Metabolic Panel
  { name: "Sodium", unit: "mmol/L", group: "Metabolic Panel" },
  { name: "Potassium", unit: "mmol/L", group: "Metabolic Panel" },
  { name: "Chloride", unit: "mmol/L", group: "Metabolic Panel" },
  { name: "Bicarbonate (CO₂)", unit: "mmol/L", group: "Metabolic Panel" },
  { name: "Blood Urea Nitrogen (BUN)", unit: "mg/dL", group: "Metabolic Panel" },
  { name: "Creatinine", unit: "mg/dL", group: "Metabolic Panel" },
  { name: "Glucose", unit: "mg/dL", group: "Metabolic Panel" },
  { name: "Calcium", unit: "mg/dL", group: "Metabolic Panel" },
  // Liver Function Tests
  { name: "Alanine Aminotransferase (ALT)", unit: "U/L", group: "Liver Function" },
  { name: "Aspartate Aminotransferase (AST)", unit: "U/L", group: "Liver Function" },
  { name: "Alkaline Phosphatase (ALP)", unit: "U/L", group: "Liver Function" },
  { name: "Total Bilirubin", unit: "mg/dL", group: "Liver Function" },
  { name: "Albumin", unit: "g/dL", group: "Liver Function" },
  { name: "Total Protein", unit: "g/dL", group: "Liver Function" },
  // Lipid Panel
  { name: "Total Cholesterol", unit: "mg/dL", group: "Lipid Panel" },
  { name: "LDL Cholesterol", unit: "mg/dL", group: "Lipid Panel" },
  { name: "HDL Cholesterol", unit: "mg/dL", group: "Lipid Panel" },
  { name: "Triglycerides", unit: "mg/dL", group: "Lipid Panel" },
  // Thyroid
  { name: "Thyroid Stimulating Hormone (TSH)", unit: "mIU/L", group: "Thyroid" },
  { name: "Free T4", unit: "ng/dL", group: "Thyroid" },
  { name: "Free T3", unit: "pg/mL", group: "Thyroid" },
  // Diabetes / Inflammatory
  { name: "Hemoglobin A1c", unit: "%", group: "Diabetes & Inflammation" },
  { name: "C-Reactive Protein (CRP)", unit: "mg/L", group: "Diabetes & Inflammation" },
  { name: "Erythrocyte Sedimentation Rate (ESR)", unit: "mm/hr", group: "Diabetes & Inflammation" },
  // Coagulation
  { name: "Prothrombin Time (PT)", unit: "s", group: "Coagulation" },
  { name: "International Normalized Ratio (INR)", group: "Coagulation" },
  { name: "Partial Thromboplastin Time (PTT)", unit: "s", group: "Coagulation" },
  // Iron / Vitamins
  { name: "Ferritin", unit: "ng/mL", group: "Iron & Vitamins" },
  { name: "Iron", unit: "µg/dL", group: "Iron & Vitamins" },
  { name: "Vitamin D, 25-Hydroxy", unit: "ng/mL", group: "Iron & Vitamins" },
  { name: "Vitamin B12", unit: "pg/mL", group: "Iron & Vitamins" },
  // Urinalysis
  { name: "Urinalysis", group: "Urinalysis" },
  { name: "Urine Protein", unit: "mg/dL", group: "Urinalysis" },
];

// Quick lookup of an analysis's unit by name (for prefilling the value hint).
export const LAB_ANALYSIS_UNITS: Record<string, string> = Object.fromEntries(
  LAB_ANALYSES.filter((a) => a.unit).map((a) => [a.name, a.unit as string]),
);
