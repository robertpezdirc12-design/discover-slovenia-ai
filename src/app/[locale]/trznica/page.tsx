import { TrznicaExplorer } from "@/components/trznica-explorer";

/**
 * /trznica — tržnica lokalnih izdelkov in doživetij. Vsebuje:
 *  - LASTNA TRŽNICA (48-c): živi izdelki iz baze (GET /api/products) z
 *    lastnim B2C checkoutom (Stripe / demo plačila) in pasico ob
 *    vrnitvi s plačila (?placilo=uspeh|preklic);
 *  - zavihke izdelkov/izkušenj/ponudnikov (supply registry).
 * Vso interakcijo nosi odjemalski del.
 */
export default function TrznicaPage() {
  return <TrznicaExplorer />;
}
