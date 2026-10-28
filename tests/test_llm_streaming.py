"""Provider streaming: SSE parsing, UTF-8 safety, errors and cleanup (mocked HTTP)."""

import json
from unittest.mock import MagicMock, patch

import pytest
import requests

from rag import provider_errors as pe
from rag.llm import _stream_chat_completion


def sse(*events, done=True):
    lines = []
    for e in events:
        lines.append(b": keep-alive comment")
        lines.append(b"")
        lines.append(b"data: " + (e if isinstance(e, bytes) else json.dumps(e, ensure_ascii=False).encode("utf-8")))
        lines.append(b"")
    if done:
        lines += [b"data: [DONE]", b""]
    return lines


def chunk(text=None, finish=None):
    delta = {"content": text} if text is not None else {}
    return {"choices": [{"delta": delta, "finish_reason": finish}]}


def fake_response(lines, status=200, body=None, raise_after=None):
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = body if body is not None else {}

    def iterate():
        for i, line in enumerate(lines):
            if raise_after is not None and i >= raise_after:
                raise requests.exceptions.ChunkedEncodingError("cut")
            yield line

    resp.iter_lines.side_effect = lambda *a, **k: iterate()
    return resp


def run(resp):
    with patch("requests.post", return_value=resp), patch("time.sleep", return_value=None):
        return list(
            _stream_chat_completion(
                api_url="https://x/chat", provider="groq", api_key="k", model="m", prompt="hi", timeout=5
            )
        )


def test_text_arrives_in_pieces_and_request_asks_for_streaming():
    resp = fake_response(sse(chunk("Hel"), chunk("lo "), chunk("world", finish="stop")))
    with patch("requests.post", return_value=resp) as post:
        out = list(
            _stream_chat_completion(api_url="u", provider="groq", api_key="k", model="m", prompt="p", timeout=5)
        )
    assert out == ["Hel", "lo ", "world"]
    assert post.call_args.kwargs["json"]["stream"] is True and post.call_args.kwargs["stream"] is True


def test_multibyte_characters_survive():
    resp = fake_response(sse(chunk("नमस्ते "), chunk("😀 café", finish="stop")))
    assert "".join(run(resp)) == "नमस्ते 😀 café"


def test_ignores_malformed_events_reasoning_and_empty_deltas():
    lines = sse(chunk(None), {"choices": [{"delta": {"reasoning": "private thoughts"}}]}, chunk("ok", finish="stop"))
    lines.insert(2, b"data: {not json")
    assert run(fake_response(lines)) == ["ok"]


def test_stream_without_finish_marker_is_an_interruption():
    with pytest.raises(pe.ProviderError) as info:
        run(fake_response(sse(chunk("partial"), done=False)))
    assert info.value.code == pe.CODE_UNAVAILABLE


def test_connection_dropped_mid_stream_is_reported_after_partial_text():
    resp = fake_response(sse(chunk("a"), chunk("b")), raise_after=4)
    got = []
    with patch("requests.post", return_value=resp):
        with pytest.raises(pe.ProviderError) as info:
            for piece in _stream_chat_completion(
                api_url="u", provider="groq", api_key="k", model="m", prompt="p", timeout=5
            ):
                got.append(piece)
    assert got == ["a"] and info.value.code == pe.CODE_UNAVAILABLE


def test_error_event_inside_stream_is_a_safe_provider_error():
    with pytest.raises(pe.ProviderError):
        run(fake_response(sse({"error": {"message": "boom sk-or-v1-secretsecret"}}, done=False)))


def test_upfront_credit_error_is_classified_and_not_retried():
    resp = fake_response([], status=402, body={"error": {"message": "Insufficient credits"}})
    with patch("requests.post", return_value=resp) as post:
        with pytest.raises(pe.ProviderError) as info:
            list(_stream_chat_completion(api_url="u", provider="openrouter", api_key="k", model="m", prompt="p", timeout=5))
    assert info.value.code == pe.CODE_CREDITS and post.call_count == 1


def test_upfront_transient_error_is_retried_before_any_text():
    bad = fake_response([], status=503)
    good = fake_response(sse(chunk("fine", finish="stop")))
    with patch("requests.post", side_effect=[bad, good]) as post, patch("time.sleep", return_value=None):
        out = list(_stream_chat_completion(api_url="u", provider="groq", api_key="k", model="m", prompt="p", timeout=5))
    assert out == ["fine"] and post.call_count == 2


def test_closing_the_generator_closes_the_upstream_connection():
    resp = fake_response(sse(chunk("a"), chunk("b"), chunk("c", finish="stop")))
    with patch("requests.post", return_value=resp):
        gen = _stream_chat_completion(api_url="u", provider="groq", api_key="k", model="m", prompt="p", timeout=5)
        assert next(gen) == "a"
        gen.close()
    resp.close.assert_called()
