import { prisma } from "@/lib/prisma";
import type { Contact } from "@prisma/client";

export async function findOrCreateByEmail(
  email: string,
  name?: string | null
): Promise<Contact> {
  const normalized = email.trim().toLowerCase();

  const existing = await prisma.contact.findUnique({ where: { email: normalized } });
  if (existing) {
    // Actualizar el nombre solo si no estaba definido
    if (!existing.name && name) {
      return prisma.contact.update({
        where: { id: existing.id },
        data: { name },
      });
    }
    return existing;
  }

  return prisma.contact.create({
    data: { email: normalized, name: name || null },
  });
}

export async function findOrCreateByPhone(phone: string, name?: string | null): Promise<Contact> {
  const normalized = normalizePhone(phone);

  const existing = await prisma.contact.findUnique({ where: { phone: normalized } });
  if (existing) {
    if (!existing.name && name) {
      return prisma.contact.update({
        where: { id: existing.id },
        data: { name },
      });
    }
    return existing;
  }

  return prisma.contact.create({
    data: { phone: normalized, name: name || null },
  });
}

function normalizePhone(phone: string): string {
  // Meta envía E.164 (ej. +5215512345678). Normalizamos a números + dígitos.
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  return `+${cleaned}`;
}