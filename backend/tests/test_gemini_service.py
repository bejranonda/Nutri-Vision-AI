"""
Unit tests for app.services.gemini_service.

These tests target the *pure* logic — JSON extraction, prompt building,
history handling — without making real Gemini API calls. Network calls
are patched via `asyncio.to_thread`.
"""
import asyncio
from unittest.mock import patch

import pytest

# Stub google.generativeai before importing the module so we don't require
# the real SDK / credentials during tests.
import sys
import types

stub = types.ModuleType("google.generativeai")
stub.configure = lambda **kwargs: None
class _FakeModel:  # noqa: N801
    def __init__(self, **kwargs):
        self.kwargs = kwargs
    def generate_content(self, parts):
        class R:
            text = '{"ok": true}'
        return R()
stub.GenerativeModel = _FakeModel
sys.modules.setdefault("google", types.ModuleType("google"))
sys.modules["google.generativeai"] = stub

from app.services.gemini_service import GeminiService  # noqa: E402


# ---------------------------------------------------------------------------
# JSON extraction
# ---------------------------------------------------------------------------
class TestJsonExtraction:
    def test_extracts_fenced_json(self):
        txt = 'Here is the answer:\n```json\n{"foo": 1}\n```\n'
        assert GeminiService._extract_json_text(txt) == '{"foo": 1}'

    def test_extracts_plain_fence(self):
        txt = '```\n{"foo": 1}\n```'
        assert GeminiService._extract_json_text(txt) == '{"foo": 1}'

    def test_extracts_bare_json_object(self):
        txt = 'Sure! {"foo": 1}'
        assert '"foo": 1' in GeminiService._extract_json_text(txt)

    def test_extracts_bare_json_array(self):
        txt = "prefix [1,2,3]"
        assert "[1,2,3]" in GeminiService._extract_json_text(txt)

    def test_extracts_first_valid_object_when_multiple(self):
        """
        Regression: the previous greedy regex would span from the first `{` to
        the LAST `}`, making `{"a":1} garbage {"b":2}` parse as one invalid
        blob. The raw_decode scanner should return the first valid object.
        """
        txt = 'noise {"a":1} some text {"b":2}'
        import json as _json
        extracted = GeminiService._extract_json_text(txt)
        assert _json.loads(extracted) == {"a": 1}

    def test_greedy_span_bug_fixed_via_parse(self):
        """End-to-end: the parser should successfully decode the first object."""
        result = GeminiService._parse_json_response(
            '{"first": true} followed by garbage {"second": false}'
        )
        assert result == {"first": True}

    def test_unclosed_fence_does_not_crash(self):
        """Regression: previously, ```json without closing ``` raised IndexError."""
        txt = '```json\n{"foo": 1}'  # note: no closing fence
        # The fenced regex won't match; the bare-json fallback should succeed.
        assert GeminiService._extract_json_text(txt) is not None

    def test_empty_returns_none(self):
        assert GeminiService._extract_json_text("") is None
        assert GeminiService._extract_json_text("   ") is None


class TestParseJsonResponse:
    def test_valid_json(self):
        result = GeminiService._parse_json_response('```json\n{"x":1}\n```')
        assert result == {"x": 1}

    def test_malformed_json_returns_fallback(self):
        fallback = {"detected_items": []}
        result = GeminiService._parse_json_response("not valid json", fallback=fallback)
        assert result["detected_items"] == []
        assert "raw_response" in result

    def test_empty_response_returns_fallback(self):
        fallback = {"recipes": []}
        result = GeminiService._parse_json_response("", fallback=fallback)
        assert result["recipes"] == []


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------
class TestPromptBuilders:
    def setup_method(self):
        self.svc = GeminiService(api_key="test")

    def test_food_prompt_thai(self):
        prompt = self.svc._create_food_analysis_prompt("th")
        assert "isFood" in prompt
        # Confidence must now be a 0-1 decimal instruction (regression test)
        assert "0.0" in prompt and "1.0" in prompt

    def test_food_prompt_english(self):
        prompt = self.svc._create_food_analysis_prompt("en")
        assert "isFood" in prompt
        assert "0.0" in prompt and "1.0" in prompt

    def test_recipe_prompt_includes_ingredients(self):
        prompt = self.svc._create_recipe_suggestion_prompt(
            ["chicken", "broccoli"], ["gluten-free"], "en"
        )
        assert "chicken" in prompt
        assert "broccoli" in prompt
        assert "gluten-free" in prompt

    def test_recipe_prompt_no_restrictions(self):
        prompt = self.svc._create_recipe_suggestion_prompt(["rice"], None, "en")
        assert "None" in prompt

    def test_chat_prompt_includes_context(self):
        prompt = self.svc._create_chat_system_prompt("en", {
            "recent_scan": "Pad Thai",
            "user_goal": "lower A1c",
            "dietary_restrictions": ["vegetarian"],
        })
        assert "Pad Thai" in prompt
        assert "lower A1c" in prompt
        assert "vegetarian" in prompt

    def test_chat_prompt_no_context(self):
        prompt = self.svc._create_chat_system_prompt("th")
        # No user-context block
        assert "ข้อมูลผู้ใช้" not in prompt


