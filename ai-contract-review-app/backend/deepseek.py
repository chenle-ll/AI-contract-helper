import json
import re

import httpx

from .config import Settings, get_settings
from .prompts import build_review_messages
from .schemas import ReviewInput, ReviewResult


class DeepSeekError(RuntimeError):
    """Raised when the DeepSeek service cannot return a valid review."""


MOCK_RESULT = {
    "overallRiskLevel": "high",
    "summary": "合同交易结构基本完整，但违约责任和付款期限存在需要人工复核的风险。",
    "issues": [
        {
            "clauseId": "5.2",
            "location": "第五条 违约责任",
            "riskLevel": "high",
            "issueType": "法律风险",
            "originalText": "乙方应赔偿甲方因此遭受的全部损失，且不设责任上限。",
            "reason": "赔偿责任没有上限，可能与合同对价明显不匹配。",
            "suggestionText": "乙方承担的累计赔偿责任以本合同已支付服务费总额为上限；因故意或重大过失造成的损失除外。",
            "basis": "基于责任与对价相匹配及风险可预见性原则，建议明确责任边界。",
        },
        {
            "clauseId": "3.2",
            "location": "第三条 服务费用与付款",
            "riskLevel": "medium",
            "issueType": "模糊表达",
            "originalText": "甲方应在项目验收通过后尽快支付剩余款项。",
            "reason": "“尽快”没有明确期限，可能导致付款节点争议。",
            "suggestionText": "甲方应在项目验收通过且收到合规发票之日起 15 个工作日内支付剩余款项。",
            "basis": "建议将模糊期限改为可计算的期限，并明确起算条件。",
        },
    ],
    "missingClauses": [
        {
            "name": "数据处理条款",
            "reason": "软件服务可能涉及业务数据处理，但合同未明确处理范围和安全责任。",
            "suggestion": "补充数据处理目的、范围、保存期限、安全措施和返还删除机制。",
            "riskLevel": "medium",
        }
    ],
    "nextSteps": ["优先复核高风险责任条款", "与业务确认付款和验收节点", "采纳修改后导出修订版合同"],
}


def _parse_json_content(content: str) -> dict:
    cleaned = re.sub(r"^```json\s*", "", content.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise DeepSeekError("DeepSeek 返回内容不是合法 JSON") from exc


async def review_contract(
    review_input: ReviewInput,
    settings: Settings | None = None,
    mock: bool = False,
) -> ReviewResult:
    settings = settings or get_settings()
    if mock or settings.deepseek_mock:
        return ReviewResult.model_validate(MOCK_RESULT)
    if not settings.deepseek_api_key:
        raise DeepSeekError("服务端未配置 DEEPSEEK_API_KEY")

    payload = {
        "model": settings.deepseek_model,
        "messages": build_review_messages(review_input),
        "temperature": 0.1,
        "max_tokens": 6000,
        "response_format": {"type": "json_object"},
    }
    headers = {"Authorization": f"Bearer {settings.deepseek_api_key}"}
    try:
        async with httpx.AsyncClient(timeout=150.0) as client:
            response = await client.post(
                f"{settings.deepseek_base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise DeepSeekError("DeepSeek 请求超时，请稍后重试") from exc
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:300]
        raise DeepSeekError(f"DeepSeek 请求失败（{exc.response.status_code}）：{detail}") from exc
    except httpx.HTTPError as exc:
        raise DeepSeekError("无法连接 DeepSeek 服务") from exc

    content = response.json().get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        raise DeepSeekError("DeepSeek 未返回有效审查内容")
    return ReviewResult.model_validate(_parse_json_content(content))
