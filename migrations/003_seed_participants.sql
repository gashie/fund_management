-- ============================================================================
-- Migration: Seed Participants Table
-- Description: Populate participants table with GhIPSS member bank codes
-- ============================================================================

-- Clear existing data
TRUNCATE TABLE participants CASCADE;

-- Insert all GhIPSS participants
INSERT INTO participants (bank_code, bank_name, short_name, is_active, supports_nec, supports_ft) VALUES
('300302', 'STANDARD CHARTERED BANK', 'SCB', true, true, true),
('300303', 'ABSA BANK GHANA LIMITED', 'ABSA', true, true, true),
('300304', 'GCB BANK LIMITED', 'GCB', true, true, true),
('300305', 'NATIONAL INVESTMENT BANK', 'NIB', true, true, true),
('300306', 'ARB APEX BANK LIMITED', 'ARB', true, true, true),
('300307', 'AGRICULTURAL DEVELOPMENT BANK', 'ADB', true, true, true),
('300308', 'SOCIETE GENERALE GHANA', 'SGG', true, true, true),
('300309', 'UNIVERSAL MERCHANT BANK', 'UMB', true, true, true),
('300310', 'REPUBLIC BANK LIMITED', 'RBL', true, true, true),
('300311', 'ZENITH BANK GHANA LTD', 'ZENITH', true, true, true),
('300312', 'ECOBANK GHANA LTD', 'ECOBANK', true, true, true),
('300313', 'CAL BANK LIMITED', 'CAL', true, true, true),
('300315', 'DevBank', 'DEV', true, true, true),
('300316', 'FIRST ATLANTIC BANK', 'FAB', true, true, true),
('300317', 'PRUDENTIAL BANK LTD', 'PRUDENTIAL', true, true, true),
('300318', 'STANBIC BANK', 'STANBIC', true, true, true),
('300319', 'FIRST BANK OF NIGERIA', 'FBN', true, true, true),
('300320', 'BANK OF AFRICA', 'BOA', true, true, true),
('300322', 'GUARANTY TRUST BANK', 'GTB', true, true, true),
('300323', 'FIDELITY BANK LIMITED', 'FIDELITY', true, true, true),
('300324', 'SAHEL - SAHARA BANK (BSIC)', 'BSIC', true, true, true),
('300325', 'UNITED BANK OF AFRICA', 'UBA', true, true, true),
('300328', 'BANK OF GHANA', 'BOG', true, true, true),
('300329', 'ACCESS BANK LTD', 'ACCESS', true, true, true),
('300331', 'CONSOLIDATED BANK GHANA', 'CBG', true, true, true),
('300333', 'BAYPORT SAVINGS AND LOANS', 'BAYPORT', true, true, true),
('300334', 'FIRST NATIONAL BANK', 'FNB', true, true, true),
('300345', 'ADEHYEMAN SAVINGS AND LOANS', 'ADEHYEMAN', true, true, true),
('300349', 'OPPORTUNITY INTERNATIONAL SAVINGS AND LOANS', 'OPPORTUNITY', true, true, true),
('300361', 'SERVICES INTEGRITY SAVINGS & LOANS', 'SISL', true, true, true),
('300362', 'GHL Bank', 'GHL', true, true, true),
('300380', 'ETRANZACT', 'ETRANZACT', true, true, true),
('300463', 'APPSNMOBILE SOLUTIONS LIMITED', 'APPSNMOBILE', true, true, false),
('300466', 'HUBTEL', 'HUBTEL', true, true, false),
('300467', 'IT CONSORTIUM', 'ITC', true, true, false),
('300468', 'FAST PACE LIMITED', 'FASTPACE', true, true, false),
('300477', 'NSANO LIMITED', 'NSANO', true, true, false),
('300478', 'BSYSTEMS LIMITED', 'BSYSTEMS', true, true, false),
('300479', 'ZEEPAY GHANA LIMITED', 'ZEEPAY', true, true, true),
('300481', 'EXPRESSPAY', 'EXPRESSPAY', true, true, false),
('300485', 'PAYSWITCH', 'PAYSWITCH', true, true, false),
('300486', 'UNITY LINK', 'UNITYLINK', true, true, false),
('300487', 'SLYDEPAY', 'SLYDEPAY', true, true, false),
('300496', 'DALEX FINANCE AND LEASING COMPANY', 'DALEX', true, true, false),
('300574', 'G-MONEY', 'GMONEY', true, true, true),
('300591', 'MTN MOBILE MONEY', 'MTN MOMO', true, true, true),
('300592', 'AIRTELTIGO MONEY', 'AIRTELTIGO', true, true, true),
('300594', 'VODAFONE CASH', 'VODACASH', true, true, true),
('300300', 'GhIPSS PAYMENT GATEWAY', 'GhIPSS', true, true, false);

-- Verify
SELECT COUNT(*) as total_participants FROM participants;
SELECT 'Participants seeded successfully' as status;
