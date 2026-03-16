export interface SiteMetadata {
  title: string;
  description: string | null;
  domain: string;
  https: boolean;
  ssl_valid: boolean;
  favicon_present: boolean;
}

export interface ContentAnalysis {
  red_flags: string[];
  summary: string;
}

export interface OutboundLink {
  url: string;
  label: "safe" | "suspicious" | "phishing";
  reason?: string;
}

export interface OwnershipInfo {
  admin_visible: boolean;
  admin_name: string | null;
  cross_platform_match: string | null;
}

export interface PaymentSecurity {
  secure_gateway: boolean;
  https_checkout: boolean;
}

export interface FraudReport {
  site_metadata?: SiteMetadata;
  content_analysis?: ContentAnalysis;
  outbound_links?: OutboundLink[];
  ownership_info?: OwnershipInfo;
  payment_security?: PaymentSecurity;
  evidence?: string[];
  fraud_risk_score?: number;
  conclusion?: "legitimate" | "suspicious" | "likely_fraud";
  [k: string]: unknown;
}
