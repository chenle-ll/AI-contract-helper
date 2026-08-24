import asyncio
import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from .config import Settings, get_settings
from .schemas import ReviewResult

EMPTY_STORE = {"contracts": [], "reviews": [], "auditLogs": []}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class JsonStore:
    def __init__(self, path: Path | None = None):
        self.path = path or get_settings().data_path
        self._lock = asyncio.Lock()

    def _load_sync(self) -> dict:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.write_text(json.dumps(EMPTY_STORE, ensure_ascii=False, indent=2), encoding="utf-8")
            return deepcopy(EMPTY_STORE)
        return json.loads(self.path.read_text(encoding="utf-8"))

    def _save_sync(self, data: dict) -> None:
        temp_path = self.path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(self.path)

    async def _read(self) -> dict:
        return await asyncio.to_thread(self._load_sync)

    async def _write(self, data: dict) -> None:
        await asyncio.to_thread(self._save_sync, data)

    async def list_contracts(self) -> list[dict]:
        async with self._lock:
            data = await self._read()
            return sorted(data["contracts"], key=lambda item: item["createdAt"], reverse=True)

    async def create_pending_review(self, input_data: dict, settings: Settings) -> tuple[dict, dict]:
        async with self._lock:
            data = await self._read()
            now = utc_now()
            contract = {
                "id": str(uuid4()), "name": input_data["name"], "fileName": input_data["fileName"],
                "fileType": input_data["fileType"], "fileSize": input_data["fileSize"],
                "contractType": input_data["contractType"], "reviewStance": input_data["stance"],
                "template": input_data["template"], "owner": "当前用户", "status": "reviewing", "createdAt": now,
            }
            review = {
                "id": str(uuid4()), "contractId": contract["id"], "status": "reviewing",
                "contractText": input_data["text"], "modelVersion": settings.deepseek_model,
                "templateVersion": input_data["template"], "createdAt": now, "issues": [],
            }
            data["contracts"].append(contract)
            data["reviews"].append(review)
            data["auditLogs"].append({"id": str(uuid4()), "action": "review.created", "contractId": contract["id"], "at": now})
            await self._write(data)
            return contract, review

    async def complete_review(self, review_id: str, result: ReviewResult) -> dict:
        async with self._lock:
            data = await self._read()
            review = next((item for item in data["reviews"] if item["id"] == review_id), None)
            if review is None:
                raise KeyError("审查任务不存在")
            now = utc_now()
            result_data = result.model_dump()
            result_data["issues"] = [
                {**issue, "id": str(uuid4()), "userAction": "pending", "editedText": ""}
                for issue in result_data["issues"]
            ]
            review.update(result_data)
            review.update({"status": "completed", "finishedAt": now})
            contract = next((item for item in data["contracts"] if item["id"] == review["contractId"]), None)
            if contract:
                contract.update({
                    "status": "completed", "reviewId": review_id,
                    "overallRiskLevel": result.overallRiskLevel, "finishedAt": now,
                })
            data["auditLogs"].append({"id": str(uuid4()), "action": "review.completed", "contractId": review["contractId"], "reviewId": review_id, "at": now})
            await self._write(data)
            return {**review, "contract": contract}

    async def fail_review(self, review_id: str, message: str) -> None:
        async with self._lock:
            data = await self._read()
            review = next((item for item in data["reviews"] if item["id"] == review_id), None)
            if review:
                review.update({"status": "failed", "error": message})
                contract = next((item for item in data["contracts"] if item["id"] == review["contractId"]), None)
                if contract:
                    contract["status"] = "failed"
                await self._write(data)

    async def get_review(self, review_id: str) -> dict | None:
        async with self._lock:
            data = await self._read()
            review = next((item for item in data["reviews"] if item["id"] == review_id), None)
            if review is None:
                return None
            contract = next((item for item in data["contracts"] if item["id"] == review["contractId"]), None)
            return {**review, "contract": contract}

    async def update_issue(self, review_id: str, issue_id: str, action: str, edited_text: str | None) -> dict | None:
        async with self._lock:
            data = await self._read()
            review = next((item for item in data["reviews"] if item["id"] == review_id), None)
            issue = next((item for item in (review or {}).get("issues", []) if item["id"] == issue_id), None)
            if issue is None:
                return None
            issue["userAction"] = action
            if edited_text:
                issue["editedText"] = edited_text
            issue["updatedAt"] = utc_now()
            data["auditLogs"].append({"id": str(uuid4()), "action": f"issue.{action}", "reviewId": review_id, "issueId": issue_id, "at": issue["updatedAt"]})
            await self._write(data)
            return issue

    async def list_audit_logs(self) -> list[dict]:
        async with self._lock:
            data = await self._read()
            return list(reversed(data["auditLogs"][-200:]))


store = JsonStore()
