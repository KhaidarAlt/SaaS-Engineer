# SmartCatalog Design Guidelines

## Design Approach

**Selected Framework**: Apple HIG-inspired minimalist SaaS design
**Justification**: The requirement for "clean Apple-like design: minimal, modern typography, lots of whitespace, smooth animations" directly aligns with Apple's Human Interface Guidelines. This creates a professional, trustworthy SaaS experience suitable for business owners while maintaining the elegance needed for public-facing storefronts.

**Core Principles**:
- Минимализм превыше всего (Minimalism above all)
- Content-first hierarchy
- Generous whitespace for breathing room
- Smooth, purposeful animations
- Crystal-clear Russian typography

---

## Typography System

### Font Families
- **Primary**: Inter (Google Fonts) - for UI, forms, data tables, admin panels
- **Display**: SF Pro Display fallback to system fonts - for headings, hero sections, product names in catalog

### Type Scale
```
Hero/H1: text-5xl md:text-6xl (60px desktop) font-bold
H2: text-3xl md:text-4xl (36px desktop) font-semibold
H3: text-2xl md:text-3xl (30px desktop) font-semibold
H4: text-xl md:text-2xl (24px desktop) font-medium
Body Large: text-lg (18px) font-normal
Body: text-base (16px) font-normal
Small: text-sm (14px) font-normal
Tiny: text-xs (12px) font-medium
```

### Cyrillic Considerations
- All placeholder text, labels, validation messages in Russian
- Line-height: 1.6 for body text (Cyrillic needs more breathing room)
- Letter-spacing: -0.02em for headings, normal for body

---

## Layout System

### Spacing Primitives
**Core Units**: Use Tailwind spacing of **2, 4, 6, 8, 12, 16, 20, 24** for consistency

- Component padding: p-4 to p-8
- Section spacing: py-12 to py-24
- Card gaps: gap-6 to gap-8
- Form field spacing: space-y-4
- Button padding: px-6 py-3 (large), px-4 py-2 (default)

### Grid System
- Container: max-w-7xl mx-auto px-4 md:px-6 lg:px-8
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Product catalog: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4
- Forms: max-w-2xl single column for clarity

---

## Component Library

### Navigation
**Tenant Admin Sidebar**:
- Fixed left sidebar, w-64, minimal icons + Russian labels
- Sections: Каталог, Заказы, Аналитика, AI, Настройки, Биллинг
- Active state: subtle background fill, font-semibold
- Collapsed mobile: hamburger overlay

**Superadmin Top Bar**:
- Sticky top navigation with tenant switcher dropdown
- User menu right-aligned with role badge

**Public Catalog Header**:
- Clean horizontal nav with logo left, categories center, cart icon right
- Sticky on scroll with subtle shadow
- Search bar: expandable on mobile, always visible desktop

### Cards
**Product Cards** (catalog):
- Aspect ratio 1:1 for product image
- Image with hover scale (scale-105 transition)
- Price display: original price strikethrough if discounted, new price prominent
- Badge positioning: absolute top-right ("Акция", "Скидка -20%", "Нет в наличии")
- Rounded corners: rounded-xl
- Shadow: shadow-sm hover:shadow-lg transition

**Dashboard Stat Cards**:
- Minimal card with large number, small label below
- Icon left-aligned, subtle
- Trend indicator (↑↓) with percentage
- Padding: p-6

**Order Cards**:
- Header: order number + status badge
- List items with small product thumbnails
- Total emphasized at bottom
- WhatsApp send status indicator

### Forms
**Input Fields**:
- Consistent height: h-12
- Border: border rounded-lg
- Focus state: ring-2 offset-0
- Labels: text-sm font-medium mb-2
- Russian placeholders: "Введите название", "Выберите категорию"
- Validation errors: text-sm text-red-600 mt-1

**Buttons**:
- Primary: px-6 py-3 rounded-lg font-medium
- Secondary: outlined variant
- Ghost: text-only with hover background
- Icon buttons: square aspect ratio, p-2

