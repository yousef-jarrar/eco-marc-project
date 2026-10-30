LUMIÈRE | Fashion E-Commerce Platform
ECO-MARC is a web-based fashion e-commerce platform designed to provide customers with a smooth online shopping experience and give store administrators the tools to manage products, inventory, orders, customers, discounts, and store settings.
<!-- ========================================================== -->
#-The project combines a customer-facing storefront with an administration dashboard. It is built using PHP, MySQL, HTML, CSS, and JavaScript, with optional third-party integrations for image hosting, Google sign-in, and AI-assisted administration.
Table of Contents
- Project Overview
- Key Features
- Technology Stack
- Team Members
- Project Structure
- Getting Started
- Environment Configuration
- Database
- Main API Endpoints
- Optional Integrations
- Security
- Troubleshooting
<!-- ========================================================== -->
#-Project Overview
ECO-MARC aims to make fashion shopping convenient for customers while simplifying day-to-day store operations for administrators.

Customers can explore products, view product information and available variants, manage a shopping cart, and maintain a wishlist. Administrators can manage the store through a dedicated dashboard, including catalogue and order-related operations.

#-Key Features:

Customer Features
- Customer registration, login, and account management.
- Google sign-in support when configured.
- Browse the fashion product catalogue.
- View product details, descriptions, images, and prices.
- Choose product variants such as size and color.
- Variant-level stock quantity management.
- Shopping cart operations, including adding items, updating quantities, and checkout.
- Wishlist support.
- Product reviews and ratings.

Admin Dashboard
- Admin authentication and protected administration pages.
- Dashboard overview and store statistics.
- Product management.
- Product image uploads and management.
- Category management.
- Discount management.
- Customer management.
- Order management and order details.
- Review moderation.
- Store settings, including delivery settings.
- AI-assisted administrative insights and business questions, when the AI service is configured.

Product and Inventory Management
- Products are organized by categories.
- Products can have multiple images.
- Product variants support sizes and colors.
- Inventory quantities are maintained per variant.
- Discounts can be applied and displayed with product pricing.

<!-- ========================================================== -->
#-Technology Stack
Area	                    Technologies
Frontend	                HTML5, CSS3, JavaScript
Backend	                    PHP 8.0+
Database	                MySQL
Local development	        XAMPP (Apache and MySQL)
PHP dependencies	        Composer
Authentication	            PHP sessions, JWT library, Google Identity integration
Image hosting	            Cloudinary
Charts	                    Chart.js
UI components and alerts	Bootstrap bundle, SweetAlert2
AI service	                Ollama (optional)
<!-- ========================================================== -->
#-Team Members
Name	        Role
Mohammed        Faqeeh Product Owner
Yousef Jarrar	Scrum Master
Besan Nazzal	Development Team
Tala Oqaili	    Development Team
Salah Qaraeen	Development Team
<!-- ========================================================== -->
#-Project Structure
E-commerce-project/
├── assets/
│   ├── lumiere-icon-light.svg
│   └── products/                 # Local product images
│
├── backend/
│   ├── api/                      # PHP API endpoints
│   ├── bin/                      # Database migration and setup scripts
│   ├── classes/                  # Application classes and business logic
│   ├── config/                   # Database, environment, and session config
│   ├── middleware/               # Admin and CSRF middleware
│   ├── vendor/                   # Composer dependencies
│   ├── .env.example              # Environment configuration template
│   ├── composer.json
│   └── composer.lock
│
├── database/
│   ├── database.sql              # Main database schema
│   └── migrations/               # Database migrations
│
├── frontend/
│   ├── account/                  # Login, registration, and account pages
│   ├── admin/                    # Administration dashboard pages
│   ├── assets/
│   │   ├── css/                  # Stylesheets
│   │   ├── js/                   # Frontend scripts
│   │   └── vendor/               # Frontend libraries
│   └── Landing.html              # Main storefront landing page
│
├── .gitignore
└── README.md
<!-- ========================================================== -->
#-Database
The main schema is stored in:
database/database.sql
The database includes tables for the main e-commerce entities, including:
- Users
- Categories
- Products
- Product variants
- Product images
- Discounts
- Carts and cart items
- Cart details
- Reviews
- Wishlist
- Store settings
- Product embeddings
<!-- ========================================================== -->
#-Security
- Keep backend/.env private and out of version control.
- Do not commit passwords, API secrets, private keys, or production credentials.
- Use the provided authentication and authorization middleware for protected operations.
- Keep CSRF protection enabled for state-changing requests.
- Use HTTPS for public deployments.
- Use a database account with only the permissions required by the application.
- Back up the database before running migrations or making schema changes.
<!-- ========================================================== -->
#-Troubleshooting
Database connection problems
- Confirm that MySQL is running in XAMPP.
- Verify the database settings in backend/.env.
- Confirm that the database exists and that the configured user has access.
Products or categories are not displayed
- Confirm that Apache and MySQL are running.
- Check that the database contains the required records.
- Open the relevant API endpoint and inspect its JSON response.
- Check the browser Developer Tools Console and Network tabs for errors.
Product images are missing
- Check that the stored image URL is valid.
- Confirm that local image files exist at their expected paths.
- If using Cloudinary, verify the CLOUDINARY_URL configuration.
Login, cart, or wishlist requests fail
- Sign in with the appropriate account.
- Check the API response in the browser Network tab.
- Confirm that cookies and PHP sessions are working.
- Verify that protected requests include the required CSRF token.
AI assistant is unavailable
- Confirm that Ollama is installed and running.
- Check OLLAMA_URL and OLLAMA_MODEL.
- Verify that the configured model is available locally.
