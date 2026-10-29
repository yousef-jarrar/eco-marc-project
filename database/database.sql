
CREATE DATABASE IF NOT EXISTS ecommerce
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ecommerce;

 
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    phone VARCHAR(20) NULL,
    address TEXT NULL,
    google_id VARCHAR(255) NULL UNIQUE,
    role ENUM('admin', 'customer') NOT NULL DEFAULT 'customer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

 
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    image_url VARCHAR(500) NULL,
    public_id VARCHAR(255) NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB;

 
CREATE TABLE discounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    CONSTRAINT chk_discount_percentage
        CHECK (percentage BETWEEN 0 AND 100)
) ENGINE=InnoDB;

 
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    price DECIMAL(10,2) NOT NULL,
    category_id INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_products_category (category_id),
    INDEX idx_products_name (name),

    CONSTRAINT chk_products_price
        CHECK (price >= 0),

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

 
CREATE TABLE product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,

    size ENUM(
        'XS', 'S', 'M', 'L', 'XL', 'XXL',
        '36', '37', '38', '39', '40', '41',
        '42', '43', '44', '45', '46', 'ONE_SIZE'
    ) NOT NULL,

    color ENUM(
        'black', 'white', 'gray', 'red', 'blue',
        'navy', 'green', 'yellow', 'orange', 'pink',
        'purple', 'brown', 'beige', 'other'
    ) NOT NULL,

    quantity INT NOT NULL DEFAULT 0,

    UNIQUE KEY uq_product_variant (product_id, size, color),

    CONSTRAINT chk_variant_quantity
        CHECK (quantity >= 0),

    CONSTRAINT fk_variants_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

 
CREATE TABLE product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    INDEX idx_images_product (product_id),

    CONSTRAINT fk_images_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

 
 
CREATE TABLE carts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,

    status ENUM(
        'active', 'pending', 'confirmed', 'processing',
        'shipped', 'delivered', 'cancelled'
    ) NOT NULL DEFAULT 'active',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    cart_owner_id INT
        GENERATED ALWAYS AS (
            CASE
                WHEN status = 'active' THEN user_id
                ELSE NULL
            END
        ) STORED,

    INDEX idx_carts_user (user_id),
    INDEX idx_carts_status_created (status, created_at),
    UNIQUE KEY uq_one_active_cart (cart_owner_id),

    CONSTRAINT fk_carts_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

 
 
CREATE TABLE cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cart_id INT NOT NULL,
    variant_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,

    UNIQUE KEY uq_cart_variant (cart_id, variant_id),
    INDEX idx_cart_items_variant (variant_id),

    CONSTRAINT chk_cart_item_quantity
        CHECK (quantity > 0),

    CONSTRAINT fk_cart_items_cart
        FOREIGN KEY (cart_id)
        REFERENCES carts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_cart_items_variant
        FOREIGN KEY (variant_id)
        REFERENCES product_variants(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

 
CREATE TABLE cart_details (
    cart_id INT PRIMARY KEY,
    subtotal DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    shipping_address TEXT NOT NULL,

    CONSTRAINT chk_cart_details_subtotal
        CHECK (subtotal >= 0),

    CONSTRAINT chk_cart_details_discount
        CHECK (discount_amount >= 0),

    CONSTRAINT chk_cart_details_delivery
        CHECK (delivery_fee >= 0),

    CONSTRAINT chk_cart_details_total
        CHECK (total >= 0),

    CONSTRAINT fk_cart_details_cart
        FOREIGN KEY (cart_id)
        REFERENCES carts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

 
CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    comment TEXT NULL,

    status ENUM('pending', 'approved', 'hidden')
        NOT NULL DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_review_user_product (user_id, product_id),
    INDEX idx_reviews_product_status (product_id, status),

    CONSTRAINT chk_review_rating
        CHECK (rating BETWEEN 1 AND 5),

    CONSTRAINT fk_reviews_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_reviews_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

 
CREATE TABLE wishlist (
    user_id INT NOT NULL,
    product_id INT NOT NULL,

    PRIMARY KEY (user_id, product_id),

    CONSTRAINT fk_wishlist_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_wishlist_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

 
CREATE TABLE settings (
    id INT PRIMARY KEY DEFAULT 1,
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    free_delivery_at DECIMAL(10,2) NULL,

    CONSTRAINT chk_settings_single_row
        CHECK (id = 1),

    CONSTRAINT chk_settings_delivery_fee
        CHECK (delivery_fee >= 0),

    CONSTRAINT chk_settings_free_delivery
        CHECK (free_delivery_at IS NULL OR free_delivery_at >= 0)
) ENGINE=InnoDB;

 
INSERT INTO settings (id, delivery_fee, free_delivery_at)
VALUES (1, 3.00, 50.00);

 
CREATE TABLE product_embeddings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_image_id INT NOT NULL UNIQUE,
    embedding JSON NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_embeddings_image
        FOREIGN KEY (product_image_id)
        REFERENCES product_images(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;
