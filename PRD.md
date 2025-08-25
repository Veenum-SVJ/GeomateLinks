
# Product Requirements Document: Geomate Links Consulting Website

**Version:** 1.0
**Author:** App Prototyper (AI)
**Date:** July 26, 2024

---

## 1. Introduction & Vision

### 1.1. Overview
Geomate Links Consulting Limited is a premier Nigerian firm specializing in Surveying, Mapping, and Geographic Information Systems (GIS). This project aims to develop a modern, professional, and dynamic corporate website to replace their existing online presence. The new website will serve as a primary digital marketing and communication tool, designed to showcase the company's expertise, attract new clients, and provide a seamless user experience.

### 1.2. Problem Statement
The current website may be outdated, difficult to update, and may not effectively communicate the company's brand and capabilities. Potential clients lack a clear, modern, and engaging platform to learn about services, view past projects, and make contact. Internally, there is no simple system for non-technical staff to manage website content, such as updating service descriptions, adding new projects, or viewing contact form submissions.

### 1.3. Vision
To create the definitive online presence for Geomate Links Consulting, establishing them as a technology-forward leader in the Nigerian geospatial industry. The platform will be visually appealing, easy to navigate for potential clients, and simple to manage for the Geomate Links team.

---

## 2. Goals & Objectives

### 2.1. Business Goals
-   **Increase Lead Generation:** Drive a higher number of qualified inquiries through a clear and accessible contact form.
-   **Enhance Brand Image:** Solidify Geomate Links' reputation as a professional, modern, and trustworthy firm.
-   **Improve Marketing Reach:** Create a strong online foundation for digital marketing campaigns.
-   **Streamline Operations:** Enable simple, in-house content management to reduce reliance on external developers for routine updates.

### 2.2. User Goals
-   **Potential Clients:** To easily understand the company's services, see proof of their expertise through project showcases, and find contact information to request a quote.
-   **Admin Users:** To be able to log in securely and update website content (pages, services, projects, media) without needing to write any code.

---

## 3. Target Audience

-   **Primary:** Project managers, procurement officers, and decision-makers in government agencies (local, state, and federal), construction companies, real estate development firms, and environmental agencies in Nigeria.
-   **Secondary:** Academic researchers, students in geospatial fields, and potential corporate partners.
-   **Internal:** Administrative staff at Geomate Links responsible for marketing and website updates.

---

## 4. Features & Requirements

### 4.1. Public-Facing Website
-   **Homepage:** A comprehensive entry point including a hero section, and summaries of About, Services, and Projects sections.
-   **Header:** Sticky navigation with links to all major sections (About, Services, Projects, Contact). Includes company logo and a "Get a Quote" call-to-action button. Highlights the active section on scroll.
-   **About Section:** Detailed company information, mission, vision, and core values.
-   **Services Section:** A detailed breakdown of all services offered by the company, each with an icon, title, and description.
-   **Projects Section:** A filterable gallery of past projects to showcase expertise. Projects are categorized (e.g., Cadastral, GIS, Drone Mapping).
-   **Contact Section:**
    -   Company contact details (address, phone, email).
    -   An embedded map showing the office location.
    -   A contact form for inquiries (Name, Email, Subject, Message).
-   **Footer:** Contains quick links, contact information, social media links, and a copyright notice. Includes a hidden link to the admin login page.
-   **Responsiveness:** The website must be fully responsive and functional on desktop, tablet, and mobile devices.

### 4.2. Admin Dashboard (Backend)
-   **Secure Login:** A dedicated login page (`/login`) for authorized administrators to access the dashboard.
-   **Dashboard Home:** An overview page displaying key site statistics (e.g., new messages, total projects).
-   **Pages Management:** A section to edit the content of key static pages like "About Us" and "Services".
-   **Services Management:** An interface to add, edit, and delete the services listed on the public website.
-   **Projects Management:** A section to upload new projects to the gallery, including an image, title, category, and description.
-   **Messages:** An inbox to view all submissions from the public contact form.
-   **Media Library:**
    -   A simple interface to upload files (images, PDFs, etc.).
    -   Uses a self-hosted backend API route (`/api/upload`) to store files in the `public/uploads/` directory, avoiding external service dependencies.
    -   Displays upload progress.
-   **Site Settings:** A page to update global site information like company address, phone number, email, and social media URLs.
-   **Profile Settings:** A section for admins to manage their own account details, including changing their password.

---

## 5. Design & UX Requirements

-   **Theme:** Professional, modern, and clean. The color palette uses earthy tones (beige, brown) with a strong accent color (forest green) to reflect the connection to land and environment.
-   **Typography:** Utilizes the 'Poppins' font for a modern and readable feel.
-   **UI Components:** Leverages the ShadCN UI library for a consistent and high-quality set of components (buttons, cards, forms, etc.).
-   **User Experience:** Navigation should be intuitive. Page load times should be fast. Interactive elements should provide clear feedback (e.g., hover states, form validation messages).

---

## 6. Technical Specifications

-   **Framework:** Next.js (App Router)
-   **Language:** TypeScript
-   **Styling:** Tailwind CSS with CSS Variables for theming.
-   **UI Components:** ShadCN
-   **Backend:** Next.js API Routes for custom server-side logic (e.g., file uploads).
-   **Hosting:** Deployable to any standard Node.js hosting environment.

---

## 7. Success Metrics

-   **Quantitative:**
    -   Number of contact form submissions per month.
    -   Page load speed (Google PageSpeed Insights score).
    -   Time spent on site by users.
-   **Qualitative:**
    -   Positive feedback from clients on the website's professionalism and usability.
    -   Ease of use for admin staff, measured by their ability to perform content updates without assistance.

---
