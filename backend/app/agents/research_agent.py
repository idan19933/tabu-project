"""Agent 2: Research Agent — searches uploaded documents for missing field values.

Given a list of missing fields and document texts, uses Claude to
re-read all documents looking specifically for the missing values,
including indirect references (e.g., cost mentioned in a table footnote).
"""
import logging
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings

logger = logging.getLogger(__name__)

RESEARCH_SYSTEM_PROMPT = """You are a research expert specialized in Israeli real estate feasibility documents.

You are given a list of MISSING fields that were not found during initial extraction,
along with all document texts from the simulation.

Your job is to carefully re-read ALL documents looking specifically for these missing values.
Look for:
- Direct mentions (e.g., "עלות בנייה: 8,500 ₪/מ"ר")
- Indirect references (values in tables, footnotes, appendices)
- Implied values (e.g., total cost / area = cost per sqm)
- Related data that can help derive the missing value

Return a JSON object with exactly this structure:
{
  "found_fields": {
    "field_name": value,
    ...
  },
  "still_missing": ["field_name1", "field_name2"],
  "sources": [
    {"field": "field_name", "quote": "exact text from document", "confidence": 0.85}
  ]
}

Only include fields you can confidently extract. Use the exact field names provided."""


def _get_llm():
    return ChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=settings.ANTHROPIC_API_KEY,
        temperature=0,
        max_tokens=4096,
    )


def run_research(
    missing_fields: list[str],
    document_texts: list[dict[str, str]],
) -> dict[str, Any]:
    """Search uploaded documents for missing field values.

    Args:
        missing_fields: List of field names that are still null/zero.
        document_texts: List of dicts with 'doc_type' and 'text' keys.

    Returns:
        Dict with found_fields, still_missing, and sources.
    """
    if not missing_fields:
        return {"found_fields": {}, "still_missing": [], "sources": []}

    if not settings.ANTHROPIC_API_KEY:
        logger.warning("No ANTHROPIC_API_KEY set, skipping research agent")
        return {"found_fields": {}, "still_missing": missing_fields, "sources": []}

    # Build document context
    doc_context = ""
    for i, doc in enumerate(document_texts, 1):
        doc_context += f"\n--- Document {i} (type: {doc.get('doc_type', 'unknown')}) ---\n"
        doc_context += doc.get("text", "")[:8000]
        doc_context += "\n"

    llm = _get_llm()

    messages = [
        SystemMessage(content=RESEARCH_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"Missing fields that need to be found:\n{missing_fields}\n\n"
            f"Documents to search:\n{doc_context}"
        )),
    ]

    try:
        response = llm.invoke(messages)
        content = response.content

        # Parse JSON from response
        import json
        # Find JSON in response
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0]
        else:
            json_str = content

        result = json.loads(json_str.strip())
        return {
            "found_fields": result.get("found_fields", {}),
            "still_missing": result.get("still_missing", missing_fields),
            "sources": result.get("sources", []),
        }
    except Exception as e:
        logger.error(f"Research agent error: {e}")
        return {"found_fields": {}, "still_missing": missing_fields, "sources": []}
