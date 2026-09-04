from pathlib import Path

path = Path("client/e2e/productJourneys.spec.js")
text = path.read_text()
old = '["/assessments", "Hiring overview"],'
new = '["/assessments", "Candidate assessments"],'
if old not in text:
    raise SystemExit("Expected Hiring overview smoke assertion not found")
path.write_text(text.replace(old, new, 1))
