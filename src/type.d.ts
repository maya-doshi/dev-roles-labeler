export type LabelType = {
  slug: string;
  name: string;
  description: string;
  uri: string;
  delete_trigger: boolean
}

export interface LabelEntry {
  slug: string;
  name: string;
  description: string;
}

export type Labels = {
  programmingLanguages: LabelerCategory;
  occupations: LabelerCategory;
  clearAll: LabelerCategory;
}

export interface LabelerCategory {
  description: string;
  delete_trigger: boolean;
  values: LabelEntry[];
}
