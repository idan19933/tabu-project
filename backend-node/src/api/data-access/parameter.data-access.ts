/**
 * @module parameter.data-access
 * Prisma data-access layer for all simulation parameter models.
 *
 * Covers: PlanningParameter, CostParameter, RevenueParameter, EconomicParameter,
 * ApartmentMix, and SimulationResult. All upsert functions use the `simulationId`
 * as the unique key, so each simulation has at most one row per parameter table.
 */
import { prisma } from '../../config/prisma';

// --- Planning Parameters ---

/**
 * Insert or update the planning parameters for a simulation.
 *
 * @param simulationId - The UUID of the owning simulation.
 * @param data - camelCase planning parameter fields to persist (e.g. `returnsPercent`, `numberOfFloors`).
 * @returns A promise resolving to the upserted PlanningParameter record.
 */
export function upsertPlanning(simulationId: string, data: any) {
  return prisma.planningParameter.upsert({
    where: { simulationId },
    create: { simulationId, ...data },
    update: data,
  });
}

// --- Cost Parameters ---

/**
 * Insert or update the cost parameters for a simulation.
 *
 * @param simulationId - The UUID of the owning simulation.
 * @param data - camelCase cost parameter fields to persist (e.g. `costPerSqmResidential`, `financingInterestRate`).
 * @returns A promise resolving to the upserted CostParameter record.
 */
export function upsertCost(simulationId: string, data: any) {
  return prisma.costParameter.upsert({
    where: { simulationId },
    create: { simulationId, ...data },
    update: data,
  });
}

// --- Revenue Parameters ---

/**
 * Insert or update the revenue parameters for a simulation.
 *
 * @param simulationId - The UUID of the owning simulation.
 * @param data - camelCase revenue parameter fields to persist (e.g. `pricePerSqmResidential`, `salesPacePerMonth`).
 * @returns A promise resolving to the upserted RevenueParameter record.
 */
export function upsertRevenue(simulationId: string, data: any) {
  return prisma.revenueParameter.upsert({
    where: { simulationId },
    create: { simulationId, ...data },
    update: data,
  });
}

// --- Economic Parameters (Legacy) ---

/**
 * Insert or update the legacy economic parameters for a simulation.
 *
 * These are the original Python-backend era parameters. New simulations prefer
 * the dedicated cost/revenue parameter tables instead.
 *
 * @param simulationId - The UUID of the owning simulation.
 * @param data - camelCase economic parameter fields to persist (e.g. `costConstructionDev`, `timelineMonths`).
 * @returns A promise resolving to the upserted EconomicParameter record.
 */
export function upsertEconomic(simulationId: string, data: any) {
  return prisma.economicParameter.upsert({
    where: { simulationId },
    create: { simulationId, ...data },
    update: data,
  });
}

// --- Apartment Mix ---

/**
 * Atomically replace all apartment mix entries for a simulation.
 *
 * Deletes all existing rows for the simulation and re-creates them from the
 * provided array in a single transaction sequence.
 *
 * @param simulationId - The UUID of the owning simulation.
 * @param items - The full apartment mix to persist. Each entry specifies type, quantity, and percentage.
 * @returns A promise resolving to the newly created ApartmentMix records.
 */
export async function replaceApartmentMix(
  simulationId: string,
  items: Array<{ apartmentType: string; quantity: number; percentageOfMix: number }>
) {
  await prisma.apartmentMix.deleteMany({ where: { simulationId } });
  if (items.length > 0) {
    await prisma.apartmentMix.createMany({
      data: items.map((item) => ({ simulationId, ...item })),
    });
  }
  return prisma.apartmentMix.findMany({ where: { simulationId } });
}

// --- Simulation Results ---

/**
 * Insert or update the calculation results for a simulation.
 *
 * @param simulationId - The UUID of the owning simulation.
 * @param data - The full results object produced by the calculation engine.
 * @returns A promise resolving to the upserted SimulationResult record.
 */
export function upsertResults(simulationId: string, data: any) {
  return prisma.simulationResult.upsert({
    where: { simulationId },
    create: { simulationId, ...data },
    update: data,
  });
}

/**
 * Fetch the current calculation results for a simulation, if they exist.
 *
 * @param simulationId - The UUID of the owning simulation.
 * @returns A promise resolving to the SimulationResult record, or `null` if none exist yet.
 */
export function findResults(simulationId: string) {
  return prisma.simulationResult.findUnique({
    where: { simulationId },
  });
}
