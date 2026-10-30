"""
Generates a synthetic top-down intersection video for testing.
Simulates a Kigali-style busy 4-way intersection.
"""
import cv2, numpy as np, random, math

W, H = 640, 480
ROAD_W = 90          # road width in pixels
CX, CY = W//2, H//2  # intersection center

def draw_road(frame):
    frame[:] = (40, 80, 40)  # grass/ground
    # Roads
    cv2.rectangle(frame, (CX-ROAD_W//2,0), (CX+ROAD_W//2,H), (60,60,60), -1)
    cv2.rectangle(frame, (0,CY-ROAD_W//2), (W,CY+ROAD_W//2), (60,60,60), -1)
    # Intersection box
    cv2.rectangle(frame, (CX-ROAD_W//2,CY-ROAD_W//2),
                  (CX+ROAD_W//2,CY+ROAD_W//2), (55,55,55), -1)
    # Center lines (dashed)
    for y in range(0, CY-ROAD_W//2, 30):
        cv2.line(frame,(CX,y),(CX,y+15),(200,200,200),2)
    for y in range(CY+ROAD_W//2, H, 30):
        cv2.line(frame,(CX,y),(CX,y+15),(200,200,200),2)
    for x in range(0, CX-ROAD_W//2, 30):
        cv2.line(frame,(x,CY),(x+15,CY),(200,200,200),2)
    for x in range(CX+ROAD_W//2, W, 30):
        cv2.line(frame,(x,CY),(x+15,CY),(200,200,200),2)
    # Crosswalks
    for i in range(5):
        offset = i*10
        cv2.rectangle(frame,(CX-ROAD_W//2, CY-ROAD_W//2-offset-8),
                      (CX+ROAD_W//2, CY-ROAD_W//2-offset),(230,230,230),-1)

class Car:
    COLORS = [(0,120,255),(255,80,0),(0,200,100),(200,0,200),(255,200,0)]
    def __init__(self, direction, ambulance=False):
        self.direction  = direction   # "N","S","E","W"
        self.ambulance  = ambulance
        self.color      = (255,255,255) if ambulance else random.choice(self.COLORS)
        self.length     = random.randint(22,32)
        self.width      = random.randint(12,18)
        self.speed      = random.uniform(1.5, 3.0) * (2 if ambulance else 1)
        self.stopped    = False
        # Start position outside frame
        if direction == "S": self.x,self.y = CX + random.randint(-20,20), -40
        if direction == "N": self.x,self.y = CX + random.randint(-20,20), H+40
        if direction == "E": self.x,self.y = -40, CY + random.randint(-20,20)
        if direction == "W": self.x,self.y = W+40, CY + random.randint(-20,20)

    def move(self, phase):
        green_directions = {"A":["N","S"],"B":["E","W"]}[phase]
        # Stop before intersection if red
        stop_line = {"S": CY-ROAD_W//2-15,
                     "N": CY+ROAD_W//2+15,
                     "E": CX-ROAD_W//2-15,
                     "W": CX+ROAD_W//2+15}
        should_stop = self.direction not in green_directions
        sl = stop_line[self.direction]
        at_stop = {
            "S": self.y >= sl-5 and self.y < CY,
            "N": self.y <= sl+5 and self.y > CY,
            "E": self.x >= sl-5 and self.x < CX,
            "W": self.x <= sl+5 and self.x > CX,
        }[self.direction]
        self.stopped = should_stop and at_stop
        if not self.stopped:
            if self.direction == "S": self.y += self.speed
            if self.direction == "N": self.y -= self.speed
            if self.direction == "E": self.x += self.speed
            if self.direction == "W": self.x -= self.speed

    def draw(self, frame):
        x,y = int(self.x), int(self.y)
        hl,hw = self.length//2, self.width//2
        if self.direction in ("N","S"):
            p1,p2 = (x-hw,y-hl),(x+hw,y+hl)
        else:
            p1,p2 = (x-hl,y-hw),(x+hl,y+hw)
        cv2.rectangle(frame, p1, p2, self.color, -1)
        cv2.rectangle(frame, p1, p2, (0,0,0), 1)
        if self.ambulance:
            cv2.line(frame,(x-6,y),(x+6,y),(0,0,220),2)
            cv2.line(frame,(x,y-6),(x,y+6),(0,0,220),2)

    def is_offscreen(self):
        return self.x < -60 or self.x > W+60 or self.y < -60 or self.y > H+60

def main():
    out = cv2.VideoWriter("test_intersection.mp4",
                          cv2.VideoWriter_fourcc(*"mp4v"), 25, (W,H))
    cars: list[Car] = []
    phase  = "A"
    timer  = 0
    frame_count = 0
    PHASE_FRAMES = {"A": 200, "B": 150}   # green duration in frames

    directions = ["N","S","E","W"]
    spawn_timer = 0

    for _ in range(900):   # 36 seconds @ 25fps
        frame = np.zeros((H,W,3), np.uint8)
        draw_road(frame)

        # Phase switching
        timer += 1
        if timer >= PHASE_FRAMES[phase]:
            phase = "B" if phase == "A" else "A"
            timer = 0

        # Spawn cars
        spawn_timer += 1
        if spawn_timer >= 20:
            spawn_timer = 0
            d = random.choice(directions)
            # 5% chance ambulance in frame 400+
            is_amb = frame_count > 400 and random.random() < 0.05
            cars.append(Car(d, ambulance=is_amb))

        # Move & draw
        for car in cars:
            car.move(phase)
            car.draw(frame)
        cars = [c for c in cars if not c.is_offscreen()]

        # HUD
        phase_color = (0,220,0) if True else (0,0,220)
        cv2.putText(frame, f"Phase {phase} | Vehicles: {len(cars)}",
                    (10,20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255,255,255), 1)
        out.write(frame)
        frame_count += 1

    out.release()
    print("Saved: test_intersection.mp4  (36 seconds, 900 frames)")

if __name__ == "__main__":
    main()