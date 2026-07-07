"""Clinical report narration.

Turns a specialist model's STRUCTURED finding into a hospital-style, educational
clinical narrative using the LLM (OpenAI). The LLM never diagnoses or prescribes;
it only explains the model's findings, grounded and guardrailed. Deterministic
disclaimer is appended in code, not left to the model.
"""

from app.services.report.narrator import ReportNarrative, generate_report_narrative

__all__ = ["ReportNarrative", "generate_report_narrative"]
