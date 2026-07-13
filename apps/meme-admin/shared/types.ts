export type GenerationMode = "template" | "generation_test";
export type GroupStatus = "ready_for_template" | "needs_review" | "skipped";
export type JobStatus = "queued" | "running" | "succeeded" | "needs_review" | "failed" | "cancelled" | "interrupted";
export type JobPhase = "preparing" | "analyzing" | "validating" | "finalizing";
export type ImageAssetOrigin = "source" | "generated" | "other";
export type ImageAssetSort = "time_desc" | "time_asc" | "name_asc";

export interface ReferenceConfig {
  template_reference: boolean;
  style_reference: boolean;
  composition_reference: boolean;
  identity_reference: boolean;
  other: string;
}

export interface ImageAsset {
  id: string;
  sourcePath: string;
  relativePath: string;
  fileName: string;
  shortHash: string;
  origin?: ImageAssetOrigin;
  modifiedAt?: string;
  fileSize?: number;
  contentSha256?: string;
  groupId?: string;
}

export interface GroupConfig {
  id: string;
  groupName: string;
  status: GroupStatus;
  referenceConfig: ReferenceConfig;
  referenceDependencyLevel: "low" | "medium" | "high";
  testModeRecommendation: "reference_aware_required" | "reference_aware_preferred" | "prompt_mode_allowed";
  generationMode: GenerationMode;
  category: string;
  templateMechanism: string;
  tags: string[];
  notes: string;
  imageIds: string[];
}

export interface BatchDefaults {
  generationMode: GenerationMode;
  category: string;
  tags: string[];
}

export interface BatchConfig {
  id: string;
  name: string;
  sourceFolder: string;
  outputFolder: string;
  defaults: BatchDefaults;
  images: ImageAsset[];
  groups: GroupConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface ValidatorResult {
  file: string;
  validator: "semantic" | "gallery";
  passed: boolean;
  output: string;
}

export interface JobRecord {
  id: string;
  batchId: string;
  groupId: string;
  groupName: string;
  status: JobStatus;
  phase: JobPhase;
  pid?: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  resultDirectory: string;
  lastEvent: string;
  error?: string;
  retryOf?: string;
  validatorResults: ValidatorResult[];
}

export interface JobEvent {
  at: string;
  type: "status" | "agent" | "validator" | "error";
  phase: JobPhase;
  summary: string;
  detail?: unknown;
}

export interface AdminSettings { concurrency: 1 | 2 | 3 }

export interface ResultFile {
  name: string;
  relativePath: string;
  absolutePath: string;
  kind: "image" | "json" | "markdown" | "other";
  url?: string;
}

export interface FolderTemplateStatus {
  folder: string;
  exists: boolean;
  absolutePath?: string;
  modifiedAt?: string;
  fileSize?: number;
}
