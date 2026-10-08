# P1-B E2E dokazi — pogovorno urejanje + razlogi + booking inteligenca (2.16.0, issue #3 §3/§5/§6/§7)

- API /api/plan-edit: „dodaj Piran na dan 2" → ok:true, summary „Dodan postanek Piran (dan 2).", diff „dodano: Piran."; neznan „Narnija" → 400 iskrena napaka z registrom (38)
- UI: plošča „Uredi načrt z ukazi" se izriše na /nacrtuj (01-nacrtuj-plosca.png, 0 napak konzole)
- Vrata: 1076/1076 (+34), tsc 0, lint 0
- Zasebnost: skupinski klepet brez osebnega spomina (source-contract + arhitektura)
