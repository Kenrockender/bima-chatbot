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
