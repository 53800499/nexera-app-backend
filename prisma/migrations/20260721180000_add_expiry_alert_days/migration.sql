-- Seuil alerte péremption configurable par article (§3.3)
ALTER TABLE "stock_items"
  ADD COLUMN "expiry_alert_days" INTEGER NOT NULL DEFAULT 30;
