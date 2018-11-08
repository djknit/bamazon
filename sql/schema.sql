DROP DATABASE IF EXISTS bamazon;

CREATE DATABASE bamazon;

USE bamazon;

CREATE TABLE products(
    item_id INT AUTO_INCREMENT NOT NULL,
    product_name VARCHAR(45) NOT NULL,
    department_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
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

CREATE TABLE managers(
    manager_id INT AUTO_INCREMENT NOT NULL,
    username VARCHAR(16) NOT NULL,
    user_password VARCHAR(19) NOT NULL,
    PRIMARY KEY(manager_id)
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

CREATE TABLE purchases(
    purchase_id INT AUTO_INCREMENT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    purchase_time VARCHAR(20),
    manager_id INT NOT NULL,
    PRIMARY KEY(purchase_id)
);

CREATE TABLE adjustments(
    adjustment_id INT AUTO_INCREMENT NOT NULL,
    item_id INT NOT NULL,
    quantity_added INT NOT NULL,
    reason VARCHAR(7) NOT NULL,
    adjustment_time VARCHAR(20),
    manager_id INT NOT NULL,
    PRIMARY KEY(adjustment_id)
);

CREATE TABLE price_changes(
    change_id INT AUTO_INCREMENT NOT NULL,
    item_id INT NOT NULL,
    old_price DECIMAL(10,2) NOT NULL,
    new_price DECIMAL(10,2) NOT NULL,
    change_time VARCHAR(20),
    manager_id INT NOT NULL,
    PRIMARY KEY(change_id)
);

CREATE TABLE departments(
    department_id INT AUTO_INCREMENT NOT NULL,
    department_name VARCHAR(30) NOT NULL,
    PRIMARY KEY(department_id)   
);