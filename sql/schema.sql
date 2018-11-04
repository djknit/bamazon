DROP DATABASE IF EXISTS bamazon;

CREATE DATABASE bamazon;

USE bamazon;

CREATE TABLE products(
    item_id INT AUTO_INCREMENT NOT NULL,
    product_name VARCHAR(45) NOT NULL,
    department_name VARCHAR(30) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INT(10) NOT NULL,
    PRIMARY KEY(item_id)
);

CREATE TABLE orders(
    order_id INT AUTO_INCREMENT NOT NULL,
    price DECIMAL(11,2) DEFAULT 0,
    customer_name VARCHAR(30) NOT NULL,
    customer_id INT(5),
    is_complete BIT DEFAULT 0,
    is_shipped BIT DEFAULT 0,
    time_completed VARCHAR(20),
    time_shipped VARCHAR(20),
    PRIMARY KEY(order_id)
);

/* Identifies the individual items on each order */
/* (This extra table is needed b/c the relationship of products to orders can be many-to-many.) */
CREATE TABLE products_orders(
    item_id INT(5) NOT NULL,
    order_id INT(5) NOT NULL,
    quantity INT(5) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL
);

CREATE TABLE customers(
    customer_id INT AUTO_INCREMENT NOT NULL,
    customer_name VARCHAR(30) NOT NULL,
    login_name VARCHAR(16) NOT NULL,
    login_password VARCHAR(19) NOT NULL,
    email VARCHAR(30),
    PRIMARY KEY(customer_id)
);

CREATE TABLE departments(
    department_id INT AUTO_INCREMENT NOT NULL,
    department_name VARCHAR(30) NOT NULL,
    
)