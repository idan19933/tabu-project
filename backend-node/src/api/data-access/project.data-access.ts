import { prisma } from '../../config/prisma';

const projectWithRelations = {
  documents: {
    select: {
      id: true,
      documentType: true,
      extractionStatus: true,
      extractionError: true,
    },
  },
  simulations: {
    select: {
      id: true,
      versionName: true,
      status: true,
      createdAt: true,
    },
  },
};

export function findAll() {
  return prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export function findById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: projectWithRelations,
  });
}

export function create(name: string) {
  return prisma.project.create({
    data: { name },
  });
}

export function update(id: string, data: { name?: string; tabuData?: any; marketResearchData?: any; marketResearchStatus?: string }) {
  return prisma.project.update({
    where: { id },
    data,
  });
}

export function remove(id: string) {
  return prisma.project.delete({
    where: { id },
  });
}
