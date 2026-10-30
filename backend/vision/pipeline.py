import cv2, time, numpy as np
from ultralytics import YOLO
from config.settings import Settings, ApproachRegion
from typing import List, Tuple, Dict, Optional

# All vehicle classes from COCO
VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

# Signal colors (BGR format)
SIGNAL_BGR = {
    "green":  (0, 230, 80),
    "yellow": (0, 210, 255),
    "red":    (40, 40, 255),
}

def point_in_polygon(point, polygon) -> bool:
    return cv2.pointPolygonTest(
        np.array(polygon, dtype=np.int32), point, False
    ) >= 0

class Detection:
    def __init__(self, tid, cls, conf, box, approach, is_ambulance=False):
        self.track_id     = tid           # -1 if snapshot mode
        self.cls          = cls           # "car", "truck", "motorcycle", "bus", "ambulance"
        self.conf         = conf
        self.box          = box           # (x1, y1, x2, y2)
        self.approach     = approach      # "north" | "south" | "east" | "west" | None
        self.is_ambulance = is_ambulance or (cls.lower() == "ambulance")

class VisionPipeline:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.model    = YOLO(settings.model_path)
        self._fps     = 0.0
        self._last_t  = time.time()
        self._frame_count = 0
        self._last_good   = time.time()
        self._warnings: List[str] = []
        self.active_ambulance_approach: Optional[str] = None
        self.last_snapshot_time: float = 0.0
        self.snapshot_count: int = 0

    def process_frame(
        self,
        frame: np.ndarray,
        approach_states: Optional[Dict[str, str]] = None,
        cached_detections: Optional[List[Detection]] = None,
        is_snapshot_frame: bool = False,
        approach_timers: Optional[Dict[str, int]] = None
    ) -> Tuple[np.ndarray, List[Detection]]:
        """
        Processes frame either in continuous tracking mode or using detections from snapshot.
        Renders bounding boxes, approach polygons, and 3-bulb traffic signal box
        with live countdown timer text right on top of each light.
        """
        detections: List[Detection] = []
        annotated = frame.copy()
        is_snapshot_mode = (self.settings.vision_mode == "snapshot")

        if is_snapshot_frame or not is_snapshot_mode:
            if is_snapshot_mode:
                results = self.model.predict(
                    frame,
                    conf=self.settings.confidence,
                    classes=list(VEHICLE_CLASSES.keys()),
                    verbose=False,
                )
                self.snapshot_count += 1
                self.last_snapshot_time = time.time()
            else:
                results = self.model.track(
                    frame,
                    persist=True,
                    conf=self.settings.confidence,
                    classes=list(VEHICLE_CLASSES.keys()),
                    verbose=False,
                )

            if results and results[0].boxes is not None:
                boxes = results[0].boxes
                for i, box in enumerate(boxes):
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cls_id   = int(box.cls[0])
                    conf     = float(box.conf[0])
                    tid      = int(box.id[0]) if (box.id is not None and not is_snapshot_mode) else (i + 1)
                    cls_name = VEHICLE_CLASSES.get(cls_id, "vehicle")
                    cx, cy   = (x1 + x2) // 2, (y1 + y2) // 2

                    approach = self._classify_approach((cx, cy))

                    is_amb = (cls_name == "ambulance") or (
                        approach and approach == self.active_ambulance_approach
                    )
                    if is_amb:
                        cls_name = "ambulance"

                    det = Detection(tid, cls_name, conf, (x1, y1, x2, y2), approach, is_ambulance=is_amb)
                    detections.append(det)
        else:
            detections = cached_detections or []

        # Draw vehicle bounding boxes
        for det in detections:
            x1, y1, x2, y2 = det.box
            cls_name = det.cls
            tid = det.track_id

            if det.is_ambulance:
                box_color = (0, 0, 255)
                thickness = 3
                label = "EMERGENCY AMBULANCE"
            else:
                color_map = {
                    "car": (0, 200, 255),
                    "truck": (255, 120, 0),
                    "bus": (255, 200, 0),
                    "motorcycle": (180, 255, 50)
                }
                box_color = color_map.get(cls_name, (0, 255, 0))
                thickness = 2
                label = f"{cls_name.upper()}" if is_snapshot_mode else f"{cls_name.upper()} #{tid}"

            cv2.rectangle(annotated, (x1, y1), (x2, y2), box_color, thickness)
            cv2.putText(annotated, label, (x1, max(y1 - 6, 14)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, box_color, 1)

        # Draw approach regions with signal color and 3-bulb traffic light enclosure with COUNTDOWN TIMER
        self._draw_regions(annotated, approach_states or {}, approach_timers or {})

        # Draw Mode Telemetry Badge
        if is_snapshot_mode:
            time_since_snap = time.time() - self.last_snapshot_time
            remaining_to_snap = max(0.0, self.settings.snapshot_interval - time_since_snap)
            cv2.rectangle(annotated, (10, 10), (320, 42), (0, 0, 0), -1)
            cv2.rectangle(annotated, (10, 10), (320, 42), (255, 255, 255), 1)
            badge_text = f"PHOTO SNAPSHOT #{self.snapshot_count} (NEXT: {remaining_to_snap:.1f}s)"
            cv2.putText(annotated, badge_text, (18, 32),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
        else:
            self._frame_count += 1
            elapsed = time.time() - self._last_t
            if elapsed >= 1.0:
                self._fps = self._frame_count / elapsed
                self._frame_count = 0
                self._last_t = time.time()
            cv2.putText(annotated, f"TRACKING FPS: {self._fps:.1f}", (12, 24),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

        self._last_good = time.time()
        return annotated, detections

    def _classify_approach(self, point) -> Optional[str]:
        for region in self.settings.approaches:
            if point_in_polygon(point, region.polygon):
                return region.name
        return None

    def _draw_regions(
        self,
        frame: np.ndarray,
        approach_states: Dict[str, str],
        approach_timers: Dict[str, int]
    ):
        for region in self.settings.approaches:
            sig   = approach_states.get(region.name, "red")
            timer = approach_timers.get(region.name, 0)
            color = SIGNAL_BGR.get(sig, (80, 80, 80))
            pts   = np.array(region.polygon, np.int32)

            # Translucent approach boundary fill
            overlay = frame.copy()
            cv2.fillPoly(overlay, [pts], color)
            cv2.addWeighted(overlay, 0.12, frame, 0.88, 0, frame)

            # Polylines border
            thickness = 3 if sig == "green" else 2
            cv2.polylines(frame, [pts], True, color, thickness)

            # Draw the 3-bulb traffic light box with live countdown timer on top
            self._draw_traffic_light_box(frame, region.polygon, sig, region.name, timer)

    def _draw_traffic_light_box(
        self,
        frame: np.ndarray,
        polygon: list,
        sig: str,
        name: str,
        timer_val: int = 0
    ):
        """
        Draws a horizontal traffic light box [ RED | YELLOW | GREEN ]
        with a live countdown timer text on top of the traffic light.
        """
        if not polygon:
            return

        xs = [p[0] for p in polygon]
        ys = [p[1] for p in polygon]
        
        # Position the traffic signal box at the stop-line edge of the region
        if name == "north":
            box_x = int(sum(xs) / len(xs)) - 48
            box_y = max(ys) - 34
        elif name == "south":
            box_x = int(sum(xs) / len(xs)) - 48
            box_y = min(ys) + 26
        elif name == "east":
            box_x = min(xs) + 10
            box_y = int(sum(ys) / len(ys)) - 14
        else: # west
            box_x = max(xs) - 106
            box_y = int(sum(ys) / len(ys)) - 14

        box_w, box_h = 104, 32
        r = 8  # bulb radius

        # ── 1. TIMER BADGE ON TOP OF TRAFFIC LIGHT ────────────────────────────
        timer_text = f"{timer_val:02d}s"
        accent_color = SIGNAL_BGR.get(sig, (255, 255, 255))

        # Solid high-contrast background tab on top of the traffic light
        cv2.rectangle(frame, (box_x, box_y - 24), (box_x + box_w, box_y), (10, 10, 10), -1)
        cv2.rectangle(frame, (box_x, box_y - 24), (box_x + box_w, box_y), (70, 70, 70), 1)

        # Approach name label (left)
        cv2.putText(frame, name.upper()[:5], (box_x + 6, box_y - 7),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.44, (200, 200, 200), 1)

        # PROMINENT COUNTDOWN TIMER ON TOP OF TRAFFIC LIGHT (right)
        cv2.putText(frame, timer_text, (box_x + box_w - 42, box_y - 7),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.52, accent_color, 2)

        # ── 2. TRAFFIC LIGHT ENCLOSURE ────────────────────────────────────────
        cv2.rectangle(frame, (box_x, box_y), (box_x + box_w, box_y + box_h), (8, 8, 8), -1)
        cv2.rectangle(frame, (box_x, box_y), (box_x + box_w, box_y + box_h), (50, 50, 50), 1)

        bulbs = [
            ("red",    box_x + 20, (0, 0, 255),   (35, 35, 75)),
            ("yellow", box_x + 52, (0, 215, 255), (35, 65, 75)),
            ("green",  box_x + 84, (0, 255, 80),  (35, 75, 45)),
        ]

        center_y = box_y + box_h // 2

        for bulb_state, center_x, on_color, off_color in bulbs:
            is_active = (sig == bulb_state)

            if is_active:
                cv2.circle(frame, (center_x, center_y), r + 5, on_color, 1)
                cv2.circle(frame, (center_x, center_y), r + 2, (255, 255, 255), 1)
                cv2.circle(frame, (center_x, center_y), r, on_color, -1)
                cv2.circle(frame, (center_x - 2, center_y - 2), 2, (255, 255, 255), -1)
            else:
                cv2.circle(frame, (center_x, center_y), r, off_color, -1)

    def health(self) -> dict:
        return {
            "mode":      self.settings.vision_mode,
            "fps":       round(self._fps, 1),
            "snapshots": self.snapshot_count,
            "last_good": self._last_good,
            "stale":     (time.time() - self._last_good) > 5,
            "warnings":  self._warnings,
        }
