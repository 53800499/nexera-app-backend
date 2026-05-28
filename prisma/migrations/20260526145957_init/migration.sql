-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('company', 'individual');

-- CreateEnum
CREATE TYPE "CatalogItemType" AS ENUM ('product', 'service', 'package');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('standard', 'proforma', 'deposit', 'balance', 'credit_note');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'issued', 'sent', 'partial', 'paid', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'converted');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('wire', 'check', 'cash', 'card', 'other');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('auto', 'manual');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('email', 'sms', 'print');
