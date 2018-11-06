DROP DATABASE IF EXISTS bamazon;

CREATE DATABASE bamazon;

USE bamazon;

CREATE TABLE products(
    item_id INT AUTO_INCREMENT NOT NULL,
    product_name VARCHAR(45) NOT NULL,
    department_name VARCHAR(30) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    available_quantity INT NOT NULL,
    hold_quantity INT DEFAULT 0,
    reserved_quantity INT DEFAULT 0,
    shipped_quantity INT DEFAULT 0,
    PRIMARY KEY(item_id)
);

CREATE TABLE customers(
    customer_id INT AUTO_INCREMENT NOT NULL,
    username VARCHAR(16) NOT NULL,
    user_password VARCHAR(19) NOT NULL,
    PRIMARY KEY(customer_id)
);

CREATE TABLE orders(
    order_id INT AUTO_INCREMENT NOT NULL,
    customer_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL,
    order_price DECIMAL(10,2) NOT NULL,
    order_time VARCHAR(20),
    paid VARCHAR(20) DEFAULT false,
    shipped VARCHAR(20) DEFAULT false,
    PRIMARY KEY(order_id)
);

CREATE TABLE manager_transactions(
    transaction_id INT AUTO_INCREMENT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL,
    neg_cost DECIMAL(10,2) NOT NULL,
    transaction_time VARCHAR(20),
    PRIMARY KEY(transaction_id)
);

 CREATE TABLE departments(
    department_id INT AUTO_INCREMENT NOT NULL,
    department_name VARCHAR(30) NOT NULL,
    PRIMARY KEY(department_id)   
);