// Require the node modules needed for the app.
const mysql = require("mysql");
const inquirer = require("inquirer");
const columnify = require("columnify");
const chalk = require("chalk");
const dotenv = require("dotenv").config();
const moment = require("moment");

// Global variables
let inventory, user;
let ordersFromThisSession = [];

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
    getInventoryThen(() => {
        displayInventory();
        console.log("You'll need to log in if you want to place an order.\n");
        userSelectFirstAction();
    });
});

function getInventoryThen(callback) {
    // Query database (using 'mysql' module) for current inventory.
    connection.query("SELECT item_id, product_name, department_name, price, available_quantity FROM products", (error, results) => {
        if (error) return console.error(error);
        inventory = [];
        results.forEach(value => {
            inventory.push({
                "Item ID": value.item_id,
                "Product Name": value.product_name,
                Price: value.price.toFixed(2),
                Available: value.available_quantity,
                Department: value.department_name
            });
        });
        callback();
    });
}

function displayInventory() {
    // Create copy of inventory array with property values of unavailable items grayed out with 'chalk'.
    let grayedInventory = inventory.map(item => {
        let result = {};
        if (item.Available < 1) {
            for (let key in item) {
                result[key] = chalk.gray(item[key]);
            }
        }
        else {
            for (let key in item) {
                result[key] = item[key];
            }
        }
        return result;
    });
    // Print inventory to console.
    console.log((chalk.bold("\nCurrent Inventory:\n\n") + columnify(grayedInventory, {
        // Specify 'columnify' package options.
        columnSplitter: " | ",
        // This option orders the columns.
        columns: ["Item ID", "Product Name", "Price", "Available", "Department"],
        // Align numeric data to the right for consistent decimal alignment
        config: {
            "Item ID": { headingTransform: inventoryHeadingTransform },
            "Product Name": { headingTransform: inventoryHeadingTransform },
            Price: { align: "right", headingTransform: inventoryHeadingTransform },
            Available: { align: "right", headingTransform: inventoryHeadingTransform },
            Department: { headingTransform: inventoryHeadingTransform }
        }
    }) + "\n"));
}

function userSelectFirstAction() {
    inquirer.prompt({
        name: "action",
        message: chalk.green("What would you like to do?"),
        type: "list",
        choices: ["Sign in", "Create a new account", "Exit"]
    }).then(answer => {
        if (answer.action === "Sign in") return login();
        if (answer.action == "Create a new account") return createAccount();
        thanksBye();
    });
}

function inventoryHeadingTransform(heading) {
    return chalk.underline(heading);
}

function login() {
    console.log("");
    inquirer.prompt([{
        name: "username",
        message: chalk.green("Enter your user name:")
    },{
        name: "password",
        type: "password",
        message: chalk.green("Enter your password")
    }]).then(answers => {
        connection.query("SELECT * FROM customers WHERE username = ? AND user_password = ?", [answers.username, answers.password], (error, results) => {
            if (error) return console.error(error);
            if (results.length < 1) {
                console.log(chalk.red("Sorry that user name and password don't match our records."));
                loginTryAgain();
            }
            else {
                user = {
                    username: results[0].username,
                    userId: results[0].customer_id
                };
                console.log(chalk.magenta("\nWelcome back " + chalk.bold(user.username) + "!"));
                mainMenu();
            }
        });
    });
}

function createAccount() {
    console.log("");
    inquirer.prompt({
        name: "username",
        message: chalk.green("Enter user name:")
    }).then((answer) => {
        connection.query("SELECT * FROM customers WHERE username = ?", answer.username, (error, results) => {
            if (error) return console.error(error);
            if (results.length > 0) {
                console.log(chalk.red("Sorry, that user name is already taken."));
                loginTryAgain();
            }
            else {
                user = { username: answer.username };
                userSetPassword();
            }
        });
    });
}

function thanksBye() {
    console.log(chalk.magenta("\nThank you! Goodbye."));
    connection.end();
}

function loginTryAgain() {
    console.log("");
    inquirer.prompt({
        name: "continue",
        message: chalk.green("What would you like to do?"),
        type: "list",
        choices: ["Sign in with existing account", "Create a new account", "Exit"]
    }).then(answer => {
        if (answer.continue === "Sign in with existing account") return login();
        if (answer.continue === "Create a new account") return createAccount();
        thanksBye();
    });
}

const BAMAZON = chalk.bgBlue.yellow("Bamazon");

