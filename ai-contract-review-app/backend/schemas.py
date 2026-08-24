from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

RiskLevel = Literal["high", "medium", "low", "tip"]
IssueAction = Literal["accept", "reject", "edit", "ignore"]


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ReviewIssueInput(ApiModel):
    clauseId: str = Field(min_length=1, max_length=80)
    location: str = Field(min_length=1, max_length=120)
    riskLevel: RiskLevel
    issueType: str = Field(min_length=1, max_length=80)
    originalText: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    suggestionText: str = Field(min_length=1)
    basis: str = Field(min_length=1)


class MissingClause(ApiModel):
    name: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    suggestion: str = Field(min_length=1)
    riskLevel: RiskLevel


class ReviewResult(ApiModel):
    overallRiskLevel: RiskLevel
    summary: str = Field(min_length=1)
    issues: list[ReviewIssueInput] = Field(max_length=80)
    missingClauses: list[MissingClause] = Field(max_length=30)
    nextSteps: list[str] = Field(min_length=1, max_length=10)


class IssueActionRequest(ApiModel):
    action: IssueAction
    editedText: str | None = Field(default=None, min_length=1, max_length=8000)

    @model_validator(mode="after")
    def validate_edit_text(self) -> "IssueActionRequest":
        if self.action == "edit" and not self.editedText:
            raise ValueError("编辑建议时必须提供 editedText")
        return self


class ReviewInput(ApiModel):
    text: str
    contractType: str
    stance: str
    template: str
