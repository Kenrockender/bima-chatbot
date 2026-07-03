"""TTS in-process LRU cache tests. Skipped when routes_training's deps (httpx)
aren't installed."""
import pytest

rt = pytest.importorskip("app.routes_training")


@pytest.fixture(autouse=True)
def _clear_cache():
    rt._tts_cache.clear()
    yield
    rt._tts_cache.clear()


def test_put_then_get_returns_bytes():
    key = rt._tts_cache_key("voiceA", "halo dunia")
    assert rt._tts_cache_get(key) is None
    rt._tts_cache_put(key, b"audio-bytes")
    assert rt._tts_cache_get(key) == b"audio-bytes"


def test_key_varies_by_voice_and_text():
    assert rt._tts_cache_key("v1", "x") != rt._tts_cache_key("v2", "x")
    assert rt._tts_cache_key("v1", "x") != rt._tts_cache_key("v1", "y")


def test_lru_eviction_bounds_size():
    for i in range(rt._TTS_CACHE_MAX + 10):
        rt._tts_cache_put(rt._tts_cache_key("v", str(i)), b"a")
    assert len(rt._tts_cache) == rt._TTS_CACHE_MAX
    # The oldest entries should have been evicted.
    assert rt._tts_cache_get(rt._tts_cache_key("v", "0")) is None
    assert rt._tts_cache_get(rt._tts_cache_key("v", str(rt._TTS_CACHE_MAX + 9))) is not None
