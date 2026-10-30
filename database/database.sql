SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ecommerce`
--

-- --------------------------------------------------------

--
-- Table structure for table `carts`
--

CREATE TABLE `carts` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `status` enum('active','pending','confirmed','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `cart_owner_id` int(11) GENERATED ALWAYS AS (case when `status` = 'active' then `user_id` else NULL end) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `carts`
--

INSERT INTO `carts` (`id`, `user_id`, `status`, `created_at`) VALUES
(1, 1, 'confirmed', '2026-10-28 11:32:41'),
(32, 12, 'delivered', '2026-10-29 09:41:49'),
(33, 13, 'confirmed', '2026-10-29 08:41:49'),
(34, 14, 'processing', '2026-10-28 09:41:49'),
(35, 15, 'shipped', '2026-10-28 08:41:49'),
(36, 16, 'delivered', '2026-10-27 09:41:49'),
(37, 17, 'pending', '2026-10-27 08:41:49'),
(38, 12, 'delivered', '2026-10-26 09:41:49'),
(39, 13, 'cancelled', '2026-10-26 08:41:49'),
(40, 14, 'delivered', '2026-10-25 09:41:49'),
(41, 15, 'confirmed', '2026-10-25 08:41:49'),
(42, 16, 'processing', '2026-10-24 09:41:49'),
(43, 17, 'shipped', '2026-10-24 08:41:49'),
(44, 12, 'delivered', '2026-10-23 09:41:49'),
(45, 13, 'pending', '2026-10-23 08:41:49'),
(46, 14, 'delivered', '2026-10-22 09:41:49'),
(47, 15, 'cancelled', '2026-10-22 08:41:49'),
(48, 16, 'delivered', '2026-10-21 09:41:49'),
(49, 17, 'confirmed', '2026-10-21 08:41:49'),
(50, 12, 'processing', '2026-10-20 09:41:49'),
(51, 13, 'shipped', '2026-10-20 08:41:49'),
(52, 14, 'delivered', '2026-10-19 09:41:49'),
(53, 15, 'pending', '2026-10-19 08:41:49'),
(54, 16, 'delivered', '2026-10-18 09:41:49'),
(55, 17, 'cancelled', '2026-10-18 08:41:49'),
(56, 12, 'delivered', '2026-10-17 09:41:49'),
(57, 13, 'confirmed', '2026-10-17 08:41:49'),
(58, 14, 'processing', '2026-10-16 09:41:49'),
(59, 15, 'shipped', '2026-10-16 08:41:49'),
(60, 16, 'delivered', '2026-10-15 09:41:49'),
(61, 17, 'pending', '2026-10-15 08:41:49');

-- --------------------------------------------------------

--
-- Table structure for table `cart_details`
--

CREATE TABLE `cart_details` (
  `cart_id` int(11) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `discount_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `delivery_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL,
  `shipping_address` text NOT NULL,
  `placed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `cart_details`
--

