import uuid
from typing import Optional
from sqlalchemy.orm import Session
from app.models.ai_report import AIReport


class AIReportRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, report: AIReport) -> AIReport:
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def get_by_id(self, report_id: uuid.UUID) -> Optional[AIReport]:
        return self.db.query(AIReport).filter(AIReport.id == report_id).first()

    def get_by_session_id(self, session_id: uuid.UUID) -> Optional[AIReport]:
        return self.db.query(AIReport).filter(AIReport.session_id == session_id).first()

