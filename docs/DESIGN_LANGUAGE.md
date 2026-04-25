# Movec Connect: Design Language Manual
**Theme: "Thin & Elegant" (Infrastructure Grade)**

This document defines the visual standards for the Movec Connect platform. All new UI additions must adhere to these rules to maintain a premium, high-end feel.

---

## 1. Typography Standards
*   **Hero Values & Numbers**: Always use `font-light` (300). Avoid `font-bold` for large data points.
*   **Page Headers**: Use `text-2xl font-light` with `tracking-tight`.
*   **Labels & Metadata**: Use `font-normal` (400) or `font-light`.
*   **Case Rule**: **NEVER USE UPPERCASE** for labels or headers. Use standard sentence case (e.g., "Monthly revenue", not "MONTHLY REVENUE").
*   **Spacing**: Do not use `tracking-widest` or excessive letter-spacing on labels. Keep them tight and precise.

## 2. Component Architecture (Cards)
*   **Border Radius**: Standardized at `rounded-2xl` (approx. 16px). Avoid `32px` (toy-like) or `8px` (too sharp).
*   **Borders**: Use ultra-thin `border-slate-100` or `border-slate-200/50`. The border should be "etched," not heavy.
*   **Shadows**: Use `shadow-sm` or custom ultra-light shadows like `shadow-[0_1px_2px_rgba(0,0,0,0.02)]`.
*   **Backgrounds**: Clean `bg-white` or very subtle `bg-slate-50/50`.

## 3. Data Visualization (Graphs)
*   **Line Weight**: Always use **`strokeWidth={1.5}`** or **`2`**. Never use `4` or higher.
*   **Gradients**: Use multi-stop linear gradients for chart fills that fade out completely (e.g., `stopOpacity={0.08}` to `0`).
*   **Axis & Grids**: Use minimalist axis labels (`fontSize: 10`) and light `slate-100` grid lines. Hide the Y-axis line where possible.

## 4. Interaction & Micro-animations
*   **Hovers**: Cards should have a subtle lift or border color change (`hover:border-slate-200`).
*   **Transitions**: Use `transition-all duration-500` for smooth, high-end movement.

## 5. Iconography
*   **Stroke**: Use `strokeWidth={1.5}` for Lucide icons.
*   **Containers**: Put icons in subtle, low-saturation containers (e.g., `bg-slate-50` or `bg-emerald-50/50`). Avoid bright, solid-colored icon boxes.

---

**Philosophy**: *Movec Connect should feel like a precision instrument. Every pixel must be intentional, lightweight, and professional.*
