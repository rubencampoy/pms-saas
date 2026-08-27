# DESIGN_GUIDE.md — Design System Reference

> **Source:** Extracted from Google Stitch HTML prototypes  
> **Last Updated:** 2026-02-12  
> **Status:** REFERENCE — All UI must match these patterns

---

## 1. Brand & Identity

- **App Name:** Chamelio PMS (use this consistently)
- **Logo:** Letter "H" in white on primary-colored rounded square (`rounded-lg`, 32×32px)
- **Font Family:** `Manrope` (Google Fonts) — all weights 300–700
- **Antialiasing:** `antialiased` on body, `selection:bg-primary/20 selection:text-primary`

---

## 2. Color Palette

### Core Colors
| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| **Primary** | `#137fec` | `primary` | CTAs, active nav, links, focus rings |
| **Background Light** | `#f6f7f8` | `background-light` | Main content area bg |
| **Background Dark** | `#101922` | `background-dark` | Dark mode content bg |
| **Sidebar** | `#0a1118` / `slate-900` | — | Sidebar background |
| **Card Dark** | `#1a2632` | — | Dark mode card bg |

### Status Colors
| Status | Background | Text | Border | Dot |
|--------|-----------|------|--------|-----|
| **Checked In** | `bg-green-100` / `dark:bg-green-900/30` | `text-green-800` / `dark:text-green-300` | `border-green-200` / `dark:border-green-800` | `bg-green-500` |
| **Confirmed** | `bg-blue-100` / `dark:bg-blue-900/30` | `text-blue-800` / `dark:text-blue-300` | `border-blue-200` / `dark:border-blue-800` | `bg-blue-500` |
| **Pending** | `bg-amber-100` / `dark:bg-amber-900/30` | `text-amber-800` / `dark:text-amber-300` | `border-amber-200` / `dark:border-amber-800` | `bg-amber-500` |
| **Checked Out** | `bg-slate-100` / `dark:bg-slate-800` | `text-slate-800` / `dark:text-slate-300` | `border-slate-200` / `dark:border-slate-700` | `bg-slate-500` |
| **Cancelled** | `bg-red-100` / `dark:bg-red-900/30` | `text-red-800` / `dark:text-red-300` | `border-red-200` / `dark:border-red-800` | `bg-red-500` |
| **Maintenance** | `bg-slate-200` / `dark:bg-slate-600` | `text-slate-500` / `dark:text-slate-300` | `border-slate-300` / `dark:border-slate-500` | — |

### Housekeeping Status (small badges on room list)
| Status | Classes |
|--------|---------|
| **Clean** | `bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400` |
| **Dirty** | `bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400` |
| **Maintenance** | `bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400` |
| **Inspected** | `bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400` |

### KPI Icon Backgrounds
| Category | Light | Dark | Text |
|----------|-------|------|------|
| Blue | `bg-blue-50` | `dark:bg-blue-900/20` | `text-blue-600` / `dark:text-blue-400` |
| Green | `bg-green-50` | `dark:bg-green-900/20` | `text-green-600` / `dark:text-green-400` |
| Amber | `bg-amber-50` | `dark:bg-amber-900/20` | `text-amber-600` / `dark:text-amber-400` |
| Purple | `bg-purple-50` | `dark:bg-purple-900/20` | `text-purple-600` / `dark:text-purple-400` |

---

## 3. Layout Structure

### Global Shell
```
┌──────────────────────────────────────────────────┐
│ Sidebar (w-64) │ Header (h-16 or h-20)          │
│ dark bg         │──────────────────────────────── │
│ sticky, full h  │ Content (bg-background-light)  │
│                 │ p-8, max-w-[1600px], mx-auto   │
│                 │                                 │
│                 │ Optional: Right Panel (w-80)    │
└──────────────────────────────────────────────────┘
```

### Sidebar Pattern
- Width: `w-64` (256px)
- Background: `bg-[#0a1118]` or `bg-slate-900`
- Logo area: `h-16`, `px-6`, `border-b border-slate-800`
- Nav items: `px-3 py-2.5`, `rounded-lg`, `text-sm font-medium`
- Active item: `bg-primary/10 text-primary`
- Inactive items: `text-slate-400 hover:bg-slate-800 hover:text-white`
- Icons: Material Icons at `text-[20px]`, `text-slate-500 group-hover:text-white`
- Badge (notifications): `bg-amber-500/20 text-amber-500 py-0.5 px-2 rounded-full text-xs font-semibold`
- User section at bottom: `p-4 border-t border-slate-800`, avatar `w-9 h-9 rounded-full ring-2 ring-slate-700`

