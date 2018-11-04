// Require the node modules needed for the app.
const mysql = require("mysql");
const inquirer = require("inquirer");
const columnify = require("columnify");
const chalk = require("chalk");
const dotenv = require("dotenv").config();
const moment = require("moment");

// Configure the connection to the MySQL server and database using the 'mysql' module
const connection = mysql.createConnection({
    port: 3306,
    user: "root",
    password: process.env.MY_SQL_PASSWORD,
    database: "bamazon"
});

// Variable to hold inventory once it is retrieved from the database
let inventory;

// Var to hold order info
let thisOrder = {
    price: (0).toFixed(2),
    customer: {
        name: null,
        id: null,
        password: null,
        username: null
    },
    items: []
}

// Connect to the MySQL server and database.
connection.connect(function(error) {
    // If there was an error, print the error and stop the process.
    if (error) return console.error(error);
    // Otherwise...
    getInventoryThen(() => {
        displayInventory();
        askIfUserWantsToOrder();
    });
});

// Function to retrieve the current inventory from the database
function getInventoryThen(callback) {
    // Query database (using 'mysql' module) for current inventory.
    connection.query("SELECT * FROM products", function(error, results) {
        if (error) return console.error(error);
        // If no error...
        // Format prices
        results.forEach((product) => product.price = product.price.toFixed(2));
        // Store inventory in global variable.     
        inventory = results;
        if (callback) callback();
    });
}

// Function to display current inventory
function displayInventory() {
    // Print inventory to console.
    console.log("\nCurrent Inventory:\n\n" + columnify(inventory, {
        // Specify 'columnify' package options.
        columnSplitter: " | ",
        // This option orders the columns.
        columns: ["item_id", "product_name", "price", "stock_quantity", "department_name"],
        // Align numeric data to the right for consistent decimal alignment
        config: {
            price: { align: "right" },
            stock_quantity: { align: "right" }
        }
    }) + "\n");
}

function askIfUserWantsToOrder() {
    inquirer.prompt({
        name: "placeOrder",
        message: "Would you like to place an order?",
        type: "confirm"
    }).then(answer => answer.placeOrder ? askLoginOrContinueAsGuest() : dontPlaceOrder());
}

function askLoginOrContinueAsGuest() {
    inquirer.prompt({
        name: "login",
        message: "Do you want to log in or order as a guest?",
        type: "list",
        choices: [{
            name: "Login or create account", value: true
        },{
            name: "Continue as guest", value: false
        }]
    }).then(answer => answer.login ? loginOrCreateAccount() : continueAsGuest());
}

// Function to run if customer declines to place an order
function dontPlaceOrder() {
    console.log("\nThanks anyways.");
    connection.end((error) => {if (error) console.error(error)});
}

function loginOrCreateAccount() {
    inquirer.prompt({
        name: "hasAccount",
        message: "Do you want to use an existing account or create a new one?",
        type: "list",
        choices: [{
            name: "Login with existing account", value: true
        },{
            name: "Create a new account", value: false
        }]
    }).then(answer => answer.hasAccount ? login() : createAccount());
}

function continueAsGuest() {
    inquirer.prompt({
        name: "name",
        message: "Enter a name to identify your order."
    }).then(answer => {
        thisOrder.customer.name = answer.name;
        placeOrder();
    });
}

function login() {
    inquirer.prompt([{
        name: "username",
        message: "Enter your user name:"
    },{
        name: "password",
        type: "password",
        message: "Enter your password"
    }]).then(answers => {
        connection.query("SELECT * FROM customers WHERE login_name = ? AND login_password = ?", [answers.username, answers.password], (error, results) => {
            if (error) {
                console.error("There was an error checking the database.");
                console.error(error);
                loginTryAgain();
            }
            else if(results.length < 1) {
                console.log("Sorry that user name and password don't match our records.");
                loginTryAgain();
            }
            else {
                thisOrder.customer.username = results[0].login_name;
                thisOrder.customer.name = results[0].customer_name;
                console.log(`\nWelcome back ${thisOrder.customer.name}!`);
                placeOrder();
            }
        });
    })
}