### Data Tables
- Sticky header
- Row hover: subtle background change
- Alternating row backgrounds optional for dense data
- Action column: right-aligned with icon buttons
- Mobile: stack to cards below md breakpoint
- Pagination: centered below table

### Modals & Overlays
- Backdrop: backdrop-blur-sm
- Modal: max-w-2xl rounded-2xl shadow-2xl
- Header with close button (×)
- Footer actions right-aligned
- Animation: scale + fade in (Framer Motion)

### Badges & Pills
- Rounded-full px-3 py-1 text-xs font-medium
- Status variants: neutral, success, warning, danger, info
- Russian labels: "Активен", "Приостановлен", "Истёк"

### Empty States
- Centered illustration placeholder (icon or simple graphic)
- Headline: text-xl font-semibold
- Description: text-gray-600
- Primary action button below
- Russian messaging: "Пока нет товаров. Добавьте первый продукт."

---

## Animation Strategy

**Principle**: Minimal, purposeful, fast (200-300ms)

**Apply animations to**:
- Page transitions: fade in, slide up slightly (Framer Motion)
- Modal entrance: scale from 0.95 to 1
- Product card hover: scale image, lift shadow
- Button hover: subtle background shift
- Loading states: skeleton screens with shimmer
- Success feedback: checkmark fade-in + scale

**Avoid**: Excessive scroll-triggered animations, parallax, bouncing elements

---

## Images

### Public Catalog
- **Hero Section**: Large hero banner showcasing sample catalog products or abstract product photography. Use placeholder with overlay gradient for text readability. Recommended: 1920×800px, showcasing products in lifestyle context.
- **Product Images**: Square format (1:1), minimum 600×600px. Show on white/neutral background for consistency.
- **Promotion Banners**: Wide format 16:9, promotional imagery with text overlay capabilities.
- **Category Headers**: Optional category-specific imagery, subtle and minimal.

### Admin Panel
- **Onboarding Wizard**: Simple illustrations for each step (store setup, catalog upload, WhatsApp connect). Clean line art style, small file size.
- **Empty States**: Icon-based illustrations, not photographs. Minimal, friendly.
- **Dashboard**: Charts and graphs only, no decorative imagery.

### Icon System
**Source**: Heroicons (outline for navigation, solid for actions)
**Usage**:
- Navigation: 24×24px outline
- Buttons: 20×20px solid
- Status indicators: 16×16px solid
- Consistent Russian tooltips on hover

---

## Page-Specific Layouts

### Public Catalog Home
- Hero: full-width banner with search + CTA "Перейти к каталогу"
- Promotions slider: horizontal scroll cards
- Featured products: 3-4 column grid
- Categories: icon + text grid navigation
- Footer: minimal with links to "О нас", "Контакты"

### Product Detail Page
- Large image gallery left (60%), details right (40%)
- Breadcrumb navigation
- Title, SKU, price prominent
- Stock status with icon
- Description in tabs: "Описание", "Характеристики"
- Related products carousel below

### Tenant Dashboard
- Stat cards row: 4 columns (Товары, Заказы, Посетители, Выручка)
- Chart section: Revenue over time (line chart)
- Recent orders table: compact, top 5
- Quick actions: "+ Товар", "+ Акция", "Импорт каталога"

### Smart Import Flow
- Three-step wizard with progress indicator
- File upload: drag-drop zone, large, centered
- Preview table: sticky header, 20 rows max visible
- Validation summary: grouped errors/warnings with Russian messages
- Column mapping: side-by-side source → destination

### Checkout Flow
- Single-page stepped layout (Cart → Delivery → Confirm)
- Order summary sticky on right (desktop)
- Progress breadcrumb top
- WhatsApp icon + text: "Заказ придёт в WhatsApp"

### Superadmin Panel
- Wide data tables with filters
- Tenant cards in grid view
- Action dropdowns for bulk operations
- Russian column headers: "Название", "План", "Дата регистрации", "Статус"

---

**Accessibility**: Maintain WCAG AA standards, proper focus indicators, keyboard navigation, Russian screen reader text.