INSERT INTO `cart_details` (`cart_id`, `subtotal`, `discount_amount`, `delivery_fee`, `total`, `shipping_address`, `placed_at`) VALUES
(1, 170.00, 0.00, 3.00, 173.00, 'Amman, Jordan', '2026-10-28 11:41:18'),
(32, 154.00, 0.00, 0.00, 154.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-29 09:41:49'),
(33, 209.00, 0.00, 0.00, 209.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-29 08:41:49'),
(34, 237.00, 0.00, 0.00, 237.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-28 09:41:49'),
(35, 113.00, 0.00, 0.00, 113.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-28 08:41:49'),
(36, 219.00, 0.00, 0.00, 219.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-27 09:41:49'),
(37, 274.00, 0.00, 0.00, 274.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-27 08:41:49'),
(38, 131.00, 0.00, 0.00, 131.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-26 09:41:49'),
(39, 178.00, 0.00, 0.00, 178.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-26 08:41:49'),
(40, 284.00, 0.00, 0.00, 284.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-25 09:41:49'),
(41, 144.00, 0.00, 0.00, 144.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-25 08:41:49'),
(42, 172.00, 0.00, 0.00, 172.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-24 09:41:49'),
(43, 243.00, 0.00, 0.00, 243.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-24 08:41:49'),
(44, 154.00, 0.00, 0.00, 154.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-23 09:41:49'),
(45, 209.00, 0.00, 0.00, 209.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-23 08:41:49'),
(46, 237.00, 0.00, 0.00, 237.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-22 09:41:49'),
(47, 113.00, 0.00, 0.00, 113.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-22 08:41:49'),
(48, 219.00, 0.00, 0.00, 219.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-21 09:41:49'),
(49, 274.00, 0.00, 0.00, 274.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-21 08:41:49'),
(50, 131.00, 0.00, 0.00, 131.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-20 09:41:49'),
(51, 178.00, 0.00, 0.00, 178.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-20 08:41:49'),
(52, 428.00, 0.00, 0.00, 428.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-19 09:41:49'),
(53, 144.00, 0.00, 0.00, 144.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-19 08:41:49'),
(54, 172.00, 0.00, 0.00, 172.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-18 09:41:49'),
(55, 243.00, 0.00, 0.00, 243.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-18 08:41:49'),
(56, 154.00, 0.00, 0.00, 154.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-17 09:41:49'),
(57, 209.00, 0.00, 0.00, 209.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-17 08:41:49'),
(58, 237.00, 0.00, 0.00, 237.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-16 09:41:49'),
(59, 113.00, 0.00, 0.00, 113.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-16 08:41:49'),
(60, 219.00, 0.00, 0.00, 219.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-15 09:41:49'),
(61, 274.00, 0.00, 0.00, 274.00, '[eco-marc-demo-v1] Demo address, Amman, Jordan', '2026-10-15 08:41:49');

-- --------------------------------------------------------

--
-- Table structure for table `cart_items`
--

CREATE TABLE `cart_items` (
  `id` int(11) NOT NULL,
  `cart_id` int(11) NOT NULL,
  `variant_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1
) ;

--
-- Dumping data for table `cart_items`
--

INSERT INTO `cart_items` (`id`, `cart_id`, `variant_id`, `quantity`) VALUES
(64, 32, 30, 1),
(65, 32, 47, 1),
(66, 33, 31, 2),
(67, 33, 35, 1),
(68, 34, 32, 3),
(69, 34, 44, 1),
(70, 35, 33, 1),
(71, 35, 58, 1),
(72, 36, 30, 2),
(73, 36, 47, 1),
(74, 37, 31, 3),
(75, 37, 35, 1),
(76, 38, 32, 1),
(77, 38, 44, 1),
(78, 38, 40, 1),
(79, 39, 33, 2),
(80, 39, 58, 1),
(81, 40, 30, 3),
(82, 40, 47, 1),
(83, 41, 31, 1),
(84, 41, 35, 1),
(85, 42, 32, 2),
(86, 42, 44, 1),
(87, 43, 33, 3),
(88, 43, 58, 1),
(89, 44, 30, 1),
(90, 44, 47, 1),
(91, 45, 31, 2),
(92, 45, 35, 1),
(93, 46, 32, 3),
(94, 46, 44, 1),
(95, 47, 33, 1),
(96, 47, 58, 1),
(97, 48, 30, 2),
(98, 48, 47, 1),
(99, 49, 31, 3),
(100, 49, 35, 1),
(101, 50, 32, 1),
(102, 50, 44, 1),
(103, 50, 40, 1),
(104, 51, 33, 2),
(105, 51, 58, 1),
(106, 52, 30, 3),
(107, 52, 47, 1),
(108, 52, 51, 2),
(109, 53, 31, 1),
(110, 53, 35, 1),
(111, 54, 32, 2),
(112, 54, 44, 1),
(113, 55, 33, 3),
(114, 55, 58, 1),
(115, 56, 30, 1),
(116, 56, 47, 1),
(117, 57, 31, 2),
(118, 57, 35, 1),
(119, 58, 32, 3),
(120, 58, 44, 1),
(121, 59, 33, 1),
(122, 59, 58, 1),
(123, 60, 30, 2),
(124, 60, 47, 1),
(125, 61, 31, 3),
(126, 61, 35, 1);

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `public_id` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `image_url`, `public_id`, `status`) VALUES
(5, 'Footwear', 'http://localhost/xampp/php-project/frontend/assets/images/demo/court.jpg', NULL, 'active'),
(6, 'Tops', 'http://localhost/xampp/php-project/frontend/assets/images/demo/tee.jpg', NULL, 'active'),
(7, 'Outerwear', 'http://localhost/xampp/php-project/frontend/assets/images/demo/jacket.jpg', NULL, 'active'),
(8, 'Accessories', 'http://localhost/xampp/php-project/frontend/assets/images/demo/tote.jpg', NULL, 'active');

-- --------------------------------------------------------

--
-- Table structure for table `discounts`
--

CREATE TABLE `discounts` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `percentage` decimal(5,2) NOT NULL,
  `type` enum('normal','coupon') NOT NULL DEFAULT 'normal',
  `coupon_code` varchar(50) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `category_id` int(11) NOT NULL,
  `discount_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `quantity` int(11) NOT NULL DEFAULT 0
) ;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `name`, `description`, `price`, `category_id`, `discount_id`, `is_active`, `created_at`, `quantity`) VALUES
(9, 'Court 01 Sneaker', '[eco-marc-demo-v1] Sample fashion and footwear catalog item for development. Current remaining stock is stored by size and color.', 65.00, 5, NULL, 1, '2026-09-14 09:41:49', 48),
(10, 'City Runner', '[eco-marc-demo-v1] Sample fashion and footwear catalog item for development. Current remaining stock is stored by size and color.', 79.00, 5, NULL, 1, '2026-09-14 09:41:49', 3),
(11, 'Studio Cotton Tee', '[eco-marc-demo-v1] Sample fashion and footwear catalog item for development. Current remaining stock is stored by size and color.', 24.00, 6, NULL, 1, '2026-09-14 09:41:49', 60),
(12, 'Linen Everyday Shirt', '[eco-marc-demo-v1] Sample fashion and footwear catalog item for development. Current remaining stock is stored by size and color.', 42.00, 6, NULL, 1, '2026-09-14 09:41:49', 32),
(13, 'Woven Everyday Tote', '[eco-marc-demo-v1] Sample fashion and footwear catalog item for development. Current remaining stock is stored by size and color.', 35.00, 8, NULL, 1, '2026-09-14 09:41:49', 40),
(14, 'Weekend Jacket', '[eco-marc-demo-v1] Sample fashion and footwear catalog item for development. Current remaining stock is stored by size and color.', 89.00, 7, NULL, 1, '2026-09-14 09:41:49', 24),
(15, 'Classic Loafer', '[eco-marc-demo-v1] Sample fashion and footwear catalog item for development. Current remaining stock is stored by size and color.', 72.00, 5, NULL, 1, '2026-09-14 09:41:49', 0),
(16, 'Everyday Denim Jacket', '[eco-marc-demo-v1] Sample fashion and footwear catalog item for development. Current remaining stock is stored by size and color.', 48.00, 7, NULL, 1, '2026-09-14 09:41:49', 50),
(17, 'Polo Sweatshirt', 'Smarten up your casual layering with this zip-neck polo sweatshirt in a regular fit. Perfect for smart-casual occasions or weekend outings, it combines classic polo detailing with sweatshirt warmth. Regular fit Zip-neck fastening Polo collar Ribbed cuffs and hem Machine washable. 80% Cotton, 20% Recycled polyester.', 20.00, 6, NULL, 1, '2026-10-29 10:27:21', 10);

-- --------------------------------------------------------

--
-- Table structure for table `product_embeddings`
--

CREATE TABLE `product_embeddings` (
  `id` int(11) NOT NULL,
  `product_image_id` int(11) NOT NULL,
  `embedding` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`embedding`)),
  `model_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product_images`
--

CREATE TABLE `product_images` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `image_url` varchar(500) NOT NULL,
  `public_id` varchar(255) DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `product_images`
--

INSERT INTO `product_images` (`id`, `product_id`, `image_url`, `public_id`, `is_primary`) VALUES
(9, 9, 'frontend/assets/images/demo/court.jpg', NULL, 1),
(10, 10, 'frontend/assets/images/demo/runner.jpg', NULL, 1),
(11, 11, 'frontend/assets/images/demo/tee.jpg', NULL, 1),
(12, 12, 'frontend/assets/images/demo/shirt.jpg', NULL, 1),
(13, 13, 'frontend/assets/images/demo/tote.jpg', NULL, 1),
(14, 14, 'frontend/assets/images/demo/jacket.jpg', NULL, 1),
(15, 15, 'frontend/assets/images/demo/loafer.jpg', NULL, 1),
(16, 16, 'frontend/assets/images/demo/hoodie.jpg', NULL, 1),
(17, 17, 'https://res.cloudinary.com/dojjyllqm/image/upload/v1793269641/eco-marc/products/6859cc9609efba5782ef72fda7e860d0.webp', 'eco-marc/products/6859cc9609efba5782ef72fda7e860d0', 1),
(18, 17, 'https://res.cloudinary.com/dojjyllqm/image/upload/v1793269861/eco-marc/products/fb615e2a155c477424502e4d2bee1ff1.webp', 'eco-marc/products/fb615e2a155c477424502e4d2bee1ff1', 0),
(19, 17, 'https://res.cloudinary.com/dojjyllqm/image/upload/v1793269862/eco-marc/products/dec46627ba5377005086de4c5a28db94.webp', 'eco-marc/products/dec46627ba5377005086de4c5a28db94', 0),
(20, 17, 'https://res.cloudinary.com/dojjyllqm/image/upload/v1793269863/eco-marc/products/c97a23204cd98917219ee5b26535af09.webp', 'eco-marc/products/c97a23204cd98917219ee5b26535af09', 0);

-- --------------------------------------------------------

--
-- Table structure for table `product_variants`
--

CREATE TABLE `product_variants` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `size` enum('XS','S','M','L','XL','XXL','36','37','38','39','40','41','42','43','44','45','46','ONE_SIZE') NOT NULL,
  `color` enum('black','white','gray','red','blue','navy','green','yellow','orange','pink','purple','brown','beige','other') NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0
) ;

--
-- Dumping data for table `product_variants`
--

INSERT INTO `product_variants` (`id`, `product_id`, `size`, `color`, `quantity`) VALUES
(30, 9, '40', 'white', 12),
(31, 9, '41', 'white', 12),
(32, 9, '42', 'white', 12),
(33, 9, '43', 'white', 12),
(34, 10, '40', 'black', 1),
(35, 10, '41', 'black', 0),
(36, 10, '42', 'black', 2),
(37, 10, '43', 'black', 0),
(38, 11, 'S', 'white', 15),
(39, 11, 'M', 'white', 15),
(40, 11, 'L', 'white', 15),
(41, 11, 'XL', 'white', 15),
(42, 12, 'S', 'beige', 8),
(43, 12, 'M', 'beige', 8),
(44, 12, 'L', 'beige', 8),
(45, 12, 'XL', 'beige', 8),
(46, 13, 'ONE_SIZE', 'brown', 40),
(47, 14, 'S', 'navy', 6),
(48, 14, 'M', 'navy', 6),
(49, 14, 'L', 'navy', 6),
(50, 14, 'XL', 'navy', 6),
(51, 15, '40', 'brown', 0),
(52, 15, '41', 'brown', 0),
(53, 15, '42', 'brown', 0),
(54, 15, '43', 'brown', 0),
(55, 16, 'S', 'blue', 12),
(56, 16, 'M', 'blue', 13),
(57, 16, 'L', 'blue', 13),
(58, 16, 'XL', 'blue', 12),
(59, 17, 'L', 'black', 5),
(60, 17, 'M', 'red', 5);

-- --------------------------------------------------------

--
-- Table structure for table `reviews`
--

CREATE TABLE `reviews` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `rating` tinyint(3) UNSIGNED NOT NULL,
  `comment` text DEFAULT NULL,
  `status` enum('pending','approved','hidden') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `reviews`
--

INSERT INTO `reviews` (`id`, `product_id`, `user_id`, `rating`, `comment`, `status`, `created_at`) VALUES
(22, 9, 12, 5, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-28 09:41:49'),
(23, 9, 13, 5, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-27 09:41:49'),
(24, 9, 14, 4, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-26 09:41:49'),
(25, 9, 15, 5, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-25 09:41:49'),
(26, 10, 12, 4, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'pending', '2026-10-28 09:41:49'),
(27, 10, 13, 5, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-27 09:41:49'),
(28, 10, 14, 4, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-26 09:41:49'),
(29, 11, 12, 4, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-28 09:41:49'),
(30, 11, 13, 5, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-27 09:41:49'),
(31, 11, 14, 5, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-26 09:41:49'),
(32, 12, 12, 5, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'pending', '2026-10-28 09:41:49'),
(33, 12, 13, 4, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-27 09:41:49'),
(34, 12, 14, 5, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-26 09:41:49'),
(35, 14, 12, 5, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-28 09:41:49'),
(36, 14, 13, 4, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-27 09:41:49'),
(37, 14, 14, 5, '[eco-marc-demo-v1] Demo review: comfortable fit and considered design.', 'approved', '2026-10-26 09:41:49'),
(38, 16, 12, 2, '[eco-marc-demo-v1] Demo review: fit and finishing need improvement.', 'approved', '2026-10-28 09:41:49'),
(39, 16, 13, 2, '[eco-marc-demo-v1] Demo review: fit and finishing need improvement.', 'approved', '2026-10-27 09:41:49'),
(40, 16, 14, 3, '[eco-marc-demo-v1] Demo review: fit and finishing need improvement.', 'approved', '2026-10-26 09:41:49'),
(41, 13, 16, 4, '[eco-marc-demo-v1] Demo review awaiting moderation.', 'pending', '2026-10-28 09:41:49'),
(42, 11, 17, 1, '[eco-marc-demo-v1] Hidden demo review; excluded from analytics.', 'hidden', '2026-10-27 09:41:49');

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `id` int(11) NOT NULL DEFAULT 1,
  `delivery_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `free_delivery_at` decimal(10,2) DEFAULT NULL
) ;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`id`, `delivery_fee`, `free_delivery_at`) VALUES
(1, 3.02, 50.00);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `google_id` varchar(255) DEFAULT NULL,
  `role` enum('admin','customer') NOT NULL DEFAULT 'customer',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `password_hash`, `phone`, `address`, `google_id`, `role`, `created_at`, `is_active`) VALUES
(1, 'Demo', 'Customer', 'demo.customer@ecomarc.test', NULL, NULL, NULL, NULL, 'customer', '2026-10-28 11:32:19', 1),
(2, 'Mohammed', 'Alfaqeeh', 'mohammadaf200477@gmail.com', NULL, NULL, NULL, '110285865472802263225', 'customer', '2026-10-29 08:24:54', 1),
(3, 'Mohammed', 'ALfaqeeh', 'faqeeh@gmail.com', '$2y$10$FE1gVCNiOxJh4mkd9zgWbuR6.fJY9Mn4hKNBBPJvpVKzhH7Iky82y', NULL, NULL, NULL, 'admin', '2026-10-29 08:28:11', 1),
(5, 'Mohammed', 'Alfaqeeh', 'mohammadaf200411@gmail.com', '$2y$10$us46ymjcTZ8byJ8dtkJHeus/HWQiMHg0z3NZR9zDdRwUxDYJCayUm', NULL, NULL, NULL, 'customer', '2026-10-29 08:33:48', 1),
(12, 'Lina', 'Demo', 'ecomarc.demo.1@example.invalid', NULL, NULL, 'Demo address, Amman, Jordan', NULL, 'customer', '2026-09-14 09:41:49', 1),
(13, 'Omar', 'Demo', 'ecomarc.demo.2@example.invalid', NULL, NULL, 'Demo address, Amman, Jordan', NULL, 'customer', '2026-09-14 09:41:49', 1),
(14, 'Sara', 'Demo', 'ecomarc.demo.3@example.invalid', NULL, NULL, 'Demo address, Amman, Jordan', NULL, 'customer', '2026-09-14 09:41:49', 1),
(15, 'Kareem', 'Demo', 'ecomarc.demo.4@example.invalid', NULL, NULL, 'Demo address, Amman, Jordan', NULL, 'customer', '2026-09-14 09:41:49', 1),
(16, 'Nour', 'Demo', 'ecomarc.demo.5@example.invalid', NULL, NULL, 'Demo address, Amman, Jordan', NULL, 'customer', '2026-09-14 09:41:49', 1),
(17, 'Zaid', 'Demo', 'ecomarc.demo.6@example.invalid', NULL, NULL, 'Demo address, Amman, Jordan', NULL, 'customer', '2026-09-14 09:41:49', 1);

-- --------------------------------------------------------

--
-- Table structure for table `wishlist`
--

CREATE TABLE `wishlist` (
  `user_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `carts`
--
ALTER TABLE `carts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_one_active_cart` (`cart_owner_id`),
  ADD KEY `idx_carts_user` (`user_id`),
  ADD KEY `idx_carts_status_created` (`status`,`created_at`);

--
-- Indexes for table `cart_details`
--
ALTER TABLE `cart_details`
  ADD PRIMARY KEY (`cart_id`);

--
-- Indexes for table `cart_items`
--
ALTER TABLE `cart_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_cart_variant` (`cart_id`,`variant_id`),
  ADD KEY `idx_cart_items_variant` (`variant_id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `discounts`
--
ALTER TABLE `discounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `coupon_code` (`coupon_code`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_products_category` (`category_id`),
  ADD KEY `idx_products_name` (`name`),
  ADD KEY `idx_products_discount` (`discount_id`);

--
-- Indexes for table `product_embeddings`
--
ALTER TABLE `product_embeddings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `product_image_id` (`product_image_id`);

--
-- Indexes for table `product_images`
--
ALTER TABLE `product_images`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_images_product` (`product_id`);

--
-- Indexes for table `product_variants`
--
ALTER TABLE `product_variants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_product_variant` (`product_id`,`size`,`color`);

--
-- Indexes for table `reviews`
--
ALTER TABLE `reviews`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_review_user_product` (`user_id`,`product_id`),
  ADD KEY `idx_reviews_product_status` (`product_id`,`status`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `google_id` (`google_id`);

--
-- Indexes for table `wishlist`
--
ALTER TABLE `wishlist`
  ADD PRIMARY KEY (`user_id`,`product_id`),
  ADD KEY `fk_wishlist_product` (`product_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `carts`
--
ALTER TABLE `carts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=62;

--
-- AUTO_INCREMENT for table `cart_items`
--
ALTER TABLE `cart_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `discounts`
--
ALTER TABLE `discounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `product_embeddings`
--
ALTER TABLE `product_embeddings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `product_images`
--
ALTER TABLE `product_images`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `product_variants`
--
ALTER TABLE `product_variants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reviews`
--
ALTER TABLE `reviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `carts`
--
ALTER TABLE `carts`
  ADD CONSTRAINT `fk_carts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `cart_details`
--
ALTER TABLE `cart_details`
  ADD CONSTRAINT `fk_cart_details_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `cart_items`
--
ALTER TABLE `cart_items`
  ADD CONSTRAINT `fk_cart_items_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_cart_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_products_discount` FOREIGN KEY (`discount_id`) REFERENCES `discounts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `product_embeddings`
--
ALTER TABLE `product_embeddings`
  ADD CONSTRAINT `fk_embeddings_image` FOREIGN KEY (`product_image_id`) REFERENCES `product_images` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `product_images`
--
ALTER TABLE `product_images`
  ADD CONSTRAINT `fk_images_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `product_variants`
--
ALTER TABLE `product_variants`
  ADD CONSTRAINT `fk_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `wishlist`
--
ALTER TABLE `wishlist`
  ADD CONSTRAINT `fk_wishlist_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_wishlist_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;