ALTER TABLE products ADD COLUMN gender ENUM('men','women','unisex') NULL DEFAULT NULL AFTER category_id;
