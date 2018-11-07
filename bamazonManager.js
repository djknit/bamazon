// Require the node modules needed for the app.
const mysql = require("mysql");
const inquirer = require("inquirer");
const columnify = require("columnify");
const chalk = require("chalk");
const dotenv = require("dotenv").config();
const moment = require("moment");

const userAuthentication = require("./userAuthentication")

// Global variables
let inventory, user;

console.log(chalk.bgBlue.yellow(" Bamazon MANAGER " + " ".repeat(61)));

// Configure the connection to the MySQL server and database using the 'mysql' module
const connection = mysql.createConnection({
    port: 3306,
    user: "root",
    password: process.env.MY_SQL_PASSWORD,
    database: "bamazon"
});

// Connect to the MySQL server and database.
connection.connect(error => {
    // If there was an error, print the error and stop the process.
    if (error) return console.error(error);
    // Otherwise...
    console.log("\nWelcome to Bamazon Manager View\n");
    userAuthentication.loginMenu(connection, "managers", begin, thanksBye);
});

function thanksBye() {
    console.log(chalk.magenta("\nThank you! Goodbye."));
    connection.end();
}

function begin(user0) {
    user = user0;
    return mainMenu();
}

function mainMenu() {
    console.log("");
    console.log(chalk.gray.underline(" MAIN MENU  "))
    inquirer.prompt({
        name: "action",
        message: chalk.green("What would you like to do?"),
        type: "list",
        choices: ["View Inventory", "View Low Inventory", "Add Inventory", "Add New Product"]
    }).then(answer => {
        if (answer.action === "Place an order") return placeOrder();
        if (answer.action === "View order history") return viewOrders();
        if (answer.action === "View inventory") return getInventoryThen(() => {
            displayInventory();
            mainMenu();
        })
        thanksBye();
    });
}

function getInventoryThen(callback) {
    // Query database (using 'mysql' module) for current inventory.
    connection.query("SELECT * FROM products", (error, results) => {
        if (error) return console.error(error);
        inventory = [];
        results.forEach(value => {
            inventory.push({
                "Item ID": value.item_id,
                "Product Name": value.product_name,
                Price: value.price.toFixed(2),
                Available: value.available_quantity,
                "On Hold": value.hold_quantity,
                Reserved: value.reserved_quantity,
                Shipped: value.shipped_quantity,
                Department: value.department_name
            });
        });
        callback();
    });
}