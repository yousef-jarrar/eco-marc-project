# Category images

Categories → Add/Edit → Upload image accepts JPG, PNG, WebP or GIF up to 5 MB, with preview and an explicit Remove image checkbox. File uploads are stored under `eco-marc/categories/`; the URL and public ID are saved on the category row.

Existing image links remain supported. An optional pasted URL is stored directly, without importing it into Cloudinary. Renaming preserves the current image. Categories containing products cannot be deleted.

After successful replacement/removal/deletion, the old cloud image is deleted directly if no product or category still references it. There is no cleanup table or automatic retry. If Cloudinary is unreachable, the database save succeeds and the unused cloud asset may require manual deletion later.

Failed uploads/saves attempt immediate cleanup of any newly uploaded asset. Admin authentication, session CSRF, file validation, product foreign-key protection and local image compatibility remain enabled.
