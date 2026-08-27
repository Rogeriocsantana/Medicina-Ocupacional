import json
import re
import sys
import unicodedata
from pathlib import Path


def key(value):
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char)).upper()
    return re.sub(r"[^A-Z0-9]+", " ", value).strip()


SETORES = {
    key("ADMNISTRAÇÃO"): "205-ADMINISTRAÇÃO",
    key("AMB CARDIOLOGIA 5º ANDAR"): "218-AMB CARDIOLOGIA 5 ANDAR",
    key("AMB OFTALMOLOGIA"): "262-AMB OFTALMOLOGIA 3 ANDAR",
    key("AMBULATÓRIO 9º ANDAR"): "274-AMB 9º ANDAR",
    key("AMBULATÓRIO CELTEC"): "223-AMB CELTEC",
    key("AMBULATÓRIO ONCOLOGIA/QUIMIOTERAPIA"): "213-AMB ONCOLOGIA/QUIMI 6 ANDAR",
    key("AMBULATÓRIO PEDIATRIA – 4º ANDAR"): "273-AMB PEDIATRIA 4 ANDAR",
    key("CENTRAL DE GUIAS (AUTORIZAÇÃO)"): "286-CENTRAL GUIAS (AUTORIZ)",
    key("ENDOSCOPIA"): "217-ENDOSCOPIA/COLONO",
    key("RECEPÇÃO AMBULATÓRIO - 10º ANDAR - CDI"): "250-RECEPÇÃO AMB 10 ANDAR",
    key("RECEPÇÃO AMBULATÓRIO - 11º ANDAR"): "239-RECEP AMB 11 ANDAR"
}

CARGOS = {
    key("ASSISTENTE ADMINISTRATIVO JR"): "ASSISTENTE ADMINISTRATIVO JR",
    key("ASSISTENTE ADMNISTRATIVO"): "ASSISTENTE ADMINISTRATIVO",
    key("AUXILIAR DE LIMPEZA (COLETOR)"): "AUXILIAR DE LIMPEZA",
    key("BIOMEDICO(A) MICROBIOLOGISTA"): "BIOMÉDICO(A) MICROBIOLOGISTA",
    key("BIOMEDICO(A) QUALIDADE"): "BIOMÉDICO(A) DA QUALIDADE",
    key("COORDENADOR(A) DE EXPÊRIENCIA DO CLIENTE"): "COORDENADOR(A) DE EXPERIÊNCIA DO PACIENTE",
    key("COPEIRA"): "COPEIRO(A)",
    key("COPEIRA ADMINISTRATIVO"): "COPEIRO(A) ADMINISTRATIVO(A)",
    key("COSTUREIRA"): "COSTUREIRO(A)",
    key("DIRETORIA ADMINISTRATIVA"): "DIRETOR(A) ADMINISTRATIVO(A)",
    key("ENCARREGADO DE MANUTENÇÃO"): "ENCARREGADO(A) DE MANUTENÇÃO",
    key("ENFERMEIRO(A) EDUCAÇÃO CONTINUADA"): "ENFERMEIRO(A) DE EDUCAÇÃO CONTINUADA",
    key("ENFERMEIRO(A) GESTOR"): "ENFERMEIRO(A) GESTOR(A)",
    key("ENFERMEIRO(A) OBSTETRA"): "ENFERMEIRO(A) OBSTETRA",
    key("FARMACÊUTICO(A) ONCOLÓGICA"): "FARMACÊUTICO(A) ONCOLÓGICO(A)",
    key("GERENTE DE NUTRIÇÃO"): "GERENTE DE NUTRIÇÃO E PRODUÇÃO",
    key("GERENTE DE RECURSOS HUMANOS"): "GERENTE DE RECURSOS HUMANOS",
    key("LACTARISTA HOSPITALAR"): "LACTARISTA",
    key("NUTRICIONISTA CLÍNICA"): "NUTRICIONISTA CLÍNICO(A)",
    key("SUPERVISOR DE SEGURANÇA DO TRABALHO"): "SUPERVISOR(A) DE SEGURANÇA DO TRABALHO",
    key("SUPERVISOR(A) DE RECPÇÃO"): "SUPERVISOR(A) DE RECEPÇÃO",
    key("SUPERVISOR(A) NOTURNO"): "SUPERVISOR(A) NOTURNO",
    key("SURPERVISOR(A) ADMINISTRATIVO(A)"): "SUPERVISOR(A) ADMINISTRATIVO(A)",
    key("TÉCNICO DE ENFERMAGEM"): "TÉCNICO(A) DE ENFERMAGEM",
    key("TÉCNICO DE MANUTENÇÃO"): "TÉCNICO(A) DE MANUTENÇÃO",
    key("TÉCNICO DE MANUTENÇÃO 2"): "TÉCNICO(A) DE MANUTENÇÃO 2",
    key("TÉCNICO DE SEGURANÇA DO TRABALHO"): "TÉCNICO(A) EM SEGURANÇA DO TRABALHO",
    key("TÉCNICO EM LOGISTICA"): "TÉCNICO(A) DE LOGÍSTICA",
    key("TÉCNICO EM MANUTENÇÃO DE EQUIPAMENTOS E INSTRUMENTOS MÉDICO HOSPITALARES"): "TÉCNICO(A) EM EQUIPAMENTOS MÉDICO-HOSPITALARES"
}

