import uuid
from typing import List
from sqlalchemy.orm import Session
from app.models.exercise_metric import ExerciseMetric


class ExerciseMetricRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, metric: ExerciseMetric) -> ExerciseMetric:
        self.db.add(metric)
        self.db.commit()
        self.db.refresh(metric)
        return metric

    def create_batch(self, metrics: List[ExerciseMetric]) -> List[ExerciseMetric]:
        self.db.add_all(metrics)
        self.db.commit()
        for m in metrics:
            self.db.refresh(m)
        return metrics

    def get_by_session_id(self, session_id: uuid.UUID) -> List[ExerciseMetric]:
        return (
            self.db.query(ExerciseMetric)
            .filter(ExerciseMetric.session_id == session_id)
            .order_by(ExerciseMetric.timestamp.asc())
            .all()
        )
