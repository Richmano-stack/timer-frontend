# ⏱️ Timer Management System

A high-performance, real-time status tracking and management dashboard built for modern teams. This application features a robust **Express.js backend** providing a seamless experience for monitoring employee statuses, analyzing performance metrics, and managing team availability.

---

## Features

### Team Management
- **Live Team Status**: Monitor the real-time status of all team members from a centralized table.
- **User Administration**: Dedicated admin interface for creating, editing, and managing user accounts and roles.
- **Profile Management**: Personalized user profiles with customizable settings.

### Analytics & Insights
- **Performance Analytics**: Visual data representation using Recharts to track status durations and patterns.
- **Status History**: Detailed audit logs of all status changes for accountability and reporting.
- **Summary Cards**: Quick-glance metrics of daily activity and team health.

### Developer Experience
- **Next.js 15+ & React 19**: Leveraging the latest features of the React ecosystem.
- **Better-Auth Integration**: Robust authentication flow with secure session management.
- **Tailwind CSS 4**: Cutting-edge styling with the latest version of Tailwind.
- **Modular Architecture**: Clean separation of concerns using Next.js Route Groups.

---

## Tech Stack

- **Frontend Framework**: [Next.js (App Router)](https://nextjs.org/)
- **Backend API**: [Express.js](https://expressjs.com/)
- **Runtime**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Authentication**: [Better-Auth](https://better-auth.com/)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Forms & Validation**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
- **Testing**: [Vitest](https://vitest.dev/)

---

## Architecture

The project utilizes a **Route Grouping** strategy to maintain a clean and scalable structure:

- **`app/(auth)`**: Contains login and registration flows. Uses a minimalist layout without navigation elements.
- **`app/(dashboard)`**: Contains the core application logic. Shares a common "App Shell" layout featuring the persistent Sidebar and Topbar.
- **`middleware.ts`**: Implements a "Guard" mechanism that ensures all dashboard routes are protected and redirects unauthenticated users to the login page.

---

## 🛠️ Getting Started

### 1. Installation

```bash
pnpm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory and add your configuration:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Add other necessary auth/api environment variables
```

### 3. Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 🧪 Testing

The project uses Vitest for unit and integration testing.

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test --coverage
```

---

## 📦 Deployment

The easiest way to deploy is via [Vercel](https://vercel.com/new).

For detailed deployment instructions, check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

