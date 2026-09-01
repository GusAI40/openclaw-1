export interface Business {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  phone: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  category: string;
  rating: number | null;
  reviewCount: number | null;
  lat: number;
  lng: number;
  discoveredAt: string;
}

export interface AuditResult {
  businessId: string;
  slug: string;
  businessName: string;
  website: string;
  auditedAt: string;

  // Overall scores (0-100)
  overallScore: number;
  technicalScore: number;
  performanceScore: number | null;
  contentScore: number;
  localSeoScore: number;
  aeoScore: number;
  geoScore: number;

  // Performance (PageSpeed)
  performance: {
    mobile: LighthouseScores;
    desktop: LighthouseScores;
  };

  // Technical SEO
  technical: {
    hasSSL: boolean;
    hasSitemap: boolean;
    hasRobotsTxt: boolean;
    statusCode: number;
    redirectChains: number;
    brokenLinks: string[];
    missingMetaTitles: string[];
    missingMetaDescriptions: string[];
    missingH1s: string[];
    missingAltText: number;
    duplicateTitles: string[];
    pageCount: number;
  };

  // Content
  content: {
    avgWordCount: number;
    thinPages: string[];
    readabilityScore: number;
    hasStructuredData: boolean;
    schemaTypes: string[];
  };

  // Local SEO
  localSeo: {
    hasLocalBusinessSchema: boolean;
    napConsistent: boolean | null;
    hasGoogleBusinessProfile: boolean | null;
  };

  // AEO (Answer Engine Optimization)
  aeo: {
    hasFaqSchema: boolean;
    hasHowToSchema: boolean;
    hasQaContent: boolean;
    hasSpeakableSchema: boolean;
    hasConciseAnswers: boolean;
    schemaTypesCount: number;
    hasProductServiceSchema: boolean;
    hasBreadcrumbSchema: boolean;
  };

  // GEO (Generative Engine Optimization)
  geo: {
    allowsGPTBot: boolean;
    allowsClaudeBot: boolean;
    allowsPerplexityBot: boolean;
    allowsGoogleExtended: boolean;
    hasLlmsTxt: boolean;
    isPlainTextAccessible: boolean;
    factualDensity: number;
    authoritativeTone: boolean;
    entityRichContent: boolean;
    citesExternalSources: boolean;
  };

  // Top issues sorted by priority
  issues: AuditIssue[];

  // Raw page data
  pages: PageAudit[];
}

export interface LighthouseScores {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcp: number;
  inp: number;
  cls: number;
}

export interface AuditIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  affectedPages?: string[];
}

export interface PageAudit {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  hasStructuredData: boolean;
  schemaTypes: string[];
  imagesWithoutAlt: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: string[];
}

export interface OutreachEmail {
  businessId: string;
  to: string;
  subject: string;
  html: string;
  reportUrl: string;
  sentAt: string;
}

/**
 * Pipeline status vocabulary.
 *
 * Stable terminals: emailed, opened, replied, converted, unsubbed, bounced, exhausted.
 * Transient: discovered, auditing, audited, report_generated, snoozed.
 * Manual: released (claim freed for re-discover).
 *
 * Migration 001 deliberately omits a CHECK constraint so this list
 * can evolve without DB changes.
 */
export type PipelineStatus =
  | 'discovered'
  | 'auditing'
  | 'audited'
  | 'report_generated'
  | 'emailed'
  | 'opened'
  | 'replied'
  | 'converted'
  | 'snoozed'
  | 'unsubbed'
  | 'bounced'
  | 'exhausted'
  | 'released';
