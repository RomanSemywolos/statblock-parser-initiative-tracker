#!/usr/bin/env python3
"""Generate src/translationGlossaryData.ts from the project glossary workbook."""

from __future__ import annotations

import argparse
import json
import pathlib
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS}
DEFAULT_OUTPUT = pathlib.Path(__file__).resolve().parents[1] / "src" / "translationGlossaryData.ts"


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=pathlib.Path, help="path to dnd_en_uk_translation_glossary_classified.xlsx")
    parser.add_argument("--output", type=pathlib.Path, default=DEFAULT_OUTPUT, help="generated TypeScript path")
    return parser.parse_args()


def workbook_rows(source: pathlib.Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(source) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = ["".join(node.text or "" for node in item.iter(f"{{{MAIN_NS}}}t")) for item in root.findall("m:si", NS)]

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {entry.attrib["Id"]: entry.attrib["Target"] for entry in relationships}
        sheet = next(item for item in workbook.find("m:sheets", NS) if item.attrib["name"] == "Glossary")
        target = targets[sheet.attrib[f"{{{REL_NS}}}id"]]
        target = target.lstrip("/") if target.startswith("/") else posixpath.normpath(f"xl/{target}")
        root = ET.fromstring(archive.read(target))

    rows: list[dict[str, str]] = []
    for row in root.findall(".//m:sheetData/m:row", NS):
        values: dict[str, str] = {}
        for cell in row.findall("m:c", NS):
            reference = cell.attrib.get("r", "")
            match = re.match(r"[A-Z]+", reference)
            if match is None:
                continue
            kind = cell.attrib.get("t")
            value_node = cell.find("m:v", NS)
            value = ""
            if kind == "inlineStr":
                value = "".join(node.text or "" for node in cell.iter(f"{{{MAIN_NS}}}t"))
            elif value_node is not None:
                value = value_node.text or ""
                if kind == "s":
                    value = shared_strings[int(value)]
            values[match.group()] = value
        rows.append(values)
    return rows


def generate(source: pathlib.Path, output: pathlib.Path) -> int:
    rows = workbook_rows(source)
    if not rows:
        raise ValueError("Glossary worksheet is empty.")
    columns = {value: key for key, value in rows[0].items()}
    fields = [
        ("english", "English"), ("uk", "Базовий варіант"), ("category", "Категорія"),
        ("processing", "Обробка translator"), ("level", "Рівень pipeline"),
        ("morphology", "Морфологія"), ("capitalization", "Капіталізація"),
        ("mtPolicy", "Політика MT"), ("matchMode", "Спосіб збігу"),
    ]
    missing = [heading for _, heading in fields if heading not in columns]
    if missing:
        raise ValueError(f"Glossary worksheet is missing columns: {', '.join(missing)}")

    entries = []
    for row in rows[1:]:
        entry = {field: row.get(columns[heading], "") for field, heading in fields}
        if entry["english"] and entry["uk"]:
            entries.append(entry)

    text = """// Generated from dnd_en_uk_translation_glossary_classified.xlsx.
// The authoritative translation is the “Базовий варіант” column; “Твоя правка” is intentionally ignored.
// Do not hand-edit this generated file.

export type TranslationGlossaryEntry = {
  english: string;
  uk: string;
  category: string;
  processing: string;
  level: string;
  morphology: string;
  capitalization: string;
  mtPolicy: string;
  matchMode: string;
};

export const TRANSLATION_GLOSSARY: readonly TranslationGlossaryEntry[] = """ + json.dumps(entries, ensure_ascii=False, indent=2) + " as const;\n"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(text, encoding="utf-8")
    return len(entries)


def main() -> None:
    options = arguments()
    count = generate(options.source.resolve(), options.output.resolve())
    print(f"generated {count} entries: {options.output.resolve()}")


if __name__ == "__main__":
    main()