function createAccount() {
    inquirer.prompt({
        name: "username",
        message: "Create you user name:"
    }).then(answer => {
        connection.query("SELECT * FROM customers WHERE login_name = ?", answer.username, (error, results) => {
            if (error) return console.error(error);
            if (results.length > 0) {
                console.log("Sorry, that user name is already taken.");
                loginTryAgain();
            }
            else {
                thisOrder.customer.username = answer.username;
                inquirer.prompt([{
                    name: "password",
                    type: "password",
                    message: "Enter your password."
                },{
                    name: "name",
                    message: "What's your name?"
                }]).then(answers => {
                    thisOrder.customer.password = answers.password;
                    thisOrder.customer.name = answers.name;
                    saveNewCustomer();
                    console.log("Your account was created!");
                    placeOrder();
                });
            }
        });
    })
}

function loginTryAgain() {
    inquirer.prompt({
        name: "continue",
        message: "What do you want to do?",
        type: "list",
        choices: ["Login", "Create a new account", "Cancel purchase"]
    }).then(answers => {
        if (answers.continue === "Try again") return login();
        return (answers.continue === "Cancel purchase") ? dontPlaceOrder() : createAccount();
    });
}

function saveNewCustomer() {
    let customer = thisOrder.customer;
    connection.query("INSERT INTO customers SET ?", {
        customer_name: customer.name,
        login_name: customer.username,
        login_password: customer.password
    });
}

// Function to take customer order
function placeOrder() {
    console.log("");
    inquirer.prompt([{
        name: "item",
        message: "Select the item you wish to order.",
        type: "list",
        choices: inventory.map(item => ({
            name: `${item.item_id} -- ${item.product_name}`,
            value: item
        }))
    }, {
        name: "quantity",
        message: "How many units would you like?",
        validate: (answer) => {
            const invalidAnswerMessage = "Quantity must be a positive whole number.";
            if (isNaN(answer)) return invalidAnswerMessage;
            const numericAnswer = parseFloat(answer);
            if (!Number.isInteger(numericAnswer) || numericAnswer < 1) return invalidAnswerMessage;
            return true;
        }
    }]).then((answers) => {
        let chosenItem = answers.item;
        const orderQuantity = parseInt(answers.quantity);
        updateItemThen(chosenItem, verifyOrderQuantity, orderQuantity);
    });
}

function updateItemThen(item, callback, callbackParam2) {
    // Grab updated item info from database
    connection.query("SELECT * FROM products WHERE ?", { item_id: item.item_id }, function(error, results) {
        if (error) return console.error(error);
        const updatedItem = results[0];
        updatedItem.price = updatedItem.price.toFixed(2);
        return callbackParam2 ? callback(updatedItem, callbackParam2) : callback(updatedItem);
    });
}

// Function to check DB to see if there is enough of item to complete order and continue accordingly
function verifyOrderQuantity(item, orderQuantity) {
    const stockQuantity = item.stock_quantity;
    return (orderQuantity > stockQuantity) ? insufficientQuantity(item) : completeOrder(item, orderQuantity);
}

function insufficientQuantity(item) {
    console.log(`Sorry, we only have ${item.stock_quantity} units in stock currently.`);
    inquirer.prompt({
        name: "continue",
        message: "Would you like to order a different amount?",
        type: "confirm"
    }).then(answer => answer.continue ? updateItemThen(item, reselectQuantity) : offerDifferentProduct());
}

function reselectQuantity(item) {
    let choicesArray = ["Cancel Order"];
    for (i = 1; i < item.stock_quantity + 1; i++) {
        choicesArray.push(i.toString());
    }
    inquirer.prompt({
        name: "quantity",
        message: `How many units of "${item.product_name}" would you like to purchase (@ $${item.price.toFixed(2)}/unit)?`,
        type: "list",
        choices: choicesArray
    }).then(answer => answer.quantity === "Cancel Order" ? offerDifferentProduct() : updateItemThen(item, verifyOrderQuantity, answer.quantity))
}

function completeOrder(item, orderQuantity) {
    console.log(`\nOrdering ${orderQuantity} units of "${item.product_name}"...`);
    item.stock_quantity = item.stock_quantity - orderQuantity;
    const orderPrice = (orderQuantity * item.price).toFixed(2);
    connection.query("UPDATE products SET ? WHERE ?", [
        {
            stock_quantity: item.stock_quantity
        },{
            item_id: item.item_id
        }
    ], function (error) {
        if (error) return console.error("Oops, something went wrong...\n" + error);
        console.log(`\nYour order is complete:\n  ${orderQuantity} units of "${item.product_name}"`);
        console.log(`    @ $ ${item.price}/unit\n  Total cost: $ ${orderPrice}`);
        console.log(`  ${moment().format("MM-DD-YY, hh:MM a")}`);
    });
}

function offerDifferentProduct() {
    console.log("offer diff. prod. ...");
}