GRUPOS = {
    "QUIMICO": "Químico",
    "BIOLOGICO": "Biológico",
    "FISICO": "Físico",
    "ERGONOMICOS": "Ergonômico",
    "ACIDENTE": "Acidente",
    "ACIDENTES": "Acidente"
}

EXAMES = {
    key("Hepatite C - anti-HCV"): "Hepatite C - Anti-HCV",
    key("Hepatite C - anti-HCV - pesquisa e/ou dosagem"): "Hepatite C - Anti-HCV",
    key("Self Report Questionare – SRQ20"): "Self-Report Questionnaire (SRQ-20)",
    key("Eletrocardiograma-ECG"): "Eletrocardiograma (ECG)",
    key("Eletroencefalograma-EEG"): "Eletroencefalograma (EEG)",
    key("Hepatite B - Anti HBS"): "Hepatite B - Anti-HBs",
    key("Antígeno Austrália (HBSAG)"): "Antígeno Austrália (HBsAg)",
    key("Hepatite A IGG"): "Hepatite A - IgG",
    key("Hepatite A IGM"): "Hepatite A - IgM"
}

TIPOS = {
    "ADMISSÃO": "admissional",
    "APÓS ADM.": "apos_admissao",
    "PERIÓDICO": "periodico",
    "RET. TRAB": "retorno_trabalho",
    "MUD. RISCOS": "mudanca_riscos",
    "DEMISSÃO": "demissional"
}


def canonical_sector(value):
    normalized = key(value)
    if normalized in SETORES:
        return SETORES[normalized]
    aliases = {
        key("PRONTO SOCORRO"): "187-PRONTO SOCORRO",
        key("CENTRO CIRÚRGICO"): "188-CENTRO CIRURGICO",
        key("UTI ADULTO"): "189-UTI ADULTO",
        key("UTI NEO"): "190-UTI NEO",
        key("INTERNAÇÃO"): "192-INTERNAÇÃO",
        key("FARMÁCIA"): "196-FARMACIA",
        key("UAN"): "199-UAN",
        key("ROUPARIA"): "200-ROUPARIA",
        key("HIGIENE HOSPITAL"): "201-HIGIENE HOSPITAL",
        key("LABORATÓRIO"): "202-LABORATÓRIO",
        key("MANUTENÇÃO"): "203-MANUTENÇÃO",
        key("PLANO DE SAÚDE"): "204-PLANO DE SAUDE",
        key("ADMINISTRAÇÃO"): "205-ADMINISTRAÇÃO",
        key("SEGURANÇA/PORTARIA"): "210-SEGURANÇA/PORTARIA",
        key("COMPRAS/ALMOXARIFADO"): "212-COMPRAS/ALMOXARIFADO",
        key("SCIH"): "221-SCIH",
        key("RECEPÇÃO DE INTERNAÇÃO"): "275-RECEPÇÃO DE INTERNAÇÃO",
        key("RECEPÇÃO DE PRONTO SOCORRO"): "276-RECEPÇÃO DE PRONTO SOCORRO",
        key("CME"): "280-CME",
        key("HIGIENE PRÉDIO"): "287-HIGIENE PRÉDIO",
        key("HEMODINÂMICA"): "305-HEMODINAMICA",
        key("AMBULATÓRIO DE INFUSÃO"): "309-AMBULATORIO DE INFUSÃO",
        key("HOME CARE/ PVD"): "258-HOME CARE - PVD",
        key("RAIO X"): "2-RAIO X",
        key("TOMOGRAFIA"): "216-TOMOGRAFIA",
        key("ULTRASSOM"): "214-ULTRASSOM"
    }
    if normalized not in aliases:
        raise ValueError(f"Setor sem mapeamento: {value}")
    return aliases[normalized]


