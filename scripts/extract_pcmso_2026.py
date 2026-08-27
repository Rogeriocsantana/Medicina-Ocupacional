import json
import re
import sys
from pathlib import Path

from docx import Document


def clean(value):
    return re.sub(r"\s+", " ", value or "").strip()


def compact_row(row):
    values = []
    for cell in row.cells:
        value = clean(cell.text)
        if value and (not values or values[-1] != value):
            values.append(value)
    return values


def parse_exam_table(table):
    headers = [clean(cell.text) for cell in table.rows[0].cells]
    rows = []
    for row in table.rows[1:]:
        values = [clean(cell.text) for cell in row.cells]
        by_header = {}
        for header, value in zip(headers, values):
            if header and header not in by_header:
                by_header[header] = value
            elif header and not by_header[header] and value:
                by_header[header] = value
        exam = by_header.pop("Exames", "")
        if exam:
            rows.append({"exame": exam, "regras": by_header})
    return rows


def extract(source):
    document = Document(source)
    profiles = []
    current_sector = None
    pending_profile = None

    for index, table in enumerate(document.tables):
        first = compact_row(table.rows[0]) if table.rows else []
        all_text = [clean(cell.text) for row in table.rows for cell in row.cells]

        if len(table.rows) == 1 and first and first[0].startswith("Setor:"):
            current_sector = clean(first[0].split(":", 1)[1])
            continue

        cargo_text = next((text for text in all_text if text.startswith("Cargo:")), None)
        has_risk_header = any("Perigo / Fator de Risco" in text for text in all_text)
        if cargo_text and has_risk_header and current_sector:
            cargo = clean(cargo_text.split(":", 1)[1])
            header_index = next(
                i for i, row in enumerate(table.rows)
                if any("Perigo / Fator de Risco" in clean(cell.text) for cell in row.cells)
            )
            risks = []
            for row in table.rows[header_index + 1:]:
                values = compact_row(row)
                if len(values) >= 2:
                    risks.append({
                        "fator": values[0],
                        "grupo": values[1],
                        "descricao": values[2] if len(values) > 2 else ""
                    })
            pending_profile = {
                "setor": current_sector,
                "cargo": cargo,
                "riscos": risks,
                "exames": [],
                "tabela_riscos": index
            }
            profiles.append(pending_profile)
            continue

        if first and first[0] == "Exames" and pending_profile is not None:
            pending_profile["exames"] = parse_exam_table(table)
            pending_profile["tabela_exames"] = index
            pending_profile = None

    return {
        "fonte": str(source),
        "perfis": profiles
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Uso: extract_pcmso_2026.py <PCMSO.docx> <saida.json>")
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    data = extract(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    profiles = data["perfis"]
    groups = {risk["grupo"] for profile in profiles for risk in profile["riscos"]}
    risks = {(risk["grupo"], risk["fator"], risk["descricao"]) for profile in profiles for risk in profile["riscos"]}
    exams = {exam["exame"] for profile in profiles for exam in profile["exames"]}
    print(json.dumps({
        "perfis": len(profiles),
        "setores": len({profile["setor"] for profile in profiles}),
        "cargos": len({profile["cargo"] for profile in profiles}),
        "grupos_raw": sorted(groups),
        "riscos_unicos": len(risks),
        "exames_unicos": len(exams),
        "perfis_sem_exames": sum(not profile["exames"] for profile in profiles)
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
