import { describe, it, expect } from "vitest";
import { getFilledIcon } from "./map-icons-filled";

describe("getFilledIcon", () => {
  it("resolves a known icon name to a non-null component", () => {
    const Icon = getFilledIcon("UtensilsCrossed");
    expect(Icon).toBeDefined();
    expect(typeof Icon).toBe("object");
  });

  it("falls back to MapPin for unknown names", () => {
    const Unknown = getFilledIcon("DoesNotExist");
    const MapPin = getFilledIcon("MapPin");
    expect(Unknown).toBe(MapPin);
  });

  it("returns the same component for aliased names (TramFront → Tram)", () => {
    expect(getFilledIcon("Tram")).toBe(getFilledIcon("TramFront"));
  });

  it.each([
    "Award", "Baby", "Bike", "Blocks", "BookOpen", "Building2",
    "Bus", "Car", "CarFront", "Coffee", "Croissant", "Dog",
    "Dumbbell", "Film", "GraduationCap", "Home", "Hospital",
    "Landmark", "Mail", "MapPin", "ParkingCircle", "Pill",
    "Plane", "Scissors", "ShoppingBag", "ShoppingCart", "Sparkles",
    "Star", "Stethoscope", "TrainFront", "TramFront", "TreePine",
    "Trophy", "UtensilsCrossed", "Waves", "Wine", "Zap",
  ])("maps %s to a Phosphor component", (name) => {
    expect(getFilledIcon(name)).toBeDefined();
  });
});
