import json
from pathlib import Path

CONFIG_PATH = Path("/app/data/config.json")


def config_exists() -> bool:
    return CONFIG_PATH.exists()


def load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def save_config(data: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)
