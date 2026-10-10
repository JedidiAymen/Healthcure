#!/usr/bin/env python3
"""Fail when user-facing copy or docs make claims MEDFORGE cannot support.

A sentence is flagged when it contains a banned phrase and no negation (for example
"does not diagnose" passes, "diagnoses stenosis" fails). Reviewed exceptions live in
scripts/claims_allowlist.txt as "path | phrase | reason". See docs/CLAIMS_AND_LIMITS.md.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
# Pattern -> why it is banned. Technical terms such as "beat detection" are deliberately allowed.
BANNED: dict[str, str] = {
    r"\bdiagnos(e|es|ed|is|tic|ing)\b": "MEDFORGE does not diagnose; it is research and education only",
    r"\bdetect(s|ed|ion|ing)? (a |the )?(stenosis|stenoses|dysfunction)": "no stenosis detector exists; at most a consultative research index",
    r"\bclinically (validated|proven|approved|safe)\b": "no clinical validation or approval exists",
    r"\bvalidated (model|classifier|algorithm|ai|detector)\b": "no model is clinically validated",
    r"\b(fda|ce)[- ](cleared|approved|marked|certified)\b": "no regulatory clearance exists",
    r"\bmedical device\b": "MEDFORGE is not a medical device",
    r"\bfull[- ]rate (video|surgical)": "Endoscapes is 1 fps sampled stills, not full-rate video",
    r"\breal[- ]time (surgical )?guidance\b": "no intraoperative guidance exists",
    r"\bfhir[- ](compatible|compliant|certified)\b": "only a minimal educational FHIR export may exist",
    r"\b(gdpr|rgpd|inpdp|hipaa)[- ]compliant\b": "compliance has not been audited",
    r"\b(fully|completely) secure\b": "security controls exist but nothing is fully secure",
    r"\bguaranteed? (privacy|security|accuracy)\b": "no guarantee can be made",
    r"\btreatment (recommendation|decision)s? (for|from) (the )?patient": "no treatment recommendations are made",
    r"\bour (model|ai) (predicts|predicted|generated) the (dose|pt_241)": "the pt_241 prediction is archived, not our inference",
}
NEGATION = re.compile(r"\b(not|no|none|never|unspecified|would|without|nor|cannot|isn't|aren't|doesn't|don't|won't|neither|avoid|must not|instead of|rather than|non)\b|n't\b", re.I)
SCAN = ["src", "content", "README.md", "RUN_LOCAL.md", "docs"]
EXCLUDE_PARTS = {"source", "design-handoff", "review", "evidence", "ui", "node_modules"}
SUFFIXES = {".ts", ".tsx", ".md", ".json"}
# The claims reference itself quotes every banned phrase on purpose.
EXCLUDE_FILES = {"docs/CLAIMS_AND_LIMITS.md"}


@dataclass
class Finding:
    path: str
    line: int
    phrase: str
    reason: str
    text: str


def sentences(line: str) -> list[str]:
    return [part for part in re.split(r"(?<=[.!?;:])\s+|\s[|]\s", line) if part.strip()]


def scan_text(text: str, path: str) -> list[Finding]:
    findings = []
    for number, line in enumerate(text.splitlines(), start=1):
        for sentence in sentences(line):
            if NEGATION.search(sentence):
                continue
            for pattern, reason in BANNED.items():
                match = re.search(pattern, sentence, re.I)
                if match:
                    findings.append(Finding(path, number, match.group(0), reason, sentence.strip()[:160]))
    return findings


def files(root: Path) -> list[Path]:
    result = []
    for entry in SCAN:
        target = root / entry
        candidates = [target] if target.is_file() else target.rglob("*") if target.is_dir() else []
        for path in candidates:
            if path.is_file() and path.suffix in SUFFIXES and not EXCLUDE_PARTS & set(path.relative_to(root).parts[:-1]) \
                    and not path.name.endswith((".test.ts", ".test.tsx")) \
                    and path.relative_to(root).as_posix() not in EXCLUDE_FILES:
                result.append(path)
    return sorted(result)


def allowlist(root: Path) -> set[tuple[str, str]]:
    entries = set()
    source = root / "scripts" / "claims_allowlist.txt"
    if source.is_file():
        for line in source.read_text(encoding="utf8").splitlines():
            if line.strip() and not line.startswith("#"):
                path, phrase, *_ = [part.strip() for part in line.split("|")]
                entries.add((path, phrase.lower()))
    return entries


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    allowed = allowlist(args.root)
    findings = []
    for path in files(args.root):
        relative = path.relative_to(args.root).as_posix()
        for finding in scan_text(path.read_text(encoding="utf8", errors="replace"), relative):
            if (relative, finding.phrase.lower()) not in allowed:
                findings.append(finding)
    for finding in findings:
        print(f"{finding.path}:{finding.line}: '{finding.phrase}' ({finding.reason})\n    {finding.text}")
    print(f"{len(findings)} unsupported claim(s) found" if findings else "No unsupported claims found")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