def canonical_cargo(value):
    normalized = key(value)
    return CARGOS.get(normalized, value.strip())


def parse_rule(value):
    value = value.strip()
    if not value or value == "-":
        return None
    if value.upper() == "X":
        return {"obrigatorio": True, "periodicidade_meses": None, "valor_original": value}
    match = re.search(r"(\d+)", value)
    return {
        "obrigatorio": True,
        "periodicidade_meses": int(match.group(1)) if match else None,
        "valor_original": value
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Uso: normalize_pcmso_2026.py <entrada.raw.json> <saida.json>")
    source = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    profiles = []
    for profile in source["perfis"]:
        risks = []
        for risk in profile["riscos"]:
            group = GRUPOS[key(risk["grupo"])]
            risks.append({
                "grupo": group,
                "fator": risk["fator"].strip(),
                "agravos": risk["descricao"].strip()
            })
        exams = []
        for exam in profile["exames"]:
            exam_name = EXAMES.get(key(exam["exame"]), exam["exame"].strip())
            if key(exam_name) == key("Exame Clínico"):
                continue
            for raw_type, value in exam["regras"].items():
                rule = parse_rule(value)
                if rule:
                    exams.append({"exame": exam_name, "tipo": TIPOS[raw_type], **rule})
        profiles.append({
            "setor": canonical_sector(profile["setor"]),
            "cargo": canonical_cargo(profile["cargo"]),
            "riscos": risks,
            "regras_exames": exams
        })
    merged = {}
    for profile in profiles:
        profile_key = (profile["setor"], profile["cargo"])
        target = merged.setdefault(profile_key, {
            "setor": profile["setor"], "cargo": profile["cargo"],
            "riscos": [], "regras_exames": []
        })
        for risk in profile["riscos"]:
            if risk not in target["riscos"]:
                target["riscos"].append(risk)
        for rule in profile["regras_exames"]:
            if rule not in target["regras_exames"]:
                target["regras_exames"].append(rule)
    profiles = list(merged.values())

    output = {
        "fonte": source["fonte"],
        "grupos": [
            {"nome": "Biológico", "cor": "#8B5E3C", "ordem": 1},
            {"nome": "Físico", "cor": "#16A34A", "ordem": 2},
            {"nome": "Químico", "cor": "#DC2626", "ordem": 3},
            {"nome": "Ergonômico", "cor": "#F59E0B", "ordem": 4},
            {"nome": "Acidente", "cor": "#2563EB", "ordem": 5}
        ],
        "tipos_exame": [
            {"chave": "admissional", "nome": "Admissional", "ordem": 1, "selecionavel_aso": True},
            {"chave": "apos_admissao", "nome": "Após admissão", "ordem": 2, "selecionavel_aso": False},
            {"chave": "periodico", "nome": "Periódico", "ordem": 3, "selecionavel_aso": True},
            {"chave": "retorno_trabalho", "nome": "Retorno ao trabalho", "ordem": 4, "selecionavel_aso": True},
            {"chave": "mudanca_riscos", "nome": "Mudança de riscos", "ordem": 5, "selecionavel_aso": True},
            {"chave": "demissional", "nome": "Demissional", "ordem": 6, "selecionavel_aso": True}
        ],
        "perfis": profiles
    }
    Path(sys.argv[2]).write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "perfis": len(profiles),
        "setores": len({p['setor'] for p in profiles}),
        "cargos": len({p['cargo'] for p in profiles}),
        "riscos": len({(r['grupo'], r['fator'], r['agravos']) for p in profiles for r in p['riscos']}),
        "exames": len({r['exame'] for p in profiles for r in p['regras_exames']}),
        "regras": sum(len(p['regras_exames']) for p in profiles)
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