### Header Pattern
- Height: `h-16` (calendar) or `h-20` (content pages)
- Background: `bg-white dark:bg-[#1a2632]`
- Border: `border-b border-slate-200 dark:border-slate-700`
- Padding: `px-6` or `px-8`
- Title: `text-xl` or `text-2xl font-bold text-slate-900 dark:text-white`
- Subtitle: `text-sm text-slate-500 dark:text-slate-400`
- Sticky: `sticky top-0 z-30`

### Right Panel (optional, calendar page)
- Width: `w-80` (320px)
- Background: `bg-white dark:bg-slate-900`
- Border: `border-l border-slate-200 dark:border-slate-800`
- Shadow: `shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)]`
- Content padding: `p-6`

---

## 4. Component Patterns

### Buttons

**Primary:**
```html
<button class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30">
  <span class="material-icons text-lg">add</span>
  New Booking
</button>
```

**Secondary/Outline:**
```html
<button class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
  <span class="material-icons text-lg">download</span>
  Export
</button>
```

**Small/compact (check-in):**
```html
<button class="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90">Check In</button>
```

### Status Badges
```html
<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-{color}-100 text-{color}-800 dark:bg-{color}-900/30 dark:text-{color}-300 border border-{color}-200 dark:border-{color}-800">
  <span class="w-1.5 h-1.5 rounded-full bg-{color}-500 mr-1.5"></span>
  Status Text
</span>
```

### Small Badges (housekeeping on room list)
```html
<span class="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">Clean</span>
```

### Cards (KPI)
```html
<div class="bg-white dark:bg-[#1a2632] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
  <div class="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
    <span class="material-icons">icon_name</span>
  </div>
  <div>
    <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">Label</p>
    <p class="text-2xl font-bold text-slate-900 dark:text-white">Value</p>
  </div>
</div>
```

### Cards (Widget/Panel)
```html
<div class="bg-background-light dark:bg-slate-800 rounded-xl p-5 mb-6 shadow-sm border border-slate-100 dark:border-slate-700">
  <!-- content -->
</div>
```

### Featured Card (gradient)
```html
<div class="bg-gradient-to-br from-primary to-blue-600 rounded-xl p-5 text-white shadow-lg shadow-blue-500/20">
  <!-- white text content -->
</div>
```

### Data Table
```html
<!-- Container -->
<div class="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
  <!-- Filter toolbar: p-5, border-b, bg-slate-50/50 dark:bg-white/5 -->
  <!-- Table: w-full text-left border-collapse -->
  <!-- Thead: bg-slate-50 dark:bg-white/5, text-xs font-semibold text-slate-500 uppercase tracking-wider -->
  <!-- Tbody: divide-y divide-slate-100 dark:divide-slate-800 -->
  <!-- Row hover: hover:bg-slate-50 dark:hover:bg-slate-800/50 -->
  <!-- Pagination: p-4, border-t, bg-slate-50/50 -->
</div>
```

### Search Input
```html
<div class="relative">
  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
  <input class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400" placeholder="Search..." type="text" />
</div>
```

### Filter Button
```html
<button class="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-slate-400 transition-colors">
  <span class="material-icons text-slate-500 text-lg">filter_list</span>
  <span>Filter Label</span>
  <span class="material-icons text-slate-400 text-lg ml-1">expand_more</span>
</button>
```

### Guest Row (with avatar)
```html
<div class="flex items-center gap-3">
  <!-- Avatar: h-10 w-10 rounded-full OR initials circle -->
  <div class="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">MR</div>
  <div>
    <div class="font-semibold text-slate-900 dark:text-white">Guest Name</div>
    <div class="text-xs text-slate-500">ID: #BK-7822</div>
  </div>
</div>
```

### Arriving Soon List Item
```html
<div class="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
  <img class="w-10 h-10 rounded-full object-cover" src="..." />
  <div class="flex-1 min-w-0">
    <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">Name</p>
    <p class="text-xs text-slate-500 truncate">Room 204 • VIP</p>
  </div>
  <span class="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">2pm</span>
</div>
```

---

## 5. Calendar/Tape Chart Patterns

### Room Sidebar (sticky left)
- Width: `w-48` (192px)
- Shadow: `shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]`
- Room type headers: `bg-slate-50 dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0`
- Room rows: `h-16`, `border-b border-slate-100`, hover state, room name bold + housekeeping badge

### Timeline Grid
- Column width: `w-32` (128px) per day
- Today column: `bg-primary/5 dark:bg-primary/10`
- Weekend columns: `bg-slate-50 dark:bg-slate-700/30`
- Current time indicator: vertical red line (`bg-red-400 w-0.5`) with dot

