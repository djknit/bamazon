DROP DATABASE IF EXISTS bamazon;

CREATE DATABASE bamazon;

USE bamazon;

CREATE TABLE products(
    item_id INT AUTO_INCREMENT NOT NULL,
    product_name VARCHAR(45) NOT NULL,
    department_name VARCHAR(30) NOT NULL,
    price DECIMAL (10,2),
    stock_quantity INT(10),
    PRIMARY KEY (item_id)
);