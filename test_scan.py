import os
import json

base_dir = "/Users/nguyenhuuhoangluan/Git_Code/Style-Bert-VITS2-Mac/model_assets"
models = []
for entry in os.scandir(base_dir):
    if entry.is_dir():
        cfg_path = os.path.join(entry.path, "config.json")
        if os.path.exists(cfg_path):
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    styles = list(cfg.get("data", {}).get("style2id", {}).keys())
                    models.append({"id": entry.name, "styles": styles})
            except Exception as e:
                pass
print(json.dumps(models))
