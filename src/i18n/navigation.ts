import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-zavedajoči navigacijski pripomočki (next-intl).
 * Uporaba: <Link href="/destinacije">, useRouter().push("/nacrtuj") …
 * Poti vedno brez jezikovne predpone — plugin jo doda glede na aktivni locale.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
