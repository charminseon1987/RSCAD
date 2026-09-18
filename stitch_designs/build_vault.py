"""
build_vault.py
Walks GFM_Research recursively, parses every .md file,
and writes vault_data.js containing a JS constant with all file objects.
"""

import os
import re
import json

GFM_ROOT = r"C:\Users\hyese\Dev\RSCAD\GFM_Research"
OUTPUT_JS = r"C:\Users\hyese\Dev\RSCAD\stitch_designs\vault_data.js"


def parse_frontmatter(text: str):
    """
    If the file starts with ---, extract YAML front matter and return
    (frontmatter_dict, body_str). Otherwise return ({}, full_text).
    """
    if not text.startswith("---"):
        return {}, text

    # Find closing ---
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text

    yaml_block = text[3:end].strip()
    body = text[end + 4:].lstrip("\n")

    frontmatter = {}
    for line in yaml_block.splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip()
            # Minimal type coercion
            if val.startswith("[") and val.endswith("]"):
                # simple inline list
                items = [v.strip().strip('"').strip("'")
                         for v in val[1:-1].split(",") if v.strip()]
                frontmatter[key] = items
            elif val.lower() == "true":
                frontmatter[key] = True
            elif val.lower() == "false":
                frontmatter[key] = False
            else:
                try:
                    frontmatter[key] = int(val)
                except ValueError:
                    try:
                        frontmatter[key] = float(val)
                    except ValueError:
                        frontmatter[key] = val
    return frontmatter, body


def extract_wikilinks(text: str) -> list:
    """Return all unique targets from [[...]] wikilinks."""
    raw = re.findall(r"\[\[([^\]]+)\]\]", text)
    seen = set()
    result = []
    for link in raw:
        # [[target|alias]] -> keep only target
        target = link.split("|")[0].strip()
        if target and target not in seen:
            seen.add(target)
            result.append(target)
    return result


def build_vault():
    records = []

    for dirpath, dirnames, filenames in os.walk(GFM_ROOT):
        # Skip .obsidian directory anywhere in the tree
        dirnames[:] = [d for d in dirnames if d != ".obsidian"]

        for fname in filenames:
            if not fname.endswith(".md"):
                continue

            abs_path = os.path.join(dirpath, fname)

            # relativePath relative to GFM_Research/
            rel_path = os.path.relpath(abs_path, GFM_ROOT).replace("\\", "/")

            # dir = parent folder path (e.g. "RSCAD/01_개념")
            dir_part = os.path.dirname(rel_path)  # may be "" for root files

            # filename without .md
            filename = fname[:-3]

            try:
                with open(abs_path, encoding="utf-8", errors="replace") as f:
                    raw = f.read()
            except OSError as exc:
                print(f"  [WARN] Cannot read {abs_path}: {exc}")
                continue

            frontmatter, body = parse_frontmatter(raw)
            wikilinks = extract_wikilinks(body)

            records.append({
                "path": rel_path,
                "dir": dir_part,
                "filename": filename,
                "frontmatter": frontmatter,
                "body": body,
                "wikilinks": wikilinks,
            })

    # Sort for deterministic output
    records.sort(key=lambda r: r["path"].lower())

    json_str = json.dumps(records, ensure_ascii=False, indent=2)
    js_content = f"const VAULT_DATA = {json_str};\n"

    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"Done. {len(records)} files written to {OUTPUT_JS}")
    return records


if __name__ == "__main__":
    build_vault()
