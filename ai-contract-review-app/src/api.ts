import type { Contract, IssueAction, Review, ReviewIssue } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
  return payload as T;
}

export const api = {
  health: () => request<{ ok: boolean; model: string; deepseekConfigured: boolean }>("/api/health"),
  contracts: () => request<{ contracts: Contract[] }>("/api/contracts"),
  review: (id: string) => request<{ review: Review }>(`/api/reviews/${id}`),
  createReview: (data: FormData) => request<{ review: Review }>("/api/reviews", { method: "POST", body: data }),
  updateIssue: (reviewId: string, issueId: string, action: IssueAction, editedText?: string) =>
    request<{ issue: ReviewIssue }>(`/api/reviews/${reviewId}/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, editedText }),
    }),
};

export const exportUrl = (reviewId: string, format: "json" | "word" | "pdf") =>
  `/api/reviews/${reviewId}/export/${format}`;