### Reservation Blocks (on timeline)
| Type | Classes |
|------|---------|
| Confirmed | `bg-primary text-white rounded-md shadow-md shadow-primary/30` |
| Checked In | `bg-green-500 text-white rounded-md shadow-md shadow-green-500/30` |
| Group/Special | `bg-purple-500 text-white rounded-md shadow-md shadow-purple-500/30` |
| Maintenance | `bg-slate-200 dark:bg-slate-600 border border-slate-300` with diagonal stripe pattern |

Block inner content: `text-xs font-bold truncate` for name, `text-[10px] opacity-80` for subtitle

---

## 6. Spacing & Typography Scale

### Spacing
| Usage | Value |
|-------|-------|
| Page padding | `p-8` (32px) |
| Card padding | `p-4` or `p-5` (16–20px) |
| Table cell padding | `p-4` (16px) |
| Inline gaps | `gap-2` (8px), `gap-3` (12px), `gap-4` (16px) |
| Section margins | `mb-6` (24px), `mb-8` (32px) |

### Typography
| Element | Classes |
|---------|---------|
| Page title | `text-2xl font-bold text-slate-900 dark:text-white` |
| Section title | `text-lg font-bold` or `text-sm font-semibold` |
| Body text | `text-sm text-slate-700 dark:text-slate-300` |
| Secondary text | `text-xs text-slate-500` or `text-slate-400` |
| Table header | `text-xs font-semibold text-slate-500 uppercase tracking-wider` |
| KPI value | `text-2xl font-bold text-slate-900 dark:text-white` |
| Money amounts | `tabular-nums` for alignment |

### Border Radius
| Element | Radius |
|---------|--------|
| Buttons | `rounded-lg` (8px) |
| Cards | `rounded-xl` (12px) |
| Badges | `rounded-full` |
| Inputs | `rounded-lg` (8px) |
| Avatars | `rounded-full` |
| Small tags | `rounded` (4px) |

---

## 7. Icons

- **Library:** Material Icons (`material-icons` class)
- **Default size:** `text-[20px]` in nav, `text-lg` in buttons, `text-xl` for actions
- **Color in nav:** `text-slate-500 group-hover:text-white` (inactive), `text-primary` (active)
- **Key icons used:**
  - Dashboard: `dashboard`
  - Calendar/Front Desk: `calendar_today`, `calendar_month`
  - Bookings: `book_online`, `calendar_month`
  - Housekeeping: `cleaning_services`
  - Guests: `people`, `person_outline`
  - Analytics/Reports: `bar_chart`, `analytics`
  - Settings: `settings`
  - Search: `search`
  - Notifications: `notifications`
  - Add: `add`
  - Export: `download`
  - Filter: `filter_list`
  - More actions: `more_vert`
  - Navigation: `chevron_left`, `chevron_right`, `expand_more`
  - Star/VIP: `star`
  - Money: `paid`
  - Trending: `trending_up`
  - Build/Maintenance: `build`
  - Check-in: `login`
  - Check-out: `logout`
  - Room: `bedroom_parent`, `bed`
  - Date: `date_range`, `event_available`

---

## 8. Dark Mode

Every component MUST support dark mode using the `dark:` prefix. Key patterns:

| Element | Light | Dark |
|---------|-------|------|
| Content bg | `bg-background-light` | `dark:bg-background-dark` |
| Card bg | `bg-white` | `dark:bg-[#1a2632]` |
| Sidebar bg | `bg-[#0a1118]` | (same) |
| Borders | `border-slate-200` | `dark:border-slate-700` or `dark:border-slate-800` |
| Primary text | `text-slate-900` | `dark:text-white` |
| Secondary text | `text-slate-500` | `dark:text-slate-400` |
| Input bg | `bg-white` | `dark:bg-slate-900` |
| Table header bg | `bg-slate-50` | `dark:bg-white/5` |
| Hover rows | `hover:bg-slate-50` | `dark:hover:bg-slate-800/50` |

---

## 9. Agent Instructions

When building any UI component:
1. **Check this guide first** for the exact classes and patterns
2. **Use Material Icons** (`material-icons` class), NOT Lucide, NOT Heroicons
3. **Use Manrope font** — import from Google Fonts
4. **Support dark mode** on every element
5. **Match the exact color tokens** — `primary: #137fec`, sidebar: `#0a1118`
6. **Translate to Shadcn/UI** where possible, but preserve the visual identity
7. **Do not invent new patterns** — if a component type exists in this guide, use it as-is
