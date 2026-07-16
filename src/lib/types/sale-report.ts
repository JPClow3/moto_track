/**
 * The public projection of a sale dossier. Everything in this type is served to
 * anyone holding the share link, so no field here may carry the owner's
 * identity or seller-private data (purchase price, plate, private notes).
 */
export type PublicSaleReport = {
  motorcycle: {
    name: string;
    brand: string;
    model: string;
    year: number;
    odometerKm: number;
    previousOwners: number | null;
    ridingProfile: string | null;
  };
  totals: {
    fuel: number;
    maintenance: number;
    tires: number;
    fees: number;
    all: number;
  };
  serviceCount: number;
  timeline: Array<{
    date: string;
    type: string | null;
    odometerKm: number | null;
    description: string | null;
    costCents: number;
  }>;
  expiresAt: string;
};
