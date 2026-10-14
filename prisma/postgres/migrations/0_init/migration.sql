-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "region" TEXT,
    "type" TEXT,
    "country" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "description" TEXT,
    "image" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "region" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyBooking" (
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyBooking_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "interest" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'USER_STATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'USER',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "condition" TEXT NOT NULL DEFAULT '{}',
    "state" TEXT NOT NULL DEFAULT 'active',
    "lastObservation" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'watch',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelJourney" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "data" TEXT NOT NULL,
    "dateStart" TEXT,
    "dateEnd" TEXT,
    "renameVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripCollaborator" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripInvite" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripReservation" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "stopSlug" TEXT,
    "stopName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripPoll" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripPollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TripPollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripPollVote" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripMessage" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "isAiBot" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'experience',
    "stock" INTEGER NOT NULL,
    "saleCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ownerId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "visitorKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "stripeSessionId" TEXT,
    "totalCents" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payoutStatus" TEXT NOT NULL DEFAULT 'not_due',
    "payoutUpdatedAt" TIMESTAMP(3),
    "cancellationRequestedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "priceCentsSnapshot" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "destinationName" TEXT,
    "travelDates" TEXT,
    "partyDescription" TEXT,
    "budget" TEXT,
    "interests" TEXT,
    "answer" TEXT,
    "answerSource" TEXT NOT NULL DEFAULT 'fallback',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "destinationSlug" TEXT,
    "destinationName" TEXT,
    "affiliateActive" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT NOT NULL,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "bookingRef" TEXT NOT NULL,
    "bookedFor" TEXT,
    "amountEur" DOUBLE PRECISION NOT NULL,
    "commissionEur" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stayCompletedAt" TIMESTAMP(3),
    "payoutDueAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meta" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "languages" TEXT NOT NULL,
    "photos" TEXT,
    "contact" TEXT,
    "officialUrl" TEXT,
    "season" TEXT,
    "openingHours" TEXT,
    "priceFrom" DOUBLE PRECISION,
    "currency" TEXT,
    "availability" TEXT,
    "bookingMode" TEXT NOT NULL,
    "verification" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "sourceName" TEXT,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dedupKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderReport" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");

-- CreateIndex
CREATE INDEX "Destination_region_idx" ON "Destination"("region");

-- CreateIndex
CREATE INDEX "Destination_type_idx" ON "Destination"("type");

-- CreateIndex
CREATE INDEX "Listing_category_idx" ON "Listing"("category");

-- CreateIndex
CREATE INDEX "Listing_region_idx" ON "Listing"("region");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key_key" ON "UserPreference"("userId", "key");

-- CreateIndex
CREATE INDEX "MemoryItem_userId_active_updatedAt_idx" ON "MemoryItem"("userId", "active", "updatedAt");

-- CreateIndex
CREATE INDEX "WatchItem_state_kind_idx" ON "WatchItem"("state", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "WatchItem_userId_kind_targetKind_targetId_key" ON "WatchItem"("userId", "kind", "targetKind", "targetId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "TravelJourney_shareId_key" ON "TravelJourney"("shareId");

-- CreateIndex
CREATE INDEX "TravelJourney_ownerId_idx" ON "TravelJourney"("ownerId");

-- CreateIndex
CREATE INDEX "TripCollaborator_userId_idx" ON "TripCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TripCollaborator_journeyId_userId_key" ON "TripCollaborator"("journeyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TripInvite_token_key" ON "TripInvite"("token");

-- CreateIndex
CREATE INDEX "TripInvite_journeyId_idx" ON "TripInvite"("journeyId");

-- CreateIndex
CREATE INDEX "TripReservation_journeyId_idx" ON "TripReservation"("journeyId");

-- CreateIndex
CREATE INDEX "TripPoll_journeyId_idx" ON "TripPoll"("journeyId");

-- CreateIndex
CREATE INDEX "TripPollOption_pollId_idx" ON "TripPollOption"("pollId");

-- CreateIndex
CREATE INDEX "TripPollVote_journeyId_userId_idx" ON "TripPollVote"("journeyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TripPollVote_optionId_userId_key" ON "TripPollVote"("optionId", "userId");

-- CreateIndex
CREATE INDEX "TripMessage_journeyId_createdAt_idx" ON "TripMessage"("journeyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "Product"("active");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_ownerId_idx" ON "Product"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_payoutStatus_idx" ON "Order"("payoutStatus");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_accessToken_key" ON "Consultation"("accessToken");

-- CreateIndex
CREATE INDEX "Consultation_email_createdAt_idx" ON "Consultation"("email", "createdAt");

-- CreateIndex
CREATE INDEX "Consultation_status_idx" ON "Consultation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedStripeEvent_eventId_key" ON "ProcessedStripeEvent"("eventId");

-- CreateIndex
CREATE INDEX "AffiliateClick_providerId_createdAt_idx" ON "AffiliateClick"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateClick_createdAt_idx" ON "AffiliateClick"("createdAt");

-- CreateIndex
CREATE INDEX "AffiliateClick_sessionKey_idx" ON "AffiliateClick"("sessionKey");

-- CreateIndex
CREATE INDEX "CommissionEntry_status_idx" ON "CommissionEntry"("status");

-- CreateIndex
CREATE INDEX "CommissionEntry_payoutDueAt_idx" ON "CommissionEntry"("payoutDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_providerId_bookingRef_key" ON "CommissionEntry"("providerId", "bookingRef");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_dedupKey_key" ON "Provider"("dedupKey");

-- CreateIndex
CREATE INDEX "Provider_countryCode_category_idx" ON "Provider"("countryCode", "category");

-- CreateIndex
CREATE INDEX "Provider_status_idx" ON "Provider"("status");

-- CreateIndex
CREATE INDEX "Provider_countryCode_status_idx" ON "Provider"("countryCode", "status");

-- CreateIndex
CREATE INDEX "ProviderReport_providerId_status_idx" ON "ProviderReport"("providerId", "status");

-- CreateIndex
CREATE INDEX "ProviderReport_status_createdAt_idx" ON "ProviderReport"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchItem" ADD CONSTRAINT "WatchItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelJourney" ADD CONSTRAINT "TravelJourney_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripCollaborator" ADD CONSTRAINT "TripCollaborator_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "TravelJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripCollaborator" ADD CONSTRAINT "TripCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripInvite" ADD CONSTRAINT "TripInvite_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "TravelJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripReservation" ADD CONSTRAINT "TripReservation_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "TravelJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPoll" ADD CONSTRAINT "TripPoll_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "TravelJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPollOption" ADD CONSTRAINT "TripPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "TripPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPollVote" ADD CONSTRAINT "TripPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "TripPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPollVote" ADD CONSTRAINT "TripPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPollVote" ADD CONSTRAINT "TripPollVote_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "TravelJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMessage" ADD CONSTRAINT "TripMessage_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "TravelJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMessage" ADD CONSTRAINT "TripMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderReport" ADD CONSTRAINT "ProviderReport_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
