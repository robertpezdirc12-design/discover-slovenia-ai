import { notFound } from "next/navigation";

/**
 * UJEMALNI SEGMENT — vse neujemanje poti znotraj locale veje
 * (npr. /en/nek-druzic ali /skrita-pot) izrecno sproži 404, ki ga
 * izriše [locale]/not-found.tsx (nikoli neveljaven locale 404).
 */
export default function CatchAllPage() {
  notFound();
}
