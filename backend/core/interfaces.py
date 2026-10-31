from abc import ABC, abstractmethod
from typing import Dict, Any

class ISignalOutputAdapter(ABC):
    """Interface for physical or virtual traffic light state synchronizers."""
    
    @abstractmethod
    def apply_signals(self, approach_signals: Dict[str, str]) -> None:
        """Applies traffic signal states (green/yellow/red) to output target."""
        pass

class ITrafficPerceptionAdapter(ABC):
    """Interface for gathering approach traffic states (vision or simulation)."""
    
    @abstractmethod
    def get_metrics(self) -> Dict[str, Any]:
        """Returns structured metrics for all intersection approaches."""
        pass
