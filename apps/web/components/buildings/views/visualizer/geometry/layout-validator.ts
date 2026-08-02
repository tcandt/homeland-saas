import type { FloorLayoutSpec, Point2D, SpaceSpec, WallSegment, DoorOpening, ApartmentUnitSpec } from "./floor-layout.types";

export interface ValidationIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  details?: any;
}

export interface ValidationReport {
  isValid: boolean;
  issues: ValidationIssue[];
}

// Helper to compute distance between two points
function getDistance(p1: Point2D, p2: Point2D): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Helper to check if a point is inside a polygon (ray-casting algorithm)
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Helper to get bounding box of a polygon
function getPolygonBoundingBox(poly: Point2D[]) {
  const xs = poly.map(p => p.x);
  const ys = poly.map(p => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

// Simple rectangular/orthogonal overlap check
export function polygonsOverlap(poly1: Point2D[], poly2: Point2D[]): boolean {
  // 1. Quick bounding box intersection
  const box1 = getPolygonBoundingBox(poly1);
  const box2 = getPolygonBoundingBox(poly2);

  const noOverlap = box1.maxX <= box2.minX + 0.01 ||
                    box2.maxX <= box1.minX + 0.01 ||
                    box1.maxY <= box2.minY + 0.01 ||
                    box2.maxY <= box1.minY + 0.01;

  if (noOverlap) return false;

  // 2. Point inclusion check for vertices
  // Check if any vertex of poly1 is strictly inside poly2
  for (const p of poly1) {
    if (isPointInPolygon(p, poly2)) {
      // Ensure it is not just on the boundary
      if (isPointStrictlyInside(p, poly2)) return true;
    }
  }
  // Check if any vertex of poly2 is strictly inside poly1
  for (const p of poly2) {
    if (isPointInPolygon(p, poly1)) {
      if (isPointStrictlyInside(p, poly1)) return true;
    }
  }

  // 3. Line intersection check
  for (let i = 0; i < poly1.length; i++) {
    const p1 = poly1[i];
    const p2 = poly1[(i + 1) % poly1.length];
    for (let j = 0; j < poly2.length; j++) {
      const q1 = poly2[j];
      const q2 = poly2[(j + 1) % poly2.length];
      if (segmentsIntersect(p1, p2, q1, q2)) {
        return true;
      }
    }
  }

  return false;
}

function isPointStrictlyInside(p: Point2D, poly: Point2D[]): boolean {
  // Simple check: point is inside, and distance to all segments is > epsilon (e.g. 0.01m)
  if (!isPointInPolygon(p, poly)) return false;
  
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (pointToSegmentDistance(p, a, b) < 0.01) {
      return false; // it is on the boundary
    }
  }
  return true;
}

function pointToSegmentDistance(p: Point2D, a: Point2D, b: Point2D): number {
  const l2 = Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2);
  if (l2 === 0) return getDistance(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return getDistance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

function segmentsIntersect(p1: Point2D, p2: Point2D, q1: Point2D, q2: Point2D): boolean {
  const ccw = (A: Point2D, B: Point2D, C: Point2D) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  
  // Colinear segments checking is omitted for simplicity as we require strict intersection
  // Check if they cross
  const crossing = ccw(p1, q1, q2) !== ccw(p2, q1, q2) && ccw(p1, p2, q1) !== ccw(p1, p2, q2);
  if (!crossing) return false;

  // Verify they don't just touch at endpoints
  const shareEndpoint = (p1.x === q1.x && p1.y === q1.y) ||
                        (p1.x === q2.x && p1.y === q2.y) ||
                        (p2.x === q1.x && p2.y === q1.y) ||
                        (p2.x === q2.x && p2.y === q2.y);
  return !shareEndpoint;
}

export function validateFloorLayout(spec: FloorLayoutSpec): ValidationReport {
  const issues: ValidationIssue[] = [];

  // Rule 1: Outer footprint ratio is exactly 5m x 20m
  if (spec.width !== 5 || spec.length !== 20) {
    issues.push({
      type: "error",
      code: "INVALID_FOOTPRINT",
      message: `Tỷ lệ ngoài tòa nhà phải chính xác 5m x 20m. Hiện tại: ${spec.width}m x ${spec.length}m.`
    });
  }

  // Rule 2: Closed polygons
  spec.spaces.forEach(space => {
    if (space.boundary.length < 3) {
      issues.push({
        type: "error",
        code: "OPEN_POLYGON",
        message: `Khu vực ${space.id} phải có ít nhất 3 đỉnh để tạo thành polygon kín.`
      });
    }
  });

  // Rule 3: No overlapping spaces
  for (let i = 0; i < spec.spaces.length; i++) {
    for (let j = i + 1; j < spec.spaces.length; j++) {
      const s1 = spec.spaces[i];
      const s2 = spec.spaces[j];
      if (polygonsOverlap(s1.boundary, s2.boundary)) {
        issues.push({
          type: "error",
          code: "SPACE_OVERLAP",
          message: `Khu vực '${s1.id}' và '${s2.id}' bị chồng lấn không gian lên nhau.`,
          details: { space1: s1.id, space2: s2.id }
        });
      }
    }
  }

  // Rule 4: Unassigned areas checking (Check total coverage area matches 5x20 = 100m2)
  let totalSpaceArea = 0;
  // Shoelace formula to calculate polygon area
  const getPolygonArea = (poly: Point2D[]) => {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      area += poly[i].x * poly[j].y;
      area -= poly[j].x * poly[i].y;
    }
    return Math.abs(area / 2);
  };

  spec.spaces.forEach(s => {
    totalSpaceArea += getPolygonArea(s.boundary);
  });

  const expectedArea = spec.width * spec.length; // 100
  const unassignedArea = expectedArea - totalSpaceArea;
  if (Math.abs(unassignedArea) > 0.1) { // 0.1m2 tolerance
    issues.push({
      type: "warning",
      code: "UNASSIGNED_AREA",
      message: `Tổng diện tích các phân khu là ${totalSpaceArea.toFixed(2)}m², lệch so với diện tích sàn ${expectedArea}m² (Khoảng trống chưa phân vùng: ${unassignedArea.toFixed(2)}m²).`
    });
  }

  // Rule 5: Door placement validator
  spec.doors.forEach(door => {
    const wall = spec.walls.find(w => w.id === door.wallId);
    if (!wall) {
      issues.push({
        type: "error",
        code: "INVALID_DOOR_WALL",
        message: `Cửa '${door.id}' được gắn vào tường không tồn tại '${door.wallId}'.`
      });
      return;
    }

    // Check if door fits in the wall length
    const wallLength = getDistance(wall.start, wall.end);
    if (door.offset + door.width > wallLength + 0.01) {
      issues.push({
        type: "error",
        code: "DOOR_EXCEEDS_WALL",
        message: `Cửa '${door.id}' (rộng ${door.width}m, offset ${door.offset}m) vượt quá chiều dài của tường '${wall.id}' (dài ${wallLength.toFixed(2)}m).`
      });
    }

    // Rule 6: Door-to-space connections exist
    const [spaceId1, spaceId2] = door.connects;
    const s1Exists = spec.spaces.some(s => s.id === spaceId1);
    const s2Exists = spec.spaces.some(s => s.id === spaceId2);
    if (!s1Exists || !s2Exists) {
      issues.push({
        type: "error",
        code: "INVALID_DOOR_CONNECTION",
        message: `Cửa '${door.id}' kết nối tới không gian không tồn tại: '${spaceId1}' hoặc '${spaceId2}'.`
      });
    }
  });

  // Rule 7: Large Suite Validation
  const largeSuites = spec.units.filter(u => u.type === "large-suite");
  largeSuites.forEach(suite => {
    const childSpaces = spec.spaces.filter(s => suite.spaceIds.includes(s.id));
    
    // Check exactly 2 mini bedrooms
    const miniBedrooms = childSpaces.filter(s => s.type === "mini-bedroom");
    if (miniBedrooms.length !== 2) {
      issues.push({
        type: "error",
        code: "LARGE_SUITE_BEDROOM_COUNT",
        message: `Căn Suite lớn '${suite.roomCode}' phải có chính xác 2 phòng ngủ mini khép kín. Hiện có: ${miniBedrooms.length}.`
      });
    }

    // Check exactly 1 living room
    const livingRooms = childSpaces.filter(s => s.type === "living-room");
    if (livingRooms.length !== 1) {
      issues.push({
        type: "error",
        code: "LARGE_SUITE_LIVING_COUNT",
        message: `Căn Suite lớn '${suite.roomCode}' phải có chính xác 1 phòng khách chung. Hiện có: ${livingRooms.length}.`
      });
    }

    // Check exactly 1 bathroom
    const bathrooms = childSpaces.filter(s => s.type === "bathroom");
    if (bathrooms.length !== 1) {
      issues.push({
        type: "error",
        code: "LARGE_SUITE_BATHROOM_COUNT",
        message: `Căn Suite lớn '${suite.roomCode}' phải có chính xác 1 phòng tắm/WC. Hiện có: ${bathrooms.length}.`
      });
    }

    // Check exactly 1 kitchen
    const kitchens = childSpaces.filter(s => s.type === "kitchen");
    if (kitchens.length !== 1) {
      issues.push({
        type: "error",
        code: "LARGE_SUITE_KITCHEN_COUNT",
        message: `Căn Suite lớn '${suite.roomCode}' phải có chính xác 1 bếp. Hiện có: ${kitchens.length}.`
      });
    }

    // Rule 8: Bed and door counts for mini bedrooms
    miniBedrooms.forEach(bedroom => {
      // exactly one bed
      const beds = bedroom.furniture.filter(f => f.type === "single-bed" || f.type === "double-bed");
      if (beds.length !== 1) {
        issues.push({
          type: "error",
          code: "MINI_BEDROOM_BED_COUNT",
          message: `Phòng ngủ mini '${bedroom.id}' thuộc '${suite.roomCode}' phải có chính xác 1 giường. Hiện có: ${beds.length}.`
        });
      }

      // at least one separate door
      const bedroomDoors = spec.doors.filter(d => d.connects.includes(bedroom.id));
      if (bedroomDoors.length === 0) {
        issues.push({
          type: "error",
          code: "MINI_BEDROOM_DOOR_MISSING",
          message: `Phòng ngủ mini '${bedroom.id}' thuộc '${suite.roomCode}' không có cửa ra vào.`
        });
      }
    });

    // Rule 9: Living room outside mini bedrooms (implicit in layout overlaps, but ensure geometry boundaries are distinct)
    miniBedrooms.forEach(bedroom => {
      livingRooms.forEach(lr => {
        if (polygonsOverlap(bedroom.boundary, lr.boundary)) {
          issues.push({
            type: "error",
            code: "LIVING_ROOM_OVERLAPS_BEDROOM",
            message: `Phòng khách chung '${lr.id}' không được đè lấp lên phòng ngủ mini '${bedroom.id}'.`
          });
        }
      });
    });
  });

  return {
    isValid: !issues.some(i => i.type === "error"),
    issues
  };
}
