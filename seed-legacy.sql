-- SEED legacy baze 1.163.4 (lokalni dokaz cutover pipeline-a — issue #2)
-- Reprezentativni podatki po RECONCILE matriki; upoštevani vsi NOT NULL.
BEGIN;

-- Uporabniki (3) — passwordHash je BCRYPT zapis (dokaz prijave po prenosu)
INSERT INTO "User" ("id","email","name","passwordHash","preferences","createdAt","updatedAt","emailVerified") VALUES
('usr_leg_1','ana@example.si','Ana Novak','$2b$10$ABMNm666LZTJ/RWswAxWI.sFzKTNOGCZ/PRuNodGpr4kuAlYzJ5y6','{"interests":["hiking","wine"],"budget":"mid"}','2026-05-10T08:00:00Z','2026-06-01T09:00:00Z','2026-05-11T08:00:00Z'),
('usr_leg_2','boris@example.hr',NULL,'$2b$10$ABMNm666LZTJ/RWswAxWI.sFzKTNOGCZ/PRuNodGpr4kuAlYzJ5y6',NULL,'2026-06-12T10:30:00Z','2026-06-12T10:30:00Z',NULL),
('usr_leg_3','cvetka@example.si','Cvetka K.','$2b$10$ABMNm666LZTJ/RWswAxWI.sFzKTNOGCZ/PRuNodGpr4kuAlYzJ5y6','{"interests":["food"]}','2026-07-03T14:00:00Z','2026-07-20T11:00:00Z','2026-07-04T14:00:00Z');

-- Poti (4): 2 veljavni, 1 anonimna (izpust — iskreno), 1 nerazčrljiva (izpust)
INSERT INTO "SavedItinerary" ("id","userId","itinerary","formData","name","shareId","editTokenHash","views","isPublic","contentVersion","createdAt","updatedAt") VALUES
('itn_leg_1','usr_leg_1','{"days":[{"day":1,"title":"Bled","locations":[{"name":"Blejsko jezero","destSlug":"bled","time":"09:00"},{"name":"Otoček","destSlug":"bled","time":"11:00"}]},{"day":2,"title":"Bohinj","locations":[{"name":"Vogel","destSlug":"bohinj","time":"08:30"}]}],"totalBudget":250}','{"days":2,"people":2}','Počitnice na Gorenjskem','shr_leg_1','abc123',12,true,1,'2026-06-01T10:00:00Z','2026-06-05T15:00:00Z'),
('itn_leg_2','usr_leg_3','{"days":[{"day":1,"title":"Ljubljana","locations":[{"name":"Ljubljanski grad","destSlug":"ljubljana","time":"10:00"}]}]}','{"days":1}','Mesto za vikend','shr_leg_2','def456',5,false,1,'2026-07-21T09:00:00Z','2026-07-21T09:00:00Z'),
('itn_leg_3',NULL,'{"days":[{"day":1,"locations":[{"name":"Piran","time":"10:00"}]}]}','{}','Anonimna pot','shr_leg_3','x',1,false,1,'2026-05-15T12:00:00Z','2026-05-15T12:00:00Z'),
('itn_leg_4','usr_leg_2','{"days":[]}','{}','Nerazčrljiva','shr_leg_4','y',0,false,1,'2026-06-13T08:00:00Z','2026-06-13T08:00:00Z');

-- Sodelujoči (3): ACTIVE, PENDING (izpust), COMMENTER→VIEWER
INSERT INTO "TripCollaborator" ("id","shareId","userId","inviteEmail","role","status","inviteToken","invitedBy","createdAt","acceptedAt","updatedAt") VALUES
('col_leg_1','shr_leg_1','usr_leg_2',NULL,'VIEWER','ACTIVE','tok-act-1','usr_leg_1','2026-06-02T10:00:00Z','2026-06-02T11:00:00Z','2026-06-02T11:00:00Z'),
('col_leg_2','shr_leg_1','usr_leg_3','cvetka@example.si','EDITOR','PENDING','tok123','usr_leg_1','2026-06-03T09:00:00Z',NULL,'2026-06-03T09:00:00Z'),
('col_leg_3','shr_leg_2','usr_leg_1',NULL,'COMMENTER','ACTIVE','tok-act-2','usr_leg_3','2026-07-22T10:00:00Z','2026-07-22T12:00:00Z','2026-07-22T12:00:00Z');

-- Komentarji (2): človek + AI (text NOT NULL v legacy — AI je imel besedilo)
INSERT INTO "TripComment" ("id","shareId","authorName","text","isAI","payload","createdAt") VALUES
('cmt_leg_1','shr_leg_1','Boris','Kdaj odhajamo na Vogel?',false,NULL,'2026-06-02T12:00:00Z'),
('cmt_leg_2','shr_leg_1','AI svetovalek','Predlagam obisk soteske Vintgar.',true,'[{"name":"Vintgar"}]','2026-06-02T12:05:00Z');

-- Ankete (2) + glasovi (2 — iskreno NE preneseni)
INSERT INTO "TripPoll" ("id","shareId","question","options","authorName","authorClientId","closed","createdAt") VALUES
('poll_leg_1','shr_leg_1','Kateri dan za izlet?','["sobota","nedelja"]','Ana','client-ana',false,'2026-06-04T10:00:00Z'),
('poll_leg_2','shr_leg_2','Večerja?','["riba","pizza"]','Cvetka','client-cv',true,'2026-07-23T18:00:00Z');
INSERT INTO "TripPollVote" ("id","pollId","voterId","optionIdx","createdAt") VALUES
('vot_leg_1','poll_leg_1','voter-b',0,'2026-06-04T11:00:00Z'),
('vot_leg_2','poll_leg_1','voter-c',1,'2026-06-04T12:00:00Z');

-- Lokali (2) — description/images NOT NULL
INSERT INTO "Listing" ("id","name","slug","description","category","destinationName","address","images","lat","lng","status","createdAt","updatedAt") VALUES
('lst_leg_1','Gostilna Pri Lipi','gostilna-pri-lipi','Domača slovenska kuhinja.','food','Ljubljana','Trg 1','[]',46.0569,14.5058,'published','2026-04-01T10:00:00Z','2026-04-01T10:00:00Z'),
('lst_leg_2','Vinotoč Marof','vinotoc-marof','Vina štajerske regije.','wine','Maribor','Ulica 5','[]',46.5547,15.6459,'published','2026-04-15T10:00:00Z','2026-04-15T10:00:00Z');

-- Izdelki (2): published + draft — sellerName/images/description NOT NULL
INSERT INTO "Product" ("id","name","slug","description","category","destinationName","price","currency","stock","images","sellerName","status","createdAt","updatedAt") VALUES
('prd_leg_1','Terenčkova medica','terencnova-medica','Medica z Pohorja.','food','Maribor',12.50,'EUR',10,'[]','Terenčkov kmetijski obrt','published','2026-03-01T10:00:00Z','2026-03-01T10:00:00Z'),
('prd_leg_2','Piranska sol (osnutek)','piranska-sol','Sol iz Sečoveljskih solin.','food','Piran',6.90,'EUR',50,'[]','Soline Piran','draft','2026-05-20T10:00:00Z','2026-05-20T10:00:00Z');

-- Naročila (2): paid (z items JSON) + pending — buyerName NOT NULL
INSERT INTO "Order" ("id","orderNumber","buyerEmail","buyerName","status","paymentMethod","subtotal","total","currency","items","createdAt","updatedAt","paidAt") VALUES
('ord_leg_1','ORD-1001','ana@example.si','Ana Novak','paid','stripe',12.50,12.50,'EUR','[{"productId":"prd_leg_1","name":"Terenčkova medica","qty":1,"price":12.50}]','2026-08-01T10:00:00Z','2026-08-01T10:05:00Z','2026-08-01T10:05:00Z'),
('ord_leg_2','ORD-1002','boris@example.hr','Boris H.','pending','cod',6.90,6.90,'EUR','[{"productId":"prd_leg_2","name":"Piranska sol","qty":1,"price":6.90}]','2026-08-10T14:00:00Z','2026-08-10T14:00:00Z',NULL);

-- Novice (2)
INSERT INTO "NewsletterSubscriber" ("id","email","source","createdAt") VALUES
('nws_leg_1','ana@example.si','footer','2026-05-11T10:00:00Z'),
('nws_leg_2','denis@example.com','modal','2026-07-01T10:00:00Z');

-- Konzultacije (2): odgovorjena (ai→manual) + nova
INSERT INTO "Consultation" ("id","accessToken","email","question","destinationName","travelDates","partyDescription","budget","interests","answer","answerSource","status","createdAt") VALUES
('kon_leg_1','tok_kon_1','ana@example.si','Kam na 3 dni z otroki?','Bled','2026-07-10/2026-07-12','2 odrasla + 2 otroka','mid','["nature"]','Odgovor svetovalca.','ai','delivered','2026-06-20T10:00:00Z'),
('kon_leg_2','tok_kon_2','boris@example.hr','Zanimive poti v Istri?','Piran','2026-09-01/2026-09-05','par','low','["food","sea"]',NULL,NULL,'pending','2026-08-15T10:00:00Z');

-- Lead-i (2): nov + kontaktiran — plan NOT NULL
INSERT INTO "Lead" ("id","name","email","phone","businessName","businessType","location","plan","message","gdprConsent","status","createdAt","updatedAt") VALUES
('lead_leg_1','Marko Kovač','marko@gostilna.si','+38640111222','Gostilna Kovač','food','Celje','free','Želimo biti na seznamu.',true,'nov','2026-06-01T10:00:00Z','2026-06-01T10:00:00Z'),
('lead_leg_2','Nina Zupan','nina@vinotoc.si',NULL,'Vinotoč Zupan','wine','Vipava','pro','Zanimata nas vodena okušanja.',true,'kontaktiran','2026-07-05T10:00:00Z','2026-07-10T10:00:00Z'),
('lead_leg_3','Peter Veliki','peter@example.si',NULL,'Kamp Veliki','stay','Soča','free','Zanimajo nas koče.',true,'zakljucen','2026-05-01T10:00:00Z','2026-05-15T10:00:00Z');

-- Stripe dogodki (2)
INSERT INTO "ProcessedStripeEvent" ("id","eventType","createdAt") VALUES
('evt_leg_1','checkout.session.completed','2026-08-01T10:05:00Z'),
('evt_leg_2','payment_intent.succeeded','2026-08-01T10:05:01Z');

-- Revizijska sled (3)
INSERT INTO "AuditLog" ("id","actorId","actorEmail","actorRole","action","resourceType","resourceId","resourceName","metadata","createdAt") VALUES
('aud_leg_1',NULL,'ana@example.si','admin','listing.approve','listing','lst_leg_1','Gostilna Pri Lipi','{}','2026-04-02T10:00:00Z'),
('aud_leg_2','usr_leg_1',NULL,'owner','order.paid','order','ord_leg_1','ORD-1001','{"total":12.50}','2026-08-01T10:05:00Z'),
('aud_leg_3',NULL,'system@stripe.com','stripe','payment.succeeded','order','ord_leg_1','ORD-1001','{}','2026-08-01T10:05:01Z');

COMMIT;
