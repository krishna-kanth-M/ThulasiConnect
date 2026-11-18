"""Local Ollama (Qwen 2.5 1.5B) structured medicine-request extraction service.

Safety & privacy rules:
- Operates ONLY on transcript text (never receives raw audio).
- Runs strictly against local Ollama HTTP API (no paid or external cloud AI APIs).
- NEVER generates medical advice, diagnoses, or prescriptions.
- Marks every extracted item as `ai_suggested` or `missing_info` requiring employee confirmation.
"""

import json
import re
from typing import Any

import httpx

from app.core.config import get_settings

SAFETY_DISCLAIMER = (
    "AI-suggested extraction only. Does not constitute medical advice or a prescription. "
    "A qualified pharmacist/employee must verify every medicine name, strength, quantity, and price before saving."
)

EXTRACTION_SYSTEM_PROMPT = """You extract structured pharmacy call request items from a transcript (English, Tamil, or Tamil-English mixed).
STRICT RULES:
1. Extract ONLY what the customer explicitly mentioned. Do NOT invent medicine names, dosages, or prices.
2. NEVER provide medical advice, treatment suggestions, or prescriptions.
3. Return ONLY valid JSON matching this exact schema:
{
  "summary_suggestion": "one concise neutral sentence summarizing the customer call inquiry",
  "medicines": [
    {
      "medicine_name": "name as mentioned",
      "strength": "e.g. 650mg or null",
      "dosage_form": "tablet/syrup/capsule/drops/cream or null",
      "quantity": "e.g. 2 strips or 10 tablets or null",
      "availability_question": true,
      "pricing_question": false,
      "notes": "optional short note or null"
    }
  ],
  "availability_questions": ["list of stock/availability questions asked"],
  "pricing_questions": ["list of price/MRP/discount questions asked"],
  "missing_information": ["missing details the pharmacist must clarify, e.g. strength, quantity, customer phone"],
  "suggested_followup_needed": true,
  "customer_details_to_confirm": ["e.g. confirm callback number or branch pickup"]
}"""


def check_ollama_health() -> dict[str, Any]:
    settings = get_settings()
    try:
        with httpx.Client(timeout=3.0) as client:
            ver_resp = client.get(f"{settings.ollama_base_url}/api/version")
            tags_resp = client.get(f"{settings.ollama_base_url}/api/tags")
            ver_resp.raise_for_status()
            tags_resp.raise_for_status()
            models = [m.get("name") for m in tags_resp.json().get("models", [])]
            return {
                "available": True,
                "version": ver_resp.json().get("version"),
                "configured_model": settings.ollama_model,
                "model_present": settings.ollama_model in models,
                "installed_models": models,
                "endpoint": settings.ollama_base_url,
            }
    except Exception as exc:
        return {
            "available": False,
            "configured_model": settings.ollama_model,
            "model_present": False,
            "endpoint": settings.ollama_base_url,
            "error": str(exc),
        }


def _heuristic_extract(transcript_text: str) -> dict[str, Any]:
    """Deterministic fallback parser when Ollama is temporarily unavailable or returns malformed JSON."""
    text = transcript_text.strip()
    lower = text.lower()
    medicines: list[dict[str, Any]] = []

    # Detect common strength patterns like "Dolo 650", "Paracetamol 500mg", "Metformin 500 mg"
    pattern = re.compile(
        r"\b([A-Z][A-Za-z0-9\-]{2,}(?:\s+[A-Z][A-Za-z0-9\-]{2,})?)\s+(\d{1,4}\s?(?:mg|ml|mcg|g|iu)?)\b",
        re.IGNORECASE,
    )
    seen: set[str] = set()
    for match in pattern.finditer(text):
        name = match.group(1).strip()
        strength = match.group(2).strip()
        if name.lower() in {"call", "phone", "number", "price", "stock", "rupees", "rs", "need", "want"}:
            continue
        key = f"{name.lower()}|{strength.lower()}"
        if key not in seen:
            seen.add(key)
            medicines.append(
                {
                    "medicine_name": name,
                    "strength": strength,
                    "dosage_form": "tablet" if "tab" in lower else ("syrup" if "syrup" in lower else None),
                    "quantity": None,
                    "availability_question": any(
                        k in lower for k in ["avail", "stock", "irukka", "iruka", "have"]
                    ),
                    "pricing_question": any(
                        k in lower for k in ["price", "cost", "rate", "mrp", "evlo", "evalo", "vila"]
                    ),
                    "verification_status": "ai_suggested",
                    "notes": "Extracted via local fallback parser; verify with customer.",
                }
            )

    avail_qs = (
        ["Customer asked about medicine stock/availability."]
        if any(k in lower for k in ["avail", "stock", "irukka", "iruka", "have"])
        else []
    )
    price_qs = (
        ["Customer asked about medicine price/rate."]
        if any(k in lower for k in ["price", "cost", "rate", "mrp", "evlo", "evalo", "vila"])
        else []
    )
    missing = []
    if not medicines:
        missing.append("No medicine name clearly detected — employee should enter medicine details manually.")
    if not any(re.search(r"\b\d+\s*(strip|tablet|bottle|pack|box|nos)\b", lower) for _ in [0]):
        missing.append("Requested quantity not clearly identified.")

    return {
        "source": "heuristic_fallback",
        "model_used": "rule-based-fallback",
        "disclaimer": SAFETY_DISCLAIMER,
        "summary_suggestion": text[:220] + ("..." if len(text) > 220 else ""),
        "customer_name_mentioned": None,
        "urgency_indicator": "urgent" if any(k in lower for k in ["urgent", "emergency", "immediately", "today"]) else "normal",
        "uncertain_fields": ["Extracted by deterministic fallback parser — verify all fields carefully."],
        "medicines": medicines,
        "availability_questions": avail_qs,
        "pricing_questions": price_qs,
        "missing_information": missing,
        "suggested_followup_needed": bool(
            avail_qs or any(k in lower for k in ["call back", "callback", "later", "order", "check", "confirm"])
        ),
        "customer_details_to_confirm": ["Confirm customer callback phone number and exact strength/quantity."],
    }


