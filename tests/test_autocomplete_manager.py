from utils import autocomplete_manager as autocomplete_module


def test_replace_all_normalizes_deduplicates_and_persists(tmp_path, monkeypatch):
    monkeypatch.setattr(autocomplete_module, "get_app_dir", lambda: tmp_path)
    monkeypatch.setattr(autocomplete_module, "get_resource_path", lambda _: tmp_path / "missing.json")

    manager = autocomplete_module.AutocompleteManager()

    saved = manager.replace_all(
        {
            "Fiscal": [" ana maria ", "ANA MARIA", "", None],
            "setor": [" obras ", "OBRAS", " Engenharia "],
            "estagiario": [],
        }
    )

    assert saved["fiscal"] == ["ANA MARIA"]
    assert saved["setor"] == ["ENGENHARIA", "OBRAS"]
    assert saved["estagiario"] == []

    reloaded = autocomplete_module.AutocompleteManager()
    assert reloaded.get_all()["fiscal"] == ["ANA MARIA"]
    assert reloaded.get_all()["setor"] == ["ENGENHARIA", "OBRAS"]


def test_replace_all_keeps_default_keys_when_payload_is_empty(tmp_path, monkeypatch):
    monkeypatch.setattr(autocomplete_module, "get_app_dir", lambda: tmp_path)
    monkeypatch.setattr(autocomplete_module, "get_resource_path", lambda _: tmp_path / "missing.json")

    manager = autocomplete_module.AutocompleteManager()
    saved = manager.replace_all({})

    for key in autocomplete_module.AutocompleteManager.DEFAULT_KEYS:
        assert key in saved
        assert saved[key] == []
