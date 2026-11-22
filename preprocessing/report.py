"""Small data-quality report collected while each dataset is cleaned."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class StepReport:
    dataset: str
    rows_in: int = 0
    rows_out: int = 0
    actions: dict[str, int] = field(default_factory=dict)

    def note(self, action: str, count: int) -> None:
        self.actions[action] = int(count)

    def to_dict(self) -> dict:
        return {
            "dataset": self.dataset,
            "rows_in": self.rows_in,
            "rows_out": self.rows_out,
            "kept_pct": round(100 * self.rows_out / self.rows_in, 2) if self.rows_in else 0.0,
            "actions": self.actions,
        }
