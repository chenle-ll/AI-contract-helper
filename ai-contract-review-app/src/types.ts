export type RiskLevel = "high" | "medium" | "low" | "tip";
export type IssueAction = "pending" | "accept" | "reject" | "edit" | "ignore";

export interface Contract {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  contractType: string;
  reviewStance: string;
  template: string;
  owner: string;
  status: "reviewing" | "completed" | "failed";
  reviewId?: string;
  overallRiskLevel?: RiskLevel;
  createdAt: string;
  finishedAt?: string;
}

export interface ReviewIssue {
  id: string;
  clauseId: string;
  location: string;
  riskLevel: RiskLevel;
  issueType: string;
  originalText: string;
  reason: string;
  suggestionText: string;
  basis: string;
  userAction: IssueAction;
  editedText?: string;
}

export interface MissingClause {
  name: string;
  reason: string;
  suggestion: string;
  riskLevel: RiskLevel;
}

export interface Review {
  id: string;
  contractId: string;
  status: "reviewing" | "completed" | "failed";
  contractText: string;
  modelVersion: string;
  templateVersion: string;
  overallRiskLevel: RiskLevel;
  summary: string;
  issues: ReviewIssue[];
  missingClauses: MissingClause[];
  nextSteps: string[];
  createdAt: string;
  finishedAt: string;
  contract: Contract;
}
