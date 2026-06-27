import json
import shutil
from core.paths import get_app_dir, get_resource_path


class AutocompleteManager:
    DEFAULT_KEYS = ("campus", "setor", "servidor", "elaborador", "estagiario", "fiscal", "bdis")
    DEFAULT_DATA = {
        "campus": [],
        "setor": [],
        "servidor": [],
        "elaborador": [],
        "estagiario": [],
        "fiscal": [],
        "bdis": ["0.2882", "0.3518"],
    }

    def __init__(self):
        self.path = get_app_dir() / "config" / "autocomplete.json"
        if not self.path.parent.exists():
            self.path.parent.mkdir(parents=True, exist_ok=True)

        self.data = {}
        self._load()

    def _load(self):
        # Primeira execução: semeia com o autocomplete.json que vem
        # embutido no instalador, se existir, para não começar vazio.
        if not self.path.exists():
            seed_path = get_resource_path("config/autocomplete.json")
            if seed_path.exists():
                try:
                    shutil.copy2(seed_path, self.path)
                except Exception:
                    pass

        if not self.path.exists():
            self.data = {key: list(values) for key, values in self.DEFAULT_DATA.items()}
            self.save()
        else:
            try:
                with open(self.path, 'r', encoding='utf-8') as f:
                    raw_data = json.load(f)
                    self.data = self._normalize_payload(raw_data)
            except Exception as e:
                print(f"Erro no autocomplete: {e}")
                self.data = {key: list(values) for key, values in self.DEFAULT_DATA.items()}

    def _normalize_payload(self, payload):
        normalized = {key: [] for key in self.DEFAULT_KEYS}
        if not isinstance(payload, dict):
            return normalized

        for key, values in payload.items():
            clean_key = str(key or "").strip().lower()
            if not clean_key:
                continue

            if not isinstance(values, list):
                values = []

            clean_values = []
            seen = set()
            for value in values:
                text = str(value or "").strip().upper()
                if not text or text in seen:
                    continue
                seen.add(text)
                clean_values.append(text)

            normalized[clean_key] = sorted(clean_values)

        return normalized

    def save(self):
        try:
            with open(self.path, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"Erro ao salvar: {e}")

    def get_list(self, key):
        key = key.lower()
        lista = self.data.get(key, [])
        if isinstance(lista, list):
            return sorted(list(set([str(x).strip().upper() for x in lista if x and str(x).strip()])))
        return []

    def get_all(self):
        return {key: self.get_list(key) for key in sorted(set(self.DEFAULT_KEYS) | set(self.data.keys()))}

    def replace_all(self, payload):
        self.data = self._normalize_payload(payload)
        self.save()
        return self.get_all()

    def add_value(self, key, value):
        if not value or not str(value).strip():
            return
        key = key.lower()
        val_str = str(value).strip().upper()
        if key not in self.data:
            self.data[key] = []
        if not isinstance(self.data[key], list):
            self.data[key] = []
        if val_str not in self.data[key]:
            self.data[key].append(val_str)
            self.save()

    def remove_value(self, key, value):
        key = key.lower()
        val_str = str(value).strip().upper()
        if key in self.data and val_str in self.data[key]:
            self.data[key].remove(val_str)
            self.save()
            return True
        return False
