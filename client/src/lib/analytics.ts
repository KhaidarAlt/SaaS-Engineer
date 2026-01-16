const STORAGE_KEY_SESSION = 'sc_sid';
const STORAGE_KEY_VISITOR = 'sc_vid';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem(STORAGE_KEY_SESSION);
  if (!sessionId) {
    sessionId = generateId();
    sessionStorage.setItem(STORAGE_KEY_SESSION, sessionId);
  }
  return sessionId;
}

function getVisitorId(): string {
  let visitorId = localStorage.getItem(STORAGE_KEY_VISITOR);
  if (!visitorId) {
    visitorId = generateId();
    localStorage.setItem(STORAGE_KEY_VISITOR, visitorId);
  }
  return visitorId;
}

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    utmContent: params.get('utm_content') || undefined,
    utmTerm: params.get('utm_term') || undefined,
  };
}

export type EventType = 
  | 'catalog_view' 
  | 'product_view' 
  | 'add_to_cart' 
  | 'remove_from_cart'
  | 'cart_view' 
  | 'checkout_start' 
  | 'order_created' 
  | 'whatsapp_open_clicked'
  | 'copy_order_text_clicked' 
  | 'promo_view' 
  | 'search';

interface TrackEventOptions {
  tenantSlug: string;
  eventType: EventType;
  productId?: string;
  orderId?: string;
  objectType?: string;
  objectId?: string;
  metadata?: Record<string, unknown>;
}

export async function trackEvent(options: TrackEventOptions): Promise<void> {
  try {
    const sessionId = getSessionId();
    const visitorId = getVisitorId();
    const utmParams = getUtmParams();
    
    await fetch('/api/events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: options.tenantSlug,
        eventType: options.eventType,
        sessionId,
        visitorId,
        pagePath: window.location.pathname,
        referrer: document.referrer || undefined,
        ...utmParams,
        productId: options.productId,
        orderId: options.orderId,
        objectType: options.objectType,
        objectId: options.objectId,
        metadata: options.metadata,
      }),
    });
  } catch (error) {
    console.warn('Analytics event failed:', error);
  }
}

interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  qty: number;
  price: number;
}

interface UpdateCartSessionOptions {
  tenantSlug: string;
  cartJson: CartItem[];
  totalEstimated: number;
  checkoutPhone?: string;
  lastStep?: 'cart' | 'checkout';
}

export async function updateCartSession(options: UpdateCartSessionOptions): Promise<void> {
  try {
    const sessionId = getSessionId();
    const visitorId = getVisitorId();
    const utmParams = getUtmParams();
    
    await fetch('/api/cart-session/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: options.tenantSlug,
        sessionId,
        visitorId,
        cartJson: options.cartJson,
        totalEstimated: options.totalEstimated,
        checkoutPhone: options.checkoutPhone,
        lastStep: options.lastStep,
        utmSource: utmParams.utmSource,
        utmMedium: utmParams.utmMedium,
        utmCampaign: utmParams.utmCampaign,
      }),
    });
  } catch (error) {
    console.warn('Cart session update failed:', error);
  }
}

export async function convertCartSession(tenantSlug: string, orderId: string): Promise<void> {
  try {
    const sessionId = getSessionId();
    
    await fetch('/api/cart-session/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug,
        sessionId,
        orderId,
      }),
    });
  } catch (error) {
    console.warn('Cart conversion failed:', error);
  }
}

export { getSessionId, getVisitorId };
