"""Pure-helper tests for the chat pipeline. Skipped when rag's heavy optional
deps (langchain/pdfplumber/etc.) aren't installed in the test env."""
import pytest

rag = pytest.importorskip("app.rag")


@pytest.mark.parametrize("q", [
    "jelaskan lagi",          # short + reference cue
    "gimana kalau yang itu",  # explicit reference
    "tell me more",
    "harga",                  # <= 3 words
])
def test_needs_rewrite_true(q):
    assert rag._needs_rewrite(q) is True


@pytest.mark.parametrize("q", [
    "Apa manfaat utama produk Heritage Platinum Protection untuk nasabah usia 40",
    "Berapa uang pertanggungan minimum untuk PRUSmart Plan menurut brosur resmi",
])
def test_needs_rewrite_false_for_standalone(q):
    assert rag._needs_rewrite(q) is False


def test_detect_lang_id_vs_en():
    assert rag.detect_lang("apa perbedaan produk ini dengan yang lain") == "id"
    assert rag.detect_lang("what is the difference between these products") == "en"


def test_is_no_answer():
    assert rag._is_no_answer("NO_ANSWER") is True
    assert rag._is_no_answer("") is True
    assert rag._is_no_answer("Produk ini memberikan manfaat proteksi jiwa.") is False


# --- DOCUMENTS block soft budget (safety valve) ------------------------------

def _doc(insurer, n):
    return {"name": f"{insurer}-{n}", "type": "txt", "insurer": insurer, "text": "x" * n}


def test_within_budget_disabled_keeps_all():
    items = [_doc("BCA Life", 100), _doc("Prudential", 100)]
    assert rag._within_budget(items, 0) == items


def test_within_budget_under_budget_keeps_all():
    items = [_doc("BCA Life", 100), _doc("Prudential", 100)]
    assert rag._within_budget(items, 10_000) == items


def test_within_budget_drops_largest_competitor_first():
    home = _doc("BCA Life", 500)
    small_comp = _doc("AIA", 100)
    big_comp = _doc("Prudential", 900)
    kept = rag._within_budget([home, small_comp, big_comp], 700)
    # Home is never dropped; the largest competitor goes first.
    assert home in kept
    assert big_comp not in kept
    assert small_comp in kept


def test_within_budget_never_drops_home_even_if_over():
    home = _doc("BCA Life", 5_000)
    comp = _doc("Prudential", 100)
    kept = rag._within_budget([home, comp], 1_000)
    assert home in kept  # home kept even though it alone exceeds the budget
    assert comp not in kept


# --- LLM retry helper --------------------------------------------------------

class _FlakyLLM:
    """Fails `fail_times` invokes with `exc`, then returns `ok`."""
    def __init__(self, fail_times, exc, ok="ok"):
        self.fail_times = fail_times
        self.exc = exc
        self.ok = ok
        self.calls = 0

    def invoke(self, messages):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise self.exc
        return self.ok


def test_invoke_with_retry_recovers_from_transient(monkeypatch):
    monkeypatch.setattr(rag.time, "sleep", lambda *_: None)
    monkeypatch.setattr(rag.settings, "llm_max_retries", 2)
    llm = _FlakyLLM(fail_times=1, exc=RuntimeError("503 upstream"))
    assert rag.invoke_with_retry(llm, []) == "ok"
    assert llm.calls == 2


def test_invoke_with_retry_exhausts_budget(monkeypatch):
    monkeypatch.setattr(rag.time, "sleep", lambda *_: None)
    monkeypatch.setattr(rag.settings, "llm_max_retries", 2)
    llm = _FlakyLLM(fail_times=99, exc=RuntimeError("network"))
    with pytest.raises(RuntimeError):
        rag.invoke_with_retry(llm, [])
    assert llm.calls == 3  # 1 initial + 2 retries


def test_invoke_with_retry_fails_fast_on_permanent(monkeypatch):
    monkeypatch.setattr(rag.time, "sleep", lambda *_: None)
    monkeypatch.setattr(rag.settings, "llm_max_retries", 2)
    llm = _FlakyLLM(fail_times=99, exc=RuntimeError("401 invalid api key"))
    with pytest.raises(RuntimeError):
        rag.invoke_with_retry(llm, [])
    assert llm.calls == 1  # no retry on a permanent error