# ---------------------------------------------------------------------------
# Chat history handling — malformed entries should not crash
# ---------------------------------------------------------------------------
class TestChatHistory:
    @pytest.mark.asyncio
    async def test_malformed_history_entries_skipped(self):
        svc = GeminiService(api_key="test")

        with patch.object(svc, "_generate") as mock_gen:
            mock_gen.return_value = type("R", (), {"text": "ok"})()
            result = await svc.chat_nutrition_question(
                question="test",
                chat_history=[
                    {"role": "user", "content": "hi"},
                    "not a dict",                 # skipped
                    {"role": "user"},             # missing content → skipped
                    {"content": "x"},             # missing role → skipped
                    None,                          # skipped
                ],
                language="en",
            )
        assert result["answer"] == "ok"
        # Build the prompt and confirm only the valid entry was included
        prompt_arg = mock_gen.call_args[0][0][0]
        assert "user: hi" in prompt_arg

    @pytest.mark.asyncio
    async def test_history_truncated_to_last_10(self):
        svc = GeminiService(api_key="test")
        history = [{"role": "user", "content": f"m{i}"} for i in range(25)]
        with patch.object(svc, "_generate") as mock_gen:
            mock_gen.return_value = type("R", (), {"text": "ok"})()
            await svc.chat_nutrition_question("q", history, language="en")
        prompt = mock_gen.call_args[0][0][0]
        assert "m24" in prompt          # last message present
        assert "m14" not in prompt      # 11th-from-end dropped


# ---------------------------------------------------------------------------
# Image analysis — mock the blocking SDK call
# ---------------------------------------------------------------------------
class TestAnalyzeFoodImage:
    @pytest.mark.asyncio
    async def test_image_analysis_returns_parsed_json(self, tmp_path):
        # Create a minimal 1×1 PNG
        from PIL import Image
        img_path = tmp_path / "tiny.png"
        Image.new("RGB", (1, 1)).save(img_path)

        svc = GeminiService(api_key="test")

        class FakeResponse:
            text = '```json\n{"detected_items":[{"name_en":"apple"}]}\n```'

        def fake_generate(parts):
            return FakeResponse()

        with patch.object(svc, "_generate", side_effect=fake_generate):
            result = await svc.analyze_food_image(str(img_path), language="en")
        assert result["detected_items"][0]["name_en"] == "apple"

    @pytest.mark.asyncio
    async def test_image_file_handle_released(self, tmp_path):
        """Regression: file handle should be closed even if generation is slow."""
        from PIL import Image
        img_path = tmp_path / "tiny.png"
        Image.new("RGB", (1, 1)).save(img_path)

        svc = GeminiService(api_key="test")

        class FakeResponse:
            text = '{"detected_items":[]}'

        with patch.object(svc, "_generate", return_value=FakeResponse()):
            await svc.analyze_food_image(str(img_path), language="en")

        # If we got here without OS errors, the handle was released.
        # Confirm we can still unlink the file (would fail on Windows if open).
        img_path.unlink()
        assert not img_path.exists()