def extract_call_requirements(transcript_text: str, language_hint: str | None = None) -> dict[str, Any]:
    """Send transcript text ONLY to local Ollama Qwen 2.5 1.5B for structured JSON extraction."""
    settings = get_settings()
    user_prompt = (
        f"Language hint: {language_hint or 'auto (English/Tamil/Tanglish)'}\n"
        f"Transcript:\n{transcript_text.strip()}\n\n"
        "Respond with valid JSON only."
    )

    try:
        payload = {
            "model": settings.ollama_model,
            "system": EXTRACTION_SYSTEM_PROMPT,
            "prompt": user_prompt,
            "format": "json",
            "stream": False,
            "keep_alive": "2m",
            "options": {"temperature": 0.1, "num_predict": 512},
        }
        with httpx.Client(timeout=float(settings.ollama_request_timeout_seconds)) as client:
            resp = client.post(f"{settings.ollama_base_url}/api/generate", json=payload)
            resp.raise_for_status()
            raw_text = resp.json().get("response", "").strip()

        # Extract JSON block defensively
        start_idx = raw_text.find("{")
        end_idx = raw_text.rfind("}")
        if start_idx == -1 or end_idx == -1:
            return _heuristic_extract(transcript_text)

        parsed = json.loads(raw_text[start_idx : end_idx + 1])

        medicines_out: list[dict[str, Any]] = []
        for item in parsed.get("medicines", []) or []:
            if not isinstance(item, dict):
                continue
            med_name = str(item.get("medicine_name") or "").strip()
            if not med_name:
                continue
            strength = item.get("strength")
            quantity = item.get("quantity")
            status_val = "ai_suggested" if (strength or quantity) else "missing_info"
            medicines_out.append(
                {
                    "medicine_name": med_name,
                    "strength": str(strength).strip() if strength else None,
                    "dosage_form": str(item.get("dosage_form")).strip() if item.get("dosage_form") else None,
                    "quantity": str(quantity).strip() if quantity else None,
                    "availability_question": bool(item.get("availability_question", False)),
                    "pricing_question": bool(item.get("pricing_question", False)),
                    "verification_status": status_val,
                    "notes": str(item.get("notes")).strip() if item.get("notes") else None,
                }
            )

        uncertain_fields: list[str] = []
        for m in medicines_out:
            if not m.get("strength"):
                uncertain_fields.append(f"{m['medicine_name']}: strength not stated")
            if not m.get("quantity"):
                uncertain_fields.append(f"{m['medicine_name']}: quantity not stated")

        return {
            "source": "ollama",
            "model_used": settings.ollama_model,
            "disclaimer": SAFETY_DISCLAIMER,
            "summary_suggestion": str(parsed.get("summary_suggestion") or "").strip()
            or transcript_text[:200],
            "customer_name_mentioned": str(parsed.get("customer_name_mentioned")).strip()
            if parsed.get("customer_name_mentioned")
            else None,
            "urgency_indicator": str(parsed.get("urgency_indicator") or "normal").lower()
            if str(parsed.get("urgency_indicator") or "normal").lower() in ("low", "normal", "high", "urgent")
            else "normal",
            "uncertain_fields": uncertain_fields,
            "medicines": medicines_out,
            "availability_questions": [str(q) for q in (parsed.get("availability_questions") or []) if q],
            "pricing_questions": [str(q) for q in (parsed.get("pricing_questions") or []) if q],
            "missing_information": [str(m) for m in (parsed.get("missing_information") or []) if m],
            "suggested_followup_needed": bool(parsed.get("suggested_followup_needed", False)),
            "customer_details_to_confirm": [
                str(c) for c in (parsed.get("customer_details_to_confirm") or []) if c
            ],
        }
    except Exception:
        return _heuristic_extract(transcript_text)
