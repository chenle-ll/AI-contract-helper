import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from starlette.requests import Request

from .config import get_settings
from .deepseek import DeepSeekError, review_contract
from .exporters import build_pdf_report, build_word_report
from .extractor import ContractExtractionError, extract_contract_text
from .schemas import IssueActionRequest, ReviewInput
from .store import store

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.data_path.parent.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="衡鉴 AI 合同审查 API", version="1.0.0", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def request_validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    return JSONResponse(status_code=400, content={"error": first.get("msg", "请求参数不正确")})


@app.get("/api/health")
async def health() -> dict:
    return {
        "ok": True,
        "model": settings.deepseek_model,
        "deepseekConfigured": bool(settings.deepseek_api_key),
    }


@app.get("/api/contracts")
async def list_contracts() -> dict:
    return {"contracts": await store.list_contracts()}


@app.get("/api/reviews/{review_id}")
async def get_review(review_id: str) -> dict:
    review = await store.get_review(review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="审查任务不存在")
    return {"review": review}


@app.post("/api/reviews", status_code=201)
async def create_review(
    file: UploadFile | None = File(default=None),
    contract_name: str = Form(default="", alias="contractName"),
    contract_type: str = Form(default="通用合同", alias="contractType"),
    stance: str = Form(default="中立"),
    template: str = Form(default="通用审查模板 V1.0"),
    pasted_text: str = Form(default="", alias="pastedText"),
) -> dict:
    pending: dict | None = None
    try:
        text, file_size = await extract_contract_text(file, pasted_text, settings)
        filename = file.filename if file and file.filename else "pasted-text.txt"
        name = contract_name.strip() or Path(filename).stem or "粘贴文本合同"
        contract, pending_review = await store.create_pending_review(
            {
                "name": name,
                "fileName": filename,
                "fileType": file.content_type if file and file.content_type else "text/plain",
                "fileSize": file_size,
                "contractType": contract_type,
                "stance": stance,
                "template": template,
                "text": text,
            },
            settings,
        )
        pending = pending_review
        result = await review_contract(
            ReviewInput(text=text, contractType=contract_type, stance=stance, template=template),
            settings,
        )
        review = await store.complete_review(pending_review["id"], result)
        return {"review": review}
    except ContractExtractionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (DeepSeekError, ValidationError) as exc:
        if pending:
            await store.fail_review(pending["id"], str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        if pending:
            await store.fail_review(pending["id"], str(exc))
        raise


@app.patch("/api/reviews/{review_id}/issues/{issue_id}")
async def update_issue(review_id: str, issue_id: str, body: IssueActionRequest) -> dict:
    issue = await store.update_issue(review_id, issue_id, body.action, body.editedText)
    if issue is None:
        raise HTTPException(status_code=404, detail="审查意见不存在")
    return {"issue": issue}


@app.get("/api/reviews/{review_id}/export/{export_format}")
async def export_review(review_id: str, export_format: Literal["json", "word", "pdf"]) -> Response:
    review = await store.get_review(review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="审查任务不存在")
    filename = f"review-{review_id}"
    if export_format == "json":
        payload = json.dumps(review, ensure_ascii=False, indent=2).encode("utf-8")
        return Response(
            payload,
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.json"'},
        )
    if export_format == "word":
        return Response(
            build_word_report(review),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}.docx"'},
        )
    return Response(
        build_pdf_report(review),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )


@app.get("/api/audit-logs")
async def list_audit_logs() -> dict:
    return {"logs": await store.list_audit_logs()}


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


dist_path = Path(__file__).resolve().parent.parent / "dist"
if dist_path.is_dir():
    assets_path = dist_path / "assets"
    if assets_path.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def frontend(full_path: str) -> FileResponse:
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="接口不存在")
        candidate = (dist_path / full_path).resolve()
        if full_path and candidate.is_file() and dist_path.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(dist_path / "index.html")
