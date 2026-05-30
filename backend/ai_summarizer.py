"""Event classification + summarization using a local Ollama model (qwen3:14b).

Exposes ``classify_event(title, description) -> dict`` returning:
    {event_type, country_a, country_b, summary, sentiment_score}

On any failure (Ollama unreachable, unparseable output) it raises so the
caller in news_fetcher can fall back to a heuristic.
"""

from __future__ import annotations

import json
import os
import re

import requests

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:14b")
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "120"))

_VALID_TYPES = {"TRADE", "DIPLOMACY", "CONFLICT", "OTHER"}


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of the model reply.

    qwen3 is a reasoning model: even with think disabled it can emit a
    ``<think>...</think>`` block or ```json fences, so strip those and grab the
    first balanced ``{...}`` object.
    """
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = text.replace("```json", "").replace("```", "").strip()
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        raise ValueError("no JSON object found in model output")
    return json.loads(match.group(0))


def classify_event(title: str, description: str) -> dict:
    prompt = f"""You are a foreign affairs analyst. Given this news article, return ONLY a JSON object with no explanation, no markdown, no backticks.

Article title: {title}
Article description: {description}

Return exactly this JSON structure:
{{
  "event_type": "TRADE" or "DIPLOMACY" or "CONFLICT" or "OTHER",
  "country_a": "first country name",
  "country_b": "second country name",
  "summary": "one neutral sentence describing the relationship event",
  "sentiment_score": a float between -1.0 (very negative) and 1.0 (very positive)
}}

Only return the JSON. Nothing else."""

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            # think:false keeps qwen3 from prepending a reasoning trace; format
            # nudges it toward clean JSON. Both are ignored if unsupported.
            "think": False,
            "format": "json",
        },
        timeout=OLLAMA_TIMEOUT,
    )
    response.raise_for_status()
    result = response.json()["response"].strip()
    data = _extract_json(result)

    # Normalize / validate the fields we depend on downstream.
    etype = str(data.get("event_type", "")).strip().upper()
    data["event_type"] = etype if etype in _VALID_TYPES else "OTHER"
    data["country_a"] = str(data.get("country_a", "")).strip()
    data["country_b"] = str(data.get("country_b", "")).strip()
    data["summary"] = str(data.get("summary", "")).strip()
    try:
        score = float(data.get("sentiment_score", 0.0))
    except (TypeError, ValueError):
        score = 0.0
    data["sentiment_score"] = max(-1.0, min(1.0, score))
    return data
