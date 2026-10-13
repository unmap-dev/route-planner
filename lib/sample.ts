import { parsePlan, type Plan } from "@/lib/plan";
import raw from "@/data/route.sample.json";

/**
 * The bundled sample day: Chinook Parcel Co., a fictional courier, with one van and eight
 * fictional customers at approximate Calgary addresses. Replace data/route.sample.json with your
 * own plan in the same shape.
 */
export const SAMPLE_PLAN: Plan = parsePlan(raw);
