import asyncio
from pathlib import Path

from fastapi.testclient import TestClient

from backend.config import Settings
from backend.deepseek import review_contract
from backend.exporters import build_pdf_report, build_word_report
from backend.main import app
from backend.schemas import ReviewInput
from backend.store import JsonStore


def run(coroutine):
    return asyncio.run(coroutine)


def settings_for(path: Path) -> Settings:
    return Settings(
        _env_file=None,
        data_path=path,
        deepseek_api_key="",
        deepseek_mock=True,
    )


def test_health_contract() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert set(response.json()) == {"ok", "model", "deepseekConfigured"}


def test_mock_review_matches_schema(tmp_path: Path) -> None:
    result = run(review_contract(
        ReviewInput(
            text="甲方应在验收后尽快付款。",
            contractType="服务合同",
            stance="乙方",
            template="通用审查模板 V1.0",
        ),
        settings_for(tmp_path / "store.json"),
        mock=True,
    ))
    assert result.overallRiskLevel == "high"
    assert result.issues


def test_store_crud_and_exports(tmp_path: Path) -> None:
    local_settings = settings_for(tmp_path / "store.json")
    local_store = JsonStore(local_settings.data_path)
    contract, pending = run(local_store.create_pending_review(
        {
            "name": "测试服务合同",
            "fileName": "test.txt",
            "fileType": "text/plain",
            "fileSize": 48,
            "contractType": "服务合同",
            "stance": "甲方",
            "template": "通用审查模板 V1.0",
            "text": "乙方应赔偿全部损失，且不设责任上限。",
        },
        local_settings,
    ))
    result = run(review_contract(
        ReviewInput(
            text="乙方应赔偿全部损失，且不设责任上限。",
            contractType="服务合同",
            stance="甲方",
            template="通用审查模板 V1.0",
        ),
        local_settings,
        mock=True,
    ))
    review = run(local_store.complete_review(pending["id"], result))
    assert review["contract"]["id"] == contract["id"]
    assert review["status"] == "completed"

    issue = review["issues"][0]
    updated = run(local_store.update_issue(review["id"], issue["id"], "accept", None))
    assert updated and updated["userAction"] == "accept"
    persisted = run(local_store.get_review(review["id"]))
    assert persisted and persisted["issues"][0]["userAction"] == "accept"
    assert len(run(local_store.list_audit_logs())) == 3

    word = build_word_report(persisted)
    pdf = build_pdf_report(persisted)
    assert word.startswith(b"PK")
    assert pdf.startswith(b"%PDF")
