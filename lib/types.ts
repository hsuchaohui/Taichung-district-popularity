export type DataStatus = 'available' | 'missing' | 'demo' | 'official';

export interface District {
  id: string;
  name: string;
  shortName: string;
  location: { lat: number; lng: number; label: string };
}

export interface MonthlyMetric {
  districtId: string;
  month: string;
  visitors: number | null;
  stayMinutes: number | null;
  revisitRate: number | null;
  attractionScore: number | null;
  engagementScore: number | null;
  loyaltyScore: number | null;
  popularityScore: number | null;
  rank: number | null;
  rankChange: number | null;
  dataStatus: DataStatus;
}

export interface ResearchMetadata {
  updatedAt: string;
  periodStart: string;
  periodEnd: string;
  isDemo: boolean;
  methodVersion?: string;
  sourceSnapshot?: string;
}

export interface ResearchDataset {
  metadata: ResearchMetadata;
  districts: District[];
  monthlyMetrics: MonthlyMetric[];
}

export interface DemoDataset extends ResearchDataset {
  metadata: ResearchMetadata & { isDemo: true };
}

export interface SensitivityRow {
  districtId: string;
  month: string;
  baseScore: number;
  baseRank: number;
  equalScore: number;
  equalRank: number;
  entropyScore: number;
  entropyRank: number;
  perturbationRankMin: number;
  perturbationRankMax: number;
}

export interface StudyAnomaly {
  severity: string;
  districtId: string;
  month: string;
  metric: string;
  previousValue: number;
  currentValue: number;
  changePct: number;
  rule: string;
}

export interface WeightSet {
  attraction: number;
  engagement: number;
  loyalty: number;
}

export interface PerturbationScenario {
  id: string;
  target: string;
  delta: number;
  weights: WeightSet;
}

export interface RankingAgreement {
  month: string;
  spearmanBaseEqual: number;
  kendallBaseEqual: number;
  spearmanBaseEntropy: number;
  kendallBaseEntropy: number;
}

export interface StudyDataset {
  core: ResearchDataset;
  entropyWeights: WeightSet;
  perturbationScenarios: PerturbationScenario[];
  sensitivityRows: SensitivityRow[];
  agreementByMonth: RankingAgreement[];
  anomalies: StudyAnomaly[];
  caveats: string[];
  qualityStatus: string;
}