function userSetPassword() {
    inquirer.prompt([{
        name: "password",
        type: "password",
        message: chalk.green("Enter password:")
    },{
        name: "confirm",
        type: "password",
        message: chalk.green("Confirm password:")
    }]).then(answers => {
        if (answers.password !== answers.confirm) {
            console.log(chalk.red("The passwords you entered didn't match.") + "\nPlease try again.");
            userSetPassword();
        }
        else {
            connection.query("INSERT INTO customers SET ?",
                {
                    username: user.username,
                    user_password: answers.password
                },
                (error, results) => {
                    if (error) return console.error(error);
                    console.log(chalk.magenta(`\nWelcome to ${BAMAZON}, ` + chalk.bold(user.username) + "!"));
                    user.userId = results.insertId;
                    mainMenu();
                }
            );
        }
    });
}

// MAIN MENU
function mainMenu() {
    console.log("");
    console.log(chalk.gray.underline(" MAIN MENU  "))
    inquirer.prompt({
        name: "action",
        message: chalk.green("What would you like to do?"),
        type: "list",
        choices: ["Place an order", "View order history", "View inventory", "Exit"]
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

// PLACE ORDER
function placeOrder() {
    console.log("");
    inquirer.prompt([{
        name: "item",
        message: chalk.green("Select the item you wish to order."),
        type: "list",
        choices: inventory.map(item => ({
            name: `${item["Item ID"]} -- ${item["Product Name"]}`,
            value: item
        }))
    }, {
        name: "quantity",
        message: chalk.green("How many units would you like?"),
        validate: (answer) => {
            const invalidAnswerMessage = chalk.red("Quantity must be a positive whole number.");
            if (isNaN(answer)) return invalidAnswerMessage;
            const numericAnswer = parseFloat(answer);
            if (!Number.isInteger(numericAnswer) || numericAnswer < 1) return invalidAnswerMessage;
            return true;
        }
    }]).then((answers) => updateItemThen(verifyOrderQuantity, answers.item, answers.quantity));
}

function updateItemThen(callback, item, quantity) {
    connection.query("SELECT * FROM products WHERE ?",
        { item_id: item["Item ID"] },
        function(error, results) {
            if (error) return console.error(error);
            const oldPrice = item.Price;
            item.Price = results[0].price.toFixed(2);
            item.Available = results[0].available_quantity;
            item.holdQuantity = results[0].hold_quantity;
            // Alert the user if the price has changed and ask if they want to continue
            if (item.Price !== oldPrice) {
                console.log(chalk.yellow("\nThe sale price of the product you are trying to purchase has changed."));
                console.log(chalk.yellow(`The price is now $${chalk.bold(item.Price)} per unit.`))
                console.log(BAMAZON + " apologizes for any inconvenience this may have caused.");
                const question = "Do you want to continue with your purchase";
                question += quantity ? ` of ${quantity} units of ${item["Product Name"]} for $${(quantity * item.Price).toFixed(2)}?` : "?";
                inquirer.prompt({
                    name: "continue",
                    type: "confirm",
                    message: chalk.green(question)
                }).then(answer => answer.continue ? callback(item, quantity) : mainMenu());
            }
            else callback(item, quantity);
        }
    );
}

function verifyOrderQuantity(item, quantity, hasPriceChanged) {
    return (quantity > item.Available) ? insufficientQuantity(item) : completeOrder(item, quantity);
}


function insufficientQuantity(item) {
    console.log(chalk.red(`Sorry, we only have ${item.Available} units in stock currently.\n`));
    inquirer.prompt({
        name: "continue",
        message: chalk.green("Would you like to order a different amount?"),
        type: "confirm"
    }).then(answer => answer.continue ? updateItemThen(reselectQuantity, item) : mainMenu());
}

function reselectQuantity(item) {
    let choicesArray = ["Cancel Order"];
    for (i = 1; i < item.Available + 1; i++) {
        choicesArray.push(i.toString());
    }
    inquirer.prompt({
        name: "quantity",
        message: chalk.green(`How many units of "${item["Product Name"]}" would you like to purchase?\n    (@ $${item.Price}/unit)`),
        type: "list",
        choices: choicesArray
    }).then(answer => answer.quantity === "Cancel Order" ? mainMenu() : updateItemThen(verifyOrderQuantity, item, parseInt(answer.quantity)));
}

function completeOrder(item, orderQuantity) {
    console.log("");
    const itemName = item["Product Name"];
    const itemPrice = item.Price;
    // console.log(`\nOrdering ${orderQuantity} units of "${itemName}"...`);
    item.Available -= orderQuantity;
    item.holdQuantity = parseInt(item.holdQuantity) + orderQuantity;
    const orderPrice = (orderQuantity * itemPrice).toFixed(2);
    connection.query("UPDATE products SET ? WHERE ?", [
        {
            available_quantity: item.Available,
            hold_quantity: item.holdQuantity
        },{
            item_id: item["Item ID"]
        }
    ], function (error) {
        if (error) return console.error(error);
        const orderTime = moment().format("MM-DD-YY, hh:mm a");
        connection.query("INSERT INTO orders SET ?",
            {
                item_id: item["Item ID"],
                customer_id: user.userId,
                quantity: orderQuantity,
                order_price: orderPrice,
                order_time: orderTime
            },
            (error, results) => {
                if (error) return console.error(error);
                ordersFromThisSession.push(results.insertId);
                console.log(orderInfoString(orderTime, orderQuantity, itemName, itemPrice, orderPrice, results.insertId));
                pressEnterToContinue();
            }
        );
    });
}

function pressEnterToContinue() {
    inquirer.prompt({
        message: chalk.green("Press 'Enter' to continue..."),
        name: "continue"
    }).then(() => mainMenu());
}

function orderInfoString(time, quantity, productName, productUnitPrice, orderPrice, orderId) {
    const headAndFoot = chalk.yellow.underline.bgBlue("_ ".repeat(40)) + "\n";
    return chalk.yellow(headAndFoot + "\n  ORDER COMPLETE" + " ".repeat(42) +
` ${time}

   ${quantity} units of "${productName}"  @ $${productUnitPrice}/unit
  -------
  $ ${chalk.bold(orderPrice)}` + " ".repeat(50) + `[Order ID = ${orderId}]
  -------
` + headAndFoot + "\n");
}

// VIEW ORDERS
function viewOrders() {
    console.log("");
    inquirer.prompt({
        name: "choice",
        message: chalk.green("Which orders do you want to see?"),
        type: "list",
        choices: ["All orders", "Orders from this session", "Unpaid orders", "Orders that haven't shipped yet", "Cancel"]
    }).then(answer => answer.choice === "Cancel" ? mainMenu() : getOrders(answer.choice));
}

function getOrders(filter) {
    connection.query("SELECT * FROM orders WHERE ?",
        { customer_id: user.userId },
        (error, results) => {
            if (error) return console.error(error);
            let orders = [];
            results.forEach(order => {
                const product = inventory.filter(product => product["Item ID"] === order.item_id)[0];
                orders.push({
                    "Order ID": order.order_id,
                    Product: product["Product Name"],
                    Quantity: order.quantity,
                    Total: order.order_price.toFixed(2),
                    "Time Ordered": order.order_time,
                    Paid: order.paid === "0" ? "Not Paid" : order.paid,
                    Shipped: order.shipped === "0" ? "Not Shipped" : order.shipped
                });
            });
            displayOrders(filterOrdersBy(filter, orders));
            pressEnterToContinue();
        }
    );
}

function displayOrders(orders) {
    console.log("\n" + columnify(orders, {
        // Specify 'columnify' package options.
        columnSplitter: " | ",
        // This option orders the columns.
        columns: ["Order ID", "Product", "Quantity", "Total", "Time Ordered", "Paid", "Shipped"],
        // Align numeric data to the right for consistent decimal alignment
        config: {
            "Order ID": { headingTransform: inventoryHeadingTransform },
            Product: { headingTransform: inventoryHeadingTransform },
            Quantity: { align: "right", headingTransform: inventoryHeadingTransform },
            Total: { align: "right", headingTransform: inventoryHeadingTransform },
            "Time Ordered": { headingTransform: inventoryHeadingTransform },
            Paid: { headingTransform: inventoryHeadingTransform },
            Shipped: { headingTransform: inventoryHeadingTransform }
        }
    }) + "\n");
}

function filterOrdersBy(filter, orders) {
    if (filter === "All orders") return orders;
    if (filter === "Orders from this session") return orders.filter(order => ordersFromThisSession.indexOf(order["Order ID"]) > -1);
    if (filter === "Unpaid orders") return orders.filter(order => order.Paid === "Not Paid");
    return orders.filter(order => order.Shipped === "Not Shipped");
}