import { prisma } from '../../config/prisma';

// --- Planning Parameters ---
export function upsertPlanning(simulationId: string, data: any) {
  return prisma.planningParameter.upsert({
    where: { simulationId },
    create: { simulationId, ...data },
    update: data,
  });
}

// --- Cost Parameters ---
export function upsertCost(simulationId: string, data: any) {
  return prisma.costParameter.upsert({
    where: { simulationId },
    create: { simulationId, ...data },
    update: data,
  });
}

// --- Revenue Parameters ---
export function upsertRevenue(simulationId: string, data: any) {
  return prisma.revenueParameter.upsert({
    where: { simulationId },
    create: { simulationId, ...data },
    update: data,
  });
}

// --- Economic Parameters (Legacy) ---
export function upsertEconomic(simulationId: string, data: any) {
  return prisma.economicParameter.upsert({
    where: { simulationId },
    create: { simulationId, ...data },
    update: data,
  });
}

// --- Apartment Mix ---
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
export function upsertResults(simulationId: string, data: any) {
  return prisma.simulationResult.upsert({
    where: { simulationId },
    create: { simulationId, ...data },
    update: data,
  });
}

export function findResults(simulationId: string) {
  return prisma.simulationResult.findUnique({
    where: { simulationId },
  });
}
