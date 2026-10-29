# Cloudinary images

Product and category uploads use the existing Cloudinary configuration. URLs and public IDs are stored on their image/category rows. Existing local images continue to work.

Cloud image deletion is attempted directly after a successful database commit. Failed uploads or saves also attempt to remove their newly uploaded assets. Images still referenced by any product or category are protected.

The `cloudinary_image_cleanup` table and its retry mechanism were removed at the user's request. There are no persistent cleanup jobs or automatic retries. A failed remote deletion is logged and may leave an unused cloud asset that must be removed manually. It does not undo a successful product/category save.

Product deletion is a soft delete and retains its images. Removing a product image or replacing/removing a category image attempts cloud deletion. Category deletion is blocked while products reference it.

Image validation, admin sessions and CSRF remain enabled. Product uploads allow up to five images per request; category uploads accept one. Each image must be 5 MB or less and use JPG/PNG/WebP/GIF format. Secrets remain server-side and `.env` files are denied by Apache.

`backend/bin/migrate-cloudinary.php` preserves/adds the product public ID column only. `backend/bin/migrate-category-images.php` preserves/adds the category public ID column. Neither creates a cleanup table